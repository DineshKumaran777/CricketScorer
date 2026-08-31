import { Router, Request, Response } from 'express';
import { db } from '../db';
import { batters, bowlers, innings, matches, matchPlayers } from '../db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';

const router = Router();

// GET /api/v1/players/:playerId/stats
// Get aggregated stats for a player across all their matches
router.get('/players/:playerId/stats', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;

    const battingStats = await db
      .select({
        playerName: batters.playerName,
        totalRuns: sql<number>`coalesce(sum(${batters.runs}), 0)`.as('total_runs'),
        totalBalls: sql<number>`coalesce(sum(${batters.ballsFaced}), 0)`.as('total_balls'),
        totalFours: sql<number>`coalesce(sum(${batters.fours}), 0)`.as('total_fours'),
        totalSixes: sql<number>`coalesce(sum(${batters.sixes}), 0)`.as('total_sixes'),
        inningsPlayed: sql<number>`count(*)`.as('innings_played'),
        notOuts: sql<number>`count(*) filter (where ${batters.status} = 'notOut' or ${batters.status} = 'retiredHurt')`.as('not_outs'),
        highestScore: sql<number>`coalesce(max(${batters.runs}), 0)`.as('highest_score'),
        fifties: sql<number>`count(*) filter (where ${batters.runs} >= 50 and ${batters.runs} < 100)`.as('fifties'),
        hundreds: sql<number>`count(*) filter (where ${batters.runs} >= 100)`.as('hundreds'),
        ducks: sql<number>`count(*) filter (where ${batters.runs} = 0 and ${batters.status} = 'out')`.as('ducks'),
      })
      .from(batters)
      .where(eq(batters.playerName, playerId))
      .groupBy(batters.playerName);

    const bowlingAggStats = await db
      .select({
        playerName: bowlers.playerName,
        totalWickets: sql<number>`coalesce(sum(${bowlers.wickets}), 0)`.as('total_wickets'),
        totalBallsBowled: sql<number>`coalesce(sum(${bowlers.ballsBowled}), 0)`.as('total_balls_bowled'),
        totalRunsConceded: sql<number>`coalesce(sum(${bowlers.runsConceded}), 0)`.as('total_runs_conceded'),
        totalMaidens: sql<number>`coalesce(sum(${bowlers.maidens}), 0)`.as('total_maidens'),
        totalWides: sql<number>`coalesce(sum(${bowlers.wides}), 0)`.as('total_wides'),
        totalNoBalls: sql<number>`coalesce(sum(${bowlers.noBalls}), 0)`.as('total_no_balls'),
        fiveWickets: sql<number>`count(*) filter (where ${bowlers.wickets} >= 5)`.as('five_wickets'),
        bowlingInnings: sql<number>`count(*)`.as('bowling_innings'),
      })
      .from(bowlers)
      .where(eq(bowlers.playerName, playerId))
      .groupBy(bowlers.playerName);

    const bestBowlingResult = await db
      .select({
        wickets: bowlers.wickets,
        runsConceded: bowlers.runsConceded,
      })
      .from(bowlers)
      .where(and(
        eq(bowlers.playerName, playerId),
        sql`${bowlers.wickets} > 0`,
      ))
      .orderBy(desc(bowlers.wickets), asc(bowlers.runsConceded))
      .limit(1);

    const bestBowling = bestBowlingResult.length > 0
      ? `${bestBowlingResult[0].wickets}/${bestBowlingResult[0].runsConceded}`
      : '0/0';

    const matchesPlayed = await db
      .select({
        matchCount: sql<number>`count(distinct ${matches.id})`.as('match_count'),
      })
      .from(matches)
      .innerJoin(matchPlayers, eq(matches.id, matchPlayers.matchId))
      .where(eq(matchPlayers.playerId, playerId));

    const batting = battingStats[0] || {
      playerName: '',
      totalRuns: 0,
      totalBalls: 0,
      totalFours: 0,
      totalSixes: 0,
      inningsPlayed: 0,
      notOuts: 0,
      highestScore: 0,
      fifties: 0,
      hundreds: 0,
      ducks: 0,
    };

    const bowling = bowlingAggStats[0] || {
      playerName: '',
      totalWickets: 0,
      totalBallsBowled: 0,
      totalRunsConceded: 0,
      totalMaidens: 0,
      totalWides: 0,
      totalNoBalls: 0,
      fiveWickets: 0,
      bowlingInnings: 0,
    };

    const dismissals = batting.inningsPlayed - batting.notOuts;
    const battingAverage = dismissals > 0
      ? (batting.totalRuns / dismissals).toFixed(1)
      : batting.totalRuns > 0 ? 'inf' : '0.0';

    const strikeRate = batting.totalBalls > 0
      ? ((batting.totalRuns / batting.totalBalls) * 100).toFixed(1)
      : '0.0';

    const bowlingOvers = bowling.totalBallsBowled > 0
      ? `${Math.floor(bowling.totalBallsBowled / 6)}.${bowling.totalBallsBowled % 6}`
      : '0';

    const bowlingAverage = bowling.totalWickets > 0
      ? (bowling.totalRunsConceded / bowling.totalWickets).toFixed(1)
      : bowling.totalRunsConceded > 0 ? 'inf' : '0.0';

    const economy = bowling.totalBallsBowled > 0
      ? ((bowling.totalRunsConceded / bowling.totalBallsBowled) * 6).toFixed(2)
      : '0.00';

    const battingAvgNum = parseFloat(battingAverage) || 0;
    const bowlingAvgNum = parseFloat(bowlingAverage) || 0;

    res.json({
      success: true,
      data: {
        playerId,
        playerName: batting.playerName || bowling.playerName || '',
        matchesPlayed: matchesPlayed[0]?.matchCount || 0,
        batting: {
          inningsPlayed: batting.inningsPlayed,
          totalRuns: batting.totalRuns,
          totalBalls: batting.totalBalls,
          notOuts: batting.notOuts,
          average: battingAverage,
          strikeRate,
          highestScore: batting.highestScore,
          fifties: batting.fifties,
          hundreds: batting.hundreds,
          ducks: batting.ducks,
          fours: batting.totalFours,
          sixes: batting.totalSixes,
        },
        bowling: {
          innings: bowling.bowlingInnings,
          totalWickets: bowling.totalWickets,
          totalBallsBowled: bowling.totalBallsBowled,
          overs: bowlingOvers,
          totalRunsConceded: bowling.totalRunsConceded,
          average: bowlingAverage,
          economy,
          bestBowling,
          maidens: bowling.totalMaidens,
          fiveWickets: bowling.fiveWickets,
          wides: bowling.totalWides,
          noBalls: bowling.totalNoBalls,
        },
        allRound: {
          battingAverage: battingAvgNum,
          bowlingAverage: bowlingAvgNum,
          isAllRounder: battingAvgNum > 25 && bowlingAvgNum > 0 && bowlingAvgNum < 30,
        },
      },
    });
  } catch (error) {
    console.error('Get player stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch player stats',
    });
  }
});

