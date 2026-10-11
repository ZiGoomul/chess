/**
 * Typing moves (SAN, coordinates or Russian piece letters) and announcing every move to
 * screen readers.
 */
import { getDisplayedGame } from '../domain/position.js';

// Russian notation: Кр король, Ф ферзь, Л ладья, С слон, К конь
const RUSSIAN_PIECES = [['Кр', 'K'], ['Ф', 'Q'], ['Л', 'R'], ['С', 'B'], ['К', 'N']];
const PIECE_NAMES = { p: 'пешка', n: 'конь', b: 'слон', r: 'ладья', q: 'ферзь', k: 'король' };
const PROMOTION_NAMES = { n: 'коня', b: 'слона', r: 'ладью', q: 'ферзя' };

export function normalizeMoveText(text) {
  let move = String(text).trim().replace(/\s+/g, '').replace(/0/g, 'O').replace(/[хХ:]/g, 'x');
  for (const [russian, latin] of RUSSIAN_PIECES) {
    if (move.startsWith(russian)) { move = latin + move.slice(russian.length); break; }
  }
  return move.replace(/[!?]+$/, '');
}

/** The legal move the text names in this position, or null. */
export function findTypedMove(game, text, ChessCtor) {
  const normalized = normalizeMoveText(text);
  if (!normalized) return null;
  const trial = new ChessCtor(game.fen());
  try {
    return trial.move(normalized, { sloppy: true }) || null;
  } catch {
    return null;
  }
}

/** "Белые: конь f3", "Чёрные: пешка бьёт d4, шах", "Белые: короткая рокировка". */
export function describeMoveForSpeech(move) {
  const side = move.color === 'w' ? 'Белые' : 'Чёрные';
  let text;
  if (move.flags?.includes('k')) text = 'короткая рокировка';
  else if (move.flags?.includes('q')) text = 'длинная рокировка';
  else {
    text = `${PIECE_NAMES[move.piece] || ''} ${move.captured ? 'бьёт ' : ''}${move.to}`.trim();
    if (move.promotion) text += `, превращение в ${PROMOTION_NAMES[move.promotion] || move.promotion}`;
  }
  if (move.san?.endsWith('#')) text += ', мат';
  else if (move.san?.endsWith('+')) text += ', шах';
  return `${side}: ${text}`;
}

export function createMoveEntry({ $, Chess, store, eventBus, session }) {
  const input = $('#moveEntryInput');
  const feedback = $('#moveEntryFeedback');

  $('#moveEntryForm').on('submit', function(event) {
    event.preventDefault();
    const text = String(input.val() || '');
    if (!text.trim()) return;
    const move = findTypedMove(getDisplayedGame(store.getState(), Chess), text, Chess);
    if (!move) {
      feedback.text(`Нет такого хода: ${text.trim()}`);
      input.attr('aria-invalid', 'true');
      return;
    }
    const accepted = session.makeMove(move.from, move.to, undefined, move.promotion || 'q');
    if (accepted === false) {
      feedback.text('Сейчас этот ход сделать нельзя.');
      input.attr('aria-invalid', 'true');
      return;
    }
    feedback.text('');
    input.val('').removeAttr('aria-invalid');
  });

  input.on('input', () => { feedback.text(''); input.removeAttr('aria-invalid'); });

  // "/" puts the cursor in the move field (by physical key too: on the Russian layout it types ".")
  $(document).on('keydown', function(event) {
    const isSlash = event.key === '/' || (event.code === 'Slash' && !event.shiftKey);
    if (!isSlash || event.ctrlKey || event.metaKey || event.altKey) return;
    if ($(event.target).closest('input, select, textarea, [contenteditable]').length) return;
    event.preventDefault();
    input.trigger('focus');
  });

  eventBus.on('game:move-made', data => {
    if (data?.move?.color) $('#moveAnnouncer').text(describeMoveForSpeech(data.move));
  });
}
