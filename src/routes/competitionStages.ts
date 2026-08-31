import { Router, Request, Response } from 'express';
import { db } from '../db';
import { competitionStages, competitions } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { createError, AppError } from '../middleware/errorHandler';

const router = Router();

router.use(authMiddleware);

router.post(
  '/competitions/:id/stages',
  async (req: Request, res: Response) => {
    try {
      const competitionId = req.params.id;

      const competition = await db
        .select()
        .from(competitions)
        .where(eq(competitions.id, competitionId))
        .limit(1);

      if (competition.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Competition not found',
        });
        return;
      }

      if (competition[0].userEmail !== req.user!.email) {
        throw createError('FORBIDDEN', 'Not authorized');
      }

      const { name, type, stageOrder, groupName } = req.body;

      if (!name || !type) {
        res.status(400).json({
          success: false,
          message: 'name and type are required',
        });
        return;
      }

      const data: typeof competitionStages.$inferInsert = {
        competitionId,
        name,
        type,
      };

      if (stageOrder !== undefined) data.stageOrder = stageOrder;
      if (groupName) data.groupName = groupName;

      const result = await db.insert(competitionStages).values(data).returning();

      res.status(201).json({
        success: true,
        data: result[0],
      });
    } catch (error: any) {
      if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
      console.error('Add stage error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add stage',
      });
    }
  }
);

router.get(
  '/competitions/:id/stages',
  async (req: Request, res: Response) => {
    try {
      const competitionId = req.params.id;

      const result = await db
        .select()
        .from(competitionStages)
        .where(eq(competitionStages.competitionId, competitionId))
        .orderBy(asc(competitionStages.stageOrder));

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Get stages error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stages',
      });
    }
  }
);

router.patch('/stages/:id', async (req: Request, res: Response) => {
  try {
    const stageId = req.params.id;

    const existing = await db
      .select()
      .from(competitionStages)
      .where(eq(competitionStages.id, stageId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Stage not found',
      });
      return;
    }

    const stageCompetition = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, existing[0].competitionId))
      .limit(1);

    if (stageCompetition.length === 0 || stageCompetition[0].userEmail !== req.user!.email) {
      throw createError('FORBIDDEN', 'Not authorized');
    }

    const allowedFields = ['name', 'type', 'stageOrder', 'groupName'];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const result = await db
      .update(competitionStages)
      .set(updateData)
      .where(eq(competitionStages.id, stageId))
      .returning();

    res.status(200).json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Update stage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stage',
    });
  }
});

export default router;
