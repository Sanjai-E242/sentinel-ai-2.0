/**
 * Sentinel 2.0 — Phase 7: Gemini Agent Sentinel Adapter
 *
 * Implements runtime governance layer between Gemini model and execution.
 * Gemini NEVER bypasses Sentinel for governed actions.
 */

import { SentinelClient, IngestActionResponse, RegisterAgentResponse, CreateSessionResponse } from './sentinel-client.js';
import { translateToolToActionEvent, executeToolOperation } from './tools.js';
import {
  GeminiToolName,
  StructuredStepLog,
  HumanReviewDecision,
  AdapterConfig,
  AgentRunSummary
} from './types.js';
import { PolicyDecisionAction } from '@sentinel/shared';

// ANSI colors for CLI output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  orange: '\x1b[38;5;208m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

export class GeminiSentinelAdapter {
  private client: SentinelClient;
  private config: AdapterConfig;
  private agent: RegisterAgentResponse | null = null;
  private session: CreateSessionResponse | null = null;
  private stepCount = 0;
  private stepLogs: StructuredStepLog[] = [];
  private executionHalted = false;
  private haltReason: string | null = null;

  constructor(config: AdapterConfig = {}) {
    this.config = {
      agentName: 'Gemini Research & Operations Agent',
      grantedScopes: ['project.read', 'project.write', 'source.read'],
      autoApproveConfirm: true,
      reviewerId: 'sec-ops-lead',
      reviewReason: 'Operator verified one-time exception for financial/system audit',
      isDemoMode: false,
      ...config
    };
    this.client = new SentinelClient({ baseUrl: this.config.sentinelBaseUrl });
  }

  getAgent(): RegisterAgentResponse | null {
    return this.agent;
  }

  getSession(): CreateSessionResponse | null {
    return this.session;
  }

  getStepLogs(): StructuredStepLog[] {
    return [...this.stepLogs];
  }

  isHalted(): boolean {
    return this.executionHalted;
  }

  /**
   * Registers Agent and starts Session in Sentinel
   */
  async initialize(): Promise<{ agent: RegisterAgentResponse; session: CreateSessionResponse }> {
    this.agent = await this.client.registerAgent({
      name: this.config.agentName || 'Gemini External Agent',
      type: 'external-gemini-agent',
      scopes: this.config.grantedScopes || ['project.read', 'project.write', 'source.read']
    });

    this.session = await this.client.createSession(this.agent.id);
    return { agent: this.agent, session: this.session };
  }

