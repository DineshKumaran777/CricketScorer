import { Router, Request, Response } from 'express';
import { db } from '../db';
import { batters, innings, matches } from '../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { createError, AppError } from '../middleware/errorHandler';

const router = Router();

router.use(authMiddleware);

router.post(
  '/innings/:inningsId/batters',
  async (req: Request, res: Response) => {
    try {
      const inningsId = req.params.inningsId;

      const inningsData = await db
        .select()
        .from(innings)
        .where(eq(innings.id, inningsId))
        .limit(1);

      if (inningsData.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Innings not found',
        });
        return;
      }

      const ownerMatch = await db
        .select()
        .from(matches)
        .where(eq(matches.id, inningsData[0].matchId))
        .limit(1);

      if (ownerMatch.length === 0 || ownerMatch[0].userEmail !== req.user!.email) {
        throw createError('FORBIDDEN', 'Not authorized');
      }

      const { playerName, matchPlayerId, position, isStriker, isNonStriker } = req.body;

      if (!playerName) {
        res.status(400).json({
          success: false,
          message: 'playerName is required',
        });
        return;
      }

      const newBatter: typeof batters.$inferInsert = {
        inningsId,
        playerName,
        position: position || 0,
        isStriker: isStriker || false,
        isNonStriker: isNonStriker || false,
      };

      if (matchPlayerId) {
        newBatter.matchPlayerId = matchPlayerId;
      }

      const result = await db.insert(batters).values(newBatter).returning();

      res.status(201).json({
        success: true,
        data: result[0],
      });
    } catch (error: any) {
      if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
      console.error('Create batter error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add batter',
      });
    }
  }
);

router.get(
  '/innings/:inningsId/batters',
  async (req: Request, res: Response) => {
    try {
      const inningsId = req.params.inningsId;

      const result = await db
        .select()
        .from(batters)
        .where(eq(batters.inningsId, inningsId))
        .orderBy(asc(batters.position));

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Get batters error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch batters',
      });
    }
  }
);

router.patch('/batters/:id', async (req: Request, res: Response) => {
  try {
    const batterId = req.params.id;

    const existing = await db
      .select()
      .from(batters)
      .where(eq(batters.id, batterId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Batter not found',
      });
      return;
    }

    const batterInnings = await db
      .select()
      .from(innings)
      .where(eq(innings.id, existing[0].inningsId))
      .limit(1);

    if (batterInnings.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Innings not found',
      });
      return;
    }

    const ownerMatch = await db
      .select()
      .from(matches)
      .where(eq(matches.id, batterInnings[0].matchId))
      .limit(1);

    if (ownerMatch.length === 0 || ownerMatch[0].userEmail !== req.user!.email) {
      throw createError('FORBIDDEN', 'Not authorized');
    }

    const allowedFields = [
      'playerName',
      'matchPlayerId',
      'position',
      'runs',
      'ballsFaced',
      'fours',
      'sixes',
      'status',
      'dismissalType',
      'dismissedBy',
      'fielder',
      'isStriker',
      'isNonStriker',
    ];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const result = await db
      .update(batters)
      .set(updateData)
      .where(eq(batters.id, batterId))
      .returning();

    res.status(200).json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Update batter error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update batter',
    });
  }
});

router.delete('/batters/:id', async (req: Request, res: Response) => {
  try {
    const batterId = req.params.id;

    const existing = await db
      .select()
      .from(batters)
      .where(eq(batters.id, batterId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Batter not found',
      });
      return;
    }

    const delInnings = await db
      .select()
      .from(innings)
      .where(eq(innings.id, existing[0].inningsId))
      .limit(1);

    if (delInnings.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Innings not found',
      });
      return;
    }

    const delMatch = await db
      .select()
      .from(matches)
      .where(eq(matches.id, delInnings[0].matchId))
      .limit(1);

    if (delMatch.length === 0 || delMatch[0].userEmail !== req.user!.email) {
      throw createError('FORBIDDEN', 'Not authorized');
    }

    await db.delete(batters).where(eq(batters.id, batterId));

    res.status(200).json({
      success: true,
      message: 'Batter deleted successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Delete batter error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete batter',
    });
  }
});

export default router;
