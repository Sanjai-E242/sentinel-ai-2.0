/**
 * Sentinel 2.0 — External AI Agent Gateway & Controller
 *
 * Coordinates external agent providers with Sentinel's runtime control layer.
 * Enforces Sentinel as the absolute enforcement authority.
 */

import {
  ExternalAgentProvider,
  ProposedAction,
  AgentTaskContext,
  GeminiScenarioId,
  ControlledStepResult,
  ControlledSessionRunResult,
  ProviderStatus
} from './types.js';
import { GeminiAgentProvider } from './providers/gemini.provider.js';
import { MockAgentProvider } from './providers/mock.provider.js';
import { agentService } from '../agents/service.js';
import { sessionService } from '../sessions/service.js';
import { actionIngestionService } from '../actions/service.js';
import { interventionService } from '../intervention/service.js';
import { toolGateway, ProtectedToolName } from '../tools/gateway.js';
import { Agent, Session, PolicyDecisionAction } from '@sentinel/shared';

interface ActiveSessionRecord {
  agent: Agent;
  session: Session;
  scenarioId?: GeminiScenarioId;
  taskPrompt: string;
  provider: ExternalAgentProvider;
  stepIndex: number;
  history: Array<{
    step: number;
    action: ProposedAction;
    decision: PolicyDecisionAction;
    decisionReasons: string[];
    risk: number;
    trajectoryDeviation: number;
    humanDecision?: string;
  }>;
  stepResults: ControlledStepResult[];
  halted: boolean;
  paused: boolean;
  pendingInterventionId?: string;
}

export class ExternalAgentGateway {
  private geminiProvider: GeminiAgentProvider;
  private mockProvider: MockAgentProvider;
  private sessions: Map<string, ActiveSessionRecord> = new Map();

  constructor() {
    this.geminiProvider = new GeminiAgentProvider();
    this.mockProvider = new MockAgentProvider();
  }

  /**
   * Returns current gateway and provider connection status
   */
  public getStatus(): ProviderStatus {
    const isConfigured = this.geminiProvider.isConfigured;

    return {
      providerId: isConfigured ? this.geminiProvider.id : this.mockProvider.id,
      providerName: isConfigured ? this.geminiProvider.name : this.mockProvider.name,
      modelName: isConfigured ? this.geminiProvider.modelName : this.mockProvider.modelName,
      isConfigured,
      statusText: isConfigured
        ? 'Gemini Connected'
        : 'Gemini is not configured — running deterministic demo agent.',
      activeSessionsCount: this.sessions.size,
      supportedScenarios: [
        'GEMINI_CUSTOMER_SUPPORT',
        'GEMINI_NORMAL',
        'GEMINI_SCOPE_CREEP',
        'GEMINI_SENSITIVE_ACCESS',
        'GEMINI_PRIVILEGE_ESCALATION',
        'GEMINI_DESTRUCTIVE_ATTEMPT',
        'GEMINI_FALSE_POSITIVE',
        'GEMINI_FINANCIAL_AUDIT'
      ]
    };
  }

  /**
   * Selects provider based on configuration and preferences
   */
  private resolveProvider(forceProvider?: 'gemini' | 'mock'): ExternalAgentProvider {
    if (forceProvider === 'gemini') {
      if (!this.geminiProvider.isConfigured) {
        throw new Error('Google Gemini provider requested, but GEMINI_API_KEY is not configured in environment.');
      }
      return this.geminiProvider;
    }

    if (forceProvider === 'mock' || process.env.NODE_ENV === 'test' || process.env.DEMO_MODE === 'true') {
      return this.mockProvider;
    }

    // Default to Gemini if configured, otherwise gracefully fall back to Mock
    return this.geminiProvider.isConfigured ? this.geminiProvider : this.mockProvider;
  }

