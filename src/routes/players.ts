import { Router, Request, Response } from 'express';
import { db } from '../db';
import { players } from '../db/schema';
import { eq, like, or, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/players', async (req: Request, res: Response) => {
  try {
    const userEmail = req.user!.email;
    const { name, email, phone, battingStyle, bowlingStyle } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: 'name is required',
      });
      return;
    }

    const data: typeof players.$inferInsert = {
      name,
    };

    if (email) data.email = email;
    if (phone) data.phone = phone;
    if (battingStyle) data.battingStyle = battingStyle;
    if (bowlingStyle) data.bowlingStyle = bowlingStyle;

    const result = await db.insert(players).values(data).returning();

    res.status(201).json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    console.error('Create player error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register player',
    });
  }
});

router.get('/players', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    let result;

    if (q && typeof q === 'string') {
      result = await db
        .select()
        .from(players)
        .where(
          or(
            like(players.name, `%${q}%`),
            like(players.email, `%${q}%`)
          )
        )
        .orderBy(desc(players.createdAt))
        .limit(50);
    } else {
      result = await db
        .select()
        .from(players)
        .orderBy(desc(players.createdAt))
        .limit(50);
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Get players error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search players',
    });
  }
});

router.post('/players/:id/claim', async (req: Request, res: Response) => {
  try {
    const playerId = req.params.id;
    const userEmail = req.user!.email;

    const existing = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Player not found',
      });
      return;
    }

    if (existing[0].isClaimed) {
      res.status(409).json({
        success: false,
        message: 'Player profile is already claimed',
      });
      return;
    }

    const result = await db
      .update(players)
      .set({
        isClaimed: true,
        claimedBy: userEmail,
        userId: userEmail,
      })
      .where(eq(players.id, playerId))
      .returning();

    res.status(200).json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    console.error('Claim player error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to claim player profile',
    });
  }
});

export default router;
