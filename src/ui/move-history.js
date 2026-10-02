export function createMoveHistoryView({
  $,
  game,
  getBoard,
  getHistoryFENs,
  getCurrentViewPly,
  setCurrentViewPly,
  clearArrows,
  onPositionChange
}) {
  function updateMoveHistory() {
    const history = game.history();
    const list = $('#moveHistoryList').empty();
    let row = null;

    history.forEach((san, index) => {
      if (index % 2 === 0) {
        row = $('<div style="display: flex; padding: 4px 8px; border-radius: 4px;"></div>');
        if ((index / 2) % 2 === 1) row.css('background-color', 'rgba(128, 128, 128, 0.1)');
        row.append($('<div style="width: 40px; color: #888;"></div>').text(`${Math.floor(index / 2) + 1}.`));
      }

      const moveLabel = `Перейти к позиции после хода ${index + 1}: ${san}`;
      const move = $('<div class="move-text" role="button" tabindex="0" style="flex: 1; cursor: pointer; padding: 0 4px; border-radius: 3px;"></div>')
        .attr('data-ply', index)
        .attr('aria-label', moveLabel)
        .text(san);
      row.append(move);

      if (index % 2 === 1 || index === history.length - 1) {
        if (index % 2 === 0) row.append($('<div style="flex: 1;"></div>'));
        list.append(row);
      }
    });

    updateActiveMove();
    const historyFENs = getHistoryFENs();
    if (list.length && getCurrentViewPly() === historyFENs.length - 1) {
      list.scrollTop(list[0].scrollHeight);
    }
  }

  function updateActiveMove() {
    $('.move-text').removeClass('active-move').removeAttr('aria-current');
    const currentPly = getCurrentViewPly();
    if (currentPly > 0) {
      $(`.move-text[data-ply="${currentPly - 1}"]`)
        .addClass('active-move')
        .attr('aria-current', 'step');
    }
  }

  function goToPly(ply) {
    const historyFENs = getHistoryFENs();
    const boundedPly = Math.max(0, Math.min(ply, historyFENs.length - 1));
    setCurrentViewPly(boundedPly);
    const board = getBoard();
    if (board && typeof board.position === 'function') {
      board.position(historyFENs[boundedPly], true);
    }
    clearArrows();
    updateActiveMove();
    if (board && typeof board.highlightLastMove === 'function') {
      const history = game.history({ verbose: true });
      if (boundedPly > 0 && history[boundedPly - 1]) {
        const lastMove = history[boundedPly - 1];
        board.highlightLastMove(lastMove.from, lastMove.to);
      } else if (typeof board.clearLastMoveHighlight === 'function') {
        board.clearLastMoveHighlight();
      }
    }
    onPositionChange();
  }

  return { updateMoveHistory, goToPly };
}
