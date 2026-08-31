import { Request, Response, NextFunction } from 'express';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_MATCH_STATE'
  | 'INVALID_DELIVERY'
  | 'DUPLICATE_EVENT'
  | 'CONCURRENCY_CONFLICT'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

const ERROR_CODE_TO_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_MATCH_STATE: 409,
  INVALID_DELIVERY: 422,
  DUPLICATE_EVENT: 409,
  CONCURRENCY_CONFLICT: 409,
  DATABASE_ERROR: 500,
  INTERNAL_ERROR: 500,
};

function logError(err: Error, req: Request) {
  const duration = Date.now() - (req as any).startTime || 0;
  const entry = {
    level: 'error' as const,
    type: 'ERROR',
    message: err.message,
    code: err instanceof AppError ? err.code : 'INTERNAL_ERROR',
    statusCode: err instanceof AppError ? err.statusCode : 500,
    requestId: req.headers['x-request-id'] as string | undefined,
    userId: (req as any).user?.userId,
    method: req.method,
    path: req.originalUrl,
    duration: `${duration}ms`,
    isOperational: err instanceof AppError ? err.isOperational : false,
    timestamp: new Date().toISOString(),
  };

  // Always log errors for debugging
  console.error(JSON.stringify(entry));
  
  // Also log stack trace in non-production
  if (process.env.NODE_ENV !== 'production') {
    console.error('Stack:', err.stack);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logError(err, req);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  const statusCode = 500;
  const response: any = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };

  if (process.env.NODE_ENV !== 'production') {
    response.error.message = err.message;
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

export function createError(code: ErrorCode, message: string): AppError {
  const statusCode = ERROR_CODE_TO_STATUS[code];
  return new AppError(message, statusCode, code);
}

export function throwNotFound(resource: string): AppError {
  return createError('NOT_FOUND', `${resource} not found`);
}

export function throwUnauthorized(message: string = 'Unauthorized'): AppError {
  return createError('UNAUTHORIZED', message);
}

export function throwForbidden(message: string = 'Forbidden'): AppError {
  return createError('FORBIDDEN', message);
}

export function throwValidation(message: string): AppError {
  return createError('VALIDATION_ERROR', message);
}

export function throwConcurrency(message: string = 'Concurrent modification detected'): AppError {
  return createError('CONCURRENCY_CONFLICT', message);
}
