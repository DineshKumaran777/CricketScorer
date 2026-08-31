import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScoringEngine, BallInput } from '../scoringEngine';
import { MatchRules, DEFAULT_RULES } from '../matchRules';

function makeBall(overrides: Partial<BallInput> = {}): BallInput {
  return {
    runsOffBat: 0,
    extrasType: null,
    extrasRuns: 0,
    isWicket: false,
    wicketType: null,
    dismissedBatter: null,
    fielder: null,
    fieldingEnd: null,
    runsOffSameBall: 0,
    ...overrides,
  };
}

function makeOverBall(
  runsOffBat: number,
  extrasType: string | null,
  extrasRuns: number,
  isLegal: boolean,
) {
  return { runsOffBat, extrasType, extrasRuns, isLegalDelivery: isLegal };
}

const gully6Rules: MatchRules = {
  ...DEFAULT_RULES,
  overs: 6,
  playersPerSide: 6,
  ballsPerOver: 6,
  maxOversPerBowler: 2,
  lastManStandingEnabled: true,
  matchType: 'gully',
};

const fiveBallsRules: MatchRules = {
  ...DEFAULT_RULES,
  ballsPerOver: 5,
};

const customRules: MatchRules = {
  ...DEFAULT_RULES,
  overs: 7,
  playersPerSide: 5,
  ballsPerOver: 8,
  maxOversPerBowler: 3,
};

// ═══════════════════════════════════════════════════════════════════════
// Constructor / Config
// ═══════════════════════════════════════════════════════════════════════

