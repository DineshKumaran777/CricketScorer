import { MatchRules } from '../utils/matchRules';

export interface BallInput {
  runsOffBat: number;
  extrasType: string | null;
  extrasRuns: number;
  isWicket: boolean;
  wicketType: string | null;
  dismissedBatter: string | null;
  fielder: string | null;
  fieldingEnd: string | null;
  runsOffSameBall: number;
}

export interface BallResult {
  batterRuns: number;
  extrasRuns: number;
  totalRuns: number;
  widesToBowler: number;
  noballsToBowler: number;
  isLegalDelivery: boolean;
}

export interface MatchState {
  matchId: string;
  inningsNumber: number;
  battingTeam: string;
  bowlingTeam: string;
  totalRuns: number;
  totalWickets: number;
  totalLegalBalls: number;
  ballsInOver: number;
  overNumber: number;
  strikerName: string | null;
  nonStrikerName: string | null;
  bowlerName: string | null;
  isFreeHit: boolean;
  target: number | null;
  thisOverBalls: string[];
}

export class ScoringEngine {
  private rules: MatchRules;

  constructor(rules: MatchRules) {
    this.rules = rules;
  }

  get rules_config(): MatchRules {
    return this.rules;
  }

  // ─── Delivery Classification ────────────────────────────────────────

  isLegalDelivery(extrasType: string | null): boolean {
    if (!extrasType) return true;
    return extrasType !== 'wide' && extrasType !== 'no_ball';
  }

  isEndOfOver(ballsInOver: number): boolean {
    return ballsInOver >= this.rules.ballsPerOver;
  }

  // ─── Ball Result Calculation ────────────────────────────────────────

  calculateBallResult(ball: BallInput): BallResult {
    let batterRuns = 0;
    let extrasTotal = 0;
    let widesToBowler = 0;
    let noballsToBowler = 0;

    if (ball.extrasType === 'wide') {
      extrasTotal = this.rules.wideRuns + ball.extrasRuns;
      widesToBowler = extrasTotal;
      batterRuns = 0;
    } else if (ball.extrasType === 'no_ball') {
      batterRuns = ball.runsOffBat;
      extrasTotal = this.rules.noBallRuns;
      noballsToBowler = this.rules.noBallRuns;
    } else if (ball.extrasType === 'bye') {
      extrasTotal = ball.extrasRuns;
      batterRuns = 0;
    } else if (ball.extrasType === 'leg_bye') {
      extrasTotal = ball.extrasRuns;
      batterRuns = 0;
    } else if (ball.extrasType === 'penalty') {
      extrasTotal = ball.extrasRuns || 5;
      batterRuns = 0;
    } else {
      batterRuns = ball.runsOffBat;
    }

    return {
      batterRuns,
      extrasRuns: extrasTotal,
      totalRuns: batterRuns + extrasTotal,
      widesToBowler,
      noballsToBowler,
      isLegalDelivery: this.isLegalDelivery(ball.extrasType),
    };
  }

  // ─── Strike Rotation ────────────────────────────────────────────────

  shouldRotateStrike(
    runsOffBat: number,
    extrasRuns: number,
    extrasType: string | null,
    isEndOfOver: boolean,
  ): boolean {
    if (isEndOfOver) return true;

    if (extrasType === 'wide' || extrasType === 'no_ball') return false;

    if (extrasType === 'bye' || extrasType === 'leg_bye') {
      return extrasRuns % 2 !== 0;
    }

    return runsOffBat % 2 !== 0;
  }

  // ─── Bowler Credit ──────────────────────────────────────────────────

  isBowlerWicket(wicketType: string | null): boolean {
    if (!wicketType) return false;
    const bowlerWickets = ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'];
    return bowlerWickets.includes(wicketType);
  }

  isRetiredHurt(wicketType: string | null): boolean {
    return wicketType === 'retired_hurt';
  }

  // ─── Maiden Detection ───────────────────────────────────────────────

  isMaiden(overBalls: { runsOffBat: number; extrasType: string | null; extrasRuns: number; isLegalDelivery: boolean }[]): boolean {
    return overBalls.every(b =>
      b.runsOffBat === 0 &&
      b.extrasRuns === 0 &&
      b.isLegalDelivery
    );
  }

  // ─── Innings End Conditions ─────────────────────────────────────────

