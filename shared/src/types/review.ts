/**
 * Human in the loop review definitions
 */
export type HumanReviewStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'REJECTED' | 'EXPIRED';

export interface HumanReview {
  id: string;
  decisionId: string;
  agentId: string;
  actionId: string;
  status: HumanReviewStatus;
  requestedAt: string;
  resolvedAt?: string;
  reviewerId?: string;
  reviewNotes?: string;
}
