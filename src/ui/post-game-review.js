function formatPawns(cp) {
  if (Math.abs(cp) >= 1500) return cp > 0 ? 'мат' : '−мат';
  const pawns = (cp / 100).toFixed(1);
  return cp > 0 ? `+${pawns}` : pawns.replace('-', '−');
}

export function describeMoment(moment, bestMoveSan) {
  const moveNumber = Math.floor(moment.ply / 2) + 1;
  const prefix = moment.ply % 2 === 0 ? `${moveNumber}.` : `${moveNumber}…`;
  const loss = moment.motif?.kind === 'missed-mate' ? 'упущен мат'
    : moment.motif?.kind === 'allowed-mate' ? 'допущен мат'
      : `−${(moment.lossCp / 100).toFixed(1)}`;
  const best = bestMoveSan ? ` Лучше: ${bestMoveSan}.` : '';
  return `${prefix} ${moment.san || '?'} (${loss}; ${formatPawns(moment.beforeCp)} → ${formatPawns(moment.afterCp)}).${best}`;
}

export function createPostGameReviewView({ $, toSan, onSelectMoment, onCancel, onRetry, onSolvePuzzle }) {
  const status = $('#reviewStatus');
  const list = $('#reviewMoments');
  const cancelBtn = $('#reviewCancelBtn');
  const retryBtn = $('#reviewRetryBtn');
  const puzzleBtn = $('#reviewPuzzleBtn');
  let gameId = null;

  cancelBtn.on('click', () => onCancel());
  retryBtn.on('click', () => gameId && onRetry(gameId));

  function reset() {
    list.empty().prop('hidden', true);
    cancelBtn.prop('hidden', true);
    retryBtn.prop('hidden', true);
    puzzleBtn.prop('hidden', true).off('click');
  }

  return {
    showProgress({ gameId: id, completed, total }) {
      if (id !== gameId) { gameId = id; reset(); }
      status.text(total ? `Разбор партии: ${completed}/${total}` : 'Разбираем партию…');
      cancelBtn.prop('hidden', false);
    },
    showReport(report, record, recommendedPuzzle) {
      gameId = report.gameId;
      reset();
      if (report.status === 'cancelled' || report.status === 'error') {
        status.text(report.status === 'error' ? 'Разбор не удалось завершить: движок недоступен.' : 'Разбор отменён. Партия сохранена.');
        retryBtn.prop('hidden', false);
        return;
      }
      const moments = report.moments || [];
      status.text(moments.length
        ? `Разбор готов. Ключевые моменты (${moments.length}):`
        : 'Разбор готов: серьёзных ошибок не найдено.');
      moments.forEach(moment => {
        const item = $('<li><button type="button" class="review-moment-btn"></button></li>');
        item.find('button')
          .text(describeMoment(moment, toSan(record.fens[moment.ply], moment.bestMove)))
          .on('click', () => onSelectMoment(record, moment));
        list.append(item);
      });
      list.prop('hidden', moments.length === 0);
      if (recommendedPuzzle) {
        const label = report.recommendation.reason === 'motif'
          ? 'Задача на ту же тему'
          : 'Задача для общей практики';
        puzzleBtn.text(`${label} (рейтинг ${recommendedPuzzle.rating || '?'})`)
          .prop('hidden', false)
          .on('click', () => onSolvePuzzle(recommendedPuzzle));
      } else {
        status.append($('<div class="review-hint"></div>').text('Загрузите задачи во вкладке «Задачи», чтобы получать рекомендации.'));
      }
    },
    showError(message) {
      reset();
      status.text(message);
    }
  };
}
