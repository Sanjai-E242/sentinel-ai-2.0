import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { simulationService } from '../src/modules/intervention/simulation.service.js';
import { agentRepository } from '../src/modules/agents/repository.js';
import { sessionRepository } from '../src/modules/sessions/repository.js';
import { actionEventRepository } from '../src/modules/actions/repository.js';
import { ActionEvent } from '@sentinel/shared';

describe('Counterfactual Intervention Simulator', () => {
  const agentId = 'agent-sim-test-01';
  const sessionId = 'session-sim-test-01';

  // Canonical 7-step test trajectory matching the user's specification:
  // Action 1: Risk 12 (ALLOW)
  // Action 2: Risk 18 (ALLOW)
  // Action 3: Risk 27 (MONITOR)
  // Action 4: Risk 42 (OPTIMAL_WINDOW / CONFIRM)
  // Action 5: Risk 67 (OPTIMAL_WINDOW / CONFIRM)
  // Action 6: Risk 82 (ESCALATING)
  // Action 7: Risk 94 (TOO_LATE / BLOCK)
  const canonicalTestActions: ActionEvent[] = [
    {
      eventId: 'evt_test_1',
      agentId,
      sessionId,
      timestamp: '2026-09-25T10:00:00.000Z',
      action: 'READ',
      resource: 'project/docs',
      resourceType: 'document',
      scope: 'project.read',
      sensitivity: 'LOW',
      reversibility: 'REVERSIBLE',
      authorization: 'AUTHORIZED',
      metadata: { risk: 12, trajectoryDeviation: 8, interventionWindow: 'TOO_EARLY', decision: { action: 'ALLOW' } }
    },
    {
      eventId: 'evt_test_2',
      agentId,
      sessionId,
      timestamp: '2026-09-25T10:01:00.000Z',
      action: 'READ',
      resource: 'project/source',
      resourceType: 'source_code',
      scope: 'source.read',
      sensitivity: 'LOW',
      reversibility: 'REVERSIBLE',
      authorization: 'AUTHORIZED',
      metadata: { risk: 18, trajectoryDeviation: 14, interventionWindow: 'TOO_EARLY', decision: { action: 'ALLOW' } }
    },
    {
      eventId: 'evt_test_3',
      agentId,
      sessionId,
      timestamp: '2026-09-25T10:02:00.000Z',
      action: 'WRITE',
      resource: 'project/report',
      resourceType: 'report',
      scope: 'project.write',
      sensitivity: 'MEDIUM',
      reversibility: 'REVERSIBLE',
      authorization: 'AUTHORIZED',
      metadata: { risk: 27, trajectoryDeviation: 22, interventionWindow: 'TOO_EARLY', decision: { action: 'MONITOR' } }
    },
    {
      eventId: 'evt_test_4',
      agentId,
      sessionId,
      timestamp: '2026-09-25T10:03:00.000Z',
      action: 'READ',
      resource: 'finance/data',
      resourceType: 'financial_records',
      scope: 'finance.read',
      sensitivity: 'HIGH',
      reversibility: 'REVERSIBLE',
      authorization: 'UNAUTHORIZED',
      metadata: { risk: 42, trajectoryDeviation: 45, interventionWindow: 'OPTIMAL_WINDOW', decision: { action: 'CONFIRM' } }
    },
    {
      eventId: 'evt_test_5',
      agentId,
      sessionId,
      timestamp: '2026-09-25T10:04:00.000Z',
      action: 'READ',
      resource: 'employee/data',
      resourceType: 'personnel_records',
      scope: 'employee.read',
      sensitivity: 'HIGH',
      reversibility: 'REVERSIBLE',
      authorization: 'UNAUTHORIZED',
      metadata: { risk: 67, trajectoryDeviation: 62, interventionWindow: 'OPTIMAL_WINDOW', decision: { action: 'CONFIRM' } }
    },
    {
      eventId: 'evt_test_6',
      agentId,
      sessionId,
      timestamp: '2026-09-25T10:05:00.000Z',
      action: 'READ',
      resource: 'admin/config',
      resourceType: 'system_config',
      scope: 'admin.read',
      sensitivity: 'CRITICAL',
      reversibility: 'REVERSIBLE',
      authorization: 'UNAUTHORIZED',
      metadata: { risk: 82, trajectoryDeviation: 76, interventionWindow: 'OPTIMAL_WINDOW', decision: { action: 'CONFIRM' } }
    },
    {
      eventId: 'evt_test_7',
      agentId,
      sessionId,
      timestamp: '2026-09-25T10:06:00.000Z',
      action: 'DELETE',
      resource: 'production/resource',
      resourceType: 'cluster_resource',
      scope: 'production.delete',
      sensitivity: 'CRITICAL',
      reversibility: 'IRREVERSIBLE',
      authorization: 'UNAUTHORIZED',
      metadata: { risk: 94, trajectoryDeviation: 87, interventionWindow: 'TOO_LATE', decision: { action: 'BLOCK' } }
    }
  ];

  beforeEach(async () => {
    if (agentRepository.clear) await agentRepository.clear();
    if (sessionRepository.clear) await sessionRepository.clear();
    if (actionEventRepository.clear) await actionEventRepository.clear();

    await agentRepository.create({
      id: agentId,
      name: 'Simulation Test Agent',
      type: 'external-ai-agent',
      status: 'ACTIVE',
      scopes: ['project.read', 'project.write', 'source.read'],
      createdAt: new Date().toISOString()
    });

    await sessionRepository.create({
      id: sessionId,
      agentId,
      status: 'ACTIVE',
      startedAt: '2026-09-25T10:00:00.000Z',
      currentRisk: 94,
      trajectoryDeviation: 87,
      actionCount: 7
    });

    for (const act of canonicalTestActions) {
      await actionEventRepository.create(act);
    }
  });

  it('1. Early intervention simulation demonstrates premature interruption and workflow friction', async () => {
    const early = simulationService.simulateInterventionScenario({
      trajectory: canonicalTestActions,
      interventionPoint: 2, // Action 2 (read_source_code, Risk 18)
      scenarioType: 'early'
    });

    expect(early.outcomeCategory).toBe('EARLY_INTERVENTION');
    expect(early.scenarioType).toBe('early');
    expect(early.interventionIndex).toBe(2);
    expect(early.interventionAction.resource).toBe('project/source');
    expect(early.riskAtIntervention).toBe(18);
    expect(early.actionsExecutedBeforeIntervention.length).toBe(2);
    expect(early.actionsPreventedAfterIntervention.length).toBe(5);
    expect(early.workflowImpact.frictionLevel).toBe('HIGH');
    expect(early.workflowImpact.unnecessaryInterruption).toBe(true);
    expect(early.explanation).toContain('intervened prematurely');
  });

  it('2. Optimal intervention simulation uses Sentinel OPTIMAL_WINDOW and prevents destructive actions', async () => {
    const optimal = simulationService.simulateInterventionScenario({
      trajectory: canonicalTestActions,
      interventionPoint: 4, // Action 4 (read_finance_data, Risk 42, OPTIMAL_WINDOW)
      scenarioType: 'optimal'
    });

    expect(optimal.outcomeCategory).toBe('OPTIMAL_INTERVENTION');
    expect(optimal.scenarioType).toBe('optimal');
    expect(optimal.interventionIndex).toBe(4);
    expect(optimal.interventionAction.resource).toBe('finance/data');
    expect(optimal.riskAtIntervention).toBe(42);
    expect(optimal.actionsExecutedBeforeIntervention.length).toBe(4);
    expect(optimal.actionsPreventedAfterIntervention.length).toBe(3);
    expect(optimal.workflowImpact.riskContained).toBe(true);
    expect(optimal.workflowImpact.frictionLevel).toBe('LOW');

    // Confirm that the destructive action (Action 7) was among the prevented actions
    const preventedActions = optimal.actionsPreventedAfterIntervention;
    const destructiveAction = preventedActions.find((a) => a.action === 'DELETE');
    expect(destructiveAction).toBeDefined();
    expect(destructiveAction?.resource).toBe('production/resource');
    expect(optimal.explanation).toContain('OPTIMAL_WINDOW');
  });

  it('3. Late intervention simulation demonstrates critical risk progression and collapsed safety margins', async () => {
    const late = simulationService.simulateInterventionScenario({
      trajectory: canonicalTestActions,
      interventionPoint: 7, // Action 7 (delete_resource, Risk 94)
      scenarioType: 'late'
    });

    expect(late.outcomeCategory).toBe('LATE_INTERVENTION');
    expect(late.scenarioType).toBe('late');
    expect(late.interventionIndex).toBe(7);
    expect(late.riskAtIntervention).toBe(94);
    expect(late.finalSimulatedState).toBe('CRITICAL');
    expect(late.actionsExecutedBeforeIntervention.length).toBe(7);
    expect(late.actionsPreventedAfterIntervention.length).toBe(0);
    expect(late.workflowImpact.missedEarlyWarning).toBe(true);
    expect(late.explanation).toContain('delayed intervention');
  });

  it('4. Same trajectory is used by all scenarios without data mutation', async () => {
    const comparison = await simulationService.simulateAllForSession(sessionId);

    expect(comparison.trajectoryTotalSteps).toBe(7);
    expect(comparison.simulations.early).toBeDefined();
    expect(comparison.simulations.optimal).toBeDefined();
    expect(comparison.simulations.late).toBeDefined();

    // Verify all scenarios operated on the exact same 7 steps
    const earlyTotal = comparison.simulations.early.actionsExecutedBeforeIntervention.length +
      comparison.simulations.early.actionsPreventedAfterIntervention.length;
    const optimalTotal = comparison.simulations.optimal.actionsExecutedBeforeIntervention.length +
      comparison.simulations.optimal.actionsPreventedAfterIntervention.length;
    const lateTotal = comparison.simulations.late.actionsExecutedBeforeIntervention.length +
      comparison.simulations.late.actionsPreventedAfterIntervention.length;

    expect(earlyTotal).toBe(7);
    expect(optimalTotal).toBe(7);
    expect(lateTotal).toBe(7);

    // Verify step order: early < optimal <= late
    expect(comparison.earlyInterventionIndex).toBeLessThan(comparison.optimalInterventionIndex);
    expect(comparison.optimalInterventionIndex).toBeLessThanOrEqual(comparison.lateInterventionIndex);

    // Verify underlying actions in database remained unchanged
    const dbActions = await actionEventRepository.findBySessionId(sessionId);
    expect(dbActions.length).toBe(7);
    expect(dbActions[0].resource).toBe('project/docs');
    expect(dbActions[6].resource).toBe('production/resource');
  });

  it('5. No real destructive tool is executed during simulation', async () => {
    // Calling simulation repeatedly does not trigger deletions, network calls, or side effects
    const beforeCount = (await actionEventRepository.findBySessionId(sessionId)).length;
    await simulationService.simulateAllForSession(sessionId);
    await simulationService.simulateSessionScenario(sessionId, 'optimal');
    await simulationService.simulateSessionScenario(sessionId, 'late');
    const afterCount = (await actionEventRepository.findBySessionId(sessionId)).length;

    expect(beforeCount).toBe(7);
    expect(afterCount).toBe(7);
  });

  it('6. Optimal scenario uses the existing intervention-window calculation', async () => {
    const comparison = await simulationService.simulateAllForSession(sessionId);
    // In our test actions, Action 4 is the first OPTIMAL_WINDOW action
    expect(comparison.optimalInterventionIndex).toBe(4);
    expect(comparison.simulations.optimal.interventionAction.resource).toBe('finance/data');
    expect(comparison.simulations.optimal.interventionAction.metadata?.interventionWindow).toBe('OPTIMAL_WINDOW');
  });

  it('7. POST /api/v1/sessions/:id/simulate-intervention returns single scenario or full comparison', async () => {
    // Requesting optimal scenario
    const optRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/simulate-intervention`)
      .send({ scenario: 'optimal' })
      .expect(200);

    expect(optRes.body.simulation).toBeDefined();
    expect(optRes.body.simulation.outcomeCategory).toBe('OPTIMAL_INTERVENTION');
    expect(optRes.body.comparison).toBeDefined();

    // Requesting early scenario
    const earlyRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/simulate-intervention`)
      .send({ scenario: 'early' })
      .expect(200);

    expect(earlyRes.body.simulation.outcomeCategory).toBe('EARLY_INTERVENTION');

    // Requesting all scenarios
    const allRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/simulate-intervention`)
      .send({ scenario: 'all' })
      .expect(200);

    expect(allRes.body.simulations).toBeDefined();
    expect(allRes.body.simulations.early).toBeDefined();
    expect(allRes.body.simulations.optimal).toBeDefined();
    expect(allRes.body.simulations.late).toBeDefined();
    expect(allRes.body.comparisonSummary).toBeDefined();
  });

  it('8. GET /api/v1/sessions/:id/simulate-intervention returns complete comparison', async () => {
    const res = await request(app)
      .get(`/api/v1/sessions/${sessionId}/simulate-intervention`)
      .expect(200);

    expect(res.body.simulations).toBeDefined();
    expect(res.body.simulations.early.outcomeCategory).toBe('EARLY_INTERVENTION');
    expect(res.body.simulations.optimal.outcomeCategory).toBe('OPTIMAL_INTERVENTION');
    expect(res.body.simulations.late.outcomeCategory).toBe('LATE_INTERVENTION');
    expect(res.body.trajectoryTimeline.length).toBe(7);
    expect(res.body.comparisonSummary.recommendedWindow).toBe('OPTIMAL_WINDOW');
  });

  it('9. Canonical Gemini demo fallback handles zero-setup or default demo session', async () => {
    const res = await request(app)
      .get('/api/v1/sessions/canonical-gemini/simulate-intervention')
      .expect(200);

    expect(res.body.sessionId).toBe('canonical-gemini');
    expect(res.body.trajectoryTotalSteps).toBe(7);
    expect(res.body.simulations.early).toBeDefined();
    expect(res.body.simulations.optimal).toBeDefined();
    expect(res.body.simulations.late).toBeDefined();
    expect(res.body.simulations.optimal.riskAtIntervention).toBe(42);
    expect(res.body.simulations.late.riskAtIntervention).toBe(94);
  });
});
