import { Router, Request, Response } from 'express';
import { db } from '../db';
import { matches, matchRules, innings } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { MatchRules, DEFAULT_RULES } from '../utils/matchRules';
import { createError, AppError } from '../middleware/errorHandler';

const router = Router();

router.use(authMiddleware);

router.get('/matches', async (req: Request, res: Response) => {
  try {
    const userEmail = req.user!.email;
    const { status, type, matchMode, visibility, competitionId } = req.query;

    const conditions: any[] = [eq(matches.userEmail, userEmail)];

    if (status && typeof status === 'string') {
      conditions.push(eq(matches.status, status as any));
    }
    if (type && typeof type === 'string') {
      conditions.push(
        eq(matchRules.matchType, type as string)
      );
    }
    if (matchMode && typeof matchMode === 'string') {
      conditions.push(eq(matches.matchMode, matchMode as any));
    }
    if (visibility && typeof visibility === 'string') {
      conditions.push(eq(matches.visibility, visibility as any));
    }
    if (competitionId && typeof competitionId === 'string') {
      conditions.push(eq(matches.competitionId, competitionId));
    }

    const result = await db
      .select()
      .from(matches)
      .where(and(...conditions))
      .orderBy(desc(matches.createdAt));

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Get matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch matches',
    });
  }
});

router.post('/matches', async (req: Request, res: Response) => {
  try {
    const userEmail = req.user!.email;
    const {
      title,
      teamA,
      teamB,
      teamAId,
      teamBId,
      competitionId,
      stageId,
      visibility,
      matchMode,
      tossWinner,
      tossDecision,
      rules,
    } = req.body;

    if (!teamA || !teamB) {
      res.status(400).json({
        success: false,
        message: 'teamA and teamB are required',
      });
      return;
    }

    const matchData: typeof matches.$inferInsert = {
      userEmail,
      title: title || `${teamA} vs ${teamB}`,
      teamA,
      teamB,
    };

    if (teamAId) matchData.teamAId = teamAId;
    if (teamBId) matchData.teamBId = teamBId;
    if (competitionId) matchData.competitionId = competitionId;
    if (stageId) matchData.stageId = stageId;
    if (visibility) matchData.visibility = visibility;
    if (matchMode) matchData.matchMode = matchMode;
    if (tossWinner) matchData.tossWinner = tossWinner;
    if (tossDecision) matchData.tossDecision = tossDecision;

    const insertedMatch = await db.insert(matches).values(matchData).returning();
    const newMatch = insertedMatch[0];

    const mergedRules: MatchRules = { ...DEFAULT_RULES, ...(rules || {}) };
    const rulesData: typeof matchRules.$inferInsert = {
      matchId: newMatch.id,
      overs: mergedRules.overs,
      playersPerSide: mergedRules.playersPerSide,
      ballsPerOver: mergedRules.ballsPerOver,
      inningsPerSide: mergedRules.inningsPerSide,
      maxOversPerBowler: mergedRules.maxOversPerBowler,
      powerplayOvers: mergedRules.powerplayOvers,
      powerplayFielders: mergedRules.powerplayFielders,
      maxFieldersOutside: mergedRules.maxFieldersOutside,
      wideRuns: mergedRules.wideRuns,
      noBallRuns: mergedRules.noBallRuns,
      freeHitEnabled: mergedRules.freeHitEnabled,
      byeAllowed: mergedRules.byeAllowed,
      legByeAllowed: mergedRules.legByeAllowed,
      retiredHurtEnabled: mergedRules.retiredHurtEnabled,
      retiredOutEnabled: mergedRules.retiredOutEnabled,
      superOverEnabled: mergedRules.superOverEnabled,
      lastManStandingEnabled: mergedRules.lastManStandingEnabled,
      reviewEnabled: mergedRules.reviewEnabled,
      reviewsPerInnings: mergedRules.reviewsPerInnings,
      tieBreakerType: mergedRules.tieBreakerType,
      matchType: mergedRules.matchType,
    };

    if (mergedRules.target !== undefined) {
      rulesData.target = mergedRules.target;
    }

    const insertedRules = await db.insert(matchRules).values(rulesData).returning();

    res.status(201).json({
      success: true,
      data: {
        ...newMatch,
        rules: insertedRules[0],
      },
    });
  } catch (error: any) {
    console.error('Create match error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create match',
    });
  }
});

