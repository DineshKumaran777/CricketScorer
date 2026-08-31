import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import {
  balls,
  innings,
  batters,
  bowlers,
  matches,
  matchRules,
  // ── These tables must exist in schema.ts (see SCHEMA ADDITIONS below) ──
  idempotencyEvents,
  ballReversals,
} from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { AppError, createError } from '../middleware/errorHandler';
import { ScoringEngine } from '../utils/scoringEngine';
import { MatchRules } from '../utils/matchRules';
import { generateCommentary } from '../utils/commentary';

// ═══════════════════════════════════════════════════════════════════════
// REQUIRED SCHEMA ADDITIONS (add to db/schema.ts and run migration)
//
// 1. Add to matches table:
//    matchStateVersion: integer('match_state_version').notNull().default(0),
//
// 2. New table — idempotency_events:
//    export const idempotencyEvents = pgTable('idempotency_events', {
//      clientEventId: varchar('client_event_id', { length: 255 }).primaryKey(),
//      matchId: uuid('match_id').notNull().references(() => matches.id),
//      result: jsonb('result'),
//      createdAt: timestamp('created_at').defaultNow().notNull(),
//    });
//
// 3. New table — ball_reversals:
//    export const ballReversals = pgTable('ball_reversals', {
//      id: uuid('id').primaryKey().defaultRandom(),
//      ballId: uuid('ball_id').notNull(),
//      inningsId: uuid('innings_id').notNull().references(() => innings.id),
//      matchId: uuid('match_id').notNull().references(() => matches.id),
//      reversedBy: varchar('reversed_by', { length: 255 }).notNull(),
//      ballData: jsonb('ball_data').notNull(),
//      createdAt: timestamp('created_at').defaultNow().notNull(),
//    });
// ═══════════════════════════════════════════════════════════════════════

// ─── Structured Logger ──────────────────────────────────────────────

