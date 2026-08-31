import { Router, Request, Response } from 'express';
import { db } from '../db';
import { competitions, competitionStages, competitionTeams } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { createError, AppError } from '../middleware/errorHandler';

const router = Router();

router.use(authMiddleware);

router.post('/competitions', async (req: Request, res: Response) => {
  try {
    const userEmail = req.user!.email;
    const { name, type, startDate, endDate } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: 'name is required',
      });
      return;
    }

    const data: typeof competitions.$inferInsert = {
      userEmail,
      name,
    };

    if (type) data.type = type;
    if (startDate) data.startDate = startDate;
    if (endDate) data.endDate = endDate;

    const result = await db.insert(competitions).values(data).returning();

    res.status(201).json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    console.error('Create competition error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create competition',
    });
  }
});

router.get('/competitions', async (req: Request, res: Response) => {
  try {
    const userEmail = req.user!.email;

    const result = await db
      .select()
      .from(competitions)
      .where(eq(competitions.userEmail, userEmail))
      .orderBy(desc(competitions.createdAt));

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Get competitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch competitions',
    });
  }
});

router.get('/competitions/:id', async (req: Request, res: Response) => {
  try {
    const competitionId = req.params.id;

    const competitionResult = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .limit(1);

    if (competitionResult.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Competition not found',
      });
      return;
    }

    if (competitionResult[0].userEmail !== req.user!.email) {
      throw createError('FORBIDDEN', 'Not authorized');
    }

    const stages = await db
      .select()
      .from(competitionStages)
      .where(eq(competitionStages.competitionId, competitionId))
      .orderBy(competitionStages.stageOrder);

    const teams = await db
      .select()
      .from(competitionTeams)
      .where(eq(competitionTeams.competitionId, competitionId));

    res.status(200).json({
      success: true,
      data: {
        ...competitionResult[0],
        stages,
        teams,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Get competition error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch competition',
    });
  }
});

router.patch('/competitions/:id', async (req: Request, res: Response) => {
  try {
    const competitionId = req.params.id;

    const existing = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Competition not found',
      });
      return;
    }

    if (existing[0].userEmail !== req.user!.email) {
      throw createError('FORBIDDEN', 'Not authorized');
    }

    const allowedFields = ['name', 'type', 'status', 'startDate', 'endDate'];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const result = await db
      .update(competitions)
      .set(updateData)
      .where(eq(competitions.id, competitionId))
      .returning();

    res.status(200).json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Update competition error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update competition',
    });
  }
});

router.delete('/competitions/:id', async (req: Request, res: Response) => {
  try {
    const competitionId = req.params.id;

    const existing = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Competition not found',
      });
      return;
    }

    if (existing[0].userEmail !== req.user!.email) {
      throw createError('FORBIDDEN', 'Not authorized');
    }

    await db.delete(competitions).where(eq(competitions.id, competitionId));

    res.status(200).json({
      success: true,
      message: 'Competition deleted successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Delete competition error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete competition',
    });
  }
});

export default router;
