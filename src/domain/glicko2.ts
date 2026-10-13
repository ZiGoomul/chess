/**
 * Glicko-2 (Mark Glickman, "Example of the Glicko-2 system"). A rating comes with a rating
 * deviation (RD, how sure the rating is) and a volatility (how erratic the player's results are).
 */

export interface Glicko2Player {
  rating: number;
  rd: number;
  vol: number;
}

export interface Glicko2Result {
  opponentRating: number;
  opponentRd: number;
  /** 1 win, 0.5 draw, 0 loss */
  score: number;
}

const SCALE = 173.7178;
const TAU = 0.5;
const EPSILON = 0.000001;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const expected = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/** The new volatility: the root of f found by the Illinois algorithm (step 5 of the paper). */
function newVolatility(phi: number, vol: number, delta: number, v: number): number {
  const a = Math.log(vol * vol);
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  return Math.exp(A / 2);
}

/** The player after one rating period with these results. No results: only the RD grows. */
export function glicko2Update(player: Glicko2Player, results: readonly Glicko2Result[]): Glicko2Player {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  if (results.length === 0) {
    return { ...player, rd: Math.sqrt(phi * phi + player.vol * player.vol) * SCALE };
  }

  let vInverse = 0;
  let deltaSum = 0;
  for (const result of results) {
    const muJ = (result.opponentRating - 1500) / SCALE;
    const phiJ = result.opponentRd / SCALE;
    const e = expected(mu, muJ, phiJ);
    vInverse += g(phiJ) ** 2 * e * (1 - e);
    deltaSum += g(phiJ) * (result.score - e);
  }
  const v = 1 / vInverse;
  const delta = v * deltaSum;

  const vol = newVolatility(phi, player.vol, delta, v);
  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * deltaSum;
  return { rating: muNew * SCALE + 1500, rd: phiNew * SCALE, vol };
}

/** The RD after some idle time: it grows with the volatility, as if `periods` empty periods passed. */
export function inflateRd(player: Glicko2Player, periods: number, maxRd: number): number {
  if (!(periods > 0)) return player.rd;
  const phi = player.rd / SCALE;
  const grown = Math.sqrt(phi * phi + player.vol * player.vol * periods) * SCALE;
  return Math.min(maxRd, grown);
}
