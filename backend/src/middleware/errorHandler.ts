import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;
  public isOperational: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code = 'NOT_FOUND', details?: unknown) {
    super(message, 404, code, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, code = 'FORBIDDEN', details?: unknown) {
    super(message, 403, code, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = 'BAD_REQUEST', details?: unknown) {
    super(message, 400, code, details);
  }
}

export class ThrottledError extends AppError {
  constructor(message = 'Request rate limit exceeded. Please retry later.', details?: unknown) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = 'statusCode' in err ? err.statusCode : 500;
  const code = 'code' in err ? err.code : 'INTERNAL_ERROR';
  const details = 'details' in err ? err.details : undefined;
  const message = err.message || 'Internal server error';
  const requestId = req.id || (req.headers['x-request-id'] as string) || 'unknown';

  if (statusCode >= 500) {
    console.error(`[Error] ${statusCode} [${code}] [${requestId}] - ${message}`, err.stack);
  }

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    error: {
      code,
      message: process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'An unexpected internal error occurred'
        : message,
      details
    },
    message: process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'An unexpected internal error occurred'
      : message,
    requestId,
    timestamp: new Date().toISOString()
  });
}
