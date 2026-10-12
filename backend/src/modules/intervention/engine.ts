import crypto from 'crypto';
import {
  ActionEvent,
  Session,
  InterventionAnalysis,
  RiskVelocity,
  RiskAcceleration
} from '@sentinel/shared';
import { calculateRiskForecast } from './forecast.js';
import { evaluateInterventionCost } from './cost.js';
import { determineInterventionWindow } from './window.js';
import { generateCounterfactualAnalysis } from './counterfactual.js';

export interface EvaluateInterventionParams {
  action: ActionEvent;
  session: Session;
  currentRisk: number;
  previousRisk?: number;
  riskDelta: number;
  riskVelocity: RiskVelocity;
  riskAcceleration: RiskAcceleration;
  trajectoryDeviation: number;
}

export class InterventionEngine {
  /**
   * Evaluates complete Intervention Analysis for an action step within a session
   */
  public evaluate(params: EvaluateInterventionParams): InterventionAnalysis {
    const {
      action,
      session,
      currentRisk,
      previousRisk = 0,
      riskDelta,
      riskVelocity,
      riskAcceleration,
      trajectoryDeviation
    } = params;

    const id = `int_${crypto.randomBytes(8).toString('hex')}`;
    const timestamp = action.timestamp || new Date().toISOString();
    const isAuthorized = action.authorization === 'AUTHORIZED';

    // 1. Calculate Multi-Step Forward Forecast
    const forecast = calculateRiskForecast({
      currentRisk,
      riskDelta,
      riskVelocity,
      riskAcceleration,
      trajectoryDeviation
    });

    // 2. Evaluate Intervention Cost vs. Delay Risk
    const costAnalysis = evaluateInterventionCost({
      action: action.action,
      reversibility: action.reversibility,
      sensitivity: action.sensitivity,
      currentRisk,
      predictedRisk: forecast.nextActionRisk,
      trajectoryDeviation,
      isAuthorized
    });

    // 3. Determine Optimal Intervention Window
    const windowResult = determineInterventionWindow({
      currentRisk,
      trajectoryDeviation,
      riskDelta,
      riskVelocity,
      riskAcceleration,
      predictedRisk: forecast.nextActionRisk,
      action: action.action,
      sensitivity: action.sensitivity,
      reversibility: action.reversibility,
      isAuthorized,
      netSafetyGain: costAnalysis.netSafetyGain
    });

    // 4. Generate Three-Path Counterfactual Simulation
    const counterfactual = generateCounterfactualAnalysis({
      currentRisk,
      predictedRisk: forecast.nextActionRisk,
      trajectoryDeviation,
      interventionWindow: windowResult.window,
      action: action.action,
      isReversible: action.reversibility === 'REVERSIBLE'
    });

    return {
      id,
      sessionId: session.id,
      actionEventId: action.eventId,
      currentRisk,
      previousRisk,
      riskDelta,
      riskVelocity,
      riskAcceleration,
      trajectoryDeviation,
      predictedRisk: forecast.nextActionRisk,
      predictedRiskHorizon: forecast.horizonLabel,
      interventionWindow: windowResult.window,
      urgency: windowResult.urgency,
      recommendedAction: windowResult.recommendedAction,
      interventionCost: costAnalysis.level,
      estimatedRiskIfDelayed: costAnalysis.delayRiskScore,
      estimatedRiskIfIntervenedNow: costAnalysis.immediateCostScore,
      explanation: windowResult.explanation,
      reasons: windowResult.reasons,
      confidence: forecast.confidence,
      timestamp,
      forecast,
      costAnalysis,
      counterfactual
    };
  }
}

export const interventionEngine = new InterventionEngine();