  /**
   * Initializes a governed external agent session
   */
  public async startSession(options: {
    scenarioId?: GeminiScenarioId;
    taskPrompt?: string;
    forceProvider?: 'gemini' | 'mock';
  } = {}): Promise<{ agent: Agent; session: Session; providerName: string; modelName: string }> {
    const provider = this.resolveProvider(options.forceProvider);

    const rawScenarioId = options.scenarioId || 'GEMINI_CUSTOMER_SUPPORT';
    const normalizedScenarioId = this.normalizeScenarioId(rawScenarioId);

    const isSupportAgent = normalizedScenarioId === 'GEMINI_CUSTOMER_SUPPORT';

    // 1. Register external agent
    const agent = await agentService.registerAgent({
      name: isSupportAgent ? 'Gemini Support Agent' : 'Gemini Research Agent',
      type: 'external-ai-agent',
      scopes: isSupportAgent
        ? ['customer.read', 'order.read', 'order.write']
        : ['project.read', 'project.write', 'source.read'],
      metadata: {
        providerId: provider.id,
        providerName: provider.name,
        modelName: provider.modelName,
        scenarioId: normalizedScenarioId
      }
    });

    // 2. Create Sentinel session
    const session = await sessionService.createSession({ agentId: agent.id });

    // 3. Store active gateway session state
    const record: ActiveSessionRecord = {
      agent,
      session,
      scenarioId: normalizedScenarioId,
      taskPrompt: options.taskPrompt || (isSupportAgent
        ? 'Act as customer support assistant: retrieve customer records, inspect orders, process adjustments, and triage support tickets.'
        : 'Conduct architectural evaluation and investigate repository assets'),
      provider,
      stepIndex: 0,
      history: [],
      stepResults: [],
      halted: false,
      paused: false
    };

    this.sessions.set(session.id, record);

    return {
      agent,
      session,
      providerName: provider.name,
      modelName: provider.modelName
    };
  }

