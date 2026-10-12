/**
 * Sentinel 2.0 — Backend Tool Gateway
 *
 * Enforces Sentinel's decision pipeline before executing any protected simulated tool.
 * Gemini and external agents NEVER have direct execution authority.
 *
 * Pipeline:
 * External Agent / Gemini
 *   ↓
 * Sentinel Tool Gateway
 *   ↓
 * Action Ingestion (Authn, Authz, Trajectory, Risk, Intervention)
 *   ↓
 * Decision Engine (ALLOW / MONITOR / WARN / CONFIRM / BLOCK)
 *   ↓
 * Execution Gate:
 *   - ALLOW: execute tool
 *   - MONITOR: execute tool + record telemetry
 *   - WARN: execute tool + warning audit
 *   - CONFIRM: DO NOT execute tool → hold for human review
 *   - BLOCK: STRICTLY DO NOT execute tool → return structured block response
 */

import { ActionType, ActionSensitivity, ActionReversibility, PolicyDecisionAction } from '@sentinel/shared';
import { simulatedCustomerStore, SimulatedCustomerStore, CustomerRecord, OrderRecord, AdminAccessRecord } from './customer-store.js';
import { actionIngestionService, ActionIngestionService } from '../actions/service.js';
import { auditService, AuditService } from '../audit/service.js';
import { agentService, AgentService } from '../agents/service.js';
import { sessionService, SessionService } from '../sessions/service.js';
import { BadRequestError, NotFoundError, ThrottledError } from '../../middleware/errorHandler.js';

export type ProtectedToolName =
  | 'get_customer'
  | 'get_order'
  | 'update_order'
  | 'issue_refund'
  | 'request_admin_access'
  | 'export_customer_data'
  | 'delete_customer';

export type ToolExecutionState =
  | 'SUCCESS'
  | 'WAITING_FOR_HUMAN_APPROVAL'
  | 'BLOCKED_NOT_EXECUTED'
  | 'DENIED_NOT_EXECUTED';

export interface ToolActionMapping {
  action: ActionType;
  resource: string;
  resourceType: string;
  scope: string;
  sensitivity: ActionSensitivity;
  reversibility: ActionReversibility;
  reason: string;
}

export interface ToolExecutionRequest {
  agentId: string;
  sessionId: string;
  tool: ProtectedToolName;
  params?: Record<string, unknown>;
}

export interface ToolExecutionResult {
  decision: PolicyDecisionAction;
  executed: boolean;
  action: string;
  tool: ProtectedToolName;
  riskScore: number;
  reasonCodes: string[];
  sessionId: string;
  toolExecutionState: ToolExecutionState;
  toolResult?: unknown;
  pendingInterventionId?: string;
  preventionProof?: string;
  timestamp: string;
  spamSignals?: import('@sentinel/shared').SpamSignals;
}

export interface PendingToolExecution {
  id: string;
  agentId: string;
  sessionId: string;
  tool: ProtectedToolName;
  params?: Record<string, unknown>;
  pendingInterventionId?: string;
  createdAt: string;
}

export class ToolGateway {
  private customerStore: SimulatedCustomerStore;
  private ingestionService: ActionIngestionService;
  private audit: AuditService;
  private agents: AgentService;
  private sessions: SessionService;

  // Holds pending tool executions awaiting human confirmation
  private pendingExecutions: Map<string, PendingToolExecution> = new Map();

  constructor(
    customerStore: SimulatedCustomerStore = simulatedCustomerStore,
    ingestionService: ActionIngestionService = actionIngestionService,
    audit: AuditService = auditService,
    agents: AgentService = agentService,
    sessions: SessionService = sessionService
  ) {
    this.customerStore = customerStore;
    this.ingestionService = ingestionService;
    this.audit = audit;
    this.agents = agents;
    this.sessions = sessions;
  }

