import crypto from 'crypto';
import {
  ActionEvent,
  Session,
  Agent,
  InterventionAnalysis,
  PendingInterventionRecord,
  HumanDecisionPayload,
  RiskForecast,
  CounterfactualAnalysis
} from '@sentinel/shared';
import { InterventionRepository, interventionRepository } from './repository.js';
import { interventionEngine, InterventionEngine } from './engine.js';
import { SessionRepository, sessionRepository } from '../sessions/repository.js';
import { ActionEventRepository, actionEventRepository } from '../actions/repository.js';
import { AuditService, auditService as defaultAuditService } from '../audit/service.js';
import { evaluationService } from '../evaluation/service.js';
import { ValidationError, NotFoundError, BadRequestError } from '../../middleware/errorHandler.js';

export class InterventionService {
  constructor(
    private interventionRepo: InterventionRepository = interventionRepository,
    private sessionRepo: SessionRepository = sessionRepository,
    private actionRepo: ActionEventRepository = actionEventRepository,
    private engine: InterventionEngine = interventionEngine,
    private audit: AuditService = defaultAuditService
  ) {}

  public setRepositories(
    interventionRepo: InterventionRepository,
    sessionRepo?: SessionRepository,
    actionRepo?: ActionEventRepository,
    audit?: AuditService
  ): void {
    this.interventionRepo = interventionRepo;
    if (sessionRepo) this.sessionRepo = sessionRepo;
    if (actionRepo) this.actionRepo = actionRepo;
    if (audit) this.audit = audit;
  }

  /**
   * Evaluates intervention analysis for an ingested action
   */
  public evaluateIntervention(params: {
    action: ActionEvent;
    session: Session;
    currentRisk: number;
    previousRisk?: number;
    riskDelta: number;
    riskVelocity: any;
    riskAcceleration: any;
    trajectoryDeviation: number;
  }): InterventionAnalysis {
    return this.engine.evaluate(params);
  }

  /**
   * Registers a pending human intervention review when a CONFIRM decision occurs
   */
  async createPendingIntervention(params: {
    analysis: InterventionAnalysis;
    action: ActionEvent;
    session: Session;
    agent: Agent;
  }): Promise<PendingInterventionRecord> {
    const { analysis, action, session, agent } = params;

    const record: PendingInterventionRecord = {
      id: analysis.id || `int_${crypto.randomBytes(8).toString('hex')}`,
      sessionId: session.id,
      actionEventId: action.eventId,
      agentId: agent.id,
      agentName: agent.name,
      action: action.action,
      resource: action.resource,
      resourceType: action.resourceType,
      scope: action.scope,
      sensitivity: action.sensitivity,
      reversibility: action.reversibility,
      currentRisk: analysis.currentRisk,
      trajectoryDeviation: analysis.trajectoryDeviation,
      riskAcceleration: analysis.riskAcceleration,
      predictedRisk: analysis.predictedRisk,
      interventionWindow: analysis.interventionWindow,
      urgency: analysis.urgency,
      recommendation: analysis.recommendedAction,
      explanation: analysis.explanation,
      reasons: analysis.reasons,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      forecast: analysis.forecast,
      counterfactual: analysis.counterfactual
    };

    const saved = await this.interventionRepo.create(record);

    await this.audit.logEvent({
      eventType: 'INTERVENTION_TRIGGERED',
      entityType: 'intervention',
      entityId: saved.id,
      sessionId: session.id,
      actor: 'sentinel-intervention-engine',
      payload: {
        actionEventId: action.eventId,
        window: saved.interventionWindow,
        urgency: saved.urgency,
        recommendation: saved.recommendation,
        currentRisk: saved.currentRisk,
        predictedRisk: saved.predictedRisk
      }
    });

    return saved;
  }

  /**
   * Lists all pending human review interventions
   */
  async listPendingInterventions(): Promise<PendingInterventionRecord[]> {
    return this.interventionRepo.findPending();
  }

  /**
   * Lists all interventions (pending, approved, denied)
   */
  async listAllInterventions(): Promise<PendingInterventionRecord[]> {
    return this.interventionRepo.findAll();
  }

