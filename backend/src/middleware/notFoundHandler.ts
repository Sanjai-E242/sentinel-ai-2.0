import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from './errorHandler.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl} - Route not found`, 'ROUTE_NOT_FOUND'));
}