  /**
   * Executes a single step in a governed session
   */
  public async stepSession(sessionId: string): Promise<ControlledStepResult> {
    const record = this.sessions.get(sessionId);
    if (!record) {
      throw new Error(`Active external agent session '${sessionId}' not found`);
    }

    if (record.halted) {
      throw new Error(`Session '${sessionId}' is halted and cannot accept further actions`);
    }

    if (record.paused) {
      throw new Error(`Session '${sessionId}' is paused awaiting human intervention review`);
    }

    // 1. Prepare context for external model
    const context: AgentTaskContext = {
      agentId: record.agent.id,
      sessionId: record.session.id,
      taskPrompt: record.taskPrompt,
      stepIndex: record.stepIndex,
      scenarioId: record.scenarioId,
      actionHistory: record.history
    };

    // 2. Model generates next action proposal
    const proposedAction = await record.provider.generateNextAction(context);

    // 3. Send proposed action through Sentinel gate or Tool Gateway
    let decisionAction: PolicyDecisionAction;
    let decisionReasons: string[];
    let risk: number;
    let trajectoryDeviation: number;
    let interventionWindow: string;
    let interventionUrgency: string;
    let predictedNextRisk: number;
    let riskAcceleration: string = String(record.session.riskAcceleration ?? 'STABLE');
    let humanReviewRequired = false;
    let pendingInterventionId: string | undefined;
    let executed = false;
    let toolExecutionState: 'SUCCESS' | 'WAITING_FOR_HUMAN_APPROVAL' | 'BLOCKED_NOT_EXECUTED' | 'DENIED_NOT_EXECUTED' | undefined;
    let toolResult: unknown = undefined;
    let preventionProof: string | undefined = undefined;
    let spamSignals: import('@sentinel/shared').SpamSignals | undefined = undefined;

    if (proposedAction.tool) {
      // Execute through Tool Gateway: Sentinel Gate -> Execution Decision -> Protected Simulated Tool
      const toolExec = await toolGateway.executeToolRequest({
        agentId: record.agent.id,
        sessionId: record.session.id,
        tool: proposedAction.tool as ProtectedToolName,
        params: proposedAction.toolParams
      });

      decisionAction = toolExec.decision;
      decisionReasons = toolExec.reasonCodes;
      risk = toolExec.riskScore;
      executed = toolExec.executed;
      toolExecutionState = toolExec.toolExecutionState;
      toolResult = toolExec.toolResult;
      preventionProof = toolExec.preventionProof;
      pendingInterventionId = toolExec.pendingInterventionId;
      spamSignals = toolExec.spamSignals;

      const updatedSession = await sessionService.getSession(record.session.id);
      trajectoryDeviation = updatedSession?.trajectoryDeviation ?? 0;
      interventionWindow = String(updatedSession?.metadata?.interventionWindow ?? 'SAFE');
      interventionUrgency = String(updatedSession?.metadata?.interventionUrgency ?? 'NONE');
      predictedNextRisk = Number(updatedSession?.metadata?.predictedRisk ?? risk);
      riskAcceleration = String(updatedSession?.riskAcceleration ?? 'STABLE');

      if (decisionAction === 'CONFIRM') {
        record.paused = true;
        humanReviewRequired = true;
        record.pendingInterventionId = pendingInterventionId;
      } else if (decisionAction === 'BLOCK') {
        record.halted = true;
        try {
          await sessionService.endSession(record.session.id);
        } catch {
          // Ignored
        }
      }
    } else {
      // Standard action ingestion
      const ingestResult = await actionIngestionService.ingestAction({
        agentId: record.agent.id,
        sessionId: record.session.id,
        action: proposedAction.action,
        resource: proposedAction.resource,
        resourceType: proposedAction.resourceType,
        scope: proposedAction.scope,
        sensitivity: proposedAction.sensitivity,
        reversibility: proposedAction.reversibility,
        metadata: {
          agentReason: proposedAction.reason,
          scenarioId: record.scenarioId,
          provider: record.provider.name
        }
      });

      const { event, decision } = ingestResult;
      decisionAction = decision.action;
      decisionReasons = decision.reason;
      risk = Number(event.metadata?.risk ?? 0);
      trajectoryDeviation = Number(event.metadata?.trajectoryDeviation ?? 0);
      interventionWindow = String(event.metadata?.interventionWindow ?? 'SAFE');
      interventionUrgency = String(event.metadata?.interventionUrgency ?? 'NONE');
      predictedNextRisk = Number(event.metadata?.predictedRisk ?? risk);
      riskAcceleration = String(record.session.riskAcceleration ?? 'STABLE');
      spamSignals = event.metadata?.spamSignals as any;

      if (decision.action === 'CONFIRM') {
        record.paused = true;
        humanReviewRequired = true;
        pendingInterventionId = event.metadata?.pendingInterventionId as string | undefined;
        record.pendingInterventionId = pendingInterventionId;
        toolExecutionState = 'WAITING_FOR_HUMAN_APPROVAL';
      } else if (decision.action === 'BLOCK') {
        record.halted = true;
        toolExecutionState = 'BLOCKED_NOT_EXECUTED';
        preventionProof = 'Sentinel prevented this action.';
        try {
          await sessionService.endSession(record.session.id);
        } catch {
          // Ignored
        }
      } else {
        toolExecutionState = 'SUCCESS';
      }
      executed = decision.action !== 'BLOCK' && decision.action !== 'CONFIRM';
    }

    // 5. Build Simple Mode Narration
    const simpleNarration = this.buildSimpleNarration(proposedAction, decisionAction, risk, trajectoryDeviation);

    const previousRisk = record.stepResults.length > 0
      ? record.stepResults[record.stepResults.length - 1].risk
      : 0;
    const riskDelta = risk - previousRisk;

    const stepResult: ControlledStepResult = {
      stepNumber: record.stepIndex + 1,
      timestamp: new Date().toISOString(),
      proposedAction,
      decision: decisionAction,
      decisionReasons: decisionReasons,
      risk,
      previousRisk,
      riskDelta,
      trajectoryDeviation,
      riskAcceleration,
      predictedNextRisk,
      interventionWindow,
      interventionUrgency,
      humanReviewRequired,
      pendingInterventionId,
      simpleNarration,
      tool: proposedAction.tool,
      toolExecutionState,
      toolResult,
      preventionProof,
      executed,
      halted: record.halted,
      spamSignals
    };

    // 6. Update History
    record.history.push({
      step: record.stepIndex + 1,
      action: proposedAction,
      decision: decisionAction,
      decisionReasons: decisionReasons,
      risk,
      trajectoryDeviation
    });

    record.stepResults.push(stepResult);
    record.stepIndex += 1;

    return stepResult;
  }

