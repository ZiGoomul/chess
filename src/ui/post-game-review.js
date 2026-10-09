import { MOVE_CLASSES, summarizeReview, winPercent } from '../services/game-review.js';
import { MOVE_CLASS_LABELS } from './move-classes.js';


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

// Area under White's winning chances, ply by ply, in a 400×80 box.
export function evalGraphPath(curve) {
  if (!curve.length) return '';
  let last = 0;
  const step = curve.length > 1 ? 400 / (curve.length - 1) : 400;
  const points = curve.map((cp, index) => {
    if (cp != null) last = cp;
    const y = 80 - winPercent(last) * 0.8;
    return `L${(index * step).toFixed(1)} ${y.toFixed(1)}`;
  });
  return `M0 80 ${points.join(' ')} L400 80 Z`;
}

function formatAccuracy(value) {
  return value == null ? '–' : value.toFixed(1);
}

export function createPostGameReviewView({ $, toSan, onSelectMoment, onCancel, onRetry, onSolvePuzzle, onPlayFromMoment, onPlayBestMove, onSummary = (_record, _summary, _report) => {} }) {
  const status = $('#reviewStatus');
  const list = $('#reviewMoments');
  const cancelBtn = $('#reviewCancelBtn');
  const retryBtn = $('#reviewRetryBtn');
  const puzzleBtn = $('#reviewPuzzleBtn');
  const playFromBtn = $('#reviewPlayFromBtn');
  const playBestMoveBtn = $('#reviewPlayBestMoveBtn');
  const summary = $('#reviewSummary');
  let gameId = null;

  function showSummary(report, record) {
    const result = summarizeReview({ record, evaluations: report.evaluations || [] });
    if (!result.moves.length) return;
    const you = record.humanColor === 'b' ? 'b' : 'w';
    const bot = you === 'w' ? 'b' : 'w';
    $('#reviewEvalArea').attr('d', evalGraphPath(result.curve));
    $('#reviewAccuracyYou').text(formatAccuracy(result.accuracy[you]));
    $('#reviewAccuracyBot').text(formatAccuracy(result.accuracy[bot]));
    const rows = $('#reviewClassRows').empty();
    MOVE_CLASSES.forEach(name => {
      const row = $('<tr></tr>').addClass(`review-class review-class--${name}`);
      row.append($('<th scope="row"></th>').text(MOVE_CLASS_LABELS[name].label));
      row.append($('<td></td>').text(result.counts[you][name]));
      row.append($('<td><span class="review-class-icon" aria-hidden="true"></span></td>').find('span').addClass(`move-class--${name}`).text(MOVE_CLASS_LABELS[name].icon).end());
      row.append($('<td></td>').text(result.counts[bot][name]));
      rows.append(row);
    });
    summary.prop('hidden', false);
    onSummary(record, result, report);
  }

  cancelBtn.on('click', () => onCancel());
  retryBtn.on('click', () => gameId && onRetry(gameId));

  function reset() {
    summary.prop('hidden', true);
    list.empty().prop('hidden', true);
    cancelBtn.prop('hidden', true);
    retryBtn.prop('hidden', true);
    puzzleBtn.prop('hidden', true).off('click');
    playFromBtn.prop('hidden', true).off('click');
    playBestMoveBtn.prop('hidden', true).off('click');
    $('#newGameDetails').prop('open', true);
  }

  function hideMomentActions() {
    playFromBtn.prop('hidden', true).off('click');
    playBestMoveBtn.prop('hidden', true).off('click');
    list.find('.review-moment-btn').removeClass('is-active');
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
      showSummary(report, record);
      const moments = report.moments || [];
      if (moments.length > 0) {
        $('#newGameDetails').prop('open', false);
      }
      status.text(moments.length
        ? `Разбор готов. Ключевые моменты (${moments.length}):`
        : 'Разбор готов: серьёзных ошибок не найдено.');
      moments.forEach(moment => {
        const item = $('<li><button type="button" class="review-moment-btn"></button></li>');
        const btn = item.find('button');
        const bestSan = toSan(record.fens[moment.ply], moment.bestMove);
        btn
          .text(describeMoment(moment, bestSan))
          .on('click', () => {
            list.find('.review-moment-btn').removeClass('is-active');
            btn.addClass('is-active');
            onSelectMoment(record, moment);

            if (onPlayBestMove && moment.bestMove) {
              playBestMoveBtn
                .text(bestSan ? `Сыграть лучший ход (${bestSan})` : 'Сыграть лучший ход')
                .prop('hidden', false)
                .off('click')
                .on('click', () => {
                  hideMomentActions();
                  onPlayBestMove(record, moment);
                });
            } else {
              playBestMoveBtn.prop('hidden', true).off('click');
            }

            if (onPlayFromMoment) {
              playFromBtn
                .text('Доиграть с этой позиции')
                .prop('hidden', false)
                .off('click')
                .on('click', () => {
                  hideMomentActions();
                  onPlayFromMoment(record, moment);
                });
            } else {
              playFromBtn.prop('hidden', true).off('click');
            }
          });
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
    },
    hideMomentActions
  };
}