function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: Record<string, unknown>,
) {
  const entry = {
    level,
    message,
    ...context,
    timestamp: new Date().toISOString(),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// ─── Zod Schemas ────────────────────────────────────────────────────

const WICKET_TYPES = [
  'bowled', 'caught', 'lbw', 'run_out', 'stumped',
  'hit_wicket', 'obstructing', 'handled_ball',
  'timed_out', 'retired_out', 'retired_hurt',
] as const;

const EXTRAS_TYPES = ['wide', 'no_ball', 'bye', 'leg_bye', 'penalty'] as const;

const PostBallSchema = z.object({
  clientEventId: z.string().uuid('clientEventId must be a valid UUID'),
  matchStateVersion: z
    .number()
    .int()
    .min(0, 'matchStateVersion must be a non-negative integer'),
  strikerName: z.string().min(1, 'strikerName is required').max(255),
  nonStrikerName: z.string().max(255).optional(),
  bowlerName: z.string().min(1, 'bowlerName is required').max(255),
  runsOffBat: z.number().int().min(0).max(6).default(0),
  extrasType: z.enum(EXTRAS_TYPES).nullable().optional(),
  extrasRuns: z.number().int().min(0).max(15).default(0),
  isWicket: z.boolean().default(false),
  wicketType: z.enum(WICKET_TYPES).nullable().optional(),
  dismissedBatter: z.string().max(255).nullable().optional(),
  fielder: z.string().max(255).nullable().optional(),
  isFreeHit: z.boolean().default(false),
  commentary: z.string().max(2000).optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────

function requireAuth(req: Request): string {
  if (!req.user?.email) {
    throw createError('UNAUTHORIZED', 'Authentication required');
  }
  return req.user.email;
}

function assertAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  throw err;
}

// ─── Router ─────────────────────────────────────────────────────────

const router = Router();
router.use(authMiddleware);

// ═══════════════════════════════════════════════════════════════════════
// POST /innings/:inningsId/balls
// Record a ball delivery with full transactional integrity
// ═══════════════════════════════════════════════════════════════════════

router.post(
  '/innings/:inningsId/balls',
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    let body: z.infer<typeof PostBallSchema>;

    // ── Input validation ───────────────────────────────────────────
    try {
      body = PostBallSchema.parse(req.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const msg = err.issues
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return next(createError('VALIDATION_ERROR', msg));
      }
      return next(err);
    }

    const userEmail = requireAuth(req);
    const { inningsId } = req.params;

    log('info', 'POST /balls request received', {
      inningsId,
      clientEventId: body.clientEventId,
      userEmail,
      striker: body.strikerName,
      bowler: body.bowlerName,
    });

    try {
      // ── 1. Idempotency check ─────────────────────────────────────
      const existing = await db
        .select()
        .from(idempotencyEvents)
        .where(eq(idempotencyEvents.clientEventId, body.clientEventId))
        .limit(1);

      if (existing.length > 0) {
        log('info', 'Idempotent replay — returning cached result', {
          clientEventId: body.clientEventId,
        });
        res.status(201).json({
          success: true,
          data: existing[0].result,
          cached: true,
        });
        return;
      }

      // ── 2. Load innings ──────────────────────────────────────────
      const inningsRows = await db
        .select()
        .from(innings)
        .where(eq(innings.id, inningsId))
        .limit(1);

      if (inningsRows.length === 0) {
        return next(createError('NOT_FOUND', 'Innings not found'));
      }
      const currentInnings = inningsRows[0];

      // ── 3. Load match ────────────────────────────────────────────
      const matchRows = await db
        .select()
        .from(matches)
        .where(eq(matches.id, currentInnings.matchId))
        .limit(1);

      if (matchRows.length === 0) {
        return next(createError('NOT_FOUND', 'Match not found for innings'));
      }
      const match = matchRows[0];

      // ── 4. Match status guard ────────────────────────────────────
      if (match.status !== 'live') {
        return next(
          createError(
            'INVALID_MATCH_STATE',
            `Match is not live (current status: ${match.status})`,
          ),
        );
      }

      // ── 5. Ownership verification ────────────────────────────────
      if (match.userEmail !== userEmail) {
        return next(createError('FORBIDDEN', 'You do not own this match'));
      }

      // ── 6. Innings validation ────────────────────────────────────
      if (currentInnings.matchId !== match.id) {
        return next(
          createError('VALIDATION_ERROR', 'Innings does not belong to this match'),
        );
      }
      if (currentInnings.status !== 'live') {
        return next(
          createError(
            'INVALID_MATCH_STATE',
            `Innings is not live (current status: ${currentInnings.status})`,
          ),
        );
      }

      // ── 7. Load match rules & create scoring engine ──────────────
      const rulesRows = await db
        .select()
        .from(matchRules)
        .where(eq(matchRules.matchId, match.id))
        .limit(1);

      if (rulesRows.length === 0) {
        return next(createError('NOT_FOUND', 'Match rules not found'));
      }
      const rules = rulesRows[0] as unknown as MatchRules;
      const engine = new ScoringEngine(rules);

      // ── 8. Validate extras allowed ───────────────────────────────
      if (body.extrasType && !engine.isExtrasAllowed(body.extrasType)) {
        return next(
          createError(
            'INVALID_DELIVERY',
            `Extras type '${body.extrasType}' is not allowed by match rules`,
          ),
        );
      }

      // ── 9. Validate free-hit wicket ──────────────────────────────
      if (body.isWicket && body.isFreeHit) {
        const wType = body.wicketType || null;
        if (!engine.canBeOutOnFreeHit(wType)) {
          return next(
            createError(
              'INVALID_DELIVERY',
              `Wicket type '${wType}' is not valid on a free hit`,
            ),
          );
        }
      }

      // ── 10. Calculate ball result ────────────────────────────────
      const ballInput = {
        runsOffBat: body.runsOffBat || 0,
        extrasType: body.extrasType || null,
        extrasRuns: body.extrasRuns || 0,
        isWicket: body.isWicket || false,
        wicketType: body.wicketType || null,
        dismissedBatter: body.dismissedBatter || null,
        fielder: body.fielder || null,
        fieldingEnd: null,
        runsOffSameBall: 0,
      };

      const result = engine.calculateBallResult(ballInput);
      const legalDelivery = engine.isLegalDelivery(body.extrasType || null);

      // ── 11. Compute over/ball numbers ────────────────────────────
      let newTotalBalls = currentInnings.totalBalls;
      if (legalDelivery) {
        newTotalBalls = currentInnings.totalBalls + 1;
      }

      const overNumber =
        newTotalBalls > 0
          ? Math.floor((newTotalBalls - 1) / rules.ballsPerOver)
          : 0;
      const ballNumber =
        newTotalBalls > 0
          ? ((newTotalBalls - 1) % rules.ballsPerOver) + 1
          : 0;

      const totalRunsThisBall = result.batterRuns + result.extrasRuns;
      const newTotalRuns = currentInnings.totalRuns + totalRunsThisBall;
      const newTotalWickets = body.isWicket
        ? currentInnings.totalWickets + 1
        : currentInnings.totalWickets;

      const newExtrasWides =
        currentInnings.extrasWides +
        (body.extrasType === 'wide' ? result.extrasRuns : 0);
      const newExtrasNoBalls =
        currentInnings.extrasNoBalls +
        (body.extrasType === 'no_ball' ? result.extrasRuns : 0);
      const newExtrasByes =
        currentInnings.extrasByes +
        (body.extrasType === 'bye' ? result.extrasRuns : 0);
      const newExtrasLegByes =
        currentInnings.extrasLegByes +
        (body.extrasType === 'leg_bye' ? result.extrasRuns : 0);
      const newExtrasPenalty =
        currentInnings.extrasPenalty +
        (body.extrasType === 'penalty' ? result.extrasRuns : 0);

      const oversDisplay = engine.formatOvers(newTotalBalls);
      const isEndOfOver =
        legalDelivery && newTotalBalls % rules.ballsPerOver === 0;

      const shouldRotate = engine.shouldRotateStrike(
        result.batterRuns,
        result.extrasRuns,
        body.extrasType || null,
        isEndOfOver,
      );

      const newIsFreeHit = engine.shouldSetFreeHit(body.extrasType || null);

      // ── 12. Generate commentary ──────────────────────────────────
      const commentaryText =
        body.commentary ||
        generateCommentary({
          strikerName: body.strikerName,
          bowlerName: body.bowlerName,
          runsOffBat: result.batterRuns,
          extrasType: body.extrasType || undefined,
          extrasRuns: result.extrasRuns,
          isWicket: body.isWicket || false,
          wicketType: body.wicketType || undefined,
          dismissedBatter: body.dismissedBatter || undefined,
          fielder: body.fielder || undefined,
        });

      // ── 13. Execute all mutations in a transaction ───────────────
      const transactionResult = await db.transaction(async (tx) => {
        // a. Optimistic lock check via matchStateVersion
        const lockResult = await tx.execute(sql`
          UPDATE matches
          SET match_state_version = match_state_version + 1
          WHERE id = ${match.id}
            AND match_state_version = ${body.matchStateVersion}
          RETURNING match_state_version
        `);

        if (lockResult.rowCount === 0) {
          throw createError(
            'CONCURRENCY_CONFLICT',
            `Match state was modified concurrently. Expected version ${body.matchStateVersion}. Please refresh and retry.`,
          );
        }

        const newVersion =
          lockResult.rows?.[0]?.match_state_version ??
          body.matchStateVersion + 1;

        // b. Insert ball record
        const [insertedBall] = await tx
          .insert(balls)
          .values({
            inningsId,
            overNumber,
            ballNumber,
            totalBallNumber: newTotalBalls,
            strikerName: body.strikerName,
            nonStrikerName: body.nonStrikerName || null,
            bowlerName: body.bowlerName,
            runsOffBat: result.batterRuns,
            extrasType: (body.extrasType || null) as any,
            extrasRuns: result.extrasRuns,
            isWicket: body.isWicket || false,
            wicketType: (body.wicketType || null) as any,
            dismissedBatter: body.dismissedBatter || null,
            fielder: body.fielder || null,
            isLegalDelivery: legalDelivery,
            isFreeHit: newIsFreeHit,
            commentary: commentaryText,
          })
          .returning();

        // c. Update striker batter stats
        const strikerRows = await tx
          .select()
          .from(batters)
          .where(
            and(
              eq(batters.inningsId, inningsId),
              eq(batters.playerName, body.strikerName),
            ),
          )
          .limit(1);

        if (strikerRows.length === 0) {
          throw createError(
            'NOT_FOUND',
            `Batter '${body.strikerName}' not found in this innings`,
          );
        }

        const strikerRecord = strikerRows[0];
        const batterUpdate: Record<string, unknown> = {};

        if (legalDelivery) {
          batterUpdate.runs = strikerRecord.runs + result.batterRuns;
          batterUpdate.ballsFaced = strikerRecord.ballsFaced + 1;
          batterUpdate.fours =
            strikerRecord.fours + (result.batterRuns === 4 ? 1 : 0);
          batterUpdate.sixes =
            strikerRecord.sixes + (result.batterRuns === 6 ? 1 : 0);
        }

        if (body.isWicket && body.dismissedBatter === body.strikerName) {
          batterUpdate.status = 'out';
          batterUpdate.dismissalType = body.wicketType || null;
          batterUpdate.dismissedBy = body.bowlerName;
          batterUpdate.fielder = body.fielder || null;
        }

        await tx
          .update(batters)
          .set(batterUpdate)
          .where(eq(batters.id, strikerRecord.id));

        // d. Update strike rotation
        if (shouldRotate && body.nonStrikerName && !body.isWicket) {
          const nonStrikerRows = await tx
            .select()
            .from(batters)
            .where(
              and(
                eq(batters.inningsId, inningsId),
                eq(batters.playerName, body.nonStrikerName),
              ),
            )
            .limit(1);

          if (nonStrikerRows.length > 0) {
            await tx
              .update(batters)
              .set({ isStriker: true, isNonStriker: false })
              .where(eq(batters.id, nonStrikerRows[0].id));
            await tx
              .update(batters)
              .set({ isStriker: false, isNonStriker: true })
              .where(eq(batters.id, strikerRecord.id));
          }
        }

        // e. Update bowler stats
        const bowlerRows = await tx
          .select()
          .from(bowlers)
          .where(
            and(
              eq(bowlers.inningsId, inningsId),
              eq(bowlers.playerName, body.bowlerName),
            ),
          )
          .limit(1);

        if (bowlerRows.length === 0) {
          throw createError(
            'NOT_FOUND',
            `Bowler '${body.bowlerName}' not found in this innings`,
          );
        }

        const bowlerRecord = bowlerRows[0];
        const bowlerUpdate: Record<string, unknown> = {};
        let bowlerWarning: string | null = null;

        if (legalDelivery) {
          bowlerUpdate.ballsBowled = bowlerRecord.ballsBowled + 1;
          bowlerUpdate.runsConceded =
            bowlerRecord.runsConceded + totalRunsThisBall;

          const isBowlerWicket =
            body.isWicket && engine.isBowlerWicket(body.wicketType || null);
          bowlerUpdate.wickets = bowlerRecord.wickets + (isBowlerWicket ? 1 : 0);

          if (body.extrasType === 'wide') {
            bowlerUpdate.wides =
              bowlerRecord.wides + result.extrasRuns;
          }
          if (body.extrasType === 'no_ball') {
            bowlerUpdate.noBalls = bowlerRecord.noBalls + 1;
          }
        } else if (
          body.extrasType === 'wide' ||
          body.extrasType === 'no_ball'
        ) {
          bowlerUpdate.runsConceded =
            bowlerRecord.runsConceded + totalRunsThisBall;
          if (body.extrasType === 'wide') {
            bowlerUpdate.wides =
              bowlerRecord.wides + result.extrasRuns;
          } else {
            bowlerUpdate.noBalls = bowlerRecord.noBalls + 1;
          }
        }

        if (Object.keys(bowlerUpdate).length > 0) {
          await tx
            .update(bowlers)
            .set(bowlerUpdate)
            .where(eq(bowlers.id, bowlerRecord.id));
        }

        const finalBallsBowled =
          (bowlerUpdate.ballsBowled as number) ?? bowlerRecord.ballsBowled;
        if (engine.isBowlerOverLimit(finalBallsBowled)) {
          bowlerWarning = `${body.bowlerName} has reached the maximum overs limit`;
        }

        // f. Update innings totals
        await tx
          .update(innings)
          .set({
            totalRuns: newTotalRuns,
            totalWickets: newTotalWickets,
            totalBalls: newTotalBalls,
            totalOvers: oversDisplay,
            extrasWides: newExtrasWides,
            extrasNoBalls: newExtrasNoBalls,
            extrasByes: newExtrasByes,
            extrasLegByes: newExtrasLegByes,
            extrasPenalty: newExtrasPenalty,
          })
          .where(eq(innings.id, inningsId));

        // g. Update match/innings completion status
        const completedOvers = Math.floor(newTotalBalls / rules.ballsPerOver);
        const isAllOut = newTotalWickets >= rules.playersPerSide - 1;
        const oversComplete =
          rules.overs > 0 && completedOvers >= rules.overs;
        const isMatchOver =
          engine.isInningsOver(
            newTotalWickets,
            completedOvers,
            newTotalRuns,
            rules.target ?? null,
          );

        if (isAllOut || oversComplete) {
          await tx
            .update(innings)
            .set({ status: 'completed' })
            .where(eq(innings.id, inningsId));

          if (isMatchOver) {
            await tx
              .update(matches)
              .set({ status: 'completed', completedAt: new Date() })
              .where(eq(matches.id, match.id));
          }
        }

        // h. Build response payload
        const responseData = {
          ball: insertedBall,
          innings: {
            id: inningsId,
            totalRuns: newTotalRuns,
            totalWickets: newTotalWickets,
            totalBalls: newTotalBalls,
            totalOvers: oversDisplay,
          },
          matchState: {
            version: newVersion,
            score: `${newTotalRuns}/${newTotalWickets}`,
            overs: oversDisplay,
            wickets: newTotalWickets,
            isComplete: (isAllOut || oversComplete) && isMatchOver,
          },
          bowlerWarning,
          isEndOfOver,
        };

        // i. Store idempotency record
        await tx.insert(idempotencyEvents).values({
          clientEventId: body.clientEventId,
          matchId: match.id,
          result: responseData as any,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        return responseData;
      });

      const elapsed = Date.now() - startTime;
      log('info', 'Ball recorded successfully', {
        inningsId,
        clientEventId: body.clientEventId,
        totalRuns: transactionResult.innings.totalRuns,
        totalWickets: transactionResult.innings.totalWickets,
        elapsed,
      });

      res.status(201).json({ success: true, data: transactionResult });
    } catch (err) {
      try {
        assertAppError(err);
        return next(err);
      } catch {
        log('error', 'Failed to record ball', {
          inningsId,
          clientEventId: body?.clientEventId,
          error: (err as Error).message,
          stack: (err as Error).stack,
        });
        return next(
          createError('DATABASE_ERROR', 'Failed to record ball delivery'),
        );
      }
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════
// DELETE /innings/:inningsId/balls/:ballId
// Reverse the most recent ball delivery with full audit trail
// ═══════════════════════════════════════════════════════════════════════

router.delete(
  '/innings/:inningsId/balls/:ballId',
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const userEmail = requireAuth(req);
    const { inningsId, ballId } = req.params;

    log('info', 'DELETE /balls request received', {
      inningsId,
      ballId,
      userEmail,
    });

    try {
      // ── 1. Load the ball to delete ───────────────────────────────
      const ballRows = await db
        .select()
        .from(balls)
        .where(and(eq(balls.id, ballId), eq(balls.inningsId, inningsId)))
        .limit(1);

      if (ballRows.length === 0) {
        return next(createError('NOT_FOUND', 'Ball not found'));
      }
      const ball = ballRows[0];

      // ── 2. Load innings & match ──────────────────────────────────
      const inningsRows = await db
        .select()
        .from(innings)
        .where(eq(innings.id, inningsId))
        .limit(1);

      if (inningsRows.length === 0) {
        return next(createError('NOT_FOUND', 'Innings not found'));
      }
      const currentInnings = inningsRows[0];

      const matchRows = await db
        .select()
        .from(matches)
        .where(eq(matches.id, currentInnings.matchId))
        .limit(1);

      if (matchRows.length === 0) {
        return next(createError('NOT_FOUND', 'Match not found'));
      }
      const match = matchRows[0];

      // ── 3. Ownership verification ────────────────────────────────
      if (match.userEmail !== userEmail) {
        return next(createError('FORBIDDEN', 'You do not own this match'));
      }

      // ── 4. Verify it is the most recent ball ─────────────────────
      const newerBalls = await db
        .select({ id: balls.id })
        .from(balls)
        .where(
          and(
            eq(balls.inningsId, inningsId),
            sql`${balls.totalBallNumber} > ${ball.totalBallNumber}`,
          ),
        )
        .limit(1);

      if (newerBalls.length > 0) {
        return next(
          createError(
            'INVALID_DELIVERY',
            'Can only delete the most recent ball delivery',
          ),
        );
      }

      // ── 5. Load rules & create engine ────────────────────────────
      const rulesRows = await db
        .select()
        .from(matchRules)
        .where(eq(matchRules.matchId, currentInnings.matchId))
        .limit(1);

      const rules =
        rulesRows.length > 0
          ? (rulesRows[0] as unknown as MatchRules)
          : ({ ballsPerOver: 6, playersPerSide: 11 } as MatchRules);
      const engine = new ScoringEngine(rules);

      // ── 6. Execute reversal in a transaction ─────────────────────
      const reversalResult = await db.transaction(async (tx) => {
        const isLegal = ball.isLegalDelivery;
        const ballRunsTotal = (ball.runsOffBat || 0) + (ball.extrasRuns || 0);

        // a. Reverse innings totals
        const newTotalBalls = isLegal
          ? Math.max(0, currentInnings.totalBalls - 1)
          : currentInnings.totalBalls;
        const newTotalRuns = Math.max(
          0,
          currentInnings.totalRuns - ballRunsTotal,
        );
        const newTotalWickets = ball.isWicket
          ? Math.max(0, currentInnings.totalWickets - 1)
          : currentInnings.totalWickets;

        let newExtrasWides = currentInnings.extrasWides;
        let newExtrasNoBalls = currentInnings.extrasNoBalls;
        let newExtrasByes = currentInnings.extrasByes;
        let newExtrasLegByes = currentInnings.extrasLegByes;
        let newExtrasPenalty = currentInnings.extrasPenalty;

        if (ball.extrasType === 'wide') {
          newExtrasWides = Math.max(
            0,
            newExtrasWides - (ball.extrasRuns || 0),
          );
        } else if (ball.extrasType === 'no_ball') {
          newExtrasNoBalls = Math.max(
            0,
            newExtrasNoBalls - (ball.extrasRuns || 0),
          );
        } else if (ball.extrasType === 'bye') {
          newExtrasByes = Math.max(
            0,
            newExtrasByes - (ball.extrasRuns || 0),
          );
        } else if (ball.extrasType === 'leg_bye') {
          newExtrasLegByes = Math.max(
            0,
            newExtrasLegByes - (ball.extrasRuns || 0),
          );
        } else if (ball.extrasType === 'penalty') {
          newExtrasPenalty = Math.max(
            0,
            newExtrasPenalty - (ball.extrasRuns || 0),
          );
        }

        const oversDisplay = engine.formatOvers(newTotalBalls);

        await tx
          .update(innings)
          .set({
            totalRuns: newTotalRuns,
            totalWickets: newTotalWickets,
            totalBalls: newTotalBalls,
            totalOvers: oversDisplay,
            extrasWides: newExtrasWides,
            extrasNoBalls: newExtrasNoBalls,
            extrasByes: newExtrasByes,
            extrasLegByes: newExtrasLegByes,
            extrasPenalty: newExtrasPenalty,
          })
          .where(eq(innings.id, inningsId));

        // b. Reverse striker batter stats
        if (isLegal || ball.isWicket) {
          const strikerRows = await tx
            .select()
            .from(batters)
            .where(
              and(
                eq(batters.inningsId, inningsId),
                eq(batters.playerName, ball.strikerName),
              ),
            )
            .limit(1);

          if (strikerRows.length > 0) {
            const b = strikerRows[0];
            const batterRunsRemoved = ball.runsOffBat || 0;
            const batterUpdate: Record<string, unknown> = {};

            if (isLegal) {
              batterUpdate.runs = Math.max(0, b.runs - batterRunsRemoved);
              batterUpdate.ballsFaced = Math.max(0, b.ballsFaced - 1);
              batterUpdate.fours = Math.max(
                0,
                b.fours - (batterRunsRemoved === 4 ? 1 : 0),
              );
              batterUpdate.sixes = Math.max(
                0,
                b.sixes - (batterRunsRemoved === 6 ? 1 : 0),
              );
            }

            if (
              ball.isWicket &&
              ball.dismissedBatter === ball.strikerName
            ) {
              batterUpdate.status = 'not_out';
              batterUpdate.dismissalType = null;
              batterUpdate.dismissedBy = null;
              batterUpdate.fielder = null;
            }

            await tx
              .update(batters)
              .set(batterUpdate)
              .where(eq(batters.id, b.id));
          }
        }

        // c. Reverse bowler stats
        const bowlerRows = await tx
          .select()
          .from(bowlers)
          .where(
            and(
              eq(bowlers.inningsId, inningsId),
              eq(bowlers.playerName, ball.bowlerName),
            ),
          )
          .limit(1);

        if (bowlerRows.length > 0) {
          const bw = bowlerRows[0];
          const bowlerUpdate: Record<string, unknown> = {};

          if (isLegal) {
            bowlerUpdate.ballsBowled = Math.max(0, bw.ballsBowled - 1);
            bowlerUpdate.runsConceded = Math.max(
              0,
              bw.runsConceded - ballRunsTotal,
            );

            if (
              ball.isWicket &&
              engine.isBowlerWicket(ball.wicketType)
            ) {
              bowlerUpdate.wickets = Math.max(0, bw.wickets - 1);
            }

            if (ball.extrasType === 'wide') {
              bowlerUpdate.wides = Math.max(
                0,
                bw.wides - (ball.extrasRuns || 0),
              );
            }
          } else if (
            ball.extrasType === 'wide' ||
            ball.extrasType === 'no_ball'
          ) {
            bowlerUpdate.runsConceded = Math.max(
              0,
              bw.runsConceded - ballRunsTotal,
            );

            if (ball.extrasType === 'wide') {
              bowlerUpdate.wides = Math.max(
                0,
                bw.wides - (ball.extrasRuns || 0),
              );
            } else {
              bowlerUpdate.noBalls = Math.max(0, bw.noBalls - 1);
            }
          }

          if (Object.keys(bowlerUpdate).length > 0) {
            await tx
              .update(bowlers)
              .set(bowlerUpdate)
              .where(eq(bowlers.id, bw.id));
          }
        }

        // d. Reverse strike rotation
        // The deleted ball's strikerName/nonStrikerName capture the state
        // BEFORE that ball was bowled. Restore batters to that state.
        if (ball.strikerName) {
          const rows = await tx
            .select()
            .from(batters)
            .where(
              and(
                eq(batters.inningsId, inningsId),
                eq(batters.playerName, ball.strikerName),
              ),
            )
            .limit(1);
          if (rows.length > 0) {
            await tx
              .update(batters)
              .set({ isStriker: true, isNonStriker: false })
              .where(eq(batters.id, rows[0].id));
          }
        }

        if (ball.nonStrikerName) {
          const rows = await tx
            .select()
            .from(batters)
            .where(
              and(
                eq(batters.inningsId, inningsId),
                eq(batters.playerName, ball.nonStrikerName),
              ),
            )
            .limit(1);
          if (rows.length > 0) {
            await tx
              .update(batters)
              .set({ isStriker: false, isNonStriker: true })
              .where(eq(batters.id, rows[0].id));
          }
        }

        // e. Delete the ball record
        await tx.delete(balls).where(eq(balls.id, ballId));

        // f. Store audit record
        await tx.insert(ballReversals).values({
          ballId,
          inningsId,
          matchId: currentInnings.matchId,
          reversedBy: userEmail,
          originalBallData: ball as any,
        });

        // g. Increment matchStateVersion
        const currentVersion = (match as any).matchStateVersion ?? 0;
        await tx.execute(sql`
          UPDATE matches
          SET match_state_version = match_state_version + 1
          WHERE id = ${match.id}
        `);

        return {
          innings: {
            id: inningsId,
            totalRuns: newTotalRuns,
            totalWickets: newTotalWickets,
            totalBalls: newTotalBalls,
            totalOvers: oversDisplay,
          },
          matchState: {
            version: currentVersion + 1,
            score: `${newTotalRuns}/${newTotalWickets}`,
            overs: oversDisplay,
            wickets: newTotalWickets,
          },
        };
      });

      const elapsed = Date.now() - startTime;
      log('info', 'Ball deleted and stats reversed', {
        inningsId,
        ballId,
        userEmail,
        elapsed,
      });

      res.status(200).json({ success: true, data: reversalResult });
    } catch (err) {
      try {
        assertAppError(err);
        return next(err);
      } catch {
        log('error', 'Failed to delete ball', {
          inningsId,
          ballId,
          error: (err as Error).message,
          stack: (err as Error).stack,
        });
        return next(
          createError('DATABASE_ERROR', 'Failed to delete ball delivery'),
        );
      }
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════
// GET /innings/:inningsId/balls
// List all deliveries for an innings
// ═══════════════════════════════════════════════════════════════════════

router.get(
  '/innings/:inningsId/balls',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { inningsId } = req.params;

      const result = await db
        .select()
        .from(balls)
        .where(eq(balls.inningsId, inningsId))
        .orderBy(balls.totalBallNumber);

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      log('error', 'Failed to fetch balls', {
        error: (err as Error).message,
      });
      return next(
        createError('DATABASE_ERROR', 'Failed to fetch ball deliveries'),
      );
    }
  },
);

export default router;
