import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { signToken } from '../utils/jwt';
import { AppError, createError } from '../middleware/errorHandler';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255, 'Name must be at most 255 characters'),
  email: z.string().email('Please provide a valid email address').max(255),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address').max(255),
  password: z.string().min(1, 'Password is required').max(128),
});

// ─── POST /api/auth/register ─────────────────────────────────────────
router.post('/auth/register', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid input';
      throw createError('VALIDATION_ERROR', message);
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      throw createError('DUPLICATE_EVENT', 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const inserted = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        name,
        passwordHash,
      })
      .returning();

    const user = inserted[0];

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name || '',
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────
router.post('/auth/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Please provide a valid email and password');
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const found = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    const user = found[0];

    if (!user || !user.passwordHash) {
      throw createError('UNAUTHORIZED', 'Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw createError('UNAUTHORIZED', 'Invalid email or password');
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name || '',
    });

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