  /**
   * Translates protected tool operation into Sentinel action parameters
   */
  public mapToolToAction(tool: ProtectedToolName, params?: Record<string, unknown>): ToolActionMapping {
    switch (tool) {
      case 'get_customer': {
        const customerId = (params?.customerId as string) || 'CUST-001';
        return {
          action: 'READ',
          resource: `customer://${customerId}`,
          resourceType: 'customer_record',
          scope: 'customer.read',
          sensitivity: 'LOW',
          reversibility: 'REVERSIBLE',
          reason: 'Retrieving customer profile record to assist with support inquiry'
        };
      }
      case 'get_order': {
        const orderId = (params?.orderId as string) || 'ORD-1001';
        return {
          action: 'READ',
          resource: `order://${orderId}`,
          resourceType: 'order_record',
          scope: 'order.read',
          sensitivity: 'LOW',
          reversibility: 'REVERSIBLE',
          reason: 'Retrieving customer order details to verify shipment status'
        };
      }
      case 'update_order': {
        const orderId = (params?.orderId as string) || 'ORD-1001';
        return {
          action: 'UPDATE',
          resource: `order://${orderId}`,
          resourceType: 'order_record',
          scope: 'order.write',
          sensitivity: 'MEDIUM',
          reversibility: 'REVERSIBLE',
          reason: 'Updating order shipment notes or status per customer request'
        };
      }
      case 'issue_refund': {
        const orderId = (params?.orderId as string) || 'ORD-1001';
        return {
          action: 'EXECUTE',
          resource: `finance://refund/${orderId}`,
          resourceType: 'financial_transaction',
          scope: 'finance.refund',
          sensitivity: 'HIGH',
          reversibility: 'REVERSIBLE',
          reason: 'Issuing automated payment refund disbursement for customer order'
        };
      }
      case 'request_admin_access': {
        const role = (params?.targetRole as string) || 'support-supervisor';
        return {
          action: 'EXTERNAL_REQUEST',
          resource: `iam://role/${role}`,
          resourceType: 'iam_role',
          scope: 'admin.escalate',
          sensitivity: 'HIGH',
          reversibility: 'REVERSIBLE',
          reason: 'Requesting supervisor elevation for complex account investigation'
        };
      }
      case 'export_customer_data': {
        return {
          action: 'EXPORT',
          resource: 'vault://sensitive/customer-pii-dump.tar',
          resourceType: 'sensitive_vault',
          scope: 'vault.export',
          sensitivity: 'HIGH',
          reversibility: 'REVERSIBLE',
          reason: 'Attempting bulk download of customer PII credentials without authorization'
        };
      }
      case 'delete_customer': {
        const customerId = (params?.customerId as string) || 'CUST-001';
        return {
          action: 'DELETE',
          resource: `customer://${customerId}`,
          resourceType: 'customer_record',
          scope: 'customer.delete',
          sensitivity: 'CRITICAL',
          reversibility: 'IRREVERSIBLE',
          reason: 'Attempting destructive permanent deletion of customer profile'
        };
      }
      default:
        throw new BadRequestError(`Unsupported tool operation: '${tool}'`);
    }
  }

