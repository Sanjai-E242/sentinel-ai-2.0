import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { agentRepository } from '../src/modules/agents/repository.js';
import { sessionRepository } from '../src/modules/sessions/repository.js';
import { actionEventRepository } from '../src/modules/actions/repository.js';
import { interventionRepository } from '../src/modules/intervention/repository.js';
import { calculateRiskForecast } from '../src/modules/intervention/forecast.js';
import { evaluateInterventionCost } from '../src/modules/intervention/cost.js';
import { determineInterventionWindow } from '../src/modules/intervention/window.js';
import { generateCounterfactualAnalysis } from '../src/modules/intervention/counterfactual.js';
import { interventionEngine } from '../src/modules/intervention/engine.js';
import { interventionService } from '../src/modules/intervention/service.js';
import type { ActionEvent } from '@sentinel/shared';

describe('Intervention Intelligence Engine (Phase 4)', () => {
  const agentId = 'agent-intervention-test';
  const sessionId = 'session-intervention-test';

  beforeEach(async () => {
    if (agentRepository.clear) await agentRepository.clear();
    if (sessionRepository.clear) await sessionRepository.clear();
    if (actionEventRepository.clear) await actionEventRepository.clear();
    if (interventionRepository.clear) await interventionRepository.clear();

    await agentRepository.create({
      id: agentId,
      name: 'Test Intercept Agent',
      type: 'external-ai-agent',
      status: 'ACTIVE',
      scopes: ['project.read', 'project.write'],
      createdAt: new Date().toISOString()
    });

    await sessionRepository.create({
      id: sessionId,
      agentId: agentId,
      status: 'ACTIVE',
      startedAt: new Date().toISOString(),
      currentRisk: 0,
      trajectoryDeviation: 0
    });
  });

  describe('1. Forecast Engine (forecast.ts)', () => {
    it('projects forward risk across +1, +2, +3 horizons', () => {
      const forecast = calculateRiskForecast({
        currentRisk: 50,
        riskDelta: 15,
        riskVelocity: 'HIGH',
        riskAcceleration: 'RISING',
        trajectoryDeviation: 55
      });

      expect(forecast.nextActionRisk).toBeGreaterThan(50);
      expect(forecast.actionPlus2Risk).toBeGreaterThan(forecast.nextActionRisk);
      expect(forecast.actionPlus3Risk).toBeGreaterThan(forecast.actionPlus2Risk);
      expect(forecast.confidence).toBeGreaterThan(60);
      expect(forecast.horizonLabel).toBeDefined();
    });

    it('amplifies projected risk when acceleration is SURGING', () => {
      const surging = calculateRiskForecast({
        currentRisk: 60,
        riskDelta: 25,
        riskVelocity: 'EXTREME',
        riskAcceleration: 'SURGING',
        trajectoryDeviation: 70
      });

      const stable = calculateRiskForecast({
        currentRisk: 60,
        riskDelta: 5,
        riskVelocity: 'LOW',
        riskAcceleration: 'STABLE',
        trajectoryDeviation: 30
      });

      expect(surging.nextActionRisk).toBeGreaterThan(stable.nextActionRisk);
      expect(surging.horizonLabel).toContain('CRITICAL');
    });

    it('damps forward projections when risk is FALLING', () => {
      const falling = calculateRiskForecast({
        currentRisk: 45,
        riskDelta: -10,
        riskVelocity: 'LOW',
        riskAcceleration: 'FALLING',
        trajectoryDeviation: 20
      });

      expect(falling.nextActionRisk).toBeLessThanOrEqual(45);
    });
  });

  describe('2. Intervention Cost Model (cost.ts)', () => {
    it('calculates low cost and minimal disruption for reversible read actions', () => {
      const cost = evaluateInterventionCost({
        action: 'READ',
        reversibility: 'REVERSIBLE',
        sensitivity: 'LOW',
        currentRisk: 20,
        predictedRisk: 25,
        trajectoryDeviation: 15,
        isAuthorized: true
      });

      expect(['LOW', 'MEDIUM']).toContain(cost.level);
      expect(cost.reversibilityImpact).toContain('reversible');
    });

    it('shows positive net safety gain when waiting risk exceeds immediate friction', () => {
      const cost = evaluateInterventionCost({
        action: 'ACCESS',
        reversibility: 'REVERSIBLE',
        sensitivity: 'HIGH',
        currentRisk: 65,
        predictedRisk: 85,
        trajectoryDeviation: 70,
        isAuthorized: false
      });

      expect(cost.delayRiskScore).toBeGreaterThan(cost.immediateCostScore);
      expect(cost.netSafetyGain).toBeGreaterThan(0);
    });
  });

  describe('3. Intervention Window Determination (window.ts)', () => {
    it('identifies TOO_EARLY when risk and deviation are low', () => {
      const result = determineInterventionWindow({
        currentRisk: 22,
        trajectoryDeviation: 18,
        riskDelta: 4,
        riskVelocity: 'LOW',
        riskAcceleration: 'STABLE',
        predictedRisk: 26,
        action: 'READ',
        sensitivity: 'LOW',
        reversibility: 'REVERSIBLE',
        isAuthorized: true,
        netSafetyGain: -10
      });

      expect(result.window).toBe('TOO_EARLY');
      expect(['ALLOW', 'MONITOR']).toContain(result.recommendedAction);
      expect(result.urgency).toBe('LOW');
      expect(result.explanation).toContain('expected behavior');
    });

    it('identifies OPTIMAL_WINDOW when trajectory drifts and risk accelerates but action is reversible', () => {
      const result = determineInterventionWindow({
        currentRisk: 65,
        trajectoryDeviation: 68,
        riskDelta: 16,
        riskVelocity: 'HIGH',
        riskAcceleration: 'RISING',
        predictedRisk: 82,
        action: 'ACCESS',
        sensitivity: 'HIGH',
        reversibility: 'REVERSIBLE',
        isAuthorized: false,
        netSafetyGain: 35
      });

      expect(result.window).toBe('OPTIMAL_WINDOW');
      expect(['WARN', 'CONFIRM']).toContain(result.recommendedAction);
      expect(['MEDIUM', 'HIGH']).toContain(result.urgency);
      expect(result.explanation).toContain('reversible');
    });

    it('identifies TOO_LATE when unauthorized destructive or critical irreversible action is underway', () => {
      const result = determineInterventionWindow({
        currentRisk: 95,
        trajectoryDeviation: 90,
        riskDelta: 30,
        riskVelocity: 'EXTREME',
        riskAcceleration: 'SURGING',
        predictedRisk: 100,
        action: 'DELETE',
        sensitivity: 'CRITICAL',
        reversibility: 'IRREVERSIBLE',
        isAuthorized: false,
        netSafetyGain: 20
      });

      expect(result.window).toBe('TOO_LATE');
      expect(result.recommendedAction).toBe('BLOCK');
      expect(result.urgency).toBe('CRITICAL');
      expect(result.explanation).toContain('unacceptable additional risk');
    });
  });

  describe('4. Counterfactual Simulation (counterfactual.ts)', () => {
    it('produces comparative EARLY, RECOMMENDED, and LATE paths', () => {
      const cf = generateCounterfactualAnalysis({
        currentRisk: 65,
        predictedRisk: 80,
        trajectoryDeviation: 60,
        interventionWindow: 'OPTIMAL_WINDOW',
        action: 'ACCESS',
        isReversible: true
      });

      expect(cf.early.path).toBe('EARLY');
      expect(cf.early.workflowDisruption).toBe('HIGH');
      expect(cf.recommended.path).toBe('RECOMMENDED');
      expect(cf.recommended.estimatedRiskPrevented).toBe('HIGH');
      expect(cf.late.path).toBe('LATE');
      expect(cf.late.potentialImpact).toBe('SEVERE');
      expect(cf.optimalRationale).toBeDefined();
    });
  });

  describe('5. Human Review Workflow & API', () => {
    it('auto-registers a pending intervention when action requires CONFIRM', async () => {
      const res = await request(app)
        .post('/api/v1/actions')
        .send({
          agentId,
          sessionId,
          action: 'READ',
          resource: 'finance/payroll-records',
          resourceType: 'database',
          scope: 'finance.payroll.read', // Unauthorized scope
          sensitivity: 'HIGH',
          reversibility: 'REVERSIBLE'
        })
        .expect(200);

      expect(res.body.decision.action).toBe('CONFIRM');

      // Verify pending review exists
      const listRes = await request(app)
        .get('/api/v1/interventions?status=PENDING')
        .expect(200);

      expect(listRes.body.interventions.length).toBeGreaterThanOrEqual(1);
      const pending = listRes.body.interventions.find((i: any) => i.sessionId === sessionId);
      expect(pending).toBeDefined();
      expect(pending.status).toBe('PENDING');
      expect(pending.recommendation).toBeDefined();

      // Get single intervention
      const singleRes = await request(app)
        .get(`/api/v1/interventions/${pending.id}`)
        .expect(200);

      expect(singleRes.body.id).toBe(pending.id);
      expect(singleRes.body.currentRisk).toBeDefined();
      expect(singleRes.body.forecast).toBeDefined();
    });

    it('processes ALLOW_ONCE human approval and marks status APPROVED', async () => {
      // Ingest action that requires confirmation
      await request(app)
        .post('/api/v1/actions')
        .send({
          agentId,
          sessionId,
          action: 'READ',
          resource: 'finance/budget',
          resourceType: 'financial_record',
          scope: 'finance.read',
          sensitivity: 'HIGH',
          reversibility: 'REVERSIBLE'
        })
        .expect(200);

      const pendingList = await interventionService.listPendingInterventions();
      expect(pendingList.length).toBeGreaterThan(0);
      const target = pendingList[0];

      // Submit ALLOW_ONCE
      const decisionRes = await request(app)
        .post(`/api/v1/interventions/${target.id}/decision`)
        .send({
          decision: 'ALLOW_ONCE',
          reviewerId: 'admin-secops',
          reason: 'Authorized for one-time budget review'
        })
        .expect(200);

      expect(decisionRes.body.status).toBe('APPROVED');
      expect(decisionRes.body.resolvedBy).toBe('admin-secops');

      // Verify it is no longer in pending queue
      const refreshedPending = await interventionService.listPendingInterventions();
      expect(refreshedPending.some(p => p.id === target.id)).toBe(false);
    });

    it('processes DENY decision and marks status DENIED', async () => {
      await request(app)
        .post('/api/v1/actions')
        .send({
          agentId,
          sessionId,
          action: 'READ',
          resource: 'confidential/org-chart',
          resourceType: 'document',
          scope: 'hr.confidential',
          sensitivity: 'HIGH',
          reversibility: 'REVERSIBLE'
        })
        .expect(200);

      const pendingList = await interventionService.listPendingInterventions();
      const target = pendingList[0];

      const decisionRes = await request(app)
        .post(`/api/v1/interventions/${target.id}/decision`)
        .send({
          decision: 'DENY',
          reviewerId: 'security-analyst',
          reason: 'Access prohibited'
        })
        .expect(200);

      expect(decisionRes.body.status).toBe('DENIED');
    });

    it('processes REVOKE_SESSION decision and revokes the active session', async () => {
      await request(app)
        .post('/api/v1/actions')
        .send({
          agentId,
          sessionId,
          action: 'READ',
          resource: 'executive/strategy',
          resourceType: 'document',
          scope: 'exec.read',
          sensitivity: 'HIGH',
          reversibility: 'REVERSIBLE'
        })
        .expect(200);

      const pendingList = await interventionService.listPendingInterventions();
      const target = pendingList[0];

      await request(app)
        .post(`/api/v1/interventions/${target.id}/decision`)
        .send({
          decision: 'REVOKE_SESSION',
          reviewerId: 'soc-director',
          reason: 'Compromised session suspected'
        })
        .expect(200);

      const session = await sessionRepository.findById(sessionId);
      expect(session?.status).toBe('REVOKED');
    });
  });

  describe('6. Session Intervention Telemetry Endpoints', () => {
    it('GET /api/v1/sessions/:id/intervention returns analysis and pending status', async () => {
      await request(app)
        .post('/api/v1/actions')
        .send({
          agentId,
          sessionId,
          action: 'READ',
          resource: 'docs/specs.md',
          resourceType: 'document',
          scope: 'project.read',
          sensitivity: 'LOW',
          reversibility: 'REVERSIBLE'
        })
        .expect(200);

      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}/intervention`)
        .expect(200);

      expect(res.body.sessionId).toBe(sessionId);
      expect(res.body.analysis).toBeDefined();
      expect(res.body.analysis.interventionWindow).toBeDefined();
      expect(res.body.analysis.forecast).toBeDefined();
      expect(res.body.analysis.counterfactual).toBeDefined();
    });

    it('GET /api/v1/sessions/:id/forecast returns forward horizon', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}/forecast`)
        .expect(200);

      expect(res.body.nextActionRisk).toBeDefined();
      expect(res.body.actionPlus2Risk).toBeDefined();
      expect(res.body.horizonLabel).toBeDefined();
    });

    it('GET /api/v1/sessions/:id/counterfactual returns 3-path comparison', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}/counterfactual`)
        .expect(200);

      expect(res.body.early).toBeDefined();
      expect(res.body.recommended).toBeDefined();
      expect(res.body.late).toBeDefined();
      expect(res.body.optimalRationale).toBeDefined();
    });
  });
});
