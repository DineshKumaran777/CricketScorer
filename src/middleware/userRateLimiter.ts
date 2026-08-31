import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message: string;
}

interface UserRateLimitStore {
  [userId: string]: {
    requests: number;
    resetTime: number;
  };
}

class UserRateLimiter {
  private store: UserRateLimitStore = {};
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const userId in this.store) {
      if (this.store[userId].resetTime < now) {
        delete this.store[userId];
      }
    }
  }

  isAllowed(userId: string): boolean {
    const now = Date.now();
    const userKey = userId || 'anonymous';

    if (!this.store[userKey]) {
      this.store[userKey] = {
        requests: 1,
        resetTime: now + this.config.windowMs,
      };
      return true;
    }

    const userData = this.store[userKey];

    // Reset if window expired
    if (now > userData.resetTime) {
      userData.requests = 1;
      userData.resetTime = now + this.config.windowMs;
      return true;
    }

    // Check limit
    if (userData.requests < this.config.max) {
      userData.requests++;
      return true;
    }

    return false;
  }
}

export function createUserRateLimiter(config: RateLimitConfig) {
  const limiter = new UserRateLimiter(config);

  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as any).user?.userId || req.ip || 'anonymous';

    if (!limiter.isAllowed(userId)) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: config.message,
          retryAfter: `${Math.ceil(config.windowMs / 1000)}s`,
        },
      });
      return;
    }

    next();
  };
}

// Predefined limiters
export const scoringLimiter = createUserRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per user
  message: 'Too many scoring requests, please try again later',
});

export const apiLimiter = createUserRateLimiter({
  windowMs: 60 * 1000,
  max: 120, // 120 requests per minute per user
  message: 'Too many requests, please try again later',
});