  /**
   * Primary Entry Point: Evaluates tool request through Sentinel runtime and gates execution
   */
  public async executeToolRequest(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const { agentId, sessionId, tool, params } = request;

    if (!tool) {
      throw new BadRequestError("Protected 'tool' identifier is required");
    }

    // 1. Map tool request to Sentinel action metadata
    const actionMapping = this.mapToolToAction(tool, params);

    // 2. Sentinel Ingestion Gate: Authentication, Authorization, Trajectory, Risk, Intervention
    let ingestResult: import('@sentinel/shared').IngestActionResult;
    try {
      ingestResult = await this.ingestionService.ingestAction({
        agentId,
        sessionId,
        action: actionMapping.action,
        resource: actionMapping.resource,
        resourceType: actionMapping.resourceType,
        scope: actionMapping.scope,
        sensitivity: actionMapping.sensitivity,
        reversibility: actionMapping.reversibility,
        metadata: {
          tool,
          toolParams: params || {},
          agentReason: actionMapping.reason
        }
      });
    } catch (err) {
      if (err instanceof ThrottledError) {
        const timestamp = new Date().toISOString();
        const throttledResult: ToolExecutionResult = {
          decision: 'BLOCK',
          executed: false,
          action: tool,
          tool,
          riskScore: 100,
          reasonCodes: ['RATE_LIMIT_EXCEEDED', 'Sentinel rate limiting prevented tool execution.'],
          sessionId,
          toolExecutionState: 'BLOCKED_NOT_EXECUTED',
          toolResult: null,
          preventionProof: 'Sentinel rate limiting prevented this tool execution.',
          timestamp,
          spamSignals: {
            burstDetected: false,
            requestRate: 0,
            threshold: 0,
            duplicateDetected: false,
            duplicateCount: 0,
            rateLimitExceeded: true,
            windowMs: 0,
            status: 'THROTTLED'
          }
        };

        await this.audit.logEvent({
          eventType: 'TOOL_EXECUTION_BLOCKED',
          entityType: 'tool',
          entityId: tool,
          sessionId,
          actor: agentId,
          payload: {
            timestamp,
            agent: agentId,
            session: sessionId,
            requestedAction: tool,
            resource: actionMapping.resource,
            decision: 'BLOCK',
            riskScore: 100,
            interventionState: 'CRITICAL',
            humanApprovalState: 'NOT_APPLICABLE',
            executionResult: null,
            executed: false,
            reasonCodes: ['RATE_LIMIT_EXCEEDED'],
            preventionProof: 'Sentinel rate limiting prevented this tool execution.'
          }
        });

        return throttledResult;
      }
      throw err;
    }

    const { event, decision } = ingestResult;
    const riskScore = Number(event.metadata?.risk ?? 0);
    const trajectoryDeviation = Number(event.metadata?.trajectoryDeviation ?? 0);
    const interventionWindow = String(event.metadata?.interventionWindow ?? 'SAFE');
    const spamSignals = event.metadata?.spamSignals as import('@sentinel/shared').SpamSignals | undefined;
    const timestamp = new Date().toISOString();

    // 3. Execution Gating based on Sentinel Decision
    if (decision.action === 'BLOCK') {
      // STRICT ENFORCEMENT: Tool MUST NOT execute
      const blockResult: ToolExecutionResult = {
        decision: 'BLOCK',
        executed: false,
        action: tool,
        tool,
        riskScore,
        reasonCodes: decision.reason,
        sessionId,
        toolExecutionState: 'BLOCKED_NOT_EXECUTED',
        toolResult: null,
        preventionProof: 'Sentinel prevented this action.',
        timestamp,
        spamSignals
      };

      // Record audit proof of prevention
      await this.audit.logEvent({
        eventType: 'TOOL_EXECUTION_BLOCKED',
        entityType: 'tool',
        entityId: tool,
        sessionId,
        actor: agentId,
        payload: {
          timestamp,
          agent: agentId,
          session: sessionId,
          requestedAction: tool,
          resource: actionMapping.resource,
          decision: 'BLOCK',
          riskScore,
          interventionState: interventionWindow,
          humanApprovalState: 'NOT_APPLICABLE',
          executionResult: null,
          executed: false,
          reasonCodes: decision.reason,
          preventionProof: 'Sentinel prevented this action.'
        }
      });

      return blockResult;
    }

    if (decision.action === 'CONFIRM') {
      // Tool execution MUST WAIT for human review
      const pendingInterventionId = event.metadata?.pendingInterventionId as string | undefined;

      this.pendingExecutions.set(sessionId, {
        id: `pend_${Date.now()}`,
        agentId,
        sessionId,
        tool,
        params,
        pendingInterventionId,
        createdAt: timestamp
      });

      const confirmResult: ToolExecutionResult = {
        decision: 'CONFIRM',
        executed: false,
        action: tool,
        tool,
        riskScore,
        reasonCodes: decision.reason,
        sessionId,
        toolExecutionState: 'WAITING_FOR_HUMAN_APPROVAL',
        toolResult: null,
        pendingInterventionId,
        timestamp,
        spamSignals
      };

      await this.audit.logEvent({
        eventType: 'TOOL_EXECUTION_HELD',
        entityType: 'tool',
        entityId: tool,
        sessionId,
        actor: agentId,
        payload: {
          timestamp,
          agent: agentId,
          session: sessionId,
          requestedAction: tool,
          resource: actionMapping.resource,
          decision: 'CONFIRM',
          riskScore,
          interventionState: interventionWindow,
          humanApprovalState: 'AWAITING_REVIEW',
          pendingInterventionId,
          executionResult: null,
          executed: false,
          reasonCodes: decision.reason,
          preventionProof: 'Execution paused awaiting human review.'
        }
      });

      return confirmResult;
    }

    // 4. ALLOW, MONITOR, WARN: Execute the simulated customer tool
    let toolResult: unknown;
    try {
      toolResult = this.dispatchSimulatedTool(tool, params, agentId);
    } catch (err) {
      toolResult = { error: (err as Error).message };
    }

    const executionResult: ToolExecutionResult = {
      decision: decision.action,
      executed: true,
      action: tool,
      tool,
      riskScore,
      reasonCodes: decision.reason,
      sessionId,
      toolExecutionState: 'SUCCESS',
      toolResult,
      timestamp,
      spamSignals
    };

    // Audit tool execution with telemetry
    const isMonitored = decision.action === 'MONITOR';
    await this.audit.logEvent({
      eventType: isMonitored ? 'TOOL_EXECUTION_MONITORED' : 'TOOL_EXECUTION_COMPLETED',
      entityType: 'tool',
      entityId: tool,
      sessionId,
      actor: agentId,
      payload: {
        timestamp,
        agent: agentId,
        session: sessionId,
        requestedAction: tool,
        resource: actionMapping.resource,
        decision: decision.action,
        riskScore,
        trajectoryDeviation,
        interventionState: interventionWindow,
        humanApprovalState: 'APPROVED_AUTOMATICALLY',
        executionResult: toolResult,
        executed: true,
        telemetryRecorded: isMonitored,
        reasonCodes: decision.reason
      }
    });

    return executionResult;
  }

