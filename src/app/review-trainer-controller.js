import { parseUciMove, applyUciMove } from '../services/puzzle-runner.js';

export function createReviewTrainerController({
  $,
  Chess,
  store,
  eventBus,
  boardView,
  moveHistoryView,
  clearSelection = () => {},
  playSound,
  playSoundForMove,
  toSan,
  onComplete
}) {
  let active = false;
  let record = null;
  let moments = [];
  let currentIndex = 0;
  let hintLevel = 0;
  let attempts = 0;
  let solved = false;
  let solvedCount = 0;
  let firstTryCount = 0;
  let isRefutationShown = false;
  let allCompleted = false;

  function isActive() {
    return active;
  }

  function isCompleted() {
    return Boolean(active && (solved || allCompleted));
  }

  function getCurrentMoment() {
    return moments[currentIndex] || null;
  }

  function getStats() {
    return {
      total: moments.length,
      solved: solvedCount,
      firstTry: firstTryCount
    };
  }

  function formatSan(fen, uci) {
    if (toSan) {
      const s = toSan(fen, uci);
      if (s) return s;
    }
    const trial = new Chess(fen);
    const moveObj = applyUciMove(trial, uci);
    return moveObj ? moveObj.san : uci;
  }

  function getInitialPrompt(moment) {
    if (!moment) return 'Найдите лучший ход!';
    const moveNumber = Math.floor(moment.ply / 2) + 1;
    const prefix = `${moveNumber}${moment.ply % 2 === 0 ? '.' : '…'}`;
    const playedSan = moment.san ? `${prefix} ${moment.san}` : '';
    return playedSan
      ? `В партии вы сыграли ${playedSan}. Найдите лучший ход!`
      : 'Найдите лучший ход!';
  }

  function loadMoment(index) {
    if (index < 0 || index >= moments.length) return;
    currentIndex = index;
    attempts = 0;
    hintLevel = 0;
    solved = false;
    isRefutationShown = false;
    allCompleted = false;

    const moment = moments[currentIndex];
    const fen = record.fens[moment.ply];
    const game = new Chess(fen);
    store.setState({ game, historyFENs: [fen], currentViewPly: 0, mode: 'review-trainer' });

    clearSelection?.();
    boardView.clearArrows?.();
    boardView.clearHighlights?.();
    boardView.clearSquareFeedback?.();
    boardView.removeHighlights?.();
    boardView.highlightCheck?.(game);
    moveHistoryView?.updateMoveHistory?.();
    eventBus?.emit('game:move-made', { fen: game.fen(), game, animate: false });

    $('#reviewTrainerPosition').text(`Момент ${currentIndex + 1} из ${moments.length}`);

    const initialPrompt = getInitialPrompt(moment);
    $('#reviewTrainerPrompt').text(initialPrompt).removeAttr('data-tone');

    $('#reviewTrainerHintBtn').text('Подсказка').prop('disabled', false);

    if (moment.refutationMove) {
      $('#reviewTrainerRefutationBtn').text('Почему ход в партии — ошибка?').prop('hidden', false);
    } else {
      $('#reviewTrainerRefutationBtn').prop('hidden', true);
    }

    $('#reviewTrainerNextBtn').prop('disabled', true);
    if (currentIndex === moments.length - 1) {
      $('#reviewTrainerNextBtn').text('Завершить');
    } else {
      $('#reviewTrainerNextBtn').text('Следующий момент');
    }
  }

  function start(newRecord, newMoments, startIndex = 0) {
    if (
      !newRecord?.fens ||
      !Array.isArray(newMoments) ||
      newMoments.length === 0 ||
      startIndex < 0 ||
      startIndex >= newMoments.length
    ) {
      return;
    }
    active = true;
    record = newRecord;
    moments = newMoments;
    solvedCount = 0;
    firstTryCount = 0;
    allCompleted = false;

    $('#reviewTrainerCard').prop('hidden', false);

    const orientation = record.humanColor === 'b' ? 'black' : 'white';
    boardView.orientation?.(orientation);
    eventBus?.emit('board:orientation-changed', { orientation });

    loadMoment(startIndex);
  }

  function tryMove(source, target, promotion = 'q') {
    if (!active || solved || isRefutationShown || allCompleted) return false;
    const moment = moments[currentIndex];
    const parsedBest = parseUciMove(moment.bestMove);
    if (!parsedBest) return false;

    const game = store.getState().game;
    const trial = new Chess(game.fen());
    const testMove = trial.move({
      from: source,
      to: target,
      promotion: parsedBest.promotion || promotion || 'q'
    });

    const userMatches =
      Boolean(testMove) &&
      source === parsedBest.from &&
      target === parsedBest.to &&
      (!parsedBest.promotion || (promotion && promotion.toLowerCase() === parsedBest.promotion.toLowerCase()));

    if (!userMatches) {
      attempts++;
      boardView.showSquareFeedback?.(target, 'wrong');
      if (playSound) playSound('wrong');
      $('#reviewTrainerPrompt').text('Ход не решает проблему. Попробуйте ещё раз!').attr('data-tone', 'error');
      return false;
    }

    const moveObj = game.move({
      from: source,
      to: target,
      promotion: parsedBest.promotion || promotion || 'q'
    });
    const fens = store.getState().historyFENs.slice();
    fens.push(game.fen());
    store.setState({ historyFENs: fens, currentViewPly: fens.length - 1 });

    boardView.clearArrows?.();
    boardView.clearHighlights?.();
    boardView.showSquareFeedback?.(target, 'correct');
    if (playSound) playSound('correct');
    if (playSoundForMove && moveObj) playSoundForMove(moveObj);

    solved = true;
    solvedCount++;
    if (attempts === 0 && hintLevel === 0) {
      firstTryCount++;
    }

    const bestSan = moveObj ? moveObj.san : (formatSan(record.fens[moment.ply], moment.bestMove) || moment.bestMove);
    $('#reviewTrainerPrompt').text(`Отлично! ${bestSan} — лучший ход!`).attr('data-tone', 'success');
    $('#reviewTrainerNextBtn').prop('disabled', false);
    $('#reviewTrainerHintBtn').prop('disabled', true);
    $('#reviewTrainerRefutationBtn').prop('hidden', true);
    eventBus?.emit('game:move-made', { fen: game.fen(), move: moveObj, game });
    moveHistoryView?.updateMoveHistory?.();
    return true;
  }

  function requestHint() {
    if (!active || solved || isRefutationShown || allCompleted) return;
    const moment = moments[currentIndex];
    const parsedBest = parseUciMove(moment.bestMove);
    if (!parsedBest) return;

    if (hintLevel === 0) {
      hintLevel = 1;
      boardView.highlightSquares?.([parsedBest.from]);
      boardView.showSquareFeedback?.(parsedBest.from, 'hint');
      $('#reviewTrainerPrompt')
        .text(`Обратите внимание на фигуру на ${parsedBest.from}`)
        .attr('data-tone', 'info');
    } else if (hintLevel === 1) {
      hintLevel = 2;
      boardView.drawArrow?.(parsedBest.from, parsedBest.to, 'guide');
      boardView.showGuideArrow?.(parsedBest.from, parsedBest.to);
      eventBus?.emit('engine:hints-updated', { hints: { 1: moment.bestMove }, game: store.getState().game });
      $('#reviewTrainerHintBtn').text('Показать решение');
      $('#reviewTrainerPrompt').text('Смотрите подсказку на доске!').attr('data-tone', 'info');
    } else if (hintLevel >= 2) {
      hintLevel = 3;
      const game = store.getState().game;
      const moveObj = game.move({
        from: parsedBest.from,
        to: parsedBest.to,
        promotion: parsedBest.promotion || 'q'
      });
      if (moveObj) {
        const fens = store.getState().historyFENs.slice();
        fens.push(game.fen());
        store.setState({ historyFENs: fens, currentViewPly: fens.length - 1 });
        boardView.clearArrows?.();
        boardView.clearHighlights?.();
        boardView.showSquareFeedback?.(parsedBest.to, 'correct');
        if (playSound) playSound('correct');
        if (playSoundForMove) playSoundForMove(moveObj);
        solved = true;
        solvedCount++;
        $('#reviewTrainerPrompt').text(`Решение: ${moveObj.san}`).attr('data-tone', 'info');
        $('#reviewTrainerNextBtn').prop('disabled', false);
        $('#reviewTrainerHintBtn').prop('disabled', true);
        $('#reviewTrainerRefutationBtn').prop('hidden', true);
        eventBus?.emit('game:move-made', { fen: game.fen(), move: moveObj, game });
        moveHistoryView?.updateMoveHistory?.();
      }
    }
  }

  function showRefutation() {
    if (!active || solved || isRefutationShown || allCompleted) return;
    const moment = moments[currentIndex];
    isRefutationShown = true;
    $('#reviewTrainerRefutationBtn').text('Вернуться к решению');

    const refGame = new Chess(record.fens[moment.ply]);
    if (moment.san) {
      refGame.move(moment.san);
    }
    let refMoveObj = null;
    if (moment.refutationMove) {
      refMoveObj = applyUciMove(refGame, moment.refutationMove);
    }
    store.setState({ game: refGame, historyFENs: [record.fens[moment.ply], refGame.fen()], currentViewPly: 1 });

    boardView.clearArrows?.();
    boardView.clearHighlights?.();
    boardView.clearSquareFeedback?.();

    if (refMoveObj) {
      const parsedRef = parseUciMove(moment.refutationMove);
      if (parsedRef) {
        boardView.drawArrow?.(parsedRef.from, parsedRef.to, 'wrong');
        boardView.showGuideArrow?.(parsedRef.from, parsedRef.to);
      }
    }

    const moveNumber = Math.floor(moment.ply / 2) + 1;
    const prefix = `${moveNumber}${moment.ply % 2 === 0 ? '.' : '…'}`;
    const playedStr = moment.san ? `${prefix} ${moment.san}` : '';
    const refSan = refMoveObj ? refMoveObj.san : moment.refutationMove;
    const promptText = refSan
      ? `В партии после ${playedStr} соперник ответил ${refSan}!`
      : `Ход в партии ${playedStr} — ошибка.`;
    $('#reviewTrainerPrompt').text(promptText).attr('data-tone', 'error');
    eventBus?.emit('game:move-made', { fen: refGame.fen(), game: refGame });
    moveHistoryView?.updateMoveHistory?.();
  }

  function hideRefutation() {
    if (!active || !isRefutationShown) return;
    isRefutationShown = false;
    const moment = moments[currentIndex];
    $('#reviewTrainerRefutationBtn').text('Почему ход в партии — ошибка?');

    const origGame = new Chess(record.fens[moment.ply]);
    store.setState({ game: origGame, historyFENs: [record.fens[moment.ply]], currentViewPly: 0 });
    boardView.clearArrows?.();
    boardView.clearHighlights?.();
    boardView.clearSquareFeedback?.();
    boardView.highlightCheck?.(origGame);

    const initialPrompt = getInitialPrompt(moment);
    $('#reviewTrainerPrompt').text(initialPrompt).removeAttr('data-tone');
    eventBus?.emit('game:move-made', { fen: origGame.fen(), game: origGame });
    moveHistoryView?.updateMoveHistory?.();
  }

  function nextMoment() {
    if (!active) return;
    if (isRefutationShown) hideRefutation();
    if (currentIndex < moments.length - 1) {
      loadMoment(currentIndex + 1);
    } else {
      allCompleted = true;
      boardView.clearArrows?.();
      boardView.clearHighlights?.();
      boardView.clearSquareFeedback?.();
      const summaryText = `Все ключевые моменты пройдены! Решено с первой попытки: ${firstTryCount} из ${moments.length}`;
      $('#reviewTrainerPrompt').text(summaryText).attr('data-tone', 'success');
      $('#reviewTrainerNextBtn').prop('disabled', true);
      $('#reviewTrainerHintBtn').prop('disabled', true);
      $('#reviewTrainerRefutationBtn').prop('hidden', true);
      onComplete?.({ total: moments.length, firstTry: firstTryCount, solved: solvedCount });
    }
  }

  function prevMoment() {
    if (!active) return;
    if (isRefutationShown) hideRefutation();
    if (currentIndex > 0) {
      loadMoment(currentIndex - 1);
    }
  }

  function exit(_options = {}) {
    if (!active) return;
    if (isRefutationShown) hideRefutation();
    active = false;
    allCompleted = false;
    solved = false;
    clearSelection?.();
    boardView.clearArrows?.();
    boardView.clearHighlights?.();
    boardView.clearSquareFeedback?.();
    boardView.removeHighlights?.();
    $('#reviewTrainerCard').prop('hidden', true);
    store.setState({ mode: 'free' });
  }

  function destroy() {
    exit();
    $('#reviewTrainerHintBtn').off('click');
    $('#reviewTrainerRefutationBtn').off('click');
    $('#reviewTrainerNextBtn').off('click');
    $('#reviewTrainerExitBtn').off('click');
  }

  // Wire UI event handlers
  function bindEvents() {
    $('#reviewTrainerHintBtn').off('click').on('click', () => requestHint());
    $('#reviewTrainerRefutationBtn').off('click').on('click', () => {
      if (isRefutationShown) hideRefutation();
      else showRefutation();
    });
    $('#reviewTrainerNextBtn').off('click').on('click', () => nextMoment());
    $('#reviewTrainerExitBtn').off('click').on('click', () => exit());
  }

  bindEvents();

  return {
    isActive,
    isCompleted,
    start,
    tryMove,
    requestHint,
    showRefutation,
    hideRefutation,
    nextMoment,
    prevMoment,
    exit,
    destroy,
    getCurrentMoment,
    getStats
  };
}
