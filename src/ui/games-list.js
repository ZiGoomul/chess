import { summarizeReview } from '../services/game-review.js';

const END_REASONS = { checkmate: 'мат', timeout: 'время вышло', resign: 'вы сдались' };

const dateFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function plural(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** What a games-list row says about a finished game. */
export function describeGame(record, review) {
  const human = record.humanColor === 'b' ? 'b' : 'w';
  const winner = record.result === '1-0' ? 'w' : record.result === '0-1' ? 'b' : null;
  const outcome = winner === null ? 'draw' : winner === human ? 'win' : 'loss';
  const title = { win: 'Победа', loss: 'Поражение', draw: 'Ничья' }[outcome];
  const reason = record.endDetail || END_REASONS[record.endReason] || '';
  const moveCount = Math.ceil((record.moves?.length || 0) / 2);
  const parts = [`Бот · ур. ${record.botLevel ?? '?'}`, `${moveCount} ${plural(moveCount, 'ход', 'хода', 'ходов')}`];
  if (record.completedAt) parts.push(dateFormat.format(new Date(record.completedAt)));
  let accuracy = null;
  if (review?.status === 'complete' && review.evaluations) {
    accuracy = summarizeReview({ record, evaluations: review.evaluations }).accuracy[human];
  }
  return {
    outcome,
    title: reason ? `${title} · ${reason}` : title,
    meta: parts.join(' · '),
    score: winner === null ? '½' : winner === human ? '1' : '0',
    accuracy: accuracy == null ? null : accuracy.toFixed(1)
  };
}

export function createGamesList({ $, getRepository, onOpen }) {
  async function render() {
    const repository = getRepository();
    const list = $('#gamesList').empty();
    if (!repository) {
      $('#gamesEmpty').text('Хранилище недоступно: партии не сохраняются.').prop('hidden', false);
      return;
    }
    const records = await repository.games.listRecent(30);
    $('#gamesEmpty').text('Здесь появятся завершённые партии против бота.').prop('hidden', records.length > 0);
    for (const record of records) {
      const review = await repository.reviews.get(record.id).catch(() => null);
      const info = describeGame(record, review);
      const button = $('<button type="button" class="game-row"></button>')
        .append($('<span class="game-row-score" aria-hidden="true"></span>').addClass(`game-row-score--${info.outcome}`).text(info.score))
        .append($('<span class="game-row-text"></span>')
          .append($('<strong></strong>').text(info.title))
          .append($('<span></span>').text(info.meta)))
        .on('click', () => onOpen(record, review));
      if (info.accuracy) {
        button.append($('<span class="panel-chip game-row-accuracy"></span>').attr('title', 'Ваша точность').text(info.accuracy));
      }
      list.append($('<li></li>').append(button));
    }
  }

  return { render };
}
