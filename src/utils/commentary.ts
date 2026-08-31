interface BallData {
  strikerName: string;
  bowlerName: string;
  runsOffBat: number;
  extrasType?: string;
  extrasRuns: number;
  isWicket: boolean;
  wicketType?: string;
  dismissedBatter?: string;
  fielder?: string;
}

const BOUNDARY_FOURS = 4;
const BOUNDARY_SIXES = 6;

const WICKET_MESSAGES: Record<string, string[]> = {
  bowled: [
    'Bowled him! {bowler} strikes!',
    '{batter} is cleaned up by {bowler}!',
    'What a delivery! {bowler} bowls {batter}!',
  ],
  caught: [
    'Caught! {bowler} gets {batter}!',
    '{batter} is caught off the bowling of {bowler}!',
    'Gone! {bowler} picks up a wicket!',
  ],
  lbw: [
    'LBW! {bowler} gets {batter}!',
    '{batter} is trapped in front by {bowler}!',
    'That looks plumb! {bowler} strikes!',
  ],
  run_out: [
    'Run out! {batter} is sent back!',
    'Direct hit! {batter} is run out!',
    'Sharp fielding! {batter} has to go!',
  ],
  stumped: [
    'Stumped! {bowler} gets {batter}!',
    '{batter} is stumped off the bowling of {bowler}!',
    'Quick work behind the stumps! {batter} is gone!',
  ],
  hit_wicket: [
    'Hit wicket! {batter} has knocked over the stumps!',
    '{batter} is out hit wicket!',
    'Disaster for {batter}! Hit wicket off {bowler}!',
  ],
  obstructing: [
    '{batter} is out for obstructing the field!',
    'Obstructing the field! {batter} has to go!',
  ],
  handled_ball: [
    '{batter} is out handled the ball!',
    'Handled the ball! {batter} is gone!',
  ],
  timed_out: [
    '{batter} is out timed out!',
    'That is rare! {batter} is timed out!',
  ],
  retired_out: [
    '{batter} is retired out!',
    'Retired out! {batter} has to leave the field!',
  ],
};

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDismissal(
  wicketType: string,
  bowler: string,
  fielder?: string,
  batter?: string
): string {
  switch (wicketType) {
    case 'bowled':
      return `b ${bowler}`;
    case 'caught':
      return fielder ? `c ${fielder} b ${bowler}` : `c & b ${bowler}`;
    case 'lbw':
      return `lbw b ${bowler}`;
    case 'run_out':
      return fielder ? `run out (${fielder})` : 'run out';
    case 'stumped':
      return fielder ? `st ${fielder} b ${bowler}` : `st b ${bowler}`;
    case 'hit_wicket':
      return `hit wicket b ${bowler}`;
    case 'obstructing':
      return 'obstructing the field';
    case 'handled_ball':
      return 'handled the ball';
    case 'timed_out':
      return 'timed out';
    case 'retired_out':
      return 'retired out';
    default:
      return `b ${bowler}`;
  }
}

export function generateCommentary(ballData: BallData): string {
  const {
    strikerName,
    bowlerName,
    runsOffBat,
    extrasType,
    extrasRuns,
    isWicket,
    wicketType,
    dismissedBatter,
    fielder,
  } = ballData;

  if (isWicket && wicketType) {
    const templates = WICKET_MESSAGES[wicketType] || WICKET_MESSAGES['caught'];
    const batter = dismissedBatter || strikerName;
    let base = pickRandom(templates)
      .replace(/{batter}/g, batter)
      .replace(/{bowler}/g, bowlerName);

    const howOut = formatDismissal(wicketType, bowlerName, fielder, batter);
    return `WICKET! ${batter} ${howOut}. ${base}`;
  }

  if (extrasType === 'wide') {
    return `Wide. ${extrasRuns} wide${extrasRuns > 1 ? 's' : ''} added.`;
  }

  if (extrasType === 'no_ball') {
    return `No Ball! Front foot no-ball by ${bowlerName}. FREE HIT next.`;
  }

  if (extrasType === 'bye') {
    return `${extrasRuns} Bye${extrasRuns > 1 ? 's' : ''}. Good take.`;
  }

  if (extrasType === 'leg_bye') {
    return `${extrasRuns} Leg Bye${extrasRuns > 1 ? 's' : ''}.`;
  }

  if (extrasType === 'penalty') {
    return `Penalty! ${extrasRuns} run${extrasRuns > 1 ? 's' : ''} awarded.`;
  }

  if (runsOffBat === 0) {
    return pickRandom([
      `Dot ball. Good delivery by ${bowlerName}.`,
      `No run. Solid bowling by ${bowlerName}.`,
      `${strikerName} defends well. Dot ball.`,
      `Play and miss! Dot ball.`,
    ]);
  }

  if (runsOffBat === 4) {
    return pickRandom([
      `FOUR! ${strikerName} finds the boundary!`,
      `That races away to the fence! Four for ${strikerName}!`,
      `${strikerName} pierces the gap beautifully! Boundary!`,
      `Lovely shot! ${strikerName} picks up four!`,
    ]);
  }

  if (runsOffBat === 6) {
    return pickRandom([
      `SIX! ${strikerName} goes the distance! Maximum!`,
      `What a hit! ${strikerName} smashes a massive six!`,
      `Maximum! ${strikerName} clears the fence with ease!`,
      `${strikerName} sends it into the crowd! Six runs!`,
    ]);
  }

  return `${runsOffBat} run${runsOffBat > 1 ? 's' : ''} to ${strikerName}.`;
}
