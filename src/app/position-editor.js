/**
 * Position editor controls: side to move, castling rights, board flip and starting a game
 * from the edited position. The board itself is edited by dragging (board-interaction.js).
 */
import { retainCastlingRights } from '../domain/castling-rights.js';

const ALL_RIGHTS = 'KQkq';

/** Why the position cannot be played, or null when it can. */
export function describeUnplayablePosition(fen, ChessCtor) {
  const [placement, turn] = fen.split(' ');
  const count = symbol => placement.split('').filter(char => char === symbol).length;
  if (count('K') !== 1 || count('k') !== 1) return 'Нужно ровно по одному королю у белых и у чёрных.';
  const ranks = placement.split('/');
  if (/[pP]/.test(ranks[0]) || /[pP]/.test(ranks[7])) return 'Пешки не могут стоять на первой и восьмой горизонталях.';
  const parts = fen.split(' ');
  parts[1] = turn === 'w' ? 'b' : 'w';
  parts[3] = '-';
  const flipped = new ChessCtor();
  if (flipped.load(parts.join(' ')) && flipped.in_check()) {
    return turn === 'w' ? 'Чёрный король под шахом, а ход белых.' : 'Белый король под шахом, а ход чёрных.';
  }
  return null;
}

export function createPositionEditor({ $, Chess, store, eventBus, session }) {
  const isEditing = () => $('body').hasClass('is-editor-mode');

  function currentFen() {
    return store.getState().game.fen();
  }

  function sync() {
    const [placement, turn, rights] = currentFen().split(' ');
    $('#editorTurn [data-turn]').each(function() {
      $(this).attr('aria-checked', String($(this).data('turn') === turn));
    });
    const possible = retainCastlingRights(`${placement} w ${ALL_RIGHTS} - 0 1`, placement);
    $('#editorCastling [data-castle]').each(function() {
      const right = $(this).data('castle');
      $(this).prop('disabled', !possible.includes(right)).prop('checked', rights.includes(right));
    });
    const level = $('#botLevel').data('playLevel') || $('#botLevel').val() || 10;
    $('#playFromPositionHint').text(`против бота · уровень ${level} · вы за ${turn === 'w' ? 'белых' : 'чёрных'}`);
    $('#editorError').text('');
  }

  function applyFen(fen) {
    const game = store.getState().game;
    if (!game.load(fen)) return;
    store.setState({ historyFENs: [game.fen()], currentViewPly: 0 });
    session.updateStatus();
    eventBus.emit('game:move-made', { fen: game.fen(), animate: false, game: game });
  }

  $('#editorTurn').on('click', '[data-turn]', function() {
    const parts = currentFen().split(' ');
    parts[1] = $(this).data('turn');
    parts[3] = '-';
    applyFen(parts.join(' '));
  });

  $('#editorCastling').on('change', '[data-castle]', function() {
    const parts = currentFen().split(' ');
    const rights = $('#editorCastling [data-castle]:checked').map((_, input) => $(input).data('castle')).get().join('');
    parts[2] = rights || '-';
    applyFen(parts.join(' '));
  });

  $('#editorFlipBtn').on('click', function() {
    $('#flipOrientationBtn').trigger('click');
  });

  $('#playFromPositionBtn').on('click', function() {
    const problem = describeUnplayablePosition(currentFen(), Chess);
    if (problem) {
      $('#editorError').text(problem);
      return;
    }
    $('.tab-btn[data-tab="tab-play"]').trigger('click');
    session.startFromCurrentPosition();
  });

  eventBus.on('game:move-made', () => { if (isEditing()) sync(); });
  $('.tab-btn[data-tab="tab-setup"]').on('click', sync);

  return { sync };
}
