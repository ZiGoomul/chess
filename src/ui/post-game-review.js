import { MOVE_CLASSES, classifyMove, summarizeReview, winPercent } from '../services/game-review.js';
import { MOVE_CLASS_LABELS } from './move-classes.js';


function formatPawns(cp) {
  if (Math.abs(cp) >= 1500) return cp > 0 ? 'мат' : '−мат';
  const pawns = (cp / 100).toFixed(1);
  return cp > 0 ? `+${pawns}` : pawns.replace('-', '−');
}

function momentMove(moment) {
  const moveNumber = Math.floor(moment.ply / 2) + 1;
  return `${moveNumber}${moment.ply % 2 === 0 ? '.' : '…'} ${moment.san || '?'}`;
}

// Second line of a key-moment card: the better move and how the evaluation changed.
export function describeMomentDetail(moment, bestMoveSan) {
  const change = moment.motif?.kind === 'missed-mate' ? 'упущен мат'
    : moment.motif?.kind === 'allowed-mate' ? 'допущен мат'
      : `оценка ${formatPawns(moment.beforeCp)} → ${formatPawns(moment.afterCp)}`;
  return bestMoveSan ? `Лучше ${bestMoveSan} · ${change}` : change;
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

export function createPostGameReviewView({
  $,
  toSan,
  onSelectMoment,
  onCancel,
  onRetry,
  onSolvePuzzle,
  onPlayFromMoment,
  onPlayBestMove,
  onStartPractice = (_record, _moments) => {},
  onPracticeMoment = (_record, _moment) => {},
  onSummary = (_record, _summary, _report) => {}
}) {
  const status = $('#reviewStatus');
  const list = $('#reviewMoments');
  const cancelBtn = $('#reviewCancelBtn');
  const retryBtn = $('#reviewRetryBtn');
  const puzzleBtn = $('#reviewPuzzleBtn');
  const playFromBtn = $('#reviewPlayFromBtn');
  const playBestMoveBtn = $('#reviewPlayBestMoveBtn');
  const startPracticeBtn = $('#reviewStartPracticeBtn');
  const practiceMomentBtn = $('#reviewPracticeMomentBtn');
  const trainerCard = $('#reviewTrainerCard');
  const summary = $('#reviewSummary');
  let gameId = null;
  let currentMoments = [];

  function showSummary(report, record) {
    const result = summarizeReview({ record, evaluations: report.evaluations || [] });
    if (!result.moves.length) return;
    const you = record.humanColor === 'b' ? 'b' : 'w';
    const bot = you === 'w' ? 'b' : 'w';
    $('#reviewEvalArea').attr('d', evalGraphPath(result.curve));
    $('#reviewAccuracyYou').text(formatAccuracy(result.accuracy[you]));
    $('#reviewAccuracyBot').text(formatAccuracy(result.accuracy[bot]));
    const chips = $('#reviewClassChips').empty();
    MOVE_CLASSES.forEach(name => {
      const chip = $('<li class="review-class-chip"></li>').addClass(`review-class--${name}`);
      chip.append($('<span class="review-class-icon" aria-hidden="true"></span>').addClass(`move-class--${name}`).text(MOVE_CLASS_LABELS[name].icon));
      chip.append($('<span class="review-class-text"></span>').text(`${MOVE_CLASS_LABELS[name].label} · ${result.counts[you][name]}`));
      chips.append(chip);
    });
    summary.prop('hidden', false);
    onSummary(record, result, report);
  }

  cancelBtn.on('click', () => onCancel());
  retryBtn.on('click', () => gameId && onRetry(gameId));

  // ‹ Момент 2 из 3 › — steps through the key moments in game order
  function updateMomentNav() {
    const buttons = list.find('.review-moment-btn');
    const index = buttons.index(buttons.filter('.is-active'));
    $('#reviewMomentNav').prop('hidden', buttons.length < 2);
    $('#reviewMomentPosition').text(index >= 0 ? `Момент ${index + 1} из ${buttons.length}` : `Моментов: ${buttons.length}`);
    $('#reviewPrevMomentBtn').prop('disabled', index <= 0);
    $('#reviewNextMomentBtn').prop('disabled', index >= buttons.length - 1);
  }

  function stepMoment(delta) {
    const buttons = list.find('.review-moment-btn');
    const index = buttons.index(buttons.filter('.is-active'));
    const next = index < 0 ? 0 : index + delta;
    if (next >= 0 && next < buttons.length) buttons.eq(next).trigger('click');
  }

  $('#reviewPrevMomentBtn').on('click', () => stepMoment(-1));
  $('#reviewNextMomentBtn').on('click', () => stepMoment(1));

  function reset() {
    summary.prop('hidden', true);
    $('#reviewMomentNav').prop('hidden', true);
    $('#reviewMomentsTitle').prop('hidden', true);
    list.empty().prop('hidden', true);
    cancelBtn.prop('hidden', true);
    retryBtn.prop('hidden', true);
    puzzleBtn.prop('hidden', true).off('click');
    playFromBtn.prop('hidden', true).off('click');
    playBestMoveBtn.prop('hidden', true).off('click');
    startPracticeBtn.prop('hidden', true).off('click');
    practiceMomentBtn.prop('hidden', true).off('click');
    trainerCard.prop('hidden', true);
    currentMoments = [];
  }

  function hideMomentActions() {
    playFromBtn.prop('hidden', true).off('click');
    playBestMoveBtn.prop('hidden', true).off('click');
    practiceMomentBtn.prop('hidden', true).off('click');
    list.find('.review-moment-btn').removeClass('is-active');
    updateMomentNav();
  }

  function showPracticeCard() {
    hideMomentActions();
    list.prop('hidden', true);
    $('#reviewMomentsTitle').prop('hidden', true);
    $('#reviewMomentNav').prop('hidden', true);
    startPracticeBtn.prop('hidden', true);
    trainerCard.prop('hidden', false);
  }

  function hidePracticeCard() {
    trainerCard.prop('hidden', true);
    const hasMoments = currentMoments.length > 0;
    list.prop('hidden', !hasMoments);
    $('#reviewMomentsTitle').prop('hidden', !hasMoments);
    startPracticeBtn.prop('hidden', !hasMoments);
    if (hasMoments) {
      updateMomentNav();
    } else {
      $('#reviewMomentNav').prop('hidden', true);
    }
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
      $('#openLastReviewBtn').prop('hidden', false);
      currentMoments = (report.moments || []).slice().sort((a, b) => a.ply - b.ply);
      const moments = currentMoments;
      status.text(moments.length ? '' : 'Серьёзных ошибок не найдено.');
      $('#reviewMomentsTitle').prop('hidden', moments.length === 0);
      if (moments.length > 0) {
        startPracticeBtn
          .text(`Работа над ошибками (${moments.length})`)
          .prop('hidden', false)
          .off('click')
          .on('click', () => {
            onStartPractice(record, moments);
          });
      } else {
        startPracticeBtn.prop('hidden', true).off('click');
      }
      moments.forEach(moment => {
        const item = $('<li><button type="button" class="review-moment-btn"></button></li>');
        const btn = item.find('button');
        const bestSan = toSan(record.fens[moment.ply], moment.bestMove);
        const cls = classifyMove({ lossCp: moment.lossCp, allowedMate: moment.motif?.kind === 'allowed-mate' });
        const text = $('<span class="review-moment-text"></span>')
          .append($('<strong></strong>').text(momentMove(moment)))
          .append($('<span></span>').text(describeMomentDetail(moment, bestSan)));
        btn
          .attr('aria-label', describeMoment(moment, bestSan))
          .append($('<span class="review-moment-badge" aria-hidden="true"></span>').addClass(`move-class--${cls}`).text(MOVE_CLASS_LABELS[cls].icon))
          .append(text)
          .on('click', () => {
            list.find('.review-moment-btn').removeClass('is-active');
            btn.addClass('is-active');
            updateMomentNav();
            onSelectMoment(record, moment);

            if (onPracticeMoment) {
              practiceMomentBtn
                .text('Исправить этот момент')
                .prop('hidden', false)
                .off('click')
                .on('click', () => {
                  hideMomentActions();
                  onPracticeMoment(record, moment);
                });
            } else {
              practiceMomentBtn.prop('hidden', true).off('click');
            }

            if (onPlayBestMove && moment.bestMove) {
              playBestMoveBtn
                .text(bestSan ? `Сыграть ${bestSan}` : 'Сыграть лучший ход')
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
                .text('Доиграть отсюда')
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
      updateMomentNav();
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
    hideMomentActions,
    showPracticeCard,
    hidePracticeCard
  };
}

