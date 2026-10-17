// Centralized review thresholds (see the game-review design spec).
export const REVIEW_THRESHOLD_CP = 80;
export const REVIEW_MOMENT_LIMIT = 3;
const CP_CLAMP = 1000;
const MATE_SCORE = 2000;
const MATE_STEP = 10;

const BOT_LEVEL_RATINGS = { 1: 800, 5: 1200, 10: 1700, 15: 2200, 20: 3000 };

export function parseReviewEvaluation(line) {
  if (typeof line !== 'string') return null;
  const match = /\bscore (cp|mate) (-?\d+)(?:.*\bpv\s+([^\s]+))?/.exec(line);
  if (!match) return null;
  return { type: match[1], value: Number(match[2]), pv: match[3] || null };
}

// Converts a UCI score (side-to-move perspective) into a bounded white-perspective score.
export function toWhitePerspective(evaluation, fen) {
  if (!evaluation) return null;
  let score;
  if (evaluation.type === 'mate') {
    // "mate 0" means the side to move is already mated.
    const moves = evaluation.value;
    score = moves > 0 ? MATE_SCORE - moves * MATE_STEP : -MATE_SCORE - moves * MATE_STEP;
  } else {
    score = Math.max(-CP_CLAMP, Math.min(CP_CLAMP, evaluation.value));
  }
  const turn = typeof fen === 'string' ? fen.split(' ')[1] : 'w';
  return turn === 'b' ? -score : score;
}

export function classifySupportedMotif({ before, after }) {
  if (!before || !after) return null;
  const moverHadMate = before.type === 'mate' && before.value > 0;
  // After the move the opponent is to move, so a positive mate score belongs to the opponent.
  const moverAllowedMate = after.type === 'mate' && after.value > 0;
  if (moverHadMate) return { themes: ['mate'], confidence: 'high', kind: 'missed-mate' };
  if (moverAllowedMate) return { themes: ['mate'], confidence: 'high', kind: 'allowed-mate' };
  return null;
}

export function findCriticalMoments({ record, evaluations, thresholdCp = REVIEW_THRESHOLD_CP, limit = REVIEW_MOMENT_LIMIT }) {
  const fens = record.fens || [];
  const moves = record.moves || [];
  const moments = [];
  for (let index = 0; index < moves.length && index + 1 < fens.length; index++) {
    const mover = fens[index].split(' ')[1];
    if (record.humanColor && mover !== record.humanColor) continue;
    const before = evaluations[index]?.evaluation;
    const after = evaluations[index + 1]?.evaluation;
    const beforeScore = toWhitePerspective(before, fens[index]);
    const afterScore = toWhitePerspective(after, fens[index + 1]);
    if (beforeScore == null || afterScore == null) continue;
    const sign = mover === 'w' ? 1 : -1;
    const lossCp = sign * (beforeScore - afterScore);
    if (lossCp < thresholdCp) continue;
    const nextEval = evaluations[index + 1]?.evaluation;
    moments.push({
      ply: index,
      san: moves[index].san || null,
      lossCp,
      beforeCp: beforeScore,
      afterCp: afterScore,
      bestMove: before.pv,
      refutationMove: nextEval?.pv || null,
      motif: classifySupportedMotif({ before, after })
    });

  }
  return moments.sort((a, b) => b.lossCp - a.lossCp).slice(0, limit);
}

// Move classes from best to worst, with the centipawn loss each one tolerates.
export const MOVE_CLASSES = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];
const CLASS_LIMITS_CP = { best: 10, excellent: 30, good: REVIEW_THRESHOLD_CP, inaccuracy: 150, mistake: 300 };

// White's winning chances (0–100) for a white-perspective score; the curve Lichess uses for accuracy.
export function winPercent(cp) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

export function moveAccuracy(winDrop) {
  const accuracy = 103.1668 * Math.exp(-0.04354 * Math.max(0, winDrop)) - 3.1669;
  return Math.max(0, Math.min(100, accuracy));
}

export function classifyMove({ lossCp, isBest = false, allowedMate = false }) {
  if (isBest) return 'best';
  if (allowedMate) return 'blunder';
  return MOVE_CLASSES.find(name => name !== 'blunder' && lossCp <= CLASS_LIMITS_CP[name]) || 'blunder';
}

