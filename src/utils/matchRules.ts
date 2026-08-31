export interface MatchRules {
  id?: string;
  matchId?: string;
  overs: number;
  playersPerSide: number;
  ballsPerOver: number;
  inningsPerSide: number;
  maxOversPerBowler: number;
  powerplayOvers: number;
  powerplayFielders: number;
  maxFieldersOutside: number;
  wideRuns: number;
  noBallRuns: number;
  freeHitEnabled: boolean;
  byeAllowed: boolean;
  legByeAllowed: boolean;
  retiredHurtEnabled: boolean;
  retiredOutEnabled: boolean;
  superOverEnabled: boolean;
  lastManStandingEnabled: boolean;
  reviewEnabled: boolean;
  reviewsPerInnings: number;
  tieBreakerType: string;
  target?: number;
  matchType: string;
}

export const DEFAULT_RULES: MatchRules = {
  overs: 20,
  playersPerSide: 11,
  ballsPerOver: 6,
  inningsPerSide: 2,
  maxOversPerBowler: 4,
  powerplayOvers: 0,
  powerplayFielders: 2,
  maxFieldersOutside: 5,
  wideRuns: 1,
  noBallRuns: 1,
  freeHitEnabled: true,
  byeAllowed: true,
  legByeAllowed: true,
  retiredHurtEnabled: true,
  retiredOutEnabled: false,
  superOverEnabled: false,
  lastManStandingEnabled: false,
  reviewEnabled: false,
  reviewsPerInnings: 1,
  tieBreakerType: 'super_over',
  matchType: 'friendly',
};

export interface MatchPreset {
  name: string;
  label: string;
  description: string;
  rules: Partial<MatchRules>;
}

export const MATCH_PRESETS: MatchPreset[] = [
  {
    name: 't20',
    label: 'T20',
    description: '20 overs, 11 players',
    rules: { overs: 20, playersPerSide: 11, maxOversPerBowler: 4, powerplayOvers: 6, matchType: 'tournament' },
  },
  {
    name: 't10',
    label: 'T10',
    description: '10 overs, 11 players',
    rules: { overs: 10, playersPerSide: 11, maxOversPerBowler: 2, matchType: 'tournament' },
  },
  {
    name: 'odi',
    label: '50 Overs',
    description: '50 overs, 11 players',
    rules: { overs: 50, playersPerSide: 11, maxOversPerBowler: 10, powerplayOvers: 10, matchType: 'tournament' },
  },
  {
    name: '40over',
    label: '40 Overs',
    description: '40 overs, 11 players',
    rules: { overs: 40, playersPerSide: 11, maxOversPerBowler: 8, matchType: 'club' },
  },
  {
    name: 'club',
    label: 'Club',
    description: '30 overs, 11 players',
    rules: { overs: 30, playersPerSide: 11, maxOversPerBowler: 6, matchType: 'club' },
  },
  {
    name: 'school',
    label: 'School',
    description: '25 overs, 11 players',
    rules: { overs: 25, playersPerSide: 11, maxOversPerBowler: 5, matchType: 'school' },
  },
  {
    name: 'gully6',
    label: 'Gully 6',
    description: '6 overs, 6 players',
    rules: {
      overs: 6, playersPerSide: 6, maxOversPerBowler: 2,
      wideRuns: 1, noBallRuns: 1, lastManStandingEnabled: true,
      matchType: 'gully',
    },
  },
  {
    name: 'gully8',
    label: 'Gully 8',
    description: '8 overs, 8 players',
    rules: {
      overs: 8, playersPerSide: 8, maxOversPerBowler: 2,
      wideRuns: 1, noBallRuns: 1, lastManStandingEnabled: true,
      matchType: 'gully',
    },
  },
  {
    name: 'street',
    label: 'Street',
    description: '5 overs, 5 players',
    rules: {
      overs: 5, playersPerSide: 5, maxOversPerBowler: 2,
      wideRuns: 2, noBallRuns: 2, lastManStandingEnabled: true,
      retiredHurtEnabled: false, matchType: 'street',
    },
  },
  {
    name: 'practice',
    label: 'Practice',
    description: '10 overs, 11 players',
    rules: { overs: 10, playersPerSide: 11, maxOversPerBowler: 3, matchType: 'practice' },
  },
  {
    name: 'test',
    label: 'Test Style',
    description: 'Unlimited overs, 11 players',
    rules: { overs: 0, playersPerSide: 11, maxOversPerBowler: 0, inningsPerSide: 2, matchType: 'test' },
  },
  {
    name: 'custom',
    label: 'Custom',
    description: 'You decide everything',
    rules: {},
  },
];

export function applyPreset(presetName: string): MatchRules {
  const preset = MATCH_PRESETS.find(p => p.name === presetName);
  if (!preset) return { ...DEFAULT_RULES };
  return { ...DEFAULT_RULES, ...preset.rules };
}
