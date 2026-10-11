/**
 * Announces every move to screen readers in Russian.
 */
const PIECE_NAMES = { p: 'пешка', n: 'конь', b: 'слон', r: 'ладья', q: 'ферзь', k: 'король' };
const PROMOTION_NAMES = { n: 'коня', b: 'слона', r: 'ладью', q: 'ферзя' };

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

export function createMoveAnnouncer({ $, eventBus }) {
  eventBus.on('game:move-made', data => {
    if (data?.move?.color) $('#moveAnnouncer').text(describeMoveForSpeech(data.move));
  });
}