  /**
   * Gets single intervention by ID
   */
  async getIntervention(id: string): Promise<PendingInterventionRecord> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Intervention ID is required');
    }
    const item = await this.interventionRepo.findById(id);
    if (!item) {
      throw new NotFoundError(`Intervention with ID '${id}' not found`, 'INTERVENTION_NOT_FOUND');
    }
    return item;
  }

  /**
   * Records human operator review decision (ALLOW_ONCE, DENY, REVOKE_SESSION)
   */
  async recordHumanDecision(
    id: string,
    payload: HumanDecisionPayload
  ): Promise<PendingInterventionRecord> {
    if (!payload || !payload.decision) {
      throw new ValidationError('Decision payload is required');
    }

    const validDecisions = ['ALLOW_ONCE', 'DENY', 'REVOKE_SESSION'];
    if (!validDecisions.includes(payload.decision)) {
      throw new ValidationError(`Invalid decision '${payload.decision}'. Supported: ${validDecisions.join(', ')}`);
    }

    const intervention = await this.getIntervention(id);
    if (intervention.status !== 'PENDING') {
      throw new BadRequestError(
        `Intervention '${id}' has already been resolved with status '${intervention.status}'`,
        'INTERVENTION_ALREADY_RESOLVED'
      );
    }

    const now = new Date().toISOString();
    intervention.resolvedAt = now;
    intervention.resolvedBy = payload.reviewerId || 'human-operator';
    intervention.resolutionDecision = payload.decision;
    intervention.resolutionNotes = payload.reason || '';

    if (payload.decision === 'ALLOW_ONCE') {
      intervention.status = 'APPROVED';
    } else {
      intervention.status = 'DENIED';
    }

    // If REVOKE_SESSION, update session status directly
    if (payload.decision === 'REVOKE_SESSION') {
      const session = await this.sessionRepo.findById(intervention.sessionId);
      if (session) {
        session.status = 'REVOKED';
        session.endedAt = now;
        await this.sessionRepo.update(session);
      }
    }

    const updated = await this.interventionRepo.update(intervention);
    evaluationService.recordHumanDecision();

    // Audit log
    await this.audit.logEvent({
      eventType: 'HUMAN_REVIEW_RESOLVED',
      entityType: 'intervention',
      entityId: id,
      sessionId: intervention.sessionId,
      actor: payload.reviewerId || 'human-operator',
      payload: {
        decision: payload.decision,
        reason: payload.reason,
        status: updated.status
      }
    });

    return updated;
  }

  /**
   * Gets session intervention analysis
   */
  async getSessionIntervention(sessionId: string): Promise<{
    sessionId: string;
    analysis: InterventionAnalysis;
    pendingReview?: PendingInterventionRecord;
  }> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`Session '${sessionId}' not found`, 'SESSION_NOT_FOUND');
    }

    const actions = await this.actionRepo.findBySessionId(sessionId);
    const pending = await this.interventionRepo.findLatestBySessionId(sessionId);

    const latestAction = actions[actions.length - 1];
    if (!latestAction) {
      // Synthesize baseline analysis for empty session
      const mockAction: ActionEvent = {
        eventId: 'evt_init',
        agentId: session.agentId,
        sessionId: session.id,
        timestamp: session.startedAt,
        action: 'READ',
        resource: 'session-start',
        resourceType: 'system',
        scope: 'baseline',
        sensitivity: 'LOW',
        reversibility: 'REVERSIBLE',
        authorization: 'AUTHORIZED'
      };

      const analysis = this.engine.evaluate({
        action: mockAction,
        session,
        currentRisk: session.currentRisk || 0,
        riskDelta: session.riskDelta || 0,
        riskVelocity: session.riskVelocity || 'LOW',
        riskAcceleration: session.riskAcceleration || 'STABLE',
        trajectoryDeviation: session.trajectoryDeviation || 0
      });

      return { sessionId, analysis, pendingReview: pending || undefined };
    }

    const analysis = this.engine.evaluate({
      action: latestAction,
      session,
      currentRisk: session.currentRisk || 0,
      riskDelta: session.riskDelta || 0,
      riskVelocity: session.riskVelocity || 'LOW',
      riskAcceleration: session.riskAcceleration || 'STABLE',
      trajectoryDeviation: session.trajectoryDeviation || 0
    });

    return {
      sessionId,
      analysis,
      pendingReview: pending || undefined
    };
  }

  /**
   * Gets forward risk forecast for a session
   */
  async getSessionForecast(sessionId: string): Promise<RiskForecast> {
    const interventionData = await this.getSessionIntervention(sessionId);
    if (!interventionData.analysis.forecast) {
      throw new NotFoundError(`No forecast available for session '${sessionId}'`, 'FORECAST_NOT_FOUND');
    }
    return interventionData.analysis.forecast;
  }

  /**
   * Gets counterfactual analysis for a session
   */
  async getSessionCounterfactual(sessionId: string): Promise<CounterfactualAnalysis> {
    const interventionData = await this.getSessionIntervention(sessionId);
    if (!interventionData.analysis.counterfactual) {
      throw new NotFoundError(`No counterfactual available for session '${sessionId}'`, 'COUNTERFACTUAL_NOT_FOUND');
    }
    return interventionData.analysis.counterfactual;
  }
}

export const interventionService = new InterventionService();