describe('Constructor / Config', () => {
  it('creates engine with default rules', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.deepStrictEqual(engine.rules_config, DEFAULT_RULES);
    assert.equal(engine.rules_config.overs, 20);
    assert.equal(engine.rules_config.playersPerSide, 11);
    assert.equal(engine.rules_config.ballsPerOver, 6);
  });

  it('creates engine with custom rules (Gully 6: 6 players, 6 overs)', () => {
    const engine = new ScoringEngine(gully6Rules);
    assert.equal(engine.rules_config.overs, 6);
    assert.equal(engine.rules_config.playersPerSide, 6);
    assert.equal(engine.rules_config.maxOversPerBowler, 2);
    assert.equal(engine.rules_config.lastManStandingEnabled, true);
    assert.equal(engine.rules_config.matchType, 'gully');
  });

  it('creates engine with custom rules (5 balls per over)', () => {
    const engine = new ScoringEngine(fiveBallsRules);
    assert.equal(engine.rules_config.ballsPerOver, 5);
    assert.equal(engine.rules_config.overs, 20);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateBallResult
// ═══════════════════════════════════════════════════════════════════════

describe('calculateBallResult', () => {
  const engine = new ScoringEngine(DEFAULT_RULES);

  it('dot ball (0 runs, no extras)', () => {
    const result = engine.calculateBallResult(makeBall());
    assert.equal(result.batterRuns, 0);
    assert.equal(result.extrasRuns, 0);
    assert.equal(result.totalRuns, 0);
    assert.equal(result.isLegalDelivery, true);
  });

  it('single off bat', () => {
    const result = engine.calculateBallResult(makeBall({ runsOffBat: 1 }));
    assert.equal(result.batterRuns, 1);
    assert.equal(result.totalRuns, 1);
  });

  it('double off bat', () => {
    const result = engine.calculateBallResult(makeBall({ runsOffBat: 2 }));
    assert.equal(result.batterRuns, 2);
    assert.equal(result.totalRuns, 2);
  });

  it('triple off bat', () => {
    const result = engine.calculateBallResult(makeBall({ runsOffBat: 3 }));
    assert.equal(result.batterRuns, 3);
    assert.equal(result.totalRuns, 3);
  });

  it('four off bat', () => {
    const result = engine.calculateBallResult(makeBall({ runsOffBat: 4 }));
    assert.equal(result.batterRuns, 4);
    assert.equal(result.totalRuns, 4);
  });

  it('six off bat', () => {
    const result = engine.calculateBallResult(makeBall({ runsOffBat: 6 }));
    assert.equal(result.batterRuns, 6);
    assert.equal(result.totalRuns, 6);
  });

  it('wide ball (adds wideRuns)', () => {
    const result = engine.calculateBallResult(makeBall({ extrasType: 'wide' }));
    assert.equal(result.batterRuns, 0);
    assert.equal(result.extrasRuns, 1);
    assert.equal(result.totalRuns, 1);
    assert.equal(result.widesToBowler, 1);
    assert.equal(result.isLegalDelivery, false);
  });

  it('wide ball with extra runs', () => {
    const result = engine.calculateBallResult(
      makeBall({ extrasType: 'wide', extrasRuns: 2 }),
    );
    assert.equal(result.batterRuns, 0);
    assert.equal(result.extrasRuns, 3);
    assert.equal(result.totalRuns, 3);
    assert.equal(result.widesToBowler, 3);
  });

  it('no ball (adds noBallRuns + bat runs)', () => {
    const result = engine.calculateBallResult(
      makeBall({ extrasType: 'no_ball', runsOffBat: 1 }),
    );
    assert.equal(result.batterRuns, 1);
    assert.equal(result.extrasRuns, 1);
    assert.equal(result.totalRuns, 2);
    assert.equal(result.noballsToBowler, 1);
    assert.equal(result.isLegalDelivery, false);
  });

  it('no ball with boundary', () => {
    const result = engine.calculateBallResult(
      makeBall({ extrasType: 'no_ball', runsOffBat: 4 }),
    );
    assert.equal(result.batterRuns, 4);
    assert.equal(result.extrasRuns, 1);
    assert.equal(result.totalRuns, 5);
    assert.equal(result.noballsToBowler, 1);
  });

  it('no ball with six', () => {
    const result = engine.calculateBallResult(
      makeBall({ extrasType: 'no_ball', runsOffBat: 6 }),
    );
    assert.equal(result.batterRuns, 6);
    assert.equal(result.extrasRuns, 1);
    assert.equal(result.totalRuns, 7);
  });

  it('bye', () => {
    const result = engine.calculateBallResult(
      makeBall({ extrasType: 'bye', extrasRuns: 1 }),
    );
    assert.equal(result.batterRuns, 0);
    assert.equal(result.extrasRuns, 1);
    assert.equal(result.totalRuns, 1);
    assert.equal(result.isLegalDelivery, true);
  });

  it('bye with 2 runs', () => {
    const result = engine.calculateBallResult(
      makeBall({ extrasType: 'bye', extrasRuns: 2 }),
    );
    assert.equal(result.batterRuns, 0);
    assert.equal(result.extrasRuns, 2);
    assert.equal(result.totalRuns, 2);
  });

  it('leg bye', () => {
    const result = engine.calculateBallResult(
      makeBall({ extrasType: 'leg_bye', extrasRuns: 1 }),
    );
    assert.equal(result.batterRuns, 0);
    assert.equal(result.extrasRuns, 1);
    assert.equal(result.totalRuns, 1);
    assert.equal(result.isLegalDelivery, true);
  });

  it('penalty', () => {
    const result = engine.calculateBallResult(
      makeBall({ extrasType: 'penalty', extrasRuns: 5 }),
    );
    assert.equal(result.batterRuns, 0);
    assert.equal(result.extrasRuns, 5);
    assert.equal(result.totalRuns, 5);
    assert.equal(result.isLegalDelivery, true);
  });

  it('penalty with no extrasRuns defaults to 5', () => {
    const result = engine.calculateBallResult(
      makeBall({ extrasType: 'penalty', extrasRuns: 0 }),
    );
    assert.equal(result.extrasRuns, 5);
    assert.equal(result.totalRuns, 5);
  });

  it('ball with no extras (runs off bat only)', () => {
    const result = engine.calculateBallResult(
      makeBall({ runsOffBat: 3, extrasType: null, extrasRuns: 0 }),
    );
    assert.equal(result.batterRuns, 3);
    assert.equal(result.extrasRuns, 0);
    assert.equal(result.totalRuns, 3);
    assert.equal(result.isLegalDelivery, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// isLegalDelivery
// ═══════════════════════════════════════════════════════════════════════

describe('isLegalDelivery', () => {
  const engine = new ScoringEngine(DEFAULT_RULES);

  it('null extras → legal', () => {
    assert.equal(engine.isLegalDelivery(null), true);
  });

  it('bye → legal', () => {
    assert.equal(engine.isLegalDelivery('bye'), true);
  });

  it('leg_bye → legal', () => {
    assert.equal(engine.isLegalDelivery('leg_bye'), true);
  });

  it('wide → illegal', () => {
    assert.equal(engine.isLegalDelivery('wide'), false);
  });

  it('no_ball → illegal', () => {
    assert.equal(engine.isLegalDelivery('no_ball'), false);
  });

  it('penalty → legal', () => {
    assert.equal(engine.isLegalDelivery('penalty'), true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// shouldRotateStrike
// ═══════════════════════════════════════════════════════════════════════

describe('shouldRotateStrike', () => {
  const engine = new ScoringEngine(DEFAULT_RULES);

  it('end of over → always rotate', () => {
    assert.equal(engine.shouldRotateStrike(0, 0, null, true), true);
    assert.equal(engine.shouldRotateStrike(2, 0, null, true), true);
    assert.equal(engine.shouldRotateStrike(0, 0, 'wide', true), true);
  });

  it('wide → no rotation', () => {
    assert.equal(engine.shouldRotateStrike(0, 1, 'wide', false), false);
  });

  it('wide with extra runs → no rotation', () => {
    assert.equal(engine.shouldRotateStrike(0, 3, 'wide', false), false);
  });

  it('no ball → no rotation', () => {
    assert.equal(engine.shouldRotateStrike(1, 0, 'no_ball', false), false);
  });

  it('no ball with bat runs → no rotation', () => {
    assert.equal(engine.shouldRotateStrike(4, 0, 'no_ball', false), false);
  });

  it('odd runs off bat → rotate', () => {
    assert.equal(engine.shouldRotateStrike(1, 0, null, false), true);
    assert.equal(engine.shouldRotateStrike(3, 0, null, false), true);
    assert.equal(engine.shouldRotateStrike(5, 0, null, false), true);
  });

  it('even runs off bat → no rotate', () => {
    assert.equal(engine.shouldRotateStrike(0, 0, null, false), false);
    assert.equal(engine.shouldRotateStrike(2, 0, null, false), false);
    assert.equal(engine.shouldRotateStrike(4, 0, null, false), false);
    assert.equal(engine.shouldRotateStrike(6, 0, null, false), false);
  });

  it('bye with odd runs → rotate', () => {
    assert.equal(engine.shouldRotateStrike(0, 1, 'bye', false), true);
    assert.equal(engine.shouldRotateStrike(0, 3, 'bye', false), true);
  });

  it('bye with even runs → no rotate', () => {
    assert.equal(engine.shouldRotateStrike(0, 2, 'bye', false), false);
    assert.equal(engine.shouldRotateStrike(0, 4, 'bye', false), false);
  });

  it('leg bye with odd runs → rotate', () => {
    assert.equal(engine.shouldRotateStrike(0, 1, 'leg_bye', false), true);
  });

  it('leg bye with even runs → no rotate', () => {
    assert.equal(engine.shouldRotateStrike(0, 2, 'leg_bye', false), false);
  });

  it('penalty → uses runsOffBat for rotation (not extrasRuns)', () => {
    assert.equal(engine.shouldRotateStrike(0, 1, 'penalty', false), false);
    assert.equal(engine.shouldRotateStrike(1, 0, 'penalty', false), true);
  });

  it('penalty with even runs → no rotate', () => {
    assert.equal(engine.shouldRotateStrike(0, 2, 'penalty', false), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// isBowlerWicket
// ═══════════════════════════════════════════════════════════════════════

describe('isBowlerWicket', () => {
  const engine = new ScoringEngine(DEFAULT_RULES);

  it('bowled → true', () => {
    assert.equal(engine.isBowlerWicket('bowled'), true);
  });

  it('caught → true', () => {
    assert.equal(engine.isBowlerWicket('caught'), true);
  });

  it('lbw → true', () => {
    assert.equal(engine.isBowlerWicket('lbw'), true);
  });

  it('stumped → true', () => {
    assert.equal(engine.isBowlerWicket('stumped'), true);
  });

  it('hit_wicket → true', () => {
    assert.equal(engine.isBowlerWicket('hit_wicket'), true);
  });

  it('run_out → false', () => {
    assert.equal(engine.isBowlerWicket('run_out'), false);
  });

  it('retired_hurt → false', () => {
    assert.equal(engine.isBowlerWicket('retired_hurt'), false);
  });

  it('null → false', () => {
    assert.equal(engine.isBowlerWicket(null), false);
  });

  it('unknown type → false', () => {
    assert.equal(engine.isBowlerWicket('hit_the_ball_twice'), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// isRetiredHurt
// ═══════════════════════════════════════════════════════════════════════

describe('isRetiredHurt', () => {
  const engine = new ScoringEngine(DEFAULT_RULES);

  it('retired_hurt → true', () => {
    assert.equal(engine.isRetiredHurt('retired_hurt'), true);
  });

  it('null → false', () => {
    assert.equal(engine.isRetiredHurt(null), false);
  });

  it('bowled → false', () => {
    assert.equal(engine.isRetiredHurt('bowled'), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// isMaiden
// ═══════════════════════════════════════════════════════════════════════

describe('isMaiden', () => {
  const engine = new ScoringEngine(DEFAULT_RULES);

  it('all dots → maiden', () => {
    const balls = Array(6).fill(makeOverBall(0, null, 0, true));
    assert.equal(engine.isMaiden(balls), true);
  });

  it('one single in over → not maiden', () => {
    const balls = [
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(1, null, 0, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
    ];
    assert.equal(engine.isMaiden(balls), false);
  });

  it('wide in over → not maiden', () => {
    const balls = [
      makeOverBall(0, null, 0, true),
      makeOverBall(0, 'wide', 1, false),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
    ];
    assert.equal(engine.isMaiden(balls), false);
  });

  it('no ball in over → not maiden', () => {
    const balls = [
      makeOverBall(0, null, 0, true),
      makeOverBall(0, 'no_ball', 0, false),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
    ];
    assert.equal(engine.isMaiden(balls), false);
  });

  it('bye in over → not maiden (extrasRuns > 0)', () => {
    const balls = [
      makeOverBall(0, 'bye', 1, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
    ];
    assert.equal(engine.isMaiden(balls), false);
  });

  it('empty array → not maiden', () => {
    assert.equal(engine.isMaiden([]), true);
  });

  it('wicket with no runs → maiden', () => {
    const balls = [
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
      makeOverBall(0, null, 0, true),
    ];
    assert.equal(engine.isMaiden(balls), true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// isInningsOver
// ═══════════════════════════════════════════════════════════════════════

describe('isInningsOver', () => {
  describe('default rules (11 players, 20 overs)', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);

    it('wickets >= playersPerSide - 1 → true (all out)', () => {
      assert.equal(engine.isInningsOver(10, 0, 0, null), true);
      assert.equal(engine.isInningsOver(11, 0, 0, null), true);
    });

    it('overs completed → true', () => {
      assert.equal(engine.isInningsOver(0, 20, 100, null), true);
      assert.equal(engine.isInningsOver(5, 20, 150, null), true);
    });

    it('target reached → true', () => {
      assert.equal(engine.isInningsOver(3, 10, 150, 150), true);
      assert.equal(engine.isInningsOver(3, 10, 160, 150), true);
    });

    it('none of the above → false', () => {
      assert.equal(engine.isInningsOver(0, 0, 0, null), false);
      assert.equal(engine.isInningsOver(5, 15, 100, 200), false);
      assert.equal(engine.isInningsOver(3, 10, 50, 100), false);
    });

    it('wickets 10 with 11 players → true (all out)', () => {
      assert.equal(engine.isInningsOver(10, 0, 0, null), true);
    });

    it('wickets 9 with 11 players → false (2 batters remain)', () => {
      assert.equal(engine.isInningsOver(9, 0, 0, null), false);
    });

    it('wickets 8 with 11 players → false', () => {
      assert.equal(engine.isInningsOver(8, 0, 0, null), false);
    });
  });

  describe('Gully 6 (6 players, 6 overs)', () => {
    const engine = new ScoringEngine(gully6Rules);

    it('wickets >= 5 → true (5 wickets = all out for 6 players)', () => {
      assert.equal(engine.isInningsOver(5, 0, 0, null), true);
      assert.equal(engine.isInningsOver(6, 0, 0, null), true);
    });

    it('wickets 4 → false (not all out)', () => {
      assert.equal(engine.isInningsOver(4, 0, 0, null), false);
    });

    it('6 overs completed → true', () => {
      assert.equal(engine.isInningsOver(0, 6, 0, null), true);
    });

    it('5 overs completed → false', () => {
      assert.equal(engine.isInningsOver(0, 5, 0, null), false);
    });
  });

  describe('unlimited overs (0 = unlimited)', () => {
    const engine = new ScoringEngine({
      ...DEFAULT_RULES,
      overs: 0,
    });

    it('overs = 0 does not trigger innings end', () => {
      assert.equal(engine.isInningsOver(0, 100, 500, null), false);
    });

    it('still ends on wickets', () => {
      assert.equal(engine.isInningsOver(10, 100, 500, null), true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// formatOvers
// ═══════════════════════════════════════════════════════════════════════

describe('formatOvers', () => {
  describe('6 balls per over (default)', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);

    it('0 balls → "0"', () => {
      assert.equal(engine.formatOvers(0), '0');
    });

    it('6 balls → "1"', () => {
      assert.equal(engine.formatOvers(6), '1');
    });

    it('7 balls → "1.1"', () => {
      assert.equal(engine.formatOvers(7), '1.1');
    });

    it('11 balls → "1.5"', () => {
      assert.equal(engine.formatOvers(11), '1.5');
    });

    it('12 balls → "2"', () => {
      assert.equal(engine.formatOvers(12), '2');
    });

    it('13 balls → "2.1"', () => {
      assert.equal(engine.formatOvers(13), '2.1');
    });

    it('18 balls → "3"', () => {
      assert.equal(engine.formatOvers(18), '3');
    });

    it('120 balls → "20"', () => {
      assert.equal(engine.formatOvers(120), '20');
    });
  });

  describe('5 balls per over', () => {
    const engine = new ScoringEngine(fiveBallsRules);

    it('5 balls → "1"', () => {
      assert.equal(engine.formatOvers(5), '1');
    });

    it('6 balls → "1.1"', () => {
      assert.equal(engine.formatOvers(6), '1.1');
    });

    it('10 balls → "2"', () => {
      assert.equal(engine.formatOvers(10), '2');
    });

    it('11 balls → "2.1"', () => {
      assert.equal(engine.formatOvers(11), '2.1');
    });

    it('0 balls → "0"', () => {
      assert.equal(engine.formatOvers(0), '0');
    });
  });

  describe('8 balls per over (custom)', () => {
    const engine = new ScoringEngine(customRules);

    it('8 balls → "1"', () => {
      assert.equal(engine.formatOvers(8), '1');
    });

    it('9 balls → "1.1"', () => {
      assert.equal(engine.formatOvers(9), '1.1');
    });

    it('16 balls → "2"', () => {
      assert.equal(engine.formatOvers(16), '2');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateRunRate
// ═══════════════════════════════════════════════════════════════════════

describe('calculateRunRate', () => {
  it('0 balls → 0', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.calculateRunRate(30, 0), 0);
  });

  it('30 runs, 30 balls, 6 bpo → 6.0', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.calculateRunRate(30, 30), 6.0);
  });

  it('30 runs, 30 balls, 5 bpo → 5.0', () => {
    const engine = new ScoringEngine(fiveBallsRules);
    assert.equal(engine.calculateRunRate(30, 30), 5.0);
  });

  it('100 runs, 120 balls, 6 bpo → 5.0', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.calculateRunRate(100, 120), 5.0);
  });

  it('0 runs, any balls → 0', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.calculateRunRate(0, 60), 0);
  });

  it('runs per ball with 8 bpo', () => {
    const engine = new ScoringEngine(customRules);
    assert.equal(engine.calculateRunRate(80, 40), 16.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateProjectedScore
// ═══════════════════════════════════════════════════════════════════════

describe('calculateProjectedScore', () => {
  it('0 balls → 0', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.calculateProjectedScore(0, 0), 0);
  });

  it('unlimited overs (0) → 0', () => {
    const engine = new ScoringEngine({
      ...DEFAULT_RULES,
      overs: 0,
    });
    assert.equal(engine.calculateProjectedScore(30, 10), 0);
  });

  it('30 runs, 10 balls, 20 overs, 6 bpo → 360', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.calculateProjectedScore(30, 10), 360);
  });

  it('60 runs, 30 balls, 20 overs, 6 bpo → 240', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.calculateProjectedScore(60, 30), 240);
  });

  it('projection with 5 bpo', () => {
    const engine = new ScoringEngine(fiveBallsRules);
    // 30 runs in 10 balls, 20 overs * 5 bpo = 100 total balls
    // (30/10) * 100 = 300
    assert.equal(engine.calculateProjectedScore(30, 10), 300);
  });

  it('projection with custom rules (7 overs, 8 bpo)', () => {
    const engine = new ScoringEngine(customRules);
    // 40 runs in 16 balls, 7 overs * 8 bpo = 56 total balls
    // (40/16) * 56 = 140
    assert.equal(engine.calculateProjectedScore(40, 16), 140);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// calculateRequiredRunRate
// ═══════════════════════════════════════════════════════════════════════

describe('calculateRequiredRunRate', () => {
  it('target 100, current 50, 30 balls remaining, 6 bpo → 10.0', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.calculateRequiredRunRate(100, 50, 30), 10.0);
  });

  it('target reached → 0', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.calculateRequiredRunRate(100, 100, 30), 0);
  });

  it('target exceeded → 0', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.calculateRequiredRunRate(100, 120, 30), 0);
  });

  it('0 balls remaining → 0', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.calculateRequiredRunRate(100, 50, 0), 0);
  });

  it('negative balls remaining → 0', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.calculateRequiredRunRate(100, 50, -5), 0);
  });

  it('with 5 bpo', () => {
    const engine = new ScoringEngine(fiveBallsRules);
    // 50 runs needed, 30 balls remaining → (50/30)*5 = 8.333...
    const rrr = engine.calculateRequiredRunRate(100, 50, 30);
    assert.ok(Math.abs(rrr - 8.3333) < 0.001);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ballsRemaining
// ═══════════════════════════════════════════════════════════════════════

describe('ballsRemaining', () => {
  it('unlimited (overs=0) → 999', () => {
    const engine = new ScoringEngine({
      ...DEFAULT_RULES,
      overs: 0,
    });
    assert.equal(engine.ballsRemaining(0), 999);
    assert.equal(engine.ballsRemaining(60), 999);
  });

  it('20 overs, 0 bowled → 120', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.ballsRemaining(0), 120);
  });

  it('20 overs, 60 bowled → 60', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.ballsRemaining(60), 60);
  });

  it('20 overs, 120 bowled → 0', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.ballsRemaining(120), 0);
  });

  it('20 overs, 130 bowled → 0 (clamped)', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.ballsRemaining(130), 0);
  });

  it('Gully 6: 6 overs, 0 bowled → 36', () => {
    const engine = new ScoringEngine(gully6Rules);
    assert.equal(engine.ballsRemaining(0), 36);
  });

  it('Gully 6: 6 overs, 18 bowled → 18', () => {
    const engine = new ScoringEngine(gully6Rules);
    assert.equal(engine.ballsRemaining(18), 18);
  });

  it('custom: 7 overs, 8 bpo, 0 bowled → 56', () => {
    const engine = new ScoringEngine(customRules);
    assert.equal(engine.ballsRemaining(0), 56);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// isBowlerOverLimit
// ═══════════════════════════════════════════════════════════════════════

describe('isBowlerOverLimit', () => {
  it('max overs = 0 → never limited', () => {
    const engine = new ScoringEngine({
      ...DEFAULT_RULES,
      maxOversPerBowler: 0,
    });
    assert.equal(engine.isBowlerOverLimit(0), false);
    assert.equal(engine.isBowlerOverLimit(100), false);
    assert.equal(engine.isBowlerOverLimit(999), false);
  });

  it('4 overs max, 23 balls → not limited', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.isBowlerOverLimit(23), false);
  });

  it('4 overs max, 24 balls → limited', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.isBowlerOverLimit(24), true);
  });

  it('4 overs max, 25 balls → limited', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.isBowlerOverLimit(25), true);
  });

  it('4 overs max, 12 balls → not limited', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.isBowlerOverLimit(12), false);
  });

  it('Gully 6: 2 overs max, 11 balls → not limited', () => {
    const engine = new ScoringEngine(gully6Rules);
    assert.equal(engine.isBowlerOverLimit(11), false);
  });

  it('Gully 6: 2 overs max, 12 balls → limited', () => {
    const engine = new ScoringEngine(gully6Rules);
    assert.equal(engine.isBowlerOverLimit(12), true);
  });

  it('5 bpo, 4 max, 19 balls → not limited', () => {
    const engine = new ScoringEngine(fiveBallsRules);
    assert.equal(engine.isBowlerOverLimit(19), false);
  });

  it('5 bpo, 4 max, 20 balls → limited', () => {
    const engine = new ScoringEngine(fiveBallsRules);
    assert.equal(engine.isBowlerOverLimit(20), true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// canBowlOver
// ═══════════════════════════════════════════════════════════════════════

describe('canBowlOver', () => {
  it('opposite of isBowlerOverLimit', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.canBowlOver(23), true);
    assert.equal(engine.canBowlOver(24), false);
  });

  it('max 0 → can always bowl', () => {
    const engine = new ScoringEngine({
      ...DEFAULT_RULES,
      maxOversPerBowler: 0,
    });
    assert.equal(engine.canBowlOver(100), true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// shouldSetFreeHit
// ═══════════════════════════════════════════════════════════════════════

describe('shouldSetFreeHit', () => {
  it('freeHitEnabled=true, no_ball → true', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.shouldSetFreeHit('no_ball'), true);
  });

  it('freeHitEnabled=true, wide → false', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.shouldSetFreeHit('wide'), false);
  });

  it('freeHitEnabled=true, null → false', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.shouldSetFreeHit(null), false);
  });

  it('freeHitEnabled=false, no_ball → false', () => {
    const engine = new ScoringEngine({
      ...DEFAULT_RULES,
      freeHitEnabled: false,
    });
    assert.equal(engine.shouldSetFreeHit('no_ball'), false);
  });

  it('freeHitEnabled=true, bye → false', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.shouldSetFreeHit('bye'), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// canBeOutOnFreeHit
// ═══════════════════════════════════════════════════════════════════════

describe('canBeOutOnFreeHit', () => {
  const engine = new ScoringEngine(DEFAULT_RULES);

  it('run_out → true', () => {
    assert.equal(engine.canBeOutOnFreeHit('run_out'), true);
  });

  it('obstructing → true', () => {
    assert.equal(engine.canBeOutOnFreeHit('obstructing'), true);
  });

  it('bowled → false', () => {
    assert.equal(engine.canBeOutOnFreeHit('bowled'), false);
  });

  it('caught → false', () => {
    assert.equal(engine.canBeOutOnFreeHit('caught'), false);
  });

  it('lbw → false', () => {
    assert.equal(engine.canBeOutOnFreeHit('lbw'), false);
  });

  it('null → false', () => {
    assert.equal(engine.canBeOutOnFreeHit(null), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// isExtrasAllowed
// ═══════════════════════════════════════════════════════════════════════

describe('isExtrasAllowed', () => {
  it('bye, byeAllowed=true → true', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.isExtrasAllowed('bye'), true);
  });

  it('bye, byeAllowed=false → false', () => {
    const engine = new ScoringEngine({
      ...DEFAULT_RULES,
      byeAllowed: false,
    });
    assert.equal(engine.isExtrasAllowed('bye'), false);
  });

  it('leg_bye, legByeAllowed=true → true', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.isExtrasAllowed('leg_bye'), true);
  });

  it('leg_bye, legByeAllowed=false → false', () => {
    const engine = new ScoringEngine({
      ...DEFAULT_RULES,
      legByeAllowed: false,
    });
    assert.equal(engine.isExtrasAllowed('leg_bye'), false);
  });

  it('null → true', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.isExtrasAllowed(null), true);
  });

  it('wide → true (always allowed)', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.isExtrasAllowed('wide'), true);
  });

  it('penalty → true (always allowed)', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.isExtrasAllowed('penalty'), true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// isEndOfOver
// ═══════════════════════════════════════════════════════════════════════

describe('isEndOfOver', () => {
  it('6 balls in over (6 bpo) → true', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.isEndOfOver(6), true);
  });

  it('5 balls in over (6 bpo) → false', () => {
    const engine = new ScoringEngine(DEFAULT_RULES);
    assert.equal(engine.isEndOfOver(5), false);
  });

  it('5 balls in over (5 bpo) → true', () => {
    const engine = new ScoringEngine(fiveBallsRules);
    assert.equal(engine.isEndOfOver(5), true);
  });

  it('8 balls in over (8 bpo) → true', () => {
    const engine = new ScoringEngine(customRules);
    assert.equal(engine.isEndOfOver(8), true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Gully 6 Format Tests
// ═══════════════════════════════════════════════════════════════════════

describe('Gully 6 format', () => {
  const engine = new ScoringEngine(gully6Rules);

  it('6 players, 6 overs, 6 balls per over config', () => {
    assert.equal(engine.rules_config.playersPerSide, 6);
    assert.equal(engine.rules_config.overs, 6);
    assert.equal(engine.rules_config.ballsPerOver, 6);
  });

  it('all wickets checks use 5 (not 10) for all-out', () => {
    assert.equal(engine.isInningsOver(5, 0, 0, null), true);
    assert.equal(engine.isInningsOver(4, 0, 0, null), false);
  });

  it('overs format uses 6 balls per over', () => {
    assert.equal(engine.formatOvers(0), '0');
    assert.equal(engine.formatOvers(6), '1');
    assert.equal(engine.formatOvers(7), '1.1');
    assert.equal(engine.formatOvers(36), '6');
  });

  it('balls remaining for 6 overs', () => {
    assert.equal(engine.ballsRemaining(0), 36);
    assert.equal(engine.ballsRemaining(18), 18);
    assert.equal(engine.ballsRemaining(36), 0);
  });

  it('run rate with 6 bpo', () => {
    assert.equal(engine.calculateRunRate(30, 30), 6.0);
    assert.equal(engine.calculateRunRate(6, 6), 6.0);
  });

  it('projected score with 6 overs', () => {
    // 30 runs in 10 balls, 6 overs * 6 bpo = 36 total balls
    // (30/10) * 36 = 108
    assert.equal(engine.calculateProjectedScore(30, 10), 108);
  });

  it('bowler limit of 2 overs', () => {
    assert.equal(engine.isBowlerOverLimit(11), false);
    assert.equal(engine.isBowlerOverLimit(12), true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Custom Format Tests (5 players, 7 overs, 8 balls per over)
// ═══════════════════════════════════════════════════════════════════════

describe('Custom format (5 players, 7 overs, 8 bpo)', () => {
  const engine = new ScoringEngine(customRules);

  it('config', () => {
    assert.equal(engine.rules_config.playersPerSide, 5);
    assert.equal(engine.rules_config.overs, 7);
    assert.equal(engine.rules_config.ballsPerOver, 8);
  });

  it('all out at 4 wickets', () => {
    assert.equal(engine.isInningsOver(4, 0, 0, null), true);
    assert.equal(engine.isInningsOver(3, 0, 0, null), false);
  });

  it('overs complete at 7', () => {
    assert.equal(engine.isInningsOver(0, 7, 0, null), true);
    assert.equal(engine.isInningsOver(0, 6, 0, null), false);
  });

  it('formatOvers with 8 bpo', () => {
    assert.equal(engine.formatOvers(0), '0');
    assert.equal(engine.formatOvers(8), '1');
    assert.equal(engine.formatOvers(9), '1.1');
    assert.equal(engine.formatOvers(16), '2');
    assert.equal(engine.formatOvers(56), '7');
  });

  it('balls remaining', () => {
    assert.equal(engine.ballsRemaining(0), 56);
    assert.equal(engine.ballsRemaining(24), 32);
    assert.equal(engine.ballsRemaining(56), 0);
  });

  it('run rate with 8 bpo', () => {
    assert.equal(engine.calculateRunRate(80, 40), 16.0);
    assert.equal(engine.calculateRunRate(16, 8), 16.0);
  });

  it('projected score', () => {
    // 40 runs in 16 balls, 7 overs * 8 bpo = 56 total balls
    // (40/16) * 56 = 140
    assert.equal(engine.calculateProjectedScore(40, 16), 140);
  });

  it('required run rate with 8 bpo', () => {
    // 30 runs needed, 20 balls remaining → (30/20)*8 = 12
    assert.equal(engine.calculateRequiredRunRate(80, 50, 20), 12.0);
  });

  it('bowler limit of 3 overs', () => {
    assert.equal(engine.isBowlerOverLimit(23), false);
    assert.equal(engine.isBowlerOverLimit(24), true);
  });

  it('end of over at 8 balls', () => {
    assert.equal(engine.isEndOfOver(8), true);
    assert.equal(engine.isEndOfOver(7), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getBallDisplayString
// ═══════════════════════════════════════════════════════════════════════

describe('getBallDisplayString', () => {
  const engine = new ScoringEngine(DEFAULT_RULES);

  it('wicket → "W"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 0,
        extrasType: null,
        extrasRuns: 0,
        isWicket: true,
        totalRuns: 0,
      }),
      'W',
    );
  });

  it('wicket with runs → "W"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 1,
        extrasType: null,
        extrasRuns: 0,
        isWicket: true,
        totalRuns: 1,
      }),
      'W',
    );
  });

  it('dot → "0"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 0,
        extrasType: null,
        extrasRuns: 0,
        isWicket: false,
        totalRuns: 0,
      }),
      '0',
    );
  });

  it('single → "1"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 1,
        extrasType: null,
        extrasRuns: 0,
        isWicket: false,
        totalRuns: 1,
      }),
      '1',
    );
  });

  it('four → "4"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 4,
        extrasType: null,
        extrasRuns: 0,
        isWicket: false,
        totalRuns: 4,
      }),
      '4',
    );
  });

  it('six → "6"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 6,
        extrasType: null,
        extrasRuns: 0,
        isWicket: false,
        totalRuns: 6,
      }),
      '6',
    );
  });

  it('wide (1 run) → "Wd"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 0,
        extrasType: 'wide',
        extrasRuns: 1,
        isWicket: false,
        totalRuns: 1,
      }),
      'Wd',
    );
  });

  it('wide (3 runs) → "Wd+2"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 0,
        extrasType: 'wide',
        extrasRuns: 3,
        isWicket: false,
        totalRuns: 3,
      }),
      'Wd+2',
    );
  });

  it('no ball (no bat runs) → "NB"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 0,
        extrasType: 'no_ball',
        extrasRuns: 1,
        isWicket: false,
        totalRuns: 1,
      }),
      'NB',
    );
  });

  it('no ball (4 bat runs) → "NB+4"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 4,
        extrasType: 'no_ball',
        extrasRuns: 1,
        isWicket: false,
        totalRuns: 5,
      }),
      'NB+4',
    );
  });

  it('bye (1 run) → "B"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 0,
        extrasType: 'bye',
        extrasRuns: 1,
        isWicket: false,
        totalRuns: 1,
      }),
      'B',
    );
  });

  it('bye (3 runs) → "B3"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 0,
        extrasType: 'bye',
        extrasRuns: 3,
        isWicket: false,
        totalRuns: 3,
      }),
      'B3',
    );
  });

  it('leg bye (1 run) → "LB"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 0,
        extrasType: 'leg_bye',
        extrasRuns: 1,
        isWicket: false,
        totalRuns: 1,
      }),
      'LB',
    );
  });

  it('leg bye (2 runs) → "LB2"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 0,
        extrasType: 'leg_bye',
        extrasRuns: 2,
        isWicket: false,
        totalRuns: 2,
      }),
      'LB2',
    );
  });

  it('penalty → "P5"', () => {
    assert.equal(
      engine.getBallDisplayString({
        runsOffBat: 0,
        extrasType: 'penalty',
        extrasRuns: 5,
        isWicket: false,
        totalRuns: 5,
      }),
      'P5',
    );
  });
});