  /**
   * Submits human intervention decision
   */
  public async submitHumanDecision(
    sessionId: string,
    decision: 'ALLOW_ONCE' | 'DENY' | 'REVOKE_SESSION',
    reviewerId = 'security-operator',
    reason = 'Human operator review decision recorded'
  ): Promise<ControlledStepResult> {
    const record = this.sessions.get(sessionId);
    if (!record) {
      throw new Error(`Active session '${sessionId}' not found`);
    }

    if (!record.paused || !record.pendingInterventionId) {
      throw new Error(`Session '${sessionId}' has no pending human intervention awaiting review`);
    }

    // Record decision in Sentinel Intervention Service
    await interventionService.recordHumanDecision(record.pendingInterventionId, {
      decision,
      reviewerId,
      reason
    });

    // If pending execution exists in ToolGateway, execute or deny it
    if (toolGateway.getPendingExecution(sessionId)) {
      const toolRes = await toolGateway.executePendingTool(sessionId, decision, reviewerId, reason);
      const lastStep = record.stepResults[record.stepResults.length - 1];
      if (lastStep) {
        lastStep.executed = toolRes.executed;
        lastStep.toolExecutionState = toolRes.toolExecutionState;
        lastStep.toolResult = toolRes.toolResult;
        lastStep.preventionProof = toolRes.preventionProof;
      }
    }

    const lastStep = record.stepResults[record.stepResults.length - 1];
    if (lastStep) {
      lastStep.humanDecision = decision;
    }

    if (decision === 'ALLOW_ONCE') {
      // Resume execution
      record.paused = false;
      record.pendingInterventionId = undefined;
    } else {
      // Deny or revoke
      record.halted = true;
      record.paused = false;
      try {
        await sessionService.endSession(record.session.id);
      } catch {
        // Ignored
      }
    }

    return lastStep;
  }

