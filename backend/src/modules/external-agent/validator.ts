/**
 * Sentinel 2.0 — External Agent Output Validator
 *
 * Enforces strict runtime validation on model-generated outputs.
 * Never trust raw model outputs.
 */

import { ActionType, ActionSensitivity, ActionReversibility } from '@sentinel/shared';
import { ProposedAction } from './types.js';

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

export class ActionValidationError extends Error {
  constructor(message: string, public readonly rawPayload?: unknown) {
    super(message);
    this.name = 'ActionValidationError';
  }
}

/**
 * Extracts and parses JSON from raw LLM text (handling markdown code blocks if present)
 */
export function extractJsonFromText(rawText: string): unknown {
  if (!rawText || typeof rawText !== 'string') {
    throw new ActionValidationError('Model produced empty or non-string output');
  }

  const trimmed = rawText.trim();

  // Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // Look for markdown code fence
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch (err) {
        throw new ActionValidationError(`Failed to parse JSON inside markdown code block: ${(err as Error).message}`, rawText);
      }
    }

    // Look for first '{' and last '}'
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch (err) {
        throw new ActionValidationError(`Failed to parse extracted JSON object: ${(err as Error).message}`, rawText);
      }
    }

    throw new ActionValidationError('Model output does not contain a valid JSON object', rawText);
  }
}

/**
 * Validates and normalizes raw model output into a strictly typed ProposedAction
 */
export function validateProposedAction(rawInput: unknown): ProposedAction {
  if (!rawInput) {
    throw new ActionValidationError('Proposed action is null or undefined');
  }

  let parsed: Record<string, unknown>;

  if (typeof rawInput === 'string') {
    const extracted = extractJsonFromText(rawInput);
    if (!extracted || typeof extracted !== 'object' || Array.isArray(extracted)) {
      throw new ActionValidationError('Parsed model output is not a JSON object', rawInput);
    }
    parsed = extracted as Record<string, unknown>;
  } else if (typeof rawInput === 'object' && !Array.isArray(rawInput)) {
    parsed = rawInput as Record<string, unknown>;
  } else {
    throw new ActionValidationError('Proposed action must be an object or JSON string', rawInput);
  }

  // 1. Validate action
  const rawAction = parsed.action;
  if (!rawAction || typeof rawAction !== 'string') {
    throw new ActionValidationError("Field 'action' is required and must be a string", rawInput);
  }
  const actionNormalized = rawAction.trim().toUpperCase() as ActionType;
  if (!VALID_ACTIONS.has(actionNormalized)) {
    throw new ActionValidationError(
      `Invalid action '${rawAction}'. Supported: ${Array.from(VALID_ACTIONS).join(', ')}`,
      rawInput
    );
  }

  // 2. Validate resource
  const rawResource = parsed.resource;
  if (!rawResource || typeof rawResource !== 'string' || rawResource.trim().length === 0) {
    throw new ActionValidationError("Field 'resource' is required and must be a non-empty string", rawInput);
  }
  const resource = rawResource.trim();

  // 3. Validate resourceType
  const rawResourceType = parsed.resourceType || parsed.resource_type || 'resource';
  const resourceType = typeof rawResourceType === 'string' && rawResourceType.trim().length > 0
    ? rawResourceType.trim()
    : 'resource';

  // 4. Validate scope
  const rawScope = parsed.scope;
  if (!rawScope || typeof rawScope !== 'string' || rawScope.trim().length === 0) {
    throw new ActionValidationError("Field 'scope' is required and must be a non-empty string", rawInput);
  }
  const scope = rawScope.trim();

  // 5. Validate sensitivity
  const rawSensitivity = parsed.sensitivity;
  if (!rawSensitivity || typeof rawSensitivity !== 'string') {
    throw new ActionValidationError("Field 'sensitivity' is required and must be a string", rawInput);
  }
  const sensitivityNormalized = rawSensitivity.trim().toUpperCase() as ActionSensitivity;
  if (!VALID_SENSITIVITIES.has(sensitivityNormalized)) {
    throw new ActionValidationError(
      `Invalid sensitivity '${rawSensitivity}'. Supported: ${Array.from(VALID_SENSITIVITIES).join(', ')}`,
      rawInput
    );
  }

  // 6. Validate reversibility
  const rawReversibility = parsed.reversibility;
  if (!rawReversibility || typeof rawReversibility !== 'string') {
    throw new ActionValidationError("Field 'reversibility' is required and must be a string", rawInput);
  }
  const reversibilityNormalized = rawReversibility.trim().toUpperCase() as ActionReversibility;
  if (!VALID_REVERSIBILITIES.has(reversibilityNormalized)) {
    throw new ActionValidationError(
      `Invalid reversibility '${rawReversibility}'. Supported: ${Array.from(VALID_REVERSIBILITIES).join(', ')}`,
      rawInput
    );
  }

  // 7. Validate reason
  const rawReason = parsed.reason || parsed.justification || parsed.description;
  const reason = typeof rawReason === 'string' && rawReason.trim().length > 0
    ? rawReason.trim()
    : `Agent proposed ${actionNormalized} on ${resource}`;

  return {
    action: actionNormalized,
    resource,
    resourceType,
    scope,
    sensitivity: sensitivityNormalized,
    reversibility: reversibilityNormalized,
    reason,
    tool: typeof parsed.tool === 'string' ? parsed.tool : undefined,
    toolParams: typeof parsed.toolParams === 'object' && parsed.toolParams !== null && !Array.isArray(parsed.toolParams)
      ? (parsed.toolParams as Record<string, unknown>)
      : undefined,
    rawModelOutput: typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput)
  };
}
