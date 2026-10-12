/**
 * Sentinel 2.0 — External AI Agent Provider Gateway Integration Tests
 *
 * Verifies provider abstraction, mock fallback, Gemini response validation,
 * Sentinel policy decisions (ALLOW, MONITOR, WARN, CONFIRM, BLOCK),
 * and human intervention reviews without depending on external live network calls.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExternalAgentGateway } from '../src/modules/external-agent/gateway.js';
import { MockAgentProvider } from '../src/modules/external-agent/providers/mock.provider.js';
import { GeminiAgentProvider } from '../src/modules/external-agent/providers/gemini.provider.js';
import { validateProposedAction, ActionValidationError, extractJsonFromText } from '../src/modules/external-agent/validator.js';
import { agentRepository } from '../src/modules/agents/repository.js';
import { sessionRepository } from '../src/modules/sessions/repository.js';
import { actionEventRepository } from '../src/modules/actions/repository.js';

describe('External AI Agent Provider Gateway (Phase 6)', () => {
  let gateway: ExternalAgentGateway;

  beforeEach(async () => {
    if (agentRepository.clear) await agentRepository.clear();
    if (sessionRepository.clear) await sessionRepository.clear();
    if (actionEventRepository.clear) await actionEventRepository.clear();

    gateway = new ExternalAgentGateway();
  });

  describe('1. Provider Abstraction & Configuration', () => {
    it('MockProvider conforms to ExternalAgentProvider interface', () => {
      const mock = new MockAgentProvider();
      expect(mock.id).toBe('mock-provider');
      expect(mock.isConfigured).toBe(true);
      expect(typeof mock.generateNextAction).toBe('function');
    });

    it('GeminiProvider handles missing API key gracefully without crashing', () => {
      const gemini = new GeminiAgentProvider('', 'gemini-1.5-flash');
      expect(gemini.isConfigured).toBe(false);
      expect(gemini.modelName).toBe('gemini-1.5-flash');
    });

    it('Gateway reports provider status and falls back gracefully when key is missing', () => {
      const status = gateway.getStatus();
      expect(status.providerName).toBeDefined();
      expect(status.supportedScenarios.length).toBeGreaterThanOrEqual(6);
      expect(status.supportedScenarios).toContain('GEMINI_SCOPE_CREEP');
      expect(status.supportedScenarios).toContain('GEMINI_DESTRUCTIVE_ATTEMPT');
      expect(status.supportedScenarios).toContain('GEMINI_FALSE_POSITIVE');
      expect(status.supportedScenarios).toContain('GEMINI_FINANCIAL_AUDIT');
    });
  });

  describe('2. Model Output Validation (Zero-Trust Validation)', () => {
    it('successfully validates a clean structured object', () => {
      const input = {
        action: 'READ',
        resource: 'docs://sentinel/spec',
        resourceType: 'documentation',
        scope: 'project.read',
        sensitivity: 'LOW',
        reversibility: 'REVERSIBLE',
        reason: 'Read project documentation'
      };

      const validated = validateProposedAction(input);
      expect(validated.action).toBe('READ');
      expect(validated.resource).toBe('docs://sentinel/spec');
      expect(validated.scope).toBe('project.read');
      expect(validated.sensitivity).toBe('LOW');
      expect(validated.reversibility).toBe('REVERSIBLE');
    });

    it('strips markdown code fences (```json ... ```) from LLM output', () => {
      const rawLlmOutput = `Here is my proposed next action:
\`\`\`json
{
  "action": "READ",
  "resource": "src://backend/kernel",
  "resourceType": "source_code",
  "scope": "source.read",
  "sensitivity": "LOW",
  "reversibility": "REVERSIBLE",
  "reason": "Examine kernel router"
}
\`\`\`
I hope this meets Sentinel criteria.`;

      const validated = validateProposedAction(rawLlmOutput);
      expect(validated.action).toBe('READ');
      expect(validated.resource).toBe('src://backend/kernel');
      expect(validated.scope).toBe('source.read');
    });

    it('throws ActionValidationError when action is missing or invalid', () => {
      expect(() => {
        validateProposedAction({
          resource: 'docs://test',
          scope: 'test.read',
          sensitivity: 'LOW',
          reversibility: 'REVERSIBLE'
        });
      }).toThrow(ActionValidationError);

      expect(() => {
        validateProposedAction({
          action: 'INVALID_VERB',
          resource: 'docs://test',
          scope: 'test.read',
          sensitivity: 'LOW',
          reversibility: 'REVERSIBLE'
        });
      }).toThrow(ActionValidationError);
    });

    it('throws ActionValidationError when output contains no valid JSON', () => {
      expect(() => {
        extractJsonFromText('I cannot perform this operation because of system safety.');
      }).toThrow(ActionValidationError);
    });
  });

  describe('3. Controlled Agent Loop & Sentinel Policy Gate', () => {
    it('executes safe step yielding ALLOW', async () => {
      const { session } = await gateway.startSession({ scenarioId: 'GEMINI_NORMAL' });
      const step = await gateway.stepSession(session.id);

      expect(step.stepNumber).toBe(1);
      expect(step.decision).toBe('ALLOW');
      expect(step.executed).toBe(true);
      expect(step.halted).toBe(false);
      expect(step.simpleNarration).toBeDefined();
      expect(step.simpleNarration.what).toContain('Gemini wants to read');
    });

    it('executes medium sensitivity step yielding MONITOR', async () => {
      const { session } = await gateway.startSession({ scenarioId: 'GEMINI_NORMAL' });
      await gateway.stepSession(session.id); // Step 1: READ
      await gateway.stepSession(session.id); // Step 2: READ
      const step3 = await gateway.stepSession(session.id); // Step 3: WRITE (medium)

      expect(step3.decision).toBe('MONITOR');
      expect(step3.executed).toBe(true);
      expect(step3.halted).toBe(false);
    });

    it('pauses session with CONFIRM on unauthorized reversible access', async () => {
      const { session } = await gateway.startSession({ scenarioId: 'GEMINI_SCOPE_CREEP' });
      await gateway.stepSession(session.id); // Step 1
      await gateway.stepSession(session.id); // Step 2
      await gateway.stepSession(session.id); // Step 3
      const step4 = await gateway.stepSession(session.id); // Step 4: READ finance (unauthorized)

      expect(step4.decision).toBe('CONFIRM');
      expect(step4.humanReviewRequired).toBe(true);
      expect(step4.pendingInterventionId).toBeDefined();

      // Subsequent step should fail because session is paused awaiting review
      await expect(gateway.stepSession(session.id)).rejects.toThrow(/paused awaiting human intervention/);
    });

    it('allows session to resume after operator approves ALLOW_ONCE', async () => {
      const { session } = await gateway.startSession({ scenarioId: 'GEMINI_SCOPE_CREEP' });
      await gateway.stepSession(session.id);
      await gateway.stepSession(session.id);
      await gateway.stepSession(session.id);
      const step4 = await gateway.stepSession(session.id);

      expect(step4.decision).toBe('CONFIRM');

      // Operator approves one-time exception
      const approvedStep = await gateway.submitHumanDecision(session.id, 'ALLOW_ONCE', 'operator-jane');
      expect(approvedStep.humanDecision).toBe('ALLOW_ONCE');

      // Session can now proceed to next step
      const step5 = await gateway.stepSession(session.id);
      expect(step5.stepNumber).toBe(5);
    });

    it('halts and terminates session when operator submits DENY', async () => {
      const { session } = await gateway.startSession({ scenarioId: 'GEMINI_SCOPE_CREEP' });
      await gateway.stepSession(session.id);
      await gateway.stepSession(session.id);
      await gateway.stepSession(session.id);
      await gateway.stepSession(session.id);

      await gateway.submitHumanDecision(session.id, 'DENY', 'operator-jane');

      await expect(gateway.stepSession(session.id)).rejects.toThrow(/halted/);
    });

    it('immediately BLOCKS and terminates session on destructive DELETE', async () => {
      const { session } = await gateway.startSession({ scenarioId: 'GEMINI_DESTRUCTIVE_ATTEMPT' });
      await gateway.stepSession(session.id); // Step 1: READ
      await gateway.stepSession(session.id); // Step 2: READ
      const step3 = await gateway.stepSession(session.id); // Step 3: DELETE cluster

      expect(step3.decision).toBe('BLOCK');
      expect(step3.executed).toBe(false);
      expect(step3.halted).toBe(true);

      // Session cannot accept further steps
      await expect(gateway.stepSession(session.id)).rejects.toThrow(/halted/);
    });

    it('immediately BLOCKS on unauthorized PRIVILEGE_ESCALATION', async () => {
      const { session } = await gateway.startSession({ scenarioId: 'GEMINI_PRIVILEGE_ESCALATION' });
      await gateway.stepSession(session.id); // Step 1: READ
      const step2 = await gateway.stepSession(session.id); // Step 2: PRIVILEGE_ESCALATION

      expect(step2.decision).toBe('BLOCK');
      expect(step2.executed).toBe(false);
      expect(step2.halted).toBe(true);
    });

    it('runs complete controlled session through runFullSession()', async () => {
      const result = await gateway.runFullSession({
        scenarioId: 'GEMINI_NORMAL',
        maxSteps: 4
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.totalSteps).toBe(4);
      expect(result.steps.every((s) => s.decision === 'ALLOW' || s.decision === 'MONITOR')).toBe(true);
    });

    it('handles legitimate diagnostic work without blindly blocking (GEMINI_FALSE_POSITIVE)', async () => {
      const { session } = await gateway.startSession({ scenarioId: 'GEMINI_FALSE_POSITIVE' });
      const step1 = await gateway.stepSession(session.id); // READ runbooks
      expect(step1.decision).toBe('ALLOW');
      expect(step1.riskDelta).toBeDefined();

      const step2 = await gateway.stepSession(session.id); // READ kernel
      expect(step2.decision).toBe('ALLOW');

      const step3 = await gateway.stepSession(session.id); // EXPORT latency-dump.json
      // System evaluates context as authorized - should NOT blindly block!
      expect(step3.decision).not.toBe('BLOCK');
      expect(step3.executed).toBe(true);
      expect(step3.halted).toBe(false);
    });
  });
});
