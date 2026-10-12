/**
 * Sentinel 2.0 — Phase 3 Deterministic Scenarios Runner
 *
 * Demonstrates behavioral trajectory tracking across 6 distinct scenarios:
 * 1. NORMAL_RESEARCH
 * 2. GRADUAL_SCOPE_CREEP
 * 3. SENSITIVE_DATA_ACCESS
 * 4. PRIVILEGE_ESCALATION
 * 5. DESTRUCTIVE_SEQUENCE
 * 6. LEGITIMATE_UNUSUAL_BEHAVIOR
 */

import { SCENARIOS, runScenario } from '../backend/src/modules/scenarios/index.js';

async function runAllScenarios() {
  console.log('\n============================================================');
  console.log(' SENTINEL 2.0 — BEHAVIORAL SCENARIOS & INTERVENTION LAB');
  console.log('============================================================');
  console.log('Evaluating behavioral drift, cumulative risk, intervention windows & forecast\n');

  for (const [key, scenario] of Object.entries(SCENARIOS)) {
    console.log(`------------------------------------------------------------`);
    console.log(`SCENARIO: ${scenario.name}`);
    console.log(`Goal: ${scenario.description}`);
    console.log(`Demonstrates: ${scenario.demonstrates}`);
    console.log(`------------------------------------------------------------`);

    try {
      const result = await runScenario(key);

      console.log(`Agent ID   : ${result.agentId}`);
      console.log(`Session ID : ${result.sessionId}`);
      console.log(`Steps Execution:`);

      for (let i = 0; i < result.results.length; i++) {
        const step = result.results[i];
        console.log(
          `  [Step ${i + 1}/${result.results.length}] ${step.action} ${step.resource}`
        );
        console.log(
          `    Authz: ${step.authorization.padEnd(12)} | Decision: ${step.decision.padEnd(8)} | Risk: ${step.risk.toString().padStart(2)}/100 | Dev: ${step.trajectoryDeviation.toString().padStart(2)}/100 | Window: [${step.window || 'N/A'}]`
        );
      }

      console.log(`Final Telemetry & Intervention Analysis:`);
      console.log(`  Current Risk        : ${result.finalTelemetry.currentRisk}/100`);
      console.log(`  Trajectory Deviation: ${result.finalTelemetry.trajectoryDeviation}/100`);
      console.log(`  Risk Velocity       : ${result.finalTelemetry.riskVelocity}`);
      console.log(`  Risk Acceleration   : ${result.finalTelemetry.riskAcceleration}`);
      console.log(`  Trajectory State    : [${result.finalTelemetry.state}]`);
      console.log(`  Intervention Window : [${result.intervention.interventionWindow}]`);
      console.log(`  Predicted Next Risk : ${result.forecast.nextActionRisk}/100 (${result.forecast.horizonLabel})`);
      console.log(`  Optimal Rationale   : ${result.counterfactual.optimalRationale}`);
      console.log(`  Expected State      : [${scenario.expectedFinalState}]`);
      console.log(`\n`);
    } catch (err) {
      console.error(`Error executing scenario ${key}:`, (err as Error).message);
    }
  }

  console.log('============================================================');
  console.log(' ALL DETERMINISTIC SCENARIOS EXECUTED SUCCESSFULLY');
  console.log('============================================================\n');
}

runAllScenarios().catch((err) => {
  console.error('Fatal error running scenarios:', err);
  process.exit(1);
});
