import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─── Enums ───────────────────────────────────────────────────────────

export const matchStatusEnum = pgEnum('match_status', [
  'upcoming', 'live', 'completed', 'abandoned',
]);

export const tossDecisionEnum = pgEnum('toss_decision', ['bat', 'bowl']);

export const visibilityEnum = pgEnum('visibility', [
  'public', 'private', 'team_only', 'invite_only',
]);

export const competitionTypeEnum = pgEnum('competition_type', [
  'single', 'league', 'knockout', 'league_knockout',
]);

export const competitionStatusEnum = pgEnum('competition_status', [
  'upcoming', 'in_progress', 'completed',
]);

export const stageTypeEnum = pgEnum('stage_type', [
  'group', 'league', 'quarter_final', 'semi_final', 'final', 'playoff',
]);

export const matchModeEnum = pgEnum('match_mode', [
  'score', 'play', 'follow',
]);

export const extrasTypeEnum = pgEnum('extras_type', [
  'wide', 'no_ball', 'bye', 'leg_bye', 'penalty',
]);

export const wicketTypeEnum = pgEnum('wicket_type', [
  'bowled', 'caught', 'lbw', 'run_out', 'stumped',
  'hit_wicket', 'obstructing', 'handled_ball',
  'timed_out', 'retired_out', 'retired_hurt',
]);

// ─── Users ───────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  image: text('image'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Teams (registered teams, optional) ──────────────────────────────

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdBy: varchar('created_by', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  shortName: varchar('short_name', { length: 10 }),
  logoUrl: text('logo_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  createdByIdx: index('idx_teams_created_by').on(table.createdBy),
}));

// ─── Players (registered players, optional) ──────────────────────────

export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  battingStyle: varchar('batting_style', { length: 30 }),
  bowlingStyle: varchar('bowling_style', { length: 30 }),
  isClaimed: boolean('is_claimed').notNull().default(false),
  claimedBy: varchar('claimed_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('idx_players_name').on(table.name),
}));

// ─── Competitions (tournaments, leagues) ─────────────────────────────

export const competitions = pgTable('competitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userEmail: varchar('user_email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: competitionTypeEnum('type').notNull().default('single'),
  status: competitionStatusEnum('status').notNull().default('upcoming'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userEmailIdx: index('idx_competitions_user_email').on(table.userEmail),
}));

// ─── Competition Stages ──────────────────────────────────────────────

export const competitionStages = pgTable('competition_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  competitionId: uuid('competition_id')
    .notNull()
    .references(() => competitions.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: stageTypeEnum('type').notNull(),
  stageOrder: integer('stage_order').notNull().default(0),
  groupName: varchar('group_name', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  competitionIdIdx: index('idx_competition_stages_competition_id').on(table.competitionId),
}));

// ─── Competition Teams ───────────────────────────────────────────────

export const competitionTeams = pgTable('competition_teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  competitionId: uuid('competition_id')
    .notNull()
    .references(() => competitions.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id'),
  teamName: varchar('team_name', { length: 255 }).notNull(),
  stageId: uuid('stage_id'),
  groupName: varchar('group_name', { length: 50 }),
  points: integer('points').notNull().default(0),
  netRunRate: real('net_run_rate').notNull().default(0),
  played: integer('played').notNull().default(0),
  won: integer('won').notNull().default(0),
  lost: integer('lost').notNull().default(0),
  tied: integer('tied').notNull().default(0),
  noResult: integer('no_result').notNull().default(0),
}, (table) => ({
  competitionIdIdx: index('idx_competition_teams_competition_id').on(table.competitionId),
}));

// ─── Matches ─────────────────────────────────────────────────────────

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userEmail: varchar('user_email', { length: 255 }).notNull(),
  competitionId: uuid('competition_id'),
  stageId: uuid('stage_id'),
  title: varchar('title', { length: 255 }).notNull(),
  teamA: varchar('team_a', { length: 255 }).notNull(),
  teamB: varchar('team_b', { length: 255 }).notNull(),
  teamAId: uuid('team_a_id'),
  teamBId: uuid('team_b_id'),
  status: matchStatusEnum('status').notNull().default('upcoming'),
  visibility: visibilityEnum('visibility').notNull().default('private'),
  matchMode: matchModeEnum('match_mode').notNull().default('score'),
  tossWinner: varchar('toss_winner', { length: 255 }),
  tossDecision: tossDecisionEnum('toss_decision'),
  result: text('result'),
  resultType: varchar('result_type', { length: 50 }),
  currentInnings: integer('current_innings').notNull().default(1),
  isLive: boolean('is_live').notNull().default(false),
  matchStateVersion: integer('match_state_version').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  userEmailIdx: index('idx_matches_user_email').on(table.userEmail),
  userEmailStatusIdx: index('idx_matches_user_email_status').on(table.userEmail, table.status),
}));

