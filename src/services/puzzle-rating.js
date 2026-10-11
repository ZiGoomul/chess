// The player's puzzle rating: Elo against the puzzle's rating, bigger steps for the first puzzles.
export const START_PUZZLE_RATING = 1500;
const PROVISIONAL_GAMES = 20;

/**
 * @param {{ rating: number, games: number }} player
 * @param {number} puzzleRating
 * @param {boolean} solved solved without a wrong move or a revealed solution
 */
export function updatePuzzleRating(player, puzzleRating, solved) {
  const k = player.games < PROVISIONAL_GAMES ? 48 : 24;
  const expected = 1 / (1 + 10 ** ((puzzleRating - player.rating) / 400));
  const delta = Math.round(k * ((solved ? 1 : 0) - expected));
  return { rating: Math.max(100, player.rating + delta), games: player.games + 1, delta };
}

/** The Lichess difficulty step that best fits a rating (its API is relative to 1500). */
export function difficultyForRating(rating) {
  if (rating < 1300) return 'easier';
  if (rating > 1700) return 'harder';
  return 'normal';
}
