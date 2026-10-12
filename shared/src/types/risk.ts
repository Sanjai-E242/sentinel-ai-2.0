/**
 * Risk Assessment types
 */
export type RiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskFactor {
  category: string;
  weight: number;
  score: number;
  description: string;
}

export interface RiskComponents {
  resourceSensitivity: number; // 0 - 100
  actionSeverity: number;      // 0 - 100
  trajectoryDeviation: number;  // 0 - 100
  acceleration: number;        // rate of risk change
  reversibilityPenalty: number;// impact of irreversible operation
}

export interface RiskAssessment {
  id: string;
  actionId: string;
  overallScore: number; // 0 - 100
  level: RiskLevel;
  components: RiskComponents;
  factors: RiskFactor[];
  timestamp: string;
  explanation: string;
}