  isInningsOver(
    wickets: number,
    completedOvers: number,
    totalRuns: number,
    target: number | null,
  ): boolean {
    // All out
    if (wickets >= this.rules.playersPerSide - 1) return true;

    // Last man standing disabled or not enabled
    if (!this.rules.lastManStandingEnabled && wickets >= this.rules.playersPerSide - 1) return true;

    // Overs completed (0 = unlimited)
    if (this.rules.overs > 0 && completedOvers >= this.rules.overs) return true;

    // Target reached (2nd innings)
    if (target !== null && totalRuns >= target) return true;

    return false;
  }

  // ─── Bowler Limits ──────────────────────────────────────────────────

  isBowlerOverLimit(bowlerBallsBowled: number): boolean {
    if (this.rules.maxOversPerBowler <= 0) return false;
    const bowlerOvers = bowlerBallsBowled / this.rules.ballsPerOver;
    return bowlerOvers >= this.rules.maxOversPerBowler;
  }

  canBowlOver(bowlerBallsBowled: number): boolean {
    return !this.isBowlerOverLimit(bowlerBallsBowled);
  }

  // ─── Free Hit ───────────────────────────────────────────────────────

  shouldSetFreeHit(extrasType: string | null): boolean {
    if (!this.rules.freeHitEnabled) return false;
    return extrasType === 'no_ball';
  }

  canBeOutOnFreeHit(wicketType: string | null): boolean {
    // On a free hit: only run out and obstructing are valid
    if (wicketType === 'run_out') return true;
    if (wicketType === 'obstructing') return true;
    return false;
  }

  // ─── Extras Validation ──────────────────────────────────────────────

  isExtrasAllowed(extrasType: string | null): boolean {
    if (extrasType === 'bye') return this.rules.byeAllowed;
    if (extrasType === 'leg_bye') return this.rules.legByeAllowed;
    return true;
  }

  // ─── Overs Display ──────────────────────────────────────────────────

  formatOvers(totalBalls: number): string {
    const completedOvers = Math.floor(totalBalls / this.rules.ballsPerOver);
    const remainingBalls = totalBalls % this.rules.ballsPerOver;
    if (remainingBalls === 0) return completedOvers.toString();
    return `${completedOvers}.${remainingBalls}`;
  }

  // ─── Statistics ─────────────────────────────────────────────────────

  calculateRunRate(runs: number, balls: number): number {
    if (balls === 0) return 0;
    return (runs / balls) * this.rules.ballsPerOver;
  }

  calculateProjectedScore(runs: number, balls: number): number {
    if (balls === 0 || this.rules.overs <= 0) return 0;
    const totalBalls = this.rules.overs * this.rules.ballsPerOver;
    return Math.round((runs / balls) * totalBalls);
  }

  calculateRequiredRunRate(target: number, currentRuns: number, ballsRemaining: number): number {
    if (ballsRemaining <= 0) return 0;
    const runsNeeded = target - currentRuns;
    if (runsNeeded <= 0) return 0;
    return (runsNeeded / ballsRemaining) * this.rules.ballsPerOver;
  }

  ballsRemaining(ballsBowled: number): number {
    if (this.rules.overs <= 0) return 999;
    const totalBalls = this.rules.overs * this.rules.ballsPerOver;
    const remaining = totalBalls - ballsBowled;
    return remaining > 0 ? remaining : 0;
  }

  // ─── Ball Display ───────────────────────────────────────────────────

  getBallDisplayString(ball: {
    runsOffBat: number;
    extrasType: string | null;
    extrasRuns: number;
    isWicket: boolean;
    totalRuns: number;
  }): string {
    if (ball.isWicket) return 'W';
    if (ball.extrasType === 'wide') {
      return ball.extrasRuns > 1 ? `Wd+${ball.extrasRuns - 1}` : 'Wd';
    }
    if (ball.extrasType === 'no_ball') {
      return ball.runsOffBat > 0 ? `NB+${ball.runsOffBat}` : 'NB';
    }
    if (ball.extrasType === 'bye') {
      return ball.extrasRuns > 1 ? `B${ball.extrasRuns}` : 'B';
    }
    if (ball.extrasType === 'leg_bye') {
      return ball.extrasRuns > 1 ? `LB${ball.extrasRuns}` : 'LB';
    }
    if (ball.extrasType === 'penalty') return `P${ball.totalRuns}`;
    return ball.totalRuns.toString();
  }
}