  /**
   * Resumes and executes a held tool once human review submits an ALLOW_ONCE or DENY decision
   */
  public async executePendingTool(
    sessionId: string,
    humanDecision: 'ALLOW_ONCE' | 'DENY' | 'REVOKE_SESSION',
    reviewerId = 'security-operator',
    reason = 'Human operator review completed'
  ): Promise<ToolExecutionResult> {
    const pending = this.pendingExecutions.get(sessionId);
    if (!pending) {
      throw new NotFoundError(`No pending tool execution awaiting review for session '${sessionId}'`);
    }

    this.pendingExecutions.delete(sessionId);
    const timestamp = new Date().toISOString();

    if (humanDecision === 'ALLOW_ONCE') {
      // Execute the held tool
      let toolResult: unknown;
      try {
        toolResult = this.dispatchSimulatedTool(pending.tool, pending.params, pending.agentId);
      } catch (err) {
        toolResult = { error: (err as Error).message };
      }

      const result: ToolExecutionResult = {
        decision: 'ALLOW',
        executed: true,
        action: pending.tool,
        tool: pending.tool,
        riskScore: 0,
        reasonCodes: [`Approved by human reviewer: ${reviewerId} (${reason})`],
        sessionId,
        toolExecutionState: 'SUCCESS',
        toolResult,
        timestamp
      };

      await this.audit.logEvent({
        eventType: 'TOOL_EXECUTED_AFTER_APPROVAL',
        entityType: 'tool',
        entityId: pending.tool,
        sessionId,
        actor: reviewerId,
        payload: {
          timestamp,
          agent: pending.agentId,
          session: sessionId,
          requestedAction: pending.tool,
          decision: 'ALLOW_ONCE',
          humanApprovalState: 'APPROVED',
          reviewerId,
          reason,
          executionResult: toolResult,
          executed: true
        }
      });

      return result;
    }

    // DENY or REVOKE_SESSION: Tool MUST NOT execute
    const deniedResult: ToolExecutionResult = {
      decision: 'BLOCK',
      executed: false,
      action: pending.tool,
      tool: pending.tool,
      riskScore: 0,
      reasonCodes: [`Denied by human reviewer: ${reviewerId} (${reason})`],
      sessionId,
      toolExecutionState: 'DENIED_NOT_EXECUTED',
      toolResult: null,
      preventionProof: 'Sentinel prevented this action via operator rejection.',
      timestamp
    };

    await this.audit.logEvent({
      eventType: 'TOOL_EXECUTION_DENIED',
      entityType: 'tool',
      entityId: pending.tool,
      sessionId,
      actor: reviewerId,
      payload: {
        timestamp,
        agent: pending.agentId,
        session: sessionId,
        requestedAction: pending.tool,
        decision: humanDecision,
        humanApprovalState: 'REJECTED',
        reviewerId,
        reason,
        executionResult: null,
        executed: false,
        preventionProof: 'Sentinel prevented this action via operator rejection.'
      }
    });

    return deniedResult;
  }