// GET /api/v1/players/:playerId/stats/recent
// Get recent match performance for a player
router.get('/players/:playerId/stats/recent', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const recentBatting = await db
      .select({
        matchId: matches.id,
        matchTitle: matches.title,
        teamA: matches.teamA,
        teamB: matches.teamB,
        date: matches.createdAt,
        runs: batters.runs,
        ballsFaced: batters.ballsFaced,
        fours: batters.fours,
        sixes: batters.sixes,
        status: batters.status,
        dismissalType: batters.dismissalType,
      })
      .from(batters)
      .innerJoin(innings, eq(batters.inningsId, innings.id))
      .innerJoin(matches, eq(innings.matchId, matches.id))
      .where(eq(batters.playerName, playerId))
      .orderBy(desc(matches.createdAt))
      .limit(limit);

    const recentBowling = await db
      .select({
        matchId: matches.id,
        matchTitle: matches.title,
        date: matches.createdAt,
        wickets: bowlers.wickets,
        ballsBowled: bowlers.ballsBowled,
        runsConceded: bowlers.runsConceded,
        maidens: bowlers.maidens,
      })
      .from(bowlers)
      .innerJoin(innings, eq(bowlers.inningsId, innings.id))
      .innerJoin(matches, eq(innings.matchId, matches.id))
      .where(eq(bowlers.playerName, playerId))
      .orderBy(desc(matches.createdAt))
      .limit(limit);

    res.json({
      success: true,
      data: {
        recentBatting,
        recentBowling,
      },
    });
  } catch (error) {
    console.error('Get player recent stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch player recent stats',
    });
  }
});

export default router;
