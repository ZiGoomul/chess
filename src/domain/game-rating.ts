/**
 * The player's rating against the bot, kept per time control like on Chess.com. A game is rated
 * only when it was played without help; the reasons a game is not rated are listed here.
 */
import { glicko2Update, inflateRd } from './glicko2.js';
import { getTimeCategory } from './time-control.js';

export type RatingCategory = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily' | 'untimed';

export const CATEGORY_LABELS: Record<RatingCategory, string> = {
  bullet: 'Пуля',
  blitz: 'Блиц',
  rapid: 'Рапид',
  classical: 'Классика',
  daily: 'Заочные',
  untimed: 'Без часов'
};

export type UnratedReason = 'hint' | 'autoHint' | 'highlights' | 'takeback' | 'botLevel' | 'noMoves';

export const UNRATED_REASONS: Record<UnratedReason, string> = {
  hint: 'вы брали подсказку',
  autoHint: 'включена авто-подсказка',
  highlights: 'включена подсветка атак и защит',
  takeback: 'вы брали ход назад',
  botLevel: 'во время партии менялся уровень бота или открывался редактор',
  noMoves: 'вы не сделали ни одного хода'
};

export interface PlayerRating {
  rating: number;
  rd: number;
  vol: number;
  games: number;
  lastPlayedAt: number | null;
}

export const NEW_PLAYER_RATING: PlayerRating = { rating: 1500, rd: 350, vol: 0.06, games: 0, lastPlayedAt: null };

// The bot's strength per level is an estimate, so it gets an RD of its own
const BOT_RD = 60;
const MAX_RD = 350;
// Above this RD the rating is still being found, shown with "?" as on Lichess
const PROVISIONAL_RD = 110;
const MIN_RATING = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORY_BY_LABEL: Record<string, RatingCategory> = { 'Пуля': 'bullet', 'Блиц': 'blitz', 'Рапид': 'rapid', 'Классика': 'classical' };

export function ratingCategory({ enabled, baseMinutes }: { enabled: boolean; baseMinutes: number }): RatingCategory {
  if (!enabled) return 'untimed';
  // A day or more per game is how the app sets up correspondence games
  if (baseMinutes >= 1440) return 'daily';
  return CATEGORY_BY_LABEL[getTimeCategory(baseMinutes)] || 'rapid';
}

export function isProvisional(player: PlayerRating): boolean {
  return player.rd > PROVISIONAL_RD;
}

/** "1512" or "1500?" while the rating is still provisional. */
export function formatRating(player: PlayerRating): string {
  return `${Math.round(player.rating)}${isProvisional(player) ? '?' : ''}`;
}

/** 1 for a win of the player, 0.5 for a draw, 0 for a loss. */
export function scoreForPlayer(result: string, humanColor: 'w' | 'b'): number {
  if (result === '1/2-1/2') return 0.5;
  const winner = result === '1-0' ? 'w' : 'b';
  return winner === humanColor ? 1 : 0;
}

/**
 * The player's rating after a game against a bot of `botRating`. Days without a rated game in
 * this category make the rating less sure first, so the next game moves it more.
 */
export function rateGameAgainstBot(
  player: PlayerRating,
  botRating: number,
  score: number,
  now: number
): { player: PlayerRating; delta: number } {
  const idleDays = player.lastPlayedAt === null ? 0 : (now - player.lastPlayedAt) / DAY_MS;
  const before = { rating: player.rating, rd: inflateRd(player, idleDays, MAX_RD), vol: player.vol };
  const after = glicko2Update(before, [{ opponentRating: botRating, opponentRd: BOT_RD, score }]);
  const rating = Math.max(MIN_RATING, after.rating);
  return {
    player: { rating, rd: Math.min(MAX_RD, after.rd), vol: after.vol, games: player.games + 1, lastPlayedAt: now },
    delta: Math.round(rating) - Math.round(player.rating)
  };
}
