import crypto from 'crypto';
import {
  ActionEvent,
  ActionType,
  ActionSensitivity,
  ActionReversibility,
  IngestActionInput,
  IngestActionResult,
  PolicyDecision,
  AuditEventType
} from '@sentinel/shared';
import { ActionEventRepository, actionEventRepository } from './repository.js';
import { AgentRepository, agentRepository } from '../agents/repository.js';
import { SessionRepository, sessionRepository } from '../sessions/repository.js';
import { ScopeAuthorizationService, scopeAuthorizationService } from '../authorization/service.js';
import { PolicyDecisionService, policyDecisionService } from '../decisions/policy.service.js';
import { AuditService, auditService as defaultAuditService } from '../audit/service.js';
import { TrajectoryService, trajectoryService as defaultTrajectoryService } from '../trajectory/service.js';
import { InterventionService, interventionService as defaultInterventionService } from '../intervention/service.js';
import { SpamGuardService, spamGuardService as defaultSpamGuard } from '../spam-guard/index.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ThrottledError
} from '../../middleware/errorHandler.js';

const VALID_ACTIONS: Set<string> = new Set([
  'READ',
  'WRITE',
  'UPDATE',
  'DELETE',
  'EXECUTE',
  'EXPORT',
  'DOWNLOAD',
  'PRIVILEGE_ESCALATION',
  'EXTERNAL_REQUEST'
]);

const VALID_SENSITIVITIES: Set<string> = new Set([
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]);

const VALID_REVERSIBILITIES: Set<string> = new Set([
  'REVERSIBLE',
  'PARTIALLY_REVERSIBLE',
  'IRREVERSIBLE'
]);

export class ActionIngestionService {
  constructor(
    private actionRepo: ActionEventRepository = actionEventRepository,
    private agentRepo: AgentRepository = agentRepository,
    private sessionRepo: SessionRepository = sessionRepository,
    private authzService: ScopeAuthorizationService = scopeAuthorizationService,
    private policyService: PolicyDecisionService = policyDecisionService,
    private audit: AuditService = defaultAuditService,
    private trajectoryService: TrajectoryService = defaultTrajectoryService,
    private interventionService: InterventionService = defaultInterventionService,
    private spamGuard: SpamGuardService = defaultSpamGuard
  ) {}

  public setRepositories(
    actionRepo: ActionEventRepository,
    agentRepo?: AgentRepository,
    sessionRepo?: SessionRepository,
    audit?: AuditService,
    trajectoryService?: TrajectoryService,
    interventionService?: InterventionService,
    spamGuard?: SpamGuardService
  ): void {
    this.actionRepo = actionRepo;
    if (agentRepo) this.agentRepo = agentRepo;
    if (sessionRepo) this.sessionRepo = sessionRepo;
    if (audit) this.audit = audit;
    if (trajectoryService) this.trajectoryService = trajectoryService;
    if (interventionService) this.interventionService = interventionService;
    if (spamGuard) this.spamGuard = spamGuard;
  }

  public setSpamGuardService(spamGuard: SpamGuardService): void {
    this.spamGuard = spamGuard;
  }

  public getSpamGuardService(): SpamGuardService {
    return this.spamGuard;
  }