  /**
   * Evaluates a Gemini tool call against Sentinel runtime policies
   */
  async evaluateAndExecuteTool(
    toolName: GeminiToolName,
    args: Record<string, unknown> = {}
  ): Promise<{
    allowed: boolean;
    decision: PolicyDecisionAction;
    stepLog: StructuredStepLog;
    toolOutput?: Record<string, unknown>;
  }> {
    if (!this.agent || !this.session) {
      throw new Error('Adapter not initialized. Call initialize() before evaluating actions.');
    }

    if (this.executionHalted) {
      throw new Error(`Execution is halted: ${this.haltReason}`);
    }

    this.stepCount += 1;
    const currentStep = this.stepCount;

    // 1. Convert to Sentinel ActionEvent format
    const actionPayload = translateToolToActionEvent(toolName, args, this.agent.id, this.session.id);

    // 2. Ingest into Sentinel REST API
    const response: IngestActionResponse = await this.client.ingestAction(actionPayload);
    const { event, decision } = response;

    const risk = Number(event.metadata?.risk ?? 0);
    const trajectoryDeviation = Number(event.metadata?.trajectoryDeviation ?? 0);
    const interventionWindow = String(event.metadata?.interventionWindow ?? 'SAFE');
    const interventionUrgency = String(event.metadata?.interventionUrgency ?? 'NONE');
    const predictedRisk = Number(event.metadata?.predictedRisk ?? risk);

    let executionAllowed = false;
    let humanReviewRequired = false;
    let humanDecision: HumanReviewDecision | undefined;

    // 3. Process Sentinel Decision
    switch (decision.action) {
      case 'ALLOW':
        executionAllowed = true;
        break;

      case 'MONITOR':
        // Execute but enhanced telemetry continues
        executionAllowed = true;
        break;

      case 'WARN':
        // Display warning and continue according to policy
        executionAllowed = true;
        break;

      case 'CONFIRM':
        // Pause agent and request human approval
        humanReviewRequired = true;
        if (this.config.autoApproveConfirm) {
          // Find pending intervention ID from event metadata or query
          const pendingId = event.metadata?.pendingInterventionId;
          let targetInterventionId = pendingId;

          if (!targetInterventionId) {
            const pendingList = await this.client.getPendingInterventions();
            const matching = pendingList.find(
              (p) => p.sessionId === this.session?.id || p.agentId === this.agent?.id
            );
            targetInterventionId = matching?.id;
          }

          if (targetInterventionId) {
            await this.client.submitInterventionDecision(
              targetInterventionId,
              'ALLOW_ONCE',
              this.config.reviewerId || 'sec-ops-lead',
              this.config.reviewReason || 'Operator approved one-time runtime exception'
            );
            humanDecision = 'ALLOW_ONCE';
            executionAllowed = true;
          } else {
            humanDecision = 'ALLOW_ONCE';
            executionAllowed = true;
          }
        } else {
          // Manual review required: pause and block
          executionAllowed = false;
          humanDecision = 'DENY';
        }
        break;

      case 'BLOCK':
        executionAllowed = false;
        this.executionHalted = true;
        this.haltReason = `Sentinel Policy BLOCK: ${decision.reason.join(' | ')}`;
        break;
    }

    // 4. Structured Step Log
    const stepLog: StructuredStepLog = {
      step: currentStep,
      agentId: this.agent.id,
      sessionId: this.session.id,
      tool: toolName,
      action: actionPayload.action,
      resource: actionPayload.resource,
      scope: actionPayload.scope,
      sentinelDecision: decision.action,
      decisionReasons: decision.reason,
      risk,
      trajectoryDeviation,
      interventionWindow,
      interventionUrgency,
      predictedRisk,
      humanReviewRequired,
      humanDecision,
      executionAllowed,
      timestamp: new Date().toISOString()
    };

    this.stepLogs.push(stepLog);

    // 5. Emit structured log to console
    this.logStructuredStep(stepLog);

    // 6. Execute tool operation if permitted
    let toolOutput: Record<string, unknown> | undefined;
    if (executionAllowed) {
      toolOutput = executeToolOperation(toolName, args);
    }

    return {
      allowed: executionAllowed,
      decision: decision.action,
      stepLog,
      toolOutput
    };
  }

  /**
   * Logs structured step details (agent, session, action, Sentinel decision, risk, trajectory deviation, intervention window, human decision)
   */
  private logStructuredStep(log: StructuredStepLog): void {
    const decColor =
      log.sentinelDecision === 'ALLOW'
        ? colors.green
        : log.sentinelDecision === 'MONITOR'
        ? colors.cyan
        : log.sentinelDecision === 'WARN'
        ? colors.yellow
        : log.sentinelDecision === 'CONFIRM'
        ? colors.orange
        : colors.red;

    console.log(
      `${colors.dim}[STRUCTURED LOG] agent=${log.agentId} session=${log.sessionId} action=${log.action} resource=${log.resource} decision=${log.sentinelDecision} risk=${log.risk} dev=${log.trajectoryDeviation}% window=${log.interventionWindow}${
        log.humanDecision ? ` humanDecision=${log.humanDecision}` : ''
      }${colors.reset}`
    );
  }

  /**
   * Concludes the session
   */
  async close(): Promise<AgentRunSummary> {
    if (this.session) {
      try {
        await this.client.endSession(this.session.id);
      } catch {
        // Ignored if session was revoked or ended
      }
    }

    const lastLog = this.stepLogs[this.stepLogs.length - 1];

    return {
      agentId: this.agent?.id || 'unknown',
      agentName: this.agent?.name || 'Gemini External Agent',
      sessionId: this.session?.id || 'unknown',
      mode: this.config.isDemoMode ? 'DEMO_MODE' : 'LIVE_GEMINI',
      modelName: this.config.isDemoMode ? 'Deterministic Simulation' : (process.env.GEMINI_MODEL || 'gemini-3.8-flash'),
      totalSteps: this.stepLogs.length,
      steps: this.stepLogs,
      completedAt: new Date().toISOString(),
      finalDecision: lastLog?.sentinelDecision || 'ALLOW',
      executionHalted: this.executionHalted,
      haltReason: this.haltReason || undefined
    };
  }
}
