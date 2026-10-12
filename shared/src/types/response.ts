/**
 * Standardized API Response contracts
 */
export interface ApiResponse<T> {
  data: T;
  requestId: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
  requestId: string;
}
