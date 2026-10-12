import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'] as string;
  const requestId = existingId && existingId.trim().length > 0
    ? existingId
    : `req_${crypto.randomBytes(8).toString('hex')}`;

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
