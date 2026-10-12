import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { agentRepository } from '../src/modules/agents/repository.js';
import { sessionRepository } from '../src/modules/sessions/repository.js';
import { actionEventRepository } from '../src/modules/actions/repository.js';
import { extractTrajectoryFeatures, calculateTrajectoryDeviation } from '../src/modules/trajectory/features.js';
import { evaluateSessionRisk, resolveTrajectoryState, calculateBaseActionRisk } from '../src/modules/risk/engine.js';
import { DEFAULT_RESEARCH_BASELINE } from '../src/modules/trajectory/baseline.js';
import type { ActionEvent } from '@sentinel/shared';

describe('Trajectory Intelligence & Cumulative Risk Engine', () => {
  const agentId = 'research-agent-01';
  const sessionId = 'session-trajectory-01';

  beforeEach(async () => {
    if (agentRepository.clear) await agentRepository.clear();
    if (sessionRepository.clear) await sessionRepository.clear();
    if (actionEventRepository.clear) await actionEventRepository.clear();

    await agentRepository.create({
      id: agentId,
      name: 'Research Assistant',
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

  describe('Feature Extraction & Deviation Calculations', () => {
    it('calculates low deviation for actions strictly matching baseline', () => {
      const normalAction: ActionEvent = {
        eventId: 'evt-1',
        agentId,
        sessionId,
        timestamp: new Date().toISOString(),
        action: 'READ',
        resource: 'project-doc',
        resourceType: 'document',
        scope: 'project.read',
        sensitivity: 'LOW',
        reversibility: 'REVERSIBLE',
        authorization: 'AUTHORIZED'
      };

      const features = extractTrajectoryFeatures(normalAction, [], DEFAULT_RESEARCH_BASELINE);
      expect(features.resourceNovelty).toBeDefined();
      expect(features.scopeExpansion).toBe(0);
      expect(features.sensitivityEscalation).toBe(0);
      expect(features.destructiveActionPresence).toBe(0);

      const { trajectoryDeviation, components } = calculateTrajectoryDeviation(features);
      expect(trajectoryDeviation).toBeLessThan(35);
      expect(resolveTrajectoryState(trajectoryDeviation)).toBe('NORMAL');
      expect(components.scopeExpansion).toBe(0);
    });

    it('detects scope expansion when requesting unauthorized or external scopes', () => {
      const creepAction: ActionEvent = {
        eventId: 'evt-2',
        agentId,
        sessionId,
        timestamp: new Date().toISOString(),
        action: 'READ',
        resource: 'payroll-db',
        resourceType: 'database',
        scope: 'finance.payroll.read',
        sensitivity: 'HIGH',
        reversibility: 'REVERSIBLE',
        authorization: 'UNAUTHORIZED'
      };

      const features = extractTrajectoryFeatures(creepAction, [], DEFAULT_RESEARCH_BASELINE);
      expect(features.scopeExpansion).toBeGreaterThanOrEqual(60);
      expect(features.authorizationFailures).toBe(100);
      expect(features.crossBoundaryAccess).toBeGreaterThanOrEqual(50);

      const { trajectoryDeviation, components } = calculateTrajectoryDeviation(features);
      expect(trajectoryDeviation).toBeGreaterThan(40);
      expect(components.scopeExpansion).toBeGreaterThan(0);
      expect(components.authorizationFailures).toBeGreaterThan(0);
    });

    it('detects sensitivity escalation from low to critical', () => {
      const criticalAction: ActionEvent = {
        eventId: 'evt-3',
        agentId,
        sessionId,
        timestamp: new Date().toISOString(),
        action: 'READ',
        resource: 'master-encryption-keys',
        resourceType: 'secrets',
        scope: 'security.keys',
        sensitivity: 'CRITICAL',
        reversibility: 'REVERSIBLE',
        authorization: 'UNAUTHORIZED'
      };

      const features = extractTrajectoryFeatures(criticalAction, [], DEFAULT_RESEARCH_BASELINE);
      expect(features.sensitivityEscalation).toBe(100);
      expect(features.crossBoundaryAccess).toBeGreaterThanOrEqual(80);
    });

    it('detects destructive and irreversible actions', () => {
      const destructiveAction: ActionEvent = {
        eventId: 'evt-4',
        agentId,
        sessionId,
        timestamp: new Date().toISOString(),
        action: 'DELETE',
        resource: 'production-database-replica',
        resourceType: 'database',
        scope: 'db.delete',
        sensitivity: 'HIGH',
        reversibility: 'IRREVERSIBLE',
        authorization: 'AUTHORIZED'
      };

      const features = extractTrajectoryFeatures(destructiveAction, [], DEFAULT_RESEARCH_BASELINE);
      expect(features.destructiveActionPresence).toBe(100);

      const { components } = calculateTrajectoryDeviation(features);
      expect(components.destructiveBehavior).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Cumulative Risk Engine', () => {
    it('computes multi-action cumulative risk accumulation, delta, velocity and acceleration', () => {
      const mockAction: ActionEvent = {
        eventId: 'evt-test',
        agentId,
        sessionId,
        timestamp: new Date().toISOString(),
        action: 'READ',
        resource: 'doc',
        resourceType: 'document',
        scope: 'project.read',
        sensitivity: 'LOW',
        reversibility: 'REVERSIBLE',
        authorization: 'AUTHORIZED'
      };

      // First action: small risk
      const step1 = evaluateSessionRisk({
        action: mockAction,
        actionRisk: 15,
        trajectoryDeviation: 10,
        previousRisk: 0,
        previousRiskDelta: 0,
        actionHistoryLength: 0
      });
      expect(step1.currentRisk).toBeGreaterThan(5);
      expect(step1.riskDelta).toBe(step1.currentRisk);
      expect(['LOW', 'MEDIUM']).toContain(step1.riskVelocity);

      // Second action: moderate risk
      const step2 = evaluateSessionRisk({
        action: mockAction,
        actionRisk: 40,
        trajectoryDeviation: 35,
        previousRisk: step1.currentRisk,
        previousRiskDelta: step1.riskDelta,
        actionHistoryLength: 1
      });
      expect(step2.currentRisk).toBeGreaterThan(step1.currentRisk);
      expect(step2.riskDelta).toBe(step2.currentRisk - step1.currentRisk);

      // Third action: severe risk spike
      const step3 = evaluateSessionRisk({
        action: mockAction,
        actionRisk: 85,
        trajectoryDeviation: 80,
        previousRisk: step2.currentRisk,
        previousRiskDelta: step2.riskDelta,
        actionHistoryLength: 2
      });
      expect(step3.currentRisk).toBeGreaterThan(step2.currentRisk);
      expect(['HIGH', 'EXTREME']).toContain(step3.riskVelocity);
      expect(['RISING', 'SURGING']).toContain(step3.riskAcceleration);
    });

    it('maps scores to consistent trajectory states', () => {
      expect(resolveTrajectoryState(15)).toBe('NORMAL');
      expect(resolveTrajectoryState(30)).toBe('NORMAL');
      expect(resolveTrajectoryState(35)).toBe('WATCH');
      expect(resolveTrajectoryState(50)).toBe('WATCH');
      expect(resolveTrajectoryState(60)).toBe('DRIFTING');
      expect(resolveTrajectoryState(70)).toBe('DRIFTING');
      expect(resolveTrajectoryState(75)).toBe('ESCALATING');
      expect(resolveTrajectoryState(85)).toBe('ESCALATING');
      expect(resolveTrajectoryState(90)).toBe('CRITICAL');
      expect(resolveTrajectoryState(100)).toBe('CRITICAL');
    });

    it('calculates base action risk correctly', () => {
      const safeAction: ActionEvent = {
        eventId: 'evt-s',
        agentId,
        sessionId,
        timestamp: new Date().toISOString(),
        action: 'READ',
        resource: 'doc',
        resourceType: 'document',
        scope: 'project.read',
        sensitivity: 'LOW',
        reversibility: 'REVERSIBLE',
        authorization: 'AUTHORIZED'
      };
      expect(calculateBaseActionRisk(safeAction)).toBeLessThanOrEqual(20);

      const severeAction: ActionEvent = {
        eventId: 'evt-u',
        agentId,
        sessionId,
        timestamp: new Date().toISOString(),
        action: 'DELETE',
        resource: 'db',
        resourceType: 'database',
        scope: 'admin',
        sensitivity: 'CRITICAL',
        reversibility: 'IRREVERSIBLE',
        authorization: 'UNAUTHORIZED'
      };
      expect(calculateBaseActionRisk(severeAction)).toBe(100);
    });
  });

  describe('Session Trajectory API endpoints', () => {
    it('updates session telemetry on action ingestion and returns trajectory', async () => {
      await request(app)
        .post('/api/v1/actions')
        .send({
          agentId,
          sessionId,
          action: 'READ',
          resource: 'project-specs',
          resourceType: 'document',
          scope: 'project.read',
          sensitivity: 'LOW',
          reversibility: 'REVERSIBLE'
        })
        .expect(200);

      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}/trajectory`)
        .expect(200);

      expect(res.body.sessionId).toBe(sessionId);
      expect(res.body.agentId).toBe(agentId);
      expect(res.body.actionCount).toBe(1);
      expect(res.body.currentRisk).toBeDefined();
      expect(res.body.trajectoryDeviation).toBeDefined();
      expect(res.body.riskDelta).toBeDefined();
      expect(res.body.riskVelocity).toBeDefined();
      expect(res.body.riskAcceleration).toBeDefined();
      expect(res.body.state).toBe('NORMAL');
      expect(res.body.features).toBeDefined();
      expect(res.body.components).toBeDefined();
      expect(res.body.actions).toHaveLength(1);
      expect(res.body.actions[0].action).toBe('READ');

      const riskRes = await request(app)
        .get(`/api/v1/sessions/${sessionId}/risk`)
        .expect(200);

      expect(riskRes.body.sessionId).toBe(sessionId);
      expect(riskRes.body.currentRisk).toBe(res.body.currentRisk);
      expect(riskRes.body.trajectoryDeviation).toBe(res.body.trajectoryDeviation);
      expect(riskRes.body.state).toBe(res.body.state);
    });

    it('persists telemetry and supports retrieval across multiple action sequence', async () => {
      const actions = [
        { action: 'READ', resource: 'doc-1', resourceType: 'document', scope: 'project.read', sensitivity: 'LOW' },
        { action: 'READ', resource: 'doc-2', resourceType: 'document', scope: 'project.read', sensitivity: 'LOW' },
        { action: 'WRITE', resource: 'doc-report', resourceType: 'document', scope: 'project.write', sensitivity: 'MEDIUM' }
      ];

      for (const act of actions) {
        await request(app)
          .post('/api/v1/actions')
          .send({
            agentId,
            sessionId,
            ...act,
            reversibility: 'REVERSIBLE'
          })
          .expect(200);
      }

      const session = await sessionRepository.findById(sessionId);
      expect(session).toBeDefined();
      expect(session?.actionCount).toBe(3);
      expect(session?.currentRisk).toBeGreaterThan(0);
      expect(session?.trajectoryState).toBeDefined();

      const trajRes = await request(app)
        .get(`/api/v1/sessions/${sessionId}/trajectory`)
        .expect(200);

      expect(trajRes.body.actionCount).toBe(3);
      expect(trajRes.body.actions).toHaveLength(3);
    });

    it('returns 404 for nonexistent session trajectory', async () => {
      await request(app)
        .get('/api/v1/sessions/nonexistent-id/trajectory')
        .expect(404);

      await request(app)
        .get('/api/v1/sessions/nonexistent-id/risk')
        .expect(404);
    });
  });
});
