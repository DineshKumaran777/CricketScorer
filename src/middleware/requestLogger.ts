import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      startTime?: number;
    }
  }
}

export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  req.startTime = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || '';

  // Log request
  const requestLog = {
    level: 'info',
    type: 'REQUEST',
    requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    userId: (req as any).user?.userId,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(requestLog));

  // Intercept response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - (req.startTime || Date.now());
    const responseLog = {
      level: 'info',
      type: 'RESPONSE',
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: (req as any).user?.userId,
      timestamp: new Date().toISOString(),
    };
    console.log(JSON.stringify(responseLog));
    return originalSend.call(this, data);
  };

  next();
}
