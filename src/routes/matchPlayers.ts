import { Router, Request, Response } from 'express';
import { db } from '../db';
import { matchPlayers, matches } from '../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { createError, AppError } from '../middleware/errorHandler';

const router = Router();

router.use(authMiddleware);

router.post(
  '/matches/:matchId/players',
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

      const {
        playerName,
        teamName,
        playerId,
        position,
        role,
        isCaptain,
        isWicketkeeper,
      } = req.body;

      if (!playerName || !teamName) {
        res.status(400).json({
          success: false,
          message: 'playerName and teamName are required',
        });
        return;
      }

      const playerData: typeof matchPlayers.$inferInsert = {
        matchId,
        playerName,
        teamName,
        userEmail: req.user!.email,
      };

      if (playerId) playerData.playerId = playerId;
      if (position !== undefined) playerData.position = position;
      if (role) playerData.role = role;
      if (isCaptain !== undefined) playerData.isCaptain = isCaptain;
      if (isWicketkeeper !== undefined) playerData.isWicketkeeper = isWicketkeeper;

      const result = await db.insert(matchPlayers).values(playerData).returning();

      res.status(201).json({
        success: true,
        data: result[0],
      });
    } catch (error: any) {
      if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
      console.error('Add match player error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add player to match',
      });
    }
  }
);

router.get(
  '/matches/:matchId/players',
  async (req: Request, res: Response) => {
    try {
      const matchId = req.params.matchId;

      const result = await db
        .select()
        .from(matchPlayers)
        .where(eq(matchPlayers.matchId, matchId))
        .orderBy(asc(matchPlayers.position));

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Get match players error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch match players',
      });
    }
  }
);

router.patch('/players/:id', async (req: Request, res: Response) => {
  try {
    const playerId = req.params.id;

    const existing = await db
      .select()
      .from(matchPlayers)
      .where(eq(matchPlayers.id, playerId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Match player not found',
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
      'playerName', 'teamName', 'playerId', 'position',
      'role', 'isCaptain', 'isWicketkeeper',
    ];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const result = await db
      .update(matchPlayers)
      .set(updateData)
      .where(eq(matchPlayers.id, playerId))
      .returning();

    res.status(200).json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Update match player error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update player',
    });
  }
});

router.delete('/players/:id', async (req: Request, res: Response) => {
  try {
    const playerId = req.params.id;

    const existing = await db
      .select()
      .from(matchPlayers)
      .where(eq(matchPlayers.id, playerId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Match player not found',
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

    await db.delete(matchPlayers).where(eq(matchPlayers.id, playerId));

    res.status(200).json({
      success: true,
      message: 'Player removed from match',
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Delete match player error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove player',
    });
  }
});

export default router;