router.get('/matches/:id', async (req: Request, res: Response) => {
  try {
    const matchId = req.params.id;

    const matchResult = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);

    if (matchResult.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Match not found',
      });
      return;
    }

    const rulesResult = await db
      .select()
      .from(matchRules)
      .where(eq(matchRules.matchId, matchId))
      .limit(1);

    const matchInnings = await db
      .select()
      .from(innings)
      .where(eq(innings.matchId, matchId))
      .orderBy(innings.inningsNumber);

    res.status(200).json({
      success: true,
      data: {
        ...matchResult[0],
        rules: rulesResult[0] || null,
        innings: matchInnings,
      },
    });
  } catch (error: any) {
    console.error('Get match error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch match',
    });
  }
});

router.patch('/matches/:id', async (req: Request, res: Response) => {
  try {
    const matchId = req.params.id;

    const existing = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Match not found',
      });
      return;
    }

    if (existing[0].userEmail !== req.user!.email) {
      throw createError('FORBIDDEN', 'Not authorized');
    }

    const matchFields = [
      'title', 'teamA', 'teamB', 'teamAId', 'teamBId',
      'status', 'visibility', 'matchMode', 'tossWinner',
      'tossDecision', 'result', 'resultType', 'currentInnings',
      'isLive', 'competitionId', 'stageId', 'completedAt',
    ];

    const matchUpdateData: Record<string, any> = {};
    for (const field of matchFields) {
      if (req.body[field] !== undefined) {
        matchUpdateData[field] = req.body[field];
      }
    }

    let updatedMatch;
    if (Object.keys(matchUpdateData).length > 0) {
      const result = await db
        .update(matches)
        .set(matchUpdateData)
        .where(eq(matches.id, matchId))
        .returning();
      updatedMatch = result[0];
    } else {
      updatedMatch = existing[0];
    }

    const rulesFields = [
      'overs', 'playersPerSide', 'ballsPerOver', 'inningsPerSide',
      'maxOversPerBowler', 'powerplayOvers', 'powerplayFielders',
      'maxFieldersOutside', 'wideRuns', 'noBallRuns', 'freeHitEnabled',
      'byeAllowed', 'legByeAllowed', 'retiredHurtEnabled', 'retiredOutEnabled',
      'superOverEnabled', 'lastManStandingEnabled', 'reviewEnabled',
      'reviewsPerInnings', 'tieBreakerType', 'target', 'matchType',
    ];

    const rulesUpdateData: Record<string, any> = {};
    for (const field of rulesFields) {
      if (req.body[field] !== undefined) {
        rulesUpdateData[field] = req.body[field];
      }
    }

    let updatedRules = null;
    if (Object.keys(rulesUpdateData).length > 0) {
      const existingRules = await db
        .select()
        .from(matchRules)
        .where(eq(matchRules.matchId, matchId))
        .limit(1);

      if (existingRules.length > 0) {
        const result = await db
          .update(matchRules)
          .set(rulesUpdateData)
          .where(eq(matchRules.matchId, matchId))
          .returning();
        updatedRules = result[0];
      } else {
        rulesUpdateData.matchId = matchId;
        const result = await db.insert(matchRules).values(rulesUpdateData as typeof matchRules.$inferInsert).returning();
        updatedRules = result[0];
      }
    }

    res.status(200).json({
      success: true,
      data: {
        ...updatedMatch,
        rules: updatedRules,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Update match error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update match',
    });
  }
});

router.post('/matches/:id/live', async (req: Request, res: Response) => {
  try {
    const matchId = req.params.id;

    const existing = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Match not found',
      });
      return;
    }

    if (existing[0].userEmail !== req.user!.email) {
      throw createError('FORBIDDEN', 'Not authorized');
    }

    const newLiveStatus = !existing[0].isLive;

    const result = await db
      .update(matches)
      .set({
        isLive: newLiveStatus,
        status: newLiveStatus ? 'live' : existing[0].status,
      })
      .where(eq(matches.id, matchId))
      .returning();

    res.status(200).json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Toggle live error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle live status',
    });
  }
});

router.delete('/matches/:id', async (req: Request, res: Response) => {
  try {
    const matchId = req.params.id;

    const existing = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Match not found',
      });
      return;
    }

    if (existing[0].userEmail !== req.user!.email) {
      throw createError('FORBIDDEN', 'Not authorized');
    }

    await db.delete(matches).where(eq(matches.id, matchId));

    res.status(200).json({
      success: true,
      message: 'Match deleted successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    console.error('Delete match error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete match',
    });
  }
});

export default router;
