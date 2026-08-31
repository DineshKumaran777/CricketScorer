DO $$ BEGIN
 CREATE TYPE "public"."competition_status" AS ENUM('upcoming', 'in_progress', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."competition_type" AS ENUM('single', 'league', 'knockout', 'league_knockout');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."extras_type" AS ENUM('wide', 'no_ball', 'bye', 'leg_bye', 'penalty');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."match_mode" AS ENUM('score', 'play', 'follow');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."match_status" AS ENUM('upcoming', 'live', 'completed', 'abandoned');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."stage_type" AS ENUM('group', 'league', 'quarter_final', 'semi_final', 'final', 'playoff');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."toss_decision" AS ENUM('bat', 'bowl');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."visibility" AS ENUM('public', 'private', 'team_only', 'invite_only');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."wicket_type" AS ENUM('bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'obstructing', 'handled_ball', 'timed_out', 'retired_out', 'retired_hurt');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ball_reversals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ball_id" uuid NOT NULL,
	"innings_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"reversed_by" varchar(255) NOT NULL,
	"reason" text,
	"original_ball_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "balls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"innings_id" uuid NOT NULL,
	"over_number" integer NOT NULL,
	"ball_number" integer NOT NULL,
	"total_ball_number" integer NOT NULL,
	"striker_name" varchar(255) NOT NULL,
	"non_striker_name" varchar(255),
	"bowler_name" varchar(255) NOT NULL,
	"runs_off_bat" integer DEFAULT 0 NOT NULL,
	"extras_type" "extras_type",
	"extras_runs" integer DEFAULT 0 NOT NULL,
	"is_wicket" boolean DEFAULT false NOT NULL,
	"wicket_type" "wicket_type",
	"dismissed_batter" varchar(255),
	"fielder" varchar(255),
	"is_legal_delivery" boolean DEFAULT true NOT NULL,
	"is_free_hit" boolean DEFAULT false NOT NULL,
	"commentary" text,
	"client_event_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "batters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"innings_id" uuid NOT NULL,
	"player_name" varchar(255) NOT NULL,
	"match_player_id" uuid,
	"position" integer NOT NULL,
	"runs" integer DEFAULT 0 NOT NULL,
	"balls_faced" integer DEFAULT 0 NOT NULL,
	"fours" integer DEFAULT 0 NOT NULL,
	"sixes" integer DEFAULT 0 NOT NULL,
	"status" varchar(30) DEFAULT 'yet_to_bat' NOT NULL,
	"dismissal_type" "wicket_type",
	"dismissed_by" varchar(255),
	"fielder" varchar(255),
	"is_striker" boolean DEFAULT false NOT NULL,
	"is_non_striker" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bowlers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"innings_id" uuid NOT NULL,
	"player_name" varchar(255) NOT NULL,
	"match_player_id" uuid,
	"balls_bowled" integer DEFAULT 0 NOT NULL,
	"maidens" integer DEFAULT 0 NOT NULL,
	"runs_conceded" integer DEFAULT 0 NOT NULL,
	"wickets" integer DEFAULT 0 NOT NULL,
	"wides" integer DEFAULT 0 NOT NULL,
	"no_balls" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competition_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "stage_type" NOT NULL,
	"stage_order" integer DEFAULT 0 NOT NULL,
	"group_name" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competition_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"team_id" uuid,
	"team_name" varchar(255) NOT NULL,
	"stage_id" uuid,
	"group_name" varchar(50),
	"points" integer DEFAULT 0 NOT NULL,
	"net_run_rate" real DEFAULT 0 NOT NULL,
	"played" integer DEFAULT 0 NOT NULL,
	"won" integer DEFAULT 0 NOT NULL,
	"lost" integer DEFAULT 0 NOT NULL,
	"tied" integer DEFAULT 0 NOT NULL,
	"no_result" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "competition_type" DEFAULT 'single' NOT NULL,
	"status" "competition_status" DEFAULT 'upcoming' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idempotency_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_event_id" varchar(255) NOT NULL,
	"match_id" uuid NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "idempotency_events_client_event_id_unique" UNIQUE("client_event_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "innings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"innings_number" integer NOT NULL,
	"batting_team" varchar(255) NOT NULL,
	"bowling_team" varchar(255) NOT NULL,
	"total_runs" integer DEFAULT 0 NOT NULL,
	"total_wickets" integer DEFAULT 0 NOT NULL,
	"total_balls" integer DEFAULT 0 NOT NULL,
	"total_overs" varchar(10) DEFAULT '0.0' NOT NULL,
	"extras_wides" integer DEFAULT 0 NOT NULL,
	"extras_no_balls" integer DEFAULT 0 NOT NULL,
	"extras_byes" integer DEFAULT 0 NOT NULL,
	"extras_leg_byes" integer DEFAULT 0 NOT NULL,
	"extras_penalty" integer DEFAULT 0 NOT NULL,
	"declared" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'live' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"player_name" varchar(255) NOT NULL,
	"team_name" varchar(255) NOT NULL,
	"player_id" uuid,
	"user_email" varchar(255),
	"position" integer DEFAULT 0 NOT NULL,
	"role" varchar(30),
	"is_captain" boolean DEFAULT false NOT NULL,
	"is_wicketkeeper" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"overs" integer DEFAULT 20 NOT NULL,
	"players_per_side" integer DEFAULT 11 NOT NULL,
	"balls_per_over" integer DEFAULT 6 NOT NULL,
	"innings_per_side" integer DEFAULT 2 NOT NULL,
	"max_overs_per_bowler" integer DEFAULT 4 NOT NULL,
	"powerplay_overs" integer DEFAULT 0 NOT NULL,
	"powerplay_fielders" integer DEFAULT 2 NOT NULL,
	"max_fielders_outside" integer DEFAULT 5 NOT NULL,
	"wide_runs" integer DEFAULT 1 NOT NULL,
	"no_ball_runs" integer DEFAULT 1 NOT NULL,
	"free_hit_enabled" boolean DEFAULT true NOT NULL,
	"bye_allowed" boolean DEFAULT true NOT NULL,
	"leg_bye_allowed" boolean DEFAULT true NOT NULL,
	"retired_hurt_enabled" boolean DEFAULT true NOT NULL,
	"retired_out_enabled" boolean DEFAULT false NOT NULL,
	"super_over_enabled" boolean DEFAULT false NOT NULL,
	"last_man_standing_enabled" boolean DEFAULT false NOT NULL,
	"review_enabled" boolean DEFAULT false NOT NULL,
	"reviews_per_innings" integer DEFAULT 1 NOT NULL,
	"tie_breaker_type" varchar(30) DEFAULT 'super_over' NOT NULL,
	"target" integer,
	"match_type" varchar(30) DEFAULT 'friendly' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_rules_match_id_unique" UNIQUE("match_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"competition_id" uuid,
	"stage_id" uuid,
	"title" varchar(255) NOT NULL,
	"team_a" varchar(255) NOT NULL,
	"team_b" varchar(255) NOT NULL,
	"team_a_id" uuid,
	"team_b_id" uuid,
	"status" "match_status" DEFAULT 'upcoming' NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"match_mode" "match_mode" DEFAULT 'score' NOT NULL,
	"toss_winner" varchar(255),
	"toss_decision" "toss_decision",
	"result" text,
	"result_type" varchar(50),
	"current_innings" integer DEFAULT 1 NOT NULL,
	"is_live" boolean DEFAULT false NOT NULL,
	"match_state_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"batting_style" varchar(30),
	"bowling_style" varchar(30),
	"is_claimed" boolean DEFAULT false NOT NULL,
	"claimed_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" varchar(255),
	"name" varchar(255) NOT NULL,
	"short_name" varchar(10),
	"logo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ball_reversals" ADD CONSTRAINT "ball_reversals_ball_id_balls_id_fk" FOREIGN KEY ("ball_id") REFERENCES "public"."balls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ball_reversals" ADD CONSTRAINT "ball_reversals_innings_id_innings_id_fk" FOREIGN KEY ("innings_id") REFERENCES "public"."innings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ball_reversals" ADD CONSTRAINT "ball_reversals_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "balls" ADD CONSTRAINT "balls_innings_id_innings_id_fk" FOREIGN KEY ("innings_id") REFERENCES "public"."innings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "batters" ADD CONSTRAINT "batters_innings_id_innings_id_fk" FOREIGN KEY ("innings_id") REFERENCES "public"."innings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bowlers" ADD CONSTRAINT "bowlers_innings_id_innings_id_fk" FOREIGN KEY ("innings_id") REFERENCES "public"."innings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "competition_stages" ADD CONSTRAINT "competition_stages_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "innings" ADD CONSTRAINT "innings_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_rules" ADD CONSTRAINT "match_rules_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_balls_innings_id" ON "balls" USING btree ("innings_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_balls_innings_id_total_ball_number" ON "balls" USING btree ("innings_id","total_ball_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_balls_client_event_id" ON "balls" USING btree ("client_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_batters_innings_id" ON "batters" USING btree ("innings_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_batters_innings_id_player_name" ON "batters" USING btree ("innings_id","player_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bowlers_innings_id" ON "bowlers" USING btree ("innings_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bowlers_innings_id_player_name" ON "bowlers" USING btree ("innings_id","player_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_competition_stages_competition_id" ON "competition_stages" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_competition_teams_competition_id" ON "competition_teams" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_competitions_user_email" ON "competitions" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_innings_match_id" ON "innings" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_innings_match_id_innings_number" ON "innings" USING btree ("match_id","innings_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_match_players_match_id" ON "match_players" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_match_players_match_id_player_id" ON "match_players" USING btree ("match_id","player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_matches_user_email" ON "matches" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_matches_user_email_status" ON "matches" USING btree ("user_email","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_players_name" ON "players" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_teams_created_by" ON "teams" USING btree ("created_by");