import { applyUciMove } from './puzzle-runner.js';

export const PUZZLE_DIFFICULTIES = ['easier', 'normal', 'harder'];

/**
 * Converts a Lichess /api/puzzle/* response into the app's puzzle record.
 * The game's PGN ends with the opponent's move, so the position after it is the
 * one the solver sees and the solution starts with the solver's move.
 */
export function parseLichessApiPuzzle(data, chessFactory) {
  const game = data?.game;
  const puzzle = data?.puzzle;
  if (!game?.pgn || !puzzle?.id || !Array.isArray(puzzle.solution) || !puzzle.solution.length) return null;

  const position = chessFactory();
  let lastMove = null;
  for (const san of String(game.pgn).trim().split(/\s+/)) {
    lastMove = position.move(san, { sloppy: true });
    if (!lastMove) return null;
  }

  const replay = chessFactory();
  replay.load(position.fen());
  if (!puzzle.solution.every(uci => applyUciMove(replay, uci))) return null;

  return {
    id: `lichess:${puzzle.id}`,
    source: 'lichess',
    sourceId: puzzle.id,
    fen: position.fen(),
    moves: puzzle.solution.slice(),
    rating: Number(puzzle.rating) || null,
    popularity: Number(puzzle.plays) || 0,
    themes: Array.isArray(puzzle.themes) ? puzzle.themes.slice() : [],
    desc: '',
    sourceUrl: `https://lichess.org/training/${puzzle.id}`,
    lastMove: lastMove ? { from: lastMove.from, to: lastMove.to } : null,
    fetchedAt: Date.now()
  };
}

/** Fetches random puzzles from the public Lichess API (no account needed). */
export function createLichessPuzzleSource({ chessFactory, fetchImpl = globalThis.fetch, baseUrl = 'https://lichess.org' }) {
  async function fetchPuzzle(url) {
    const response = await fetchImpl(url.toString());
    if (!response.ok) throw new Error(`Lichess puzzle request failed (${response.status})`);
    const puzzle = parseLichessApiPuzzle(await response.json(), chessFactory);
    if (!puzzle) throw new Error('Lichess returned a puzzle that could not be replayed');
    return puzzle;
  }

  return {
    /** @param {{ theme?: string, difficulty?: string }} [options] */
    async next({ theme, difficulty = 'normal' } = {}) {
      const url = new URL('/api/puzzle/next', baseUrl);
      if (theme) url.searchParams.set('angle', theme);
      if (PUZZLE_DIFFICULTIES.includes(difficulty)) url.searchParams.set('difficulty', difficulty);
      return fetchPuzzle(url);
    },
    /** Lichess' puzzle of the day. */
    async daily() {
      return fetchPuzzle(new URL('/api/puzzle/daily', baseUrl));
    }
  };
}
