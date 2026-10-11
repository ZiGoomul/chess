import { botLevelToRating } from '../services/game-review.js';

/** Names the opponent badge after the chosen bot level; the editor (level 0) leaves it alone. */
export function showBotOpponent($, level) {
  if (!(level > 0)) return;
  $('#topPlayerName').text(`Бот · ур. ${level}`);
  $('#topPlayerRating').text(`~${botLevelToRating(level)}`);
}