/**
 * Per-move classes, accuracy per side and the white-perspective evaluation curve
 * for a finished review. Plies without an evaluation on either side are skipped.
 */
export function summarizeReview({ record, evaluations }) {
  const fens = record.fens || [];
  const moves = record.moves || [];
  const emptyCounts = () => Object.fromEntries(MOVE_CLASSES.map(name => [name, 0]));
  const counts = { w: emptyCounts(), b: emptyCounts() };
  const accuracies = { w: [], b: [] };
  const classified = [];
  const curve = fens.map((fen, index) => toWhitePerspective(evaluations[index]?.evaluation, fen));

  for (let index = 0; index < moves.length && index + 1 < fens.length; index++) {
    const before = evaluations[index]?.evaluation;
    const after = evaluations[index + 1]?.evaluation;
    const beforeScore = curve[index];
    const afterScore = curve[index + 1];
    if (beforeScore == null || afterScore == null) continue;
    const mover = fens[index].split(' ')[1];
    const sign = mover === 'w' ? 1 : -1;
    const lossCp = Math.max(0, sign * (beforeScore - afterScore));
    const move = moves[index];
    const uci = move.from && move.to ? `${move.from}${move.to}${move.promotion || ''}` : null;
    const cls = classifyMove({
      lossCp,
      isBest: Boolean(uci && before?.pv === uci),
      allowedMate: classifySupportedMotif({ before, after })?.kind === 'allowed-mate'
    });
    counts[mover][cls]++;
    accuracies[mover].push(moveAccuracy(sign * (winPercent(beforeScore) - winPercent(afterScore))));
    classified.push({ ply: index, mover, san: move.san || null, lossCp, cls });
  }

  const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return { moves: classified, counts, accuracy: { w: mean(accuracies.w), b: mean(accuracies.b) }, curve };
}

export function botLevelToRating(level) {
  return BOT_LEVEL_RATINGS[level] || 1500;
}

export function createGameReviewService({ worker, skillLevel = 20, searchDepth = 10 }) {
  let active = null;
  // Cancelled searches are drained up to the readyok that follows their stop.
  let staleSearches = 0;

  function search(fen) {
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${searchDepth}`);
  }

  worker.onmessage = event => {
    if (typeof event.data !== 'string') return;
    const line = event.data;
    if (staleSearches > 0) {
      if (line === 'readyok') staleSearches--;
      return;
    }
    if (!active) return;
    const evaluation = parseReviewEvaluation(line);
    if (evaluation) active.latest = evaluation;
    // Stockfish.js answers a mated/stalemated position with a single "depth 0" line
    // and no bestmove; confirm the search is over with isready before moving on.
    if (evaluation && /\bdepth 0\b/.test(line) && !active.awaitingReady) {
      active.awaitingReady = true;
      worker.postMessage('isready');
      return;
    }
    const finished = active.awaitingReady ? line === 'readyok' : line.startsWith('bestmove');
    if (!finished) return;
    active.awaitingReady = false;
    const request = active;
    request.results.push({ fen: request.fens[request.index], evaluation: request.latest });
    request.index++;
    request.onProgress?.({ completed: request.index, total: request.fens.length });
    if (request.index >= request.fens.length) {
      active = null;
      request.resolve({ status: 'complete', evaluations: request.results });
      return;
    }
    request.latest = null;
    search(request.fens[request.index]);
  };

  worker.onerror = () => {
    if (!active) return;
    const request = active;
    active = null;
    request.resolve({ status: 'error', evaluations: request.results });
  };

  return {
    analyze(record, onProgress) {
      if (active) this.cancel();
      return new Promise(resolve => {
        const fens = record.fens || [];
        if (!fens.length) { resolve({ status: 'complete', evaluations: [] }); return; }
        active = { fens, index: 0, results: [], latest: null, onProgress, resolve };
        worker.postMessage(`setoption name Skill Level value ${skillLevel}`);
        search(fens[0]);
      });
    },
    cancel() {
      if (!active) return;
      const request = active;
      active = null;
      staleSearches++;
      worker.postMessage('stop');
      worker.postMessage('isready');
      request.resolve({ status: 'cancelled', evaluations: request.results });
    },
    get isAnalyzing() { return active !== null; }
  };
}