// ─── Match Rules (configurable per match) ────────────────────────────

export const matchRules = pgTable('match_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' })
    .unique(),
  overs: integer('overs').notNull().default(20),
  playersPerSide: integer('players_per_side').notNull().default(11),
  ballsPerOver: integer('balls_per_over').notNull().default(6),
  inningsPerSide: integer('innings_per_side').notNull().default(2),
  maxOversPerBowler: integer('max_overs_per_bowler').notNull().default(4),
  powerplayOvers: integer('powerplay_overs').notNull().default(0),
  powerplayFielders: integer('powerplay_fielders').notNull().default(2),
  maxFieldersOutside: integer('max_fielders_outside').notNull().default(5),
  wideRuns: integer('wide_runs').notNull().default(1),
  noBallRuns: integer('no_ball_runs').notNull().default(1),
  freeHitEnabled: boolean('free_hit_enabled').notNull().default(true),
  byeAllowed: boolean('bye_allowed').notNull().default(true),
  legByeAllowed: boolean('leg_bye_allowed').notNull().default(true),
  retiredHurtEnabled: boolean('retired_hurt_enabled').notNull().default(true),
  retiredOutEnabled: boolean('retired_out_enabled').notNull().default(false),
  superOverEnabled: boolean('super_over_enabled').notNull().default(false),
  lastManStandingEnabled: boolean('last_man_standing_enabled').notNull().default(false),
  reviewEnabled: boolean('review_enabled').notNull().default(false),
  reviewsPerInnings: integer('reviews_per_innings').notNull().default(1),
  tieBreakerType: varchar('tie_breaker_type', { length: 30 }).notNull().default('super_over'),
  target: integer('target'),
  matchType: varchar('match_type', { length: 30 }).notNull().default('friendly'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Match Players ───────────────────────────────────────────────────

export const matchPlayers = pgTable('match_players', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  playerName: varchar('player_name', { length: 255 }).notNull(),
  teamName: varchar('team_name', { length: 255 }).notNull(),
  playerId: uuid('player_id'),
  userEmail: varchar('user_email', { length: 255 }),
  position: integer('position').notNull().default(0),
  role: varchar('role', { length: 30 }),
  isCaptain: boolean('is_captain').notNull().default(false),
  isWicketkeeper: boolean('is_wicketkeeper').notNull().default(false),
}, (table) => ({
  matchIdIdx: index('idx_match_players_match_id').on(table.matchId),
  matchIdPlayerIdIdx: uniqueIndex('idx_match_players_match_id_player_id').on(table.matchId, table.playerId),
}));

// ─── Innings ─────────────────────────────────────────────────────────

export const innings = pgTable('innings', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  inningsNumber: integer('innings_number').notNull(),
  battingTeam: varchar('batting_team', { length: 255 }).notNull(),
  bowlingTeam: varchar('bowling_team', { length: 255 }).notNull(),
  totalRuns: integer('total_runs').notNull().default(0),
  totalWickets: integer('total_wickets').notNull().default(0),
  totalBalls: integer('total_balls').notNull().default(0),
  totalOvers: varchar('total_overs', { length: 10 }).notNull().default('0.0'),
  extrasWides: integer('extras_wides').notNull().default(0),
  extrasNoBalls: integer('extras_no_balls').notNull().default(0),
  extrasByes: integer('extras_byes').notNull().default(0),
  extrasLegByes: integer('extras_leg_byes').notNull().default(0),
  extrasPenalty: integer('extras_penalty').notNull().default(0),
  declared: boolean('declared').notNull().default(false),
  status: varchar('status', { length: 20 }).notNull().default('live'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  matchIdIdx: index('idx_innings_match_id').on(table.matchId),
  matchIdInningsNumberIdx: uniqueIndex('idx_innings_match_id_innings_number').on(table.matchId, table.inningsNumber),
}));

// ─── Batters ─────────────────────────────────────────────────────────