  /**
   * Runs the complete safe demonstration loop
   */
  public async runFullSession(options: {
    scenarioId?: GeminiScenarioId;
    taskPrompt?: string;
    forceProvider?: 'gemini' | 'mock';
    autoApproveConfirm?: boolean;
    maxSteps?: number;
  } = {}): Promise<ControlledSessionRunResult> {
    const { agent, session, providerName, modelName } = await this.startSession(options);
    const maxSteps = options.maxSteps || 7;
    const record = this.sessions.get(session.id)!;

    let stepCount = 0;
    while (stepCount < maxSteps && !record.halted) {
      const step = await this.stepSession(session.id);
      stepCount++;

      if (step.decision === 'CONFIRM') {
        if (options.autoApproveConfirm) {
          await this.submitHumanDecision(session.id, 'ALLOW_ONCE', 'operator-auto-demo', 'Demo auto-approval exception');
        } else {
          // Pause and return partial result awaiting operator decision
          break;
        }
      }

      if (step.decision === 'BLOCK') {
        break;
      }
    }

    const finalStep = record.stepResults[record.stepResults.length - 1];

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        scopes: agent.scopes
      },
      session: {
        id: session.id,
        status: record.halted ? 'COMPLETED' : record.paused ? 'PAUSED' : 'ACTIVE',
        startedAt: session.startedAt,
        endedAt: record.halted ? new Date().toISOString() : undefined
      },
      providerName,
      modelName,
      scenarioId: options.scenarioId || 'GEMINI_CUSTOMER_SUPPORT',
      totalSteps: record.stepResults.length,
      steps: record.stepResults,
      finalDecision: finalStep?.decision || 'ALLOW',
      status: record.halted ? 'BLOCKED' : record.paused ? 'PAUSED' : 'COMPLETED',
      haltReason: record.halted ? `Sentinel blocked action: ${finalStep?.decisionReasons.join(' | ')}` : undefined
    };
  }

  /**
   * Builds clear, layman explanation for Simple Mode
   */
  private buildSimpleNarration(
    action: ProposedAction,
    decision: PolicyDecisionAction,
    risk: number,
    deviation: number
  ): ControlledStepResult['simpleNarration'] {
    let what = `Gemini wants to perform ${action.action} on ${action.resource}.`;
    if (action.tool === 'get_customer' || action.resource.startsWith('customer://')) {
      what = `Gemini wants to view profile details for customer CUST-001.`;
    } else if (action.tool === 'get_order' || action.resource.startsWith('order://')) {
      what = `Gemini wants to inspect line items for order ORD-1001.`;
    } else if (action.tool === 'update_order') {
      what = `Gemini wants to update shipping notes on order ORD-1001.`;
    } else if (action.tool === 'issue_refund') {
      what = `Gemini wants to disburse a $350.00 refund for order ORD-1001. Human review required.`;
    } else if (action.tool === 'request_admin_access') {
      what = `Gemini is requesting elevated supervisor role access.`;
    } else if (action.tool === 'export_customer_data') {
      what = `Gemini is attempting to export confidential customer PII data.`;
    } else if (action.tool === 'delete_customer') {
      what = `Gemini is attempting permanent deletion of customer CUST-001.`;
    } else if (action.action === 'READ') what = `Gemini wants to read: ${action.resource}`;
    else if (action.action === 'WRITE') what = `Gemini wants to write: ${action.resource}`;
    else if (action.action === 'DELETE') what = `Gemini wants to permanently delete: ${action.resource}`;
    else if (action.action === 'PRIVILEGE_ESCALATION') what = `Gemini is attempting to gain administrative super-user privileges.`;

    let why = action.reason;
    if (decision === 'CONFIRM') {
      why = `This resource is outside the agent's normal scope and risk has escalated (Deviation: ${deviation}%). Human approval is required before execution.`;
    } else if (decision === 'BLOCK') {
      why = `This is a destructive or critical operation attempted without authorized permissions. Sentinel strictly prevented execution.`;
    }

    const riskLabel = risk >= 75 ? 'Critical' : risk >= 50 ? 'High' : risk >= 25 ? 'Medium' : 'Low';

    let actionRecommendation = 'Safe to continue.';
    if (decision === 'MONITOR') actionRecommendation = 'Action permitted under enhanced observation with recorded telemetry.';
    if (decision === 'CONFIRM') actionRecommendation = 'Action held. Tool will not execute until operator clicks Allow Once.';
    if (decision === 'BLOCK') actionRecommendation = 'Action terminated immediately to protect the system. Tool execution prevented.';

    return {
      what,
      why,
      risk: riskLabel,
      actionRecommendation
    };
  }

  private normalizeScenarioId(id?: string): GeminiScenarioId {
    switch (id) {
      case 'CUSTOMER_SUPPORT':
      case 'CUSTOMER_TOOL_CONTROL':
      case 'GEMINI_CUSTOMER_SUPPORT':
        return 'GEMINI_CUSTOMER_SUPPORT';
      case 'NORMAL_RESEARCH':
      case 'GEMINI_NORMAL':
        return 'GEMINI_NORMAL';
      case 'SCOPE_CREEP':
      case 'GEMINI_SCOPE_CREEP':
        return 'GEMINI_SCOPE_CREEP';
      case 'SENSITIVE_ACCESS':
      case 'GEMINI_SENSITIVE_ACCESS':
        return 'GEMINI_SENSITIVE_ACCESS';
      case 'PRIVILEGE_ESCALATION':
      case 'GEMINI_PRIVILEGE_ESCALATION':
        return 'GEMINI_PRIVILEGE_ESCALATION';
      case 'DESTRUCTIVE_ATTEMPT':
      case 'GEMINI_DESTRUCTIVE_ATTEMPT':
        return 'GEMINI_DESTRUCTIVE_ATTEMPT';
      case 'FALSE_POSITIVE_CASE':
      case 'GEMINI_FALSE_POSITIVE':
        return 'GEMINI_FALSE_POSITIVE';
      case 'FINANCIAL_AUDIT':
      case 'GEMINI_FINANCIAL_AUDIT':
        return 'GEMINI_FINANCIAL_AUDIT';
      default:
        return 'GEMINI_CUSTOMER_SUPPORT';
    }
  }
}

export const externalAgentGateway = new ExternalAgentGateway();
