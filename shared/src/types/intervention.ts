import { HumanReviewStatus } from './review.js';

export type InterventionWindow = 'TOO_EARLY' | 'OPTIMAL_WINDOW' | 'TOO_LATE';

// Backward compatibility alias for Phase 0-2 vocabulary
export type InterventionWindowStage = InterventionWindow | 'MONITOR' | 'WARNING' | 'OPTIMAL_INTERVENTION_WINDOW' | 'CONFIRM';

export type InterventionUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type InterventionRecommendation =
  | 'ALLOW'
  | 'MONITOR'
  | 'WARN'
  | 'CONFIRM'
  | 'BLOCK';

export type InterventionCostLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type HumanDecisionAction = 'ALLOW_ONCE' | 'DENY' | 'REVOKE_SESSION';

export interface RiskForecast {
  nextActionRisk: number; // Projected risk for action t+1 (0-100)
  actionPlus2Risk: number; // Projected risk for action t+2 (0-100)
  actionPlus3Risk: number; // Projected risk for action t+3 (0-100)
  horizonLabel: string; // e.g. "CRITICAL_THRESHOLD_LIKELY_WITHIN_2_ACTIONS"
  trajectorySlope: number; // Estimated trajectory gradient
  confidence: number; // Confidence score (0-100)
}

export interface InterventionCost {
  level: InterventionCostLevel;
  workflowDisruption: 'MINIMAL' | 'MODERATE' | 'HIGH';
  reversibilityImpact: string;
  delayRiskScore: number; // Risk of waiting further (0-100)
  immediateCostScore: number; // Cost of intervening now (0-100)
  netSafetyGain: number; // delayRiskScore - immediateCostScore (-100 to 100)
}

export interface CounterfactualPath {
  path: 'EARLY' | 'RECOMMENDED' | 'LATE';
  estimatedRiskPrevented: 'LOW' | 'MODERATE' | 'HIGH' | 'MAXIMAL';
  interventionCost: 'LOW' | 'MEDIUM' | 'HIGH';
  workflowDisruption: 'LOW' | 'MEDIUM' | 'HIGH';
  potentialImpact: 'LOW' | 'MODERATE' | 'SEVERE';
  explanation: string;
}

export interface CounterfactualAnalysis {
  early: CounterfactualPath;
  recommended: CounterfactualPath;
  late: CounterfactualPath;
  optimalRationale: string;
}

export interface InterventionAnalysis {
  id: string;
  sessionId: string;
  actionEventId: string;
  currentRisk: number;
  previousRisk: number;
  riskDelta: number;
  riskVelocity: string;
  riskAcceleration: string;
  trajectoryDeviation: number;
  predictedRisk: number;
  predictedRiskHorizon: string;
  interventionWindow: InterventionWindow;
  urgency: InterventionUrgency;
  recommendedAction: InterventionRecommendation;
  interventionCost: InterventionCostLevel;
  estimatedRiskIfDelayed: number;
  estimatedRiskIfIntervenedNow: number;
  explanation: string;
  reasons: string[];
  confidence: number;
  timestamp: string;
  forecast?: RiskForecast;
  costAnalysis?: InterventionCost;
  counterfactual?: CounterfactualAnalysis;
}

export interface PendingInterventionRecord {
  id: string;
  sessionId: string;
  actionEventId: string;
  agentId: string;
  agentName: string;
  action: string;
  resource: string;
  resourceType: string;
  scope: string;
  sensitivity: string;
  reversibility: string;
  currentRisk: number;
  trajectoryDeviation: number;
  riskAcceleration: string;
  predictedRisk: number;
  interventionWindow: InterventionWindow;
  urgency: InterventionUrgency;
  recommendation: InterventionRecommendation;
  explanation: string;
  reasons: string[];
  status: HumanReviewStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionDecision?: HumanDecisionAction;
  resolutionNotes?: string;
  counterfactual?: CounterfactualAnalysis;
  forecast?: RiskForecast;
}

export interface HumanDecisionPayload {
  decision: HumanDecisionAction;
  reviewerId?: string;
  reason?: string;
}

export interface SessionInterventionResponse {
  sessionId: string;
  actionCount: number;
  analysis: InterventionAnalysis;
  pendingReview?: PendingInterventionRecord;
}
