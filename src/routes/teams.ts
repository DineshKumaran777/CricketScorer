import { Router, Request, Response } from 'express';
import { db } from '../db';
import { teams } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { createError, AppError } from '../middleware/errorHandler';

const router = Router();

router.use(authMiddleware);

router.post('/teams', async (req: Request, res: Response) => {
  try {
    const userEmail = req.user!.email;
    const { name, shortName, logoUrl } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: 'name is required',
      });
      return;
    }

    const data: typeof teams.$inferInsert = {
      name,
      createdBy: userEmail,
    };

    if (shortName) data.shortName = shortName;
    if (logoUrl) data.logoUrl = logoUrl;

    const result = await db.insert(teams).values(data).returning();

    res.status(201).json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    console.error('Create team error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create team',
    });
  }
});

router.get('/teams', async (req: Request, res: Response) => {
  try {
    const userEmail = req.user!.email;

    const result = await db
      .select()
      .from(teams)
      .where(eq(teams.createdBy, userEmail))
      .orderBy(desc(teams.createdAt));

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Get teams error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teams',
    });
  }
});

router.patch('/teams/:id', async (req: Request, res: Response) => {
  try {
    const teamId = req.params.id;

    const existing = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Team not found',
      });
      return;
    }

    if (existing[0].createdBy !== req.user!.email) {
      throw createError('FORBIDDEN', 'Not authorized');
    }

    const allowedFields = ['name', 'shortName', 'logoUrl'];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const result = await db
      .update(teams)
      .set(updateData)
      .where(eq(teams.id, teamId))
      .returning();

    res.status(200).json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Update team error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update team',
    });
  }
});

router.delete('/teams/:id', async (req: Request, res: Response) => {
  try {
    const teamId = req.params.id;

    const existing = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Team not found',
      });
      return;
    }

    if (existing[0].createdBy !== req.user!.email) {
      throw createError('FORBIDDEN', 'Not authorized');
    }

    await db.delete(teams).where(eq(teams.id, teamId));

    res.status(200).json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Delete team error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete team',
    });
  }
});

export default router;
