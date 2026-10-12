import { describe, it, expect } from 'vitest';
import {
  DECISION_VOCABULARY,
  INTERVENTION_STAGE_VOCABULARY,
  mapDecisionToSimpleStatus,
  calculateRiskLevel
} from '../shared/src/index.js';

describe('Sentinel 2.0 System Contract & Vocabulary Verification', () => {
  it('contains all required decision types and their simple-mode mappings', () => {
    expect(mapDecisionToSimpleStatus('ALLOW')).toBe('SAFE');
    expect(mapDecisionToSimpleStatus('MONITOR')).toBe('WATCHING');
    expect(mapDecisionToSimpleStatus('WARNING')).toBe('ATTENTION');
    expect(mapDecisionToSimpleStatus('CONFIRM')).toBe('APPROVAL_NEEDED');
    expect(mapDecisionToSimpleStatus('BLOCK')).toBe('STOPPED');
  });

  it('defines the 6 intervention window stages accurately', () => {
    const stages = Object.keys(INTERVENTION_STAGE_VOCABULARY);
    expect(stages).toContain('TOO_EARLY');
    expect(stages).toContain('MONITOR');
    expect(stages).toContain('WARNING');
    expect(stages).toContain('OPTIMAL_INTERVENTION_WINDOW');
    expect(stages).toContain('CONFIRM');
    expect(stages).toContain('TOO_LATE');
    expect(INTERVENTION_STAGE_VOCABULARY.OPTIMAL_INTERVENTION_WINDOW.isOptimal).toBe(true);
  });

  it('computes risk levels across boundary values', () => {
    expect(calculateRiskLevel(5)).toBe('NONE');
    expect(calculateRiskLevel(25)).toBe('LOW');
    expect(calculateRiskLevel(50)).toBe('MEDIUM');
    expect(calculateRiskLevel(80)).toBe('HIGH');
    expect(calculateRiskLevel(95)).toBe('CRITICAL');
  });
});
