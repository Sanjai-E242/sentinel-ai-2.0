import { AppError } from '../middleware/errorHandler.js';

export interface PostgrestErrorLike {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

export type DatabaseError = AppError;

export function handleDatabaseError(err: PostgrestErrorLike | Error | unknown, operation: string): never {
  if (!err) {
    throw new AppError(`Database operation '${operation}' failed with unknown error`, 500, 'DATABASE_ERROR');
  }

  const pgErr = err as PostgrestErrorLike;
  const message = pgErr.message || (err as Error).message || 'Database error occurred';
  const code = pgErr.code;

  // Sanitize message: never expose internal auth tokens or service keys
  const safeMessage = message.replace(/(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g, '[REDACTED_JWT]');

  // 23505: Unique constraint violation (duplicate key) -> 409 Conflict
  if (code === '23505') {
    throw new AppError(`Duplicate record found during ${operation}: ${safeMessage}`, 409, 'DUPLICATE_RECORD', { operation });
  }

  // 23503: Foreign key violation (referenced entity does not exist) -> 400 Bad Request
  if (code === '23503') {
    throw new AppError(`Referenced entity does not exist during ${operation}: ${safeMessage}`, 400, 'FOREIGN_KEY_VIOLATION', { operation });
  }

  // Connection/Network or PostgREST service errors -> 503 Service Unavailable
  const lowerMsg = message.toLowerCase();
  if (
    code === 'PGRST301' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('connection terminated') ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('unreachable')
  ) {
    throw new AppError('Database service temporarily unavailable', 503, 'DATABASE_UNAVAILABLE', {
      operation
    });
  }

  throw new AppError(`Database operation failed: ${safeMessage}`, 500, 'DATABASE_ERROR', {
    operation,
    code
  });
}