  async ingestAction(input: IngestActionInput, requestId = '-'): Promise<IngestActionResult> {
    // 1. Validate payload existence
    if (!input || typeof input !== 'object') {
      throw new ValidationError('Action payload is required');
    }

    // 2. Validate agentId
    const rawAgentId = input.agentId || (input as unknown as Record<string, unknown>)?.agent_id;
    if (!rawAgentId || typeof rawAgentId !== 'string' || (rawAgentId as string).trim().length === 0) {
      throw new ValidationError('agentId is required and must be a non-empty string');
    }
    const agentId = (rawAgentId as string).trim();

    // 3. Validate sessionId
    const rawSessionId = input.sessionId || (input as unknown as Record<string, unknown>)?.session_id;
    if (!rawSessionId || typeof rawSessionId !== 'string' || (rawSessionId as string).trim().length === 0) {
      throw new ValidationError('sessionId is required and must be a non-empty string');
    }
    const sessionId = (rawSessionId as string).trim();

    // 4. Validate action
    if (!input.action || typeof input.action !== 'string') {
      throw new ValidationError('action is required and must be a string');
    }
    const normalizedAction = input.action.trim().toUpperCase() as ActionType;
    if (!VALID_ACTIONS.has(normalizedAction)) {
      throw new ValidationError(
        `Invalid action '${input.action}'. Supported actions: ${Array.from(VALID_ACTIONS).join(', ')}`
      );
    }

    // 5. Validate resource & resourceType
    if (!input.resource || typeof input.resource !== 'string' || input.resource.trim().length === 0) {
      throw new ValidationError('resource is required and must be a non-empty string');
    }
    const resource = input.resource.trim();
    const rawResourceType = input.resourceType || (input as unknown as Record<string, unknown>)?.resource_type;
    const resourceType = rawResourceType && typeof rawResourceType === 'string'
      ? (rawResourceType as string).trim()
      : 'resource';

    // 6. Validate scope
    if (!input.scope || typeof input.scope !== 'string' || input.scope.trim().length === 0) {
      throw new ValidationError('scope is required and must be a non-empty string');
    }
    const scope = input.scope.trim();

    // 7. Validate sensitivity
    if (!input.sensitivity || typeof input.sensitivity !== 'string') {
      throw new ValidationError('sensitivity is required and must be a string');
    }
    const normalizedSensitivity = input.sensitivity.trim().toUpperCase() as ActionSensitivity;
    if (!VALID_SENSITIVITIES.has(normalizedSensitivity)) {
      throw new ValidationError(
        `Invalid sensitivity '${input.sensitivity}'. Supported: ${Array.from(VALID_SENSITIVITIES).join(', ')}`
      );
    }

    // 8. Validate reversibility
    if (!input.reversibility || typeof input.reversibility !== 'string') {
      throw new ValidationError('reversibility is required and must be a string');
    }
    const normalizedReversibility = input.reversibility.trim().toUpperCase() as ActionReversibility;
    if (!VALID_REVERSIBILITIES.has(normalizedReversibility)) {
      throw new ValidationError(
        `Invalid reversibility '${input.reversibility}'. Supported: ${Array.from(VALID_REVERSIBILITIES).join(', ')}`
      );
    }

    // 8b. Spam / Abuse Guard Check (Rate Limit, Burst Detection, Duplicate Detection)
    // Sits BEFORE expensive downstream processing (Agent/Session DB queries, Trajectory, Risk)
    const spamCheck = await this.spamGuard.check({
      agentId,
      sessionId,
      action: normalizedAction,
      resource,
      tool: (input.metadata?.tool as string) || undefined,
      toolParams: (input.metadata?.toolParams as Record<string, unknown>) || undefined
    });

    if (spamCheck.throttled) {
      throw new ThrottledError(
        spamCheck.reason || 'Request rate limit exceeded. Please retry later.',
        {
          requestRate: spamCheck.signals.requestRate,
          threshold: spamCheck.signals.threshold,
          windowMs: spamCheck.signals.windowMs,
          status: spamCheck.signals.status
        }
      );
    }

    // 9. Verify Agent exists and is ACTIVE
    const agent = await this.agentRepo.findById(agentId);
    if (!agent) {
      throw new NotFoundError(`The specified agent '${agentId}' does not exist`, 'AGENT_NOT_FOUND');
    }
    if (agent.status === 'REVOKED') {
      throw new ForbiddenError(`Agent '${agentId}' is revoked and cannot perform actions`, 'AGENT_REVOKED');
    }
    if (agent.status === 'SUSPENDED') {
      throw new ForbiddenError(`Agent '${agentId}' is suspended and cannot perform actions`, 'AGENT_SUSPENDED');
    }

    // 10. Verify Session exists, belongs to the Agent, and is ACTIVE
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`The specified session '${sessionId}' does not exist`, 'SESSION_NOT_FOUND');
    }
    if (session.agentId !== agent.id) {
      throw new BadRequestError(
        `Session '${sessionId}' belongs to agent '${session.agentId}', not '${agent.id}'`,
        'SESSION_AGENT_MISMATCH'
      );
    }
    if (session.status === 'COMPLETED') {
      throw new BadRequestError(
        `Session '${sessionId}' has completed. Cannot accept new actions.`,
        'SESSION_ALREADY_COMPLETED'
      );
    }
    if (session.status === 'REVOKED') {
      throw new BadRequestError(
        `Session '${sessionId}' has been revoked. Cannot accept new actions.`,
        'SESSION_REVOKED'
      );
    }

    // 11. Resolve Timestamp
    const timestamp = input.timestamp && !isNaN(Date.parse(input.timestamp))
      ? new Date(input.timestamp).toISOString()
      : new Date().toISOString();

    // 12. Determine Authorization independently using agent's registered scopes
    const isAuthorized = this.authzService.isAuthorized(agent.scopes, scope);
    const authorization = isAuthorized ? 'AUTHORIZED' : 'UNAUTHORIZED';

    // 13. Create Unique Event ID
    const eventId = `evt_${crypto.randomBytes(8).toString('hex')}`;

    const actionEvent: ActionEvent = {
      eventId,
      agentId: agent.id,
      sessionId: session.id,
      timestamp,
      action: normalizedAction,
      resource,
      resourceType,
      scope,
      sensitivity: normalizedSensitivity,
      reversibility: normalizedReversibility,
      authorization,
      metadata: {
        ...(input.metadata || {}),
        spamSignals: spamCheck.signals
      }
    };

    // 14. Evaluate Trajectory Features, Deviation, and Cumulative Risk
    const pastActions = await this.actionRepo.findBySessionId(session.id);
    const trajectoryEval = this.trajectoryService.evaluateActionTrajectory({
      action: actionEvent,
      actionHistory: pastActions,
      agent,
      session
    });

    // 14b. Evaluate Intervention Analysis (Window, Forecast, Cost, Counterfactuals)
    const interventionAnalysis = this.interventionService.evaluateIntervention({
      action: actionEvent,
      session,
      currentRisk: trajectoryEval.currentRisk,
      previousRisk: session.currentRisk ?? Math.max(0, trajectoryEval.currentRisk - trajectoryEval.riskDelta),
      riskDelta: trajectoryEval.riskDelta,
      riskVelocity: trajectoryEval.riskVelocity,
      riskAcceleration: trajectoryEval.riskAcceleration,
      trajectoryDeviation: trajectoryEval.trajectoryDeviation
    });

    // Attach trajectory snapshot & intervention telemetry to action metadata
    actionEvent.metadata = {
      ...(actionEvent.metadata || {}),
      risk: trajectoryEval.currentRisk,
      actionRisk: trajectoryEval.actionRisk,
      trajectoryDeviation: trajectoryEval.trajectoryDeviation,
      trajectoryState: trajectoryEval.state,
      interventionWindow: interventionAnalysis.interventionWindow,
      interventionUrgency: interventionAnalysis.urgency,
      predictedRisk: interventionAnalysis.predictedRisk,
      forecast: interventionAnalysis.forecast,
      counterfactual: interventionAnalysis.counterfactual,
      spamSignals: spamCheck.signals
    };

    // 15. Record Action Event
    await this.actionRepo.create(actionEvent);

    // 16. Update Session Telemetry
    session.actionCount = (session.actionCount || 0) + 1;
    session.currentRisk = trajectoryEval.currentRisk;
    session.trajectoryDeviation = trajectoryEval.trajectoryDeviation;
    session.riskDelta = trajectoryEval.riskDelta;
    session.riskVelocity = trajectoryEval.riskVelocity;
    session.riskAcceleration = trajectoryEval.riskAcceleration;
    session.trajectoryState = trajectoryEval.state;
    session.metadata = {
      ...(session.metadata || {}),
      lastActionRisk: trajectoryEval.actionRisk,
      trajectoryFeatures: trajectoryEval.features,
      trajectoryComponents: trajectoryEval.components,
      trajectoryReasons: trajectoryEval.plainReasons,
      lastState: trajectoryEval.state,
      interventionWindow: interventionAnalysis.interventionWindow,
      interventionUrgency: interventionAnalysis.urgency,
      predictedRisk: interventionAnalysis.predictedRisk,
      forecast: interventionAnalysis.forecast,
      counterfactual: interventionAnalysis.counterfactual,
      spamSignals: spamCheck.signals
    };
    await this.sessionRepo.update(session);

    // 17. Produce Basic Policy Decision with Intervention Intelligence Context
    const decision: PolicyDecision = this.policyService.evaluate({
      event: actionEvent,
      agentName: agent.name,
      interventionAnalysis
    });

    actionEvent.metadata.decision = decision;

    // 17b. If human confirmation required, register pending review in queue
    if (decision.action === 'CONFIRM') {
      try {
        const pendingReview = await this.interventionService.createPendingIntervention({
          analysis: interventionAnalysis,
          action: actionEvent,
          session,
          agent
        });
        actionEvent.metadata.pendingInterventionId = pendingReview.id;
      } catch (err) {
        console.warn(`[INTERVENTION] Failed to record pending review: ${(err as Error).message}`);
      }
    }

    // 18. Structured Log of Action Ingestion
    console.log(
      `[ACTION_INGESTION] [${requestId}] agentId=${agent.id} sessionId=${session.id} eventId=${eventId} action=${normalizedAction} resource=${resource} authz=${authorization} decision=${decision.action} risk=${trajectoryEval.currentRisk} dev=${trajectoryEval.trajectoryDeviation} state=${trajectoryEval.state}`
    );

    // 19. Audit Logging - ACTION_INGESTED
    await this.audit.logEvent({
      eventType: 'ACTION_INGESTED',
      entityType: 'action',
      entityId: eventId,
      sessionId: session.id,
      actor: agent.id,
      payload: {
        action: normalizedAction,
        resource,
        resourceType,
        scope,
        sensitivity: normalizedSensitivity,
        reversibility: normalizedReversibility,
        authorization,
        riskScore: trajectoryEval.currentRisk,
        trajectoryDeviation: trajectoryEval.trajectoryDeviation,
        trajectoryState: trajectoryEval.state
      }
    });

    // 20. Audit Logging - Decision outcome
    const decisionEventMap: Record<string, AuditEventType> = {
      ALLOW: 'ACTION_ALLOWED',
      MONITOR: 'ACTION_MONITORED',
      WARN: 'ACTION_WARNED',
      CONFIRM: 'ACTION_CONFIRM_REQUIRED',
      BLOCK: 'ACTION_BLOCKED'
    };

    const decisionEventType = decisionEventMap[decision.action] || 'ACTION_INGESTED';
    await this.audit.logEvent({
      eventType: decisionEventType,
      entityType: 'action',
      entityId: eventId,
      sessionId: session.id,
      actor: 'sentinel-policy-engine',
      payload: {
        decision: decision.action,
        reason: decision.reason,
        riskScore: trajectoryEval.currentRisk,
        trajectoryDeviation: trajectoryEval.trajectoryDeviation,
        trajectoryState: trajectoryEval.state
      }
    });

    return {
      event: actionEvent,
      decision
    };
  }

  async getAction(eventId: string): Promise<ActionEvent> {
    if (!eventId || typeof eventId !== 'string') {
      throw new ValidationError('Event ID is required');
    }

    const event = await this.actionRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError(`The specified action event '${eventId}' does not exist`, 'EVENT_NOT_FOUND');
    }
    return event;
  }

  async listActions(sessionId?: string, agentId?: string): Promise<ActionEvent[]> {
    if (sessionId) {
      return this.actionRepo.findBySessionId(sessionId);
    }
    if (agentId) {
      return this.actionRepo.findByAgentId(agentId);
    }
    return this.actionRepo.findAll();
  }
}

export const actionIngestionService = new ActionIngestionService();