export const batters = pgTable('batters', {
  id: uuid('id').primaryKey().defaultRandom(),
  inningsId: uuid('innings_id')
    .notNull()
    .references(() => innings.id, { onDelete: 'cascade' }),
  playerName: varchar('player_name', { length: 255 }).notNull(),
  matchPlayerId: uuid('match_player_id'),
  position: integer('position').notNull(),
  runs: integer('runs').notNull().default(0),
  ballsFaced: integer('balls_faced').notNull().default(0),
  fours: integer('fours').notNull().default(0),
  sixes: integer('sixes').notNull().default(0),
  status: varchar('status', { length: 30 }).notNull().default('yet_to_bat'),
  dismissalType: wicketTypeEnum('dismissal_type'),
  dismissedBy: varchar('dismissed_by', { length: 255 }),
  fielder: varchar('fielder', { length: 255 }),
  isStriker: boolean('is_striker').notNull().default(false),
  isNonStriker: boolean('is_non_striker').notNull().default(false),
}, (table) => ({
  inningsIdIdx: index('idx_batters_innings_id').on(table.inningsId),
  inningsIdPlayerNameIdx: index('idx_batters_innings_id_player_name').on(table.inningsId, table.playerName),
}));

// ─── Bowlers ─────────────────────────────────────────────────────────

export const bowlers = pgTable('bowlers', {
  id: uuid('id').primaryKey().defaultRandom(),
  inningsId: uuid('innings_id')
    .notNull()
    .references(() => innings.id, { onDelete: 'cascade' }),
  playerName: varchar('player_name', { length: 255 }).notNull(),
  matchPlayerId: uuid('match_player_id'),
  ballsBowled: integer('balls_bowled').notNull().default(0),
  maidens: integer('maidens').notNull().default(0),
  runsConceded: integer('runs_conceded').notNull().default(0),
  wickets: integer('wickets').notNull().default(0),
  wides: integer('wides').notNull().default(0),
  noBalls: integer('no_balls').notNull().default(0),
}, (table) => ({
  inningsIdIdx: index('idx_bowlers_innings_id').on(table.inningsId),
  inningsIdPlayerNameIdx: index('idx_bowlers_innings_id_player_name').on(table.inningsId, table.playerName),
}));

// ─── Balls (deliveries) ──────────────────────────────────────────────

export const balls = pgTable('balls', {
  id: uuid('id').primaryKey().defaultRandom(),
  inningsId: uuid('innings_id')
    .notNull()
    .references(() => innings.id, { onDelete: 'cascade' }),
  overNumber: integer('over_number').notNull(),
  ballNumber: integer('ball_number').notNull(),
  totalBallNumber: integer('total_ball_number').notNull(),
  strikerName: varchar('striker_name', { length: 255 }).notNull(),
  nonStrikerName: varchar('non_striker_name', { length: 255 }),
  bowlerName: varchar('bowler_name', { length: 255 }).notNull(),
  runsOffBat: integer('runs_off_bat').notNull().default(0),
  extrasType: extrasTypeEnum('extras_type'),
  extrasRuns: integer('extras_runs').notNull().default(0),
  isWicket: boolean('is_wicket').notNull().default(false),
  wicketType: wicketTypeEnum('wicket_type'),
  dismissedBatter: varchar('dismissed_batter', { length: 255 }),
  fielder: varchar('fielder', { length: 255 }),
  isLegalDelivery: boolean('is_legal_delivery').notNull().default(true),
  isFreeHit: boolean('is_free_hit').notNull().default(false),
  commentary: text('commentary'),
  clientEventId: varchar('client_event_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  inningsIdIdx: index('idx_balls_innings_id').on(table.inningsId),
  inningsIdTotalBallNumberIdx: index('idx_balls_innings_id_total_ball_number').on(table.inningsId, table.totalBallNumber),
  clientEventIdIdx: uniqueIndex('idx_balls_client_event_id').on(table.clientEventId),
}));

// ─── Ball Reversals (undo audit trail) ───────────────────────────────

export const ballReversals = pgTable('ball_reversals', {
  id: uuid('id').primaryKey().defaultRandom(),
  ballId: uuid('ball_id')
    .notNull()
    .references(() => balls.id, { onDelete: 'cascade' }),
  inningsId: uuid('innings_id')
    .notNull()
    .references(() => innings.id, { onDelete: 'cascade' }),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  reversedBy: varchar('reversed_by', { length: 255 }).notNull(),
  reason: text('reason'),
  originalBallData: jsonb('original_ball_data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Idempotency Events ─────────────────────────────────────────────

export const idempotencyEvents = pgTable('idempotency_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientEventId: varchar('client_event_id', { length: 255 }).notNull().unique(),
  matchId: uuid('match_id').notNull(),
  result: jsonb('result').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});