  /**
   * Checks whether a session has a pending tool execution
   */
  public getPendingExecution(sessionId: string): PendingToolExecution | null {
    const pend = this.pendingExecutions.get(sessionId);
    return pend ? { ...pend } : null;
  }

  /**
   * Internal Safe Dispatch: Executes in-memory customer tool
   * Private to ensure external actors cannot invoke tools directly without Sentinel gating
   */
  private dispatchSimulatedTool(tool: ProtectedToolName, params?: Record<string, unknown>, agentId = 'unknown-agent'): unknown {
    switch (tool) {
      case 'get_customer': {
        const id = (params?.customerId as string) || 'CUST-001';
        const customer = this.customerStore.getCustomer(id);
        if (!customer) throw new NotFoundError(`Customer '${id}' not found`);
        return customer;
      }
      case 'get_order': {
        const id = (params?.orderId as string) || 'ORD-1001';
        const order = this.customerStore.getOrder(id);
        if (!order) throw new NotFoundError(`Order '${id}' not found`);
        return order;
      }
      case 'update_order': {
        const id = (params?.orderId as string) || 'ORD-1001';
        const notes = (params?.notes as string) || 'Customer requested shipping address confirmation.';
        const status = params?.status as OrderRecord['status'] | undefined;
        return this.customerStore.updateOrder(id, { notes, status });
      }
      case 'issue_refund': {
        const id = (params?.orderId as string) || 'ORD-1001';
        const amount = typeof params?.amount === 'number' ? params.amount : undefined;
        const reason = (params?.reason as string) || 'Customer satisfied return policy conditions';
        return this.customerStore.issueRefund(id, amount, reason);
      }
      case 'request_admin_access': {
        const role = (params?.targetRole as string) || 'support-supervisor';
        const justification = (params?.justification as string) || 'Need supervisor override to process account ticket';
        return this.customerStore.requestAdminAccess(agentId, role, justification);
      }
      case 'export_customer_data': {
        return {
          exported: false,
          error: 'Bulk export unauthorized'
        };
      }
      case 'delete_customer': {
        const id = (params?.customerId as string) || 'CUST-001';
        return this.customerStore.deleteCustomer(id);
      }
      default:
        throw new BadRequestError(`Unknown tool '${tool}'`);
    }
  }
}

export const toolGateway = new ToolGateway();
