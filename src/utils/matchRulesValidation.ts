import { z } from 'zod';

export const matchRulesSchema = z.object({
  overs: z.number().int().min(1).max(500),
  playersPerSide: z.number().int().min(2).max(12),
  ballsPerOver: z.number().int().min(1).max(10),
  inningsPerSide: z.number().int().min(1).max(4),
  maxOversPerBowler: z.number().int().min(0).max(500),
  powerplayOvers: z.number().int().min(0).max(500),
  powerplayFielders: z.number().int().min(1).max(11),
  maxFieldersOutside: z.number().int().min(1).max(11),
  wideRuns: z.number().int().min(0).max(10),
  noBallRuns: z.number().int().min(0).max(10),
  freeHitEnabled: z.boolean(),
  byeAllowed: z.boolean(),
  legByeAllowed: z.boolean(),
  retiredHurtEnabled: z.boolean(),
  retiredOutEnabled: z.boolean(),
  superOverEnabled: z.boolean(),
  lastManStandingEnabled: z.boolean(),
  reviewEnabled: z.boolean(),
  reviewsPerInnings: z.number().int().min(0).max(10),
  tieBreakerType: z.enum(['super_over', 'bowl_out', 'most_runs']),
  target: z.number().int().min(1).optional(),
  matchType: z.enum(['friendly', 'competitive', 'tournament']),
}).refine(
  (data) => {
    if (data.maxOversPerBowler > 0 && data.maxOversPerBowler > data.overs) {
      return false;
    }
    return true;
  },
  { message: 'Max overs per bowler cannot exceed match overs' }
).refine(
  (data) => {
    if (data.powerplayOvers > data.overs) {
      return false;
    }
    return true;
  },
  { message: 'Powerplay overs cannot exceed match overs' }
).refine(
  (data) => {
    if (data.powerplayFielders > data.playersPerSide) {
      return false;
    }
    return true;
  },
  { message: 'Powerplay fielders cannot exceed players per side' }
).refine(
  (data) => {
    if (data.maxFieldersOutside > data.playersPerSide) {
      return false;
    }
    return true;
  },
  { message: 'Max fielders outside circle cannot exceed players per side' }
);

export type MatchRules = z.infer<typeof matchRulesSchema>;

export function validateMatchRules(rules: unknown) {
  return matchRulesSchema.safeParse(rules);
}
