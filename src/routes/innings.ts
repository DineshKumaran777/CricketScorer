import { Router, Request, Response } from 'express';
import { db } from '../db';
import { innings, matches } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { createError, AppError } from '../middleware/errorHandler';

const router = Router();

router.use(authMiddleware);

router.post(
  '/matches/:matchId/innings',
  async (req: Request, res: Response) => {
    try {
      const matchId = req.params.matchId;

      const match = await db
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1);

      if (match.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Match not found',
        });
        return;
      }

      if (match[0].userEmail !== req.user!.email) {
        throw createError('FORBIDDEN', 'Not authorized');
      }

      const { battingTeam, bowlingTeam, inningsNumber } = req.body;

      if (!battingTeam || !bowlingTeam) {
        res.status(400).json({
          success: false,
          message: 'battingTeam and bowlingTeam are required',
        });
        return;
      }

      if (!inningsNumber) {
        res.status(400).json({
          success: false,
          message: 'inningsNumber is required',
        });
        return;
      }

      const newInnings = {
        matchId,
        inningsNumber,
        battingTeam,
        bowlingTeam,
      };

      const result = await db.insert(innings).values(newInnings).returning();

      res.status(201).json({
        success: true,
        data: result[0],
      });
    } catch (error: any) {
      if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
      console.error('Create innings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create innings',
      });
    }
  }
);

router.get(
  '/matches/:matchId/innings',
  async (req: Request, res: Response) => {
    try {
      const matchId = req.params.matchId;

      const match = await db
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1);

      if (match.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Match not found',
        });
        return;
      }

      if (match[0].userEmail !== req.user!.email) {
        throw createError('FORBIDDEN', 'Not authorized');
      }

      const result = await db
        .select()
        .from(innings)
        .where(eq(innings.matchId, matchId))
        .orderBy(innings.inningsNumber);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
      console.error('Get innings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch innings',
      });
    }
  }
);

router.patch('/innings/:id', async (req: Request, res: Response) => {
  try {
    const inningsId = req.params.id;

    const existing = await db
      .select()
      .from(innings)
      .where(eq(innings.id, inningsId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Innings not found',
      });
      return;
    }

    const ownerMatch = await db
      .select()
      .from(matches)
      .where(eq(matches.id, existing[0].matchId))
      .limit(1);

    if (ownerMatch.length === 0 || ownerMatch[0].userEmail !== req.user!.email) {
      throw createError('FORBIDDEN', 'Not authorized');
    }

    const allowedFields = [
      'totalRuns',
      'totalWickets',
      'totalBalls',
      'totalOvers',
      'extrasWides',
      'extrasNoBalls',
      'extrasByes',
      'extrasLegByes',
      'extrasPenalty',
      'declared',
      'status',
    ];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const result = await db
      .update(innings)
      .set(updateData)
      .where(eq(innings.id, inningsId))
      .returning();

    res.status(200).json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Update innings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update innings',
    });
  }
});

export default router;
