import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MatchRules,
  DEFAULT_RULES,
  MATCH_PRESETS,
  applyPreset,
} from '../matchRules';

function validateRules(rules: MatchRules): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (rules.overs < 0) {
    errors.push('overs must be >= 0');
  }

  if (rules.playersPerSide < 4) {
    errors.push('playersPerSide must be >= 4');
  }

  if (rules.ballsPerOver < 1) {
    errors.push('ballsPerOver must be >= 1');
  }

  if (rules.maxOversPerBowler < 0) {
    errors.push('maxOversPerBowler must be >= 0');
  }

  if (rules.overs > 0 && rules.maxOversPerBowler > rules.overs) {
    errors.push('maxOversPerBowler cannot exceed total overs');
  }

  if (rules.inningsPerSide < 1) {
    errors.push('inningsPerSide must be >= 1');
  }

  if (rules.maxOversPerBowler > 0 && rules.maxOversPerBowler * rules.playersPerSide < rules.overs) {
    errors.push('bowlers cannot cover all overs');
  }

  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════════════
// Default Rules
// ═══════════════════════════════════════════════════════════════════════

describe('DEFAULT_RULES', () => {
  it('has expected default values', () => {
    assert.equal(DEFAULT_RULES.overs, 20);
    assert.equal(DEFAULT_RULES.playersPerSide, 11);
    assert.equal(DEFAULT_RULES.ballsPerOver, 6);
    assert.equal(DEFAULT_RULES.inningsPerSide, 2);
    assert.equal(DEFAULT_RULES.maxOversPerBowler, 4);
    assert.equal(DEFAULT_RULES.wideRuns, 1);
    assert.equal(DEFAULT_RULES.noBallRuns, 1);
    assert.equal(DEFAULT_RULES.freeHitEnabled, true);
    assert.equal(DEFAULT_RULES.byeAllowed, true);
    assert.equal(DEFAULT_RULES.legByeAllowed, true);
    assert.equal(DEFAULT_RULES.retiredHurtEnabled, true);
  });

  it('default rules are valid', () => {
    const result = validateRules(DEFAULT_RULES);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Valid Rules
// ═══════════════════════════════════════════════════════════════════════

describe('Valid rules', () => {
  it('valid T20 rules pass', () => {
    const t20: MatchRules = {
      ...DEFAULT_RULES,
      overs: 20,
      playersPerSide: 11,
      maxOversPerBowler: 4,
    };
    const result = validateRules(t20);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });

  it('valid Gully 6 rules pass', () => {
    const gully6: MatchRules = {
      ...DEFAULT_RULES,
      overs: 6,
      playersPerSide: 6,
      maxOversPerBowler: 2,
    };
    const result = validateRules(gully6);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });

  it('valid ODI rules pass', () => {
    const odi: MatchRules = {
      ...DEFAULT_RULES,
      overs: 50,
      playersPerSide: 11,
      maxOversPerBowler: 10,
    };
    const result = validateRules(odi);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });

  it('valid T10 rules pass', () => {
    const t10: MatchRules = {
      ...DEFAULT_RULES,
      overs: 10,
      playersPerSide: 11,
      maxOversPerBowler: 2,
    };
    const result = validateRules(t10);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });

  it('unlimited overs (0) with max 0 per bowler is valid', () => {
    const testMatch: MatchRules = {
      ...DEFAULT_RULES,
      overs: 0,
      maxOversPerBowler: 0,
    };
    const result = validateRules(testMatch);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Invalid Rules
// ═══════════════════════════════════════════════════════════════════════

describe('Invalid rules', () => {
  it('overs = 0 is flagged (but could be unlimited)', () => {
    const rules: MatchRules = { ...DEFAULT_RULES, overs: 0 };
    const result = validateRules(rules);
    assert.equal(result.valid, true);
  });

  it('negative overs fail', () => {
    const rules: MatchRules = { ...DEFAULT_RULES, overs: -1 };
    const result = validateRules(rules);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('overs')));
  });

  it('playersPerSide = 3 fails', () => {
    const rules: MatchRules = { ...DEFAULT_RULES, playersPerSide: 3 };
    const result = validateRules(rules);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('playersPerSide')));
  });

  it('playersPerSide = 2 fails', () => {
    const rules: MatchRules = { ...DEFAULT_RULES, playersPerSide: 2 };
    const result = validateRules(rules);
    assert.equal(result.valid, false);
  });

  it('ballsPerOver = 0 fails', () => {
    const rules: MatchRules = { ...DEFAULT_RULES, ballsPerOver: 0 };
    const result = validateRules(rules);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('ballsPerOver')));
  });

  it('ballsPerOver = -1 fails', () => {
    const rules: MatchRules = { ...DEFAULT_RULES, ballsPerOver: -1 };
    const result = validateRules(rules);
    assert.equal(result.valid, false);
  });

  it('maxOversPerBowler > overs fails', () => {
    const rules: MatchRules = {
      ...DEFAULT_RULES,
      overs: 10,
      maxOversPerBowler: 15,
    };
    const result = validateRules(rules);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('maxOversPerBowler')));
  });

  it('maxOversPerBowler = overs passes', () => {
    const rules: MatchRules = {
      ...DEFAULT_RULES,
      overs: 10,
      maxOversPerBowler: 10,
    };
    const result = validateRules(rules);
    assert.equal(result.valid, true);
  });

  it('negative maxOversPerBowler fails', () => {
    const rules: MatchRules = {
      ...DEFAULT_RULES,
      maxOversPerBowler: -1,
    };
    const result = validateRules(rules);
    assert.equal(result.valid, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Presets
// ═══════════════════════════════════════════════════════════════════════

describe('MATCH_PRESETS', () => {
  it('contains expected presets', () => {
    const names = MATCH_PRESETS.map(p => p.name);
    assert.ok(names.includes('t20'));
    assert.ok(names.includes('t10'));
    assert.ok(names.includes('odi'));
    assert.ok(names.includes('club'));
    assert.ok(names.includes('school'));
    assert.ok(names.includes('gully6'));
    assert.ok(names.includes('gully8'));
    assert.ok(names.includes('street'));
    assert.ok(names.includes('practice'));
    assert.ok(names.includes('test'));
    assert.ok(names.includes('custom'));
  });

  it('all presets have required fields', () => {
    for (const preset of MATCH_PRESETS) {
      assert.ok(preset.name, `Preset missing name`);
      assert.ok(preset.label, `Preset "${preset.name}" missing label`);
      assert.ok(preset.description, `Preset "${preset.name}" missing description`);
      assert.ok(preset.rules, `Preset "${preset.name}" missing rules`);
    }
  });
});

describe('applyPreset', () => {
  it('T20 preset produces valid rules', () => {
    const rules = applyPreset('t20');
    assert.equal(rules.overs, 20);
    assert.equal(rules.playersPerSide, 11);
    assert.equal(rules.maxOversPerBowler, 4);
    const result = validateRules(rules);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });

  it('Gully 6 preset produces valid rules', () => {
    const rules = applyPreset('gully6');
    assert.equal(rules.overs, 6);
    assert.equal(rules.playersPerSide, 6);
    assert.equal(rules.maxOversPerBowler, 2);
    assert.equal(rules.lastManStandingEnabled, true);
    const result = validateRules(rules);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });

  it('T10 preset produces valid rules', () => {
    const rules = applyPreset('t10');
    assert.equal(rules.overs, 10);
    assert.equal(rules.playersPerSide, 11);
    assert.equal(rules.maxOversPerBowler, 2);
    const result = validateRules(rules);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });

  it('ODI preset produces valid rules', () => {
    const rules = applyPreset('odi');
    assert.equal(rules.overs, 50);
    assert.equal(rules.playersPerSide, 11);
    assert.equal(rules.maxOversPerBowler, 10);
    const result = validateRules(rules);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });

  it('Club preset produces valid rules', () => {
    const rules = applyPreset('club');
    assert.equal(rules.overs, 30);
    assert.equal(rules.maxOversPerBowler, 6);
    const result = validateRules(rules);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });

  it('School preset produces valid rules', () => {
    const rules = applyPreset('school');
    assert.equal(rules.overs, 25);
    assert.equal(rules.maxOversPerBowler, 5);
    const result = validateRules(rules);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });

  it('Gully 8 preset produces valid rules', () => {
    const rules = applyPreset('gully8');
    assert.equal(rules.overs, 8);
    assert.equal(rules.playersPerSide, 8);
    assert.equal(rules.maxOversPerBowler, 2);
    const result = validateRules(rules);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });

  it('Street preset produces valid rules', () => {
    const rules = applyPreset('street');
    assert.equal(rules.overs, 5);
    assert.equal(rules.playersPerSide, 5);
    assert.equal(rules.maxOversPerBowler, 2);
    assert.equal(rules.wideRuns, 2);
    assert.equal(rules.noBallRuns, 2);
    const result = validateRules(rules);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });

  it('Practice preset produces valid rules', () => {
    const rules = applyPreset('practice');
    assert.equal(rules.overs, 10);
    assert.equal(rules.maxOversPerBowler, 3);
    const result = validateRules(rules);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });

  it('Test preset produces valid rules', () => {
    const rules = applyPreset('test');
    assert.equal(rules.overs, 0);
    assert.equal(rules.playersPerSide, 11);
    assert.equal(rules.maxOversPerBowler, 0);
    const result = validateRules(rules);
    assert.equal(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  });

  it('unknown preset returns defaults', () => {
    const rules = applyPreset('nonexistent');
    assert.deepStrictEqual(rules, DEFAULT_RULES);
  });

  it('custom preset returns defaults (empty rules override)', () => {
    const rules = applyPreset('custom');
    assert.equal(rules.overs, DEFAULT_RULES.overs);
    assert.equal(rules.playersPerSide, DEFAULT_RULES.playersPerSide);
  });

  it('all presets produce valid rules', () => {
    for (const preset of MATCH_PRESETS) {
      const rules = applyPreset(preset.name);
      const result = validateRules(rules);
      assert.equal(
        result.valid,
        true,
        `Preset "${preset.name}" produces invalid rules: ${result.errors.join(', ')}`,
      );
    }
  });

  it('preset rules are merged with defaults', () => {
    const rules = applyPreset('gully6');
    assert.equal(rules.ballsPerOver, DEFAULT_RULES.ballsPerOver);
    assert.equal(rules.inningsPerSide, DEFAULT_RULES.inningsPerSide);
    assert.equal(rules.freeHitEnabled, DEFAULT_RULES.freeHitEnabled);
    assert.equal(rules.byeAllowed, DEFAULT_RULES.byeAllowed);
    assert.equal(rules.legByeAllowed, DEFAULT_RULES.legByeAllowed);
  });
});
