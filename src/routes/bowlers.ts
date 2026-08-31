import { Router, Request, Response } from 'express';
import { db } from '../db';
import { bowlers, innings, matches } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { createError, AppError } from '../middleware/errorHandler';

const router = Router();

router.use(authMiddleware);

router.post(
  '/innings/:inningsId/bowlers',
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

      const { playerName, matchPlayerId } = req.body;

      if (!playerName) {
        res.status(400).json({
          success: false,
          message: 'playerName is required',
        });
        return;
      }

      const newBowler: typeof bowlers.$inferInsert = {
        inningsId,
        playerName,
      };

      if (matchPlayerId) {
        newBowler.matchPlayerId = matchPlayerId;
      }

      const result = await db.insert(bowlers).values(newBowler).returning();

      res.status(201).json({
        success: true,
        data: result[0],
      });
    } catch (error: any) {
      if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
      console.error('Create bowler error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add bowler',
      });
    }
  }
);

router.get(
  '/innings/:inningsId/bowlers',
  async (req: Request, res: Response) => {
    try {
      const inningsId = req.params.inningsId;

      const result = await db
        .select()
        .from(bowlers)
        .where(eq(bowlers.inningsId, inningsId));

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Get bowlers error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bowlers',
      });
    }
  }
);

router.patch('/bowlers/:id', async (req: Request, res: Response) => {
  try {
    const bowlerId = req.params.id;

    const existing = await db
      .select()
      .from(bowlers)
      .where(eq(bowlers.id, bowlerId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Bowler not found',
      });
      return;
    }

    const bowlerInnings = await db
      .select()
      .from(innings)
      .where(eq(innings.id, existing[0].inningsId))
      .limit(1);

    if (bowlerInnings.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Innings not found',
      });
      return;
    }

    const ownerMatch = await db
      .select()
      .from(matches)
      .where(eq(matches.id, bowlerInnings[0].matchId))
      .limit(1);

    if (ownerMatch.length === 0 || ownerMatch[0].userEmail !== req.user!.email) {
      throw createError('FORBIDDEN', 'Not authorized');
    }

    const allowedFields = [
      'playerName',
      'matchPlayerId',
      'ballsBowled',
      'maidens',
      'runsConceded',
      'wickets',
      'wides',
      'noBalls',
    ];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const result = await db
      .update(bowlers)
      .set(updateData)
      .where(eq(bowlers.id, bowlerId))
      .returning();

    res.status(200).json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Update bowler error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bowler',
    });
  }
});

router.delete('/bowlers/:id', async (req: Request, res: Response) => {
  try {
    const bowlerId = req.params.id;

    const existing = await db
      .select()
      .from(bowlers)
      .where(eq(bowlers.id, bowlerId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Bowler not found',
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

    await db.delete(bowlers).where(eq(bowlers.id, bowlerId));

    res.status(200).json({
      success: true,
      message: 'Bowler deleted successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Delete bowler error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete bowler',
    });
  }
});

export default router;
