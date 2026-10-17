import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './helpers/harness.js';
import { createReviewTrainerController } from '../src/app/review-trainer-controller.js';

test('start() enters active mode, loads initial moment position, and shows prompt', () => {
  const h = createHarness();
  const trainer = createReviewTrainerController({
    $: h.$,
    Chess: h.Chess,
    store: h.store,
    eventBus: h.eventBus,
    boardView: h.boardView,
    moveHistoryView: h.moveHistoryView,
    playSound: h.playSound,
    playSoundForMove: h.playSoundForMove
  });

  const fens = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
  ];
  const moments = [
    {
      ply: 1,
      san: 'e5',
      lossCp: 120,
      beforeCp: 20,
      afterCp: -100,
      bestMove: 'c7c5',
      refutationMove: 'g1f3',
      motif: { kind: 'positional' }
    }
  ];
  const record = { fens, moves: [{ san: 'e4' }, { san: 'e5' }], humanColor: 'b' };

  assert.equal(trainer.isActive(), false);
  trainer.start(record, moments, 0);

  assert.equal(trainer.isActive(), true);
  assert.equal(h.boardView.calls.orientation, 'black');
  assert.equal(h.$('#reviewTrainerCard').prop('hidden'), false);
  assert.equal(h.$('#reviewTrainerPosition').text(), 'Момент 1 из 1');
  assert.ok(h.$('#reviewTrainerPrompt').text().includes('e5'));
  assert.equal(h.$('#reviewTrainerNextBtn').prop('disabled'), true);
  assert.equal(h.$('#reviewTrainerRefutationBtn').prop('hidden'), false);

  h.close();
});

test('tryMove() with incorrect move returns false, records wrong feedback and increments attempts', () => {
  const h = createHarness();
  const trainer = createReviewTrainerController({
    $: h.$,
    Chess: h.Chess,
    store: h.store,
    eventBus: h.eventBus,
    boardView: h.boardView,
    moveHistoryView: h.moveHistoryView,
    playSound: h.playSound,
    playSoundForMove: h.playSoundForMove
  });

  const fens = [
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
  ];
  const moments = [
    {
      ply: 0,
      san: 'e5',
      lossCp: 150,
      beforeCp: 0,
      afterCp: -150,
      bestMove: 'c7c5',
      refutationMove: 'g1f3'
    }
  ];
  const record = { fens, moves: [{ san: 'e5' }], humanColor: 'b' };
  trainer.start(record, moments, 0);

  // Wrong move (e.g. e7e6 instead of c7c5)
  const result = trainer.tryMove('e7', 'e6');
  assert.equal(result, false);
  assert.equal(trainer.isCompleted(), false);

  const lastFeedback = h.boardView.calls.feedback[h.boardView.calls.feedback.length - 1];
  assert.deepEqual(lastFeedback, { square: 'e6', kind: 'wrong' });
  assert.ok(h.sounds.includes('wrong') || h.sounds.includes('illegal'));
  assert.ok(h.$('#reviewTrainerPrompt').text().includes('не решает проблему'));
  assert.equal(h.$('#reviewTrainerNextBtn').prop('disabled'), true);

  h.close();
});

test('tryMove() with correct move returns true, updates board/store, marks moment solved', () => {
  const h = createHarness();
  const trainer = createReviewTrainerController({
    $: h.$,
    Chess: h.Chess,
    store: h.store,
    eventBus: h.eventBus,
    boardView: h.boardView,
    moveHistoryView: h.moveHistoryView,
    playSound: h.playSound,
    playSoundForMove: h.playSoundForMove
  });

  const fens = [
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  ];
  const moments = [
    {
      ply: 0,
      san: 'e5',
      lossCp: 150,
      beforeCp: 0,
      afterCp: -150,
      bestMove: 'c7c5',
      refutationMove: 'g1f3'
    }
  ];
  const record = { fens, moves: [{ san: 'e5' }], humanColor: 'b' };
  trainer.start(record, moments, 0);

  // Correct move c7-c5
  const result = trainer.tryMove('c7', 'c5');
  assert.equal(result, true);
  assert.equal(trainer.isCompleted(), true);

  const lastFeedback = h.boardView.calls.feedback[h.boardView.calls.feedback.length - 1];
  assert.deepEqual(lastFeedback, { square: 'c5', kind: 'correct' });
  assert.ok(h.sounds.includes('correct'));
  assert.ok(h.$('#reviewTrainerPrompt').text().includes('лучший ход'));
  assert.equal(h.$('#reviewTrainerNextBtn').prop('disabled'), false);
  assert.equal(h.$('#reviewTrainerHintBtn').prop('disabled'), true);

  // Cannot make another move once solved
  assert.equal(trainer.tryMove('d7', 'd6'), false);

  h.close();
});

test('requestHint() progresses through levels 1 (square), 2 (arrow), 3 (reveal)', () => {
  const h = createHarness();
  const trainer = createReviewTrainerController({
    $: h.$,
    Chess: h.Chess,
    store: h.store,
    eventBus: h.eventBus,
    boardView: h.boardView,
    moveHistoryView: h.moveHistoryView,
    playSound: h.playSound,
    playSoundForMove: h.playSoundForMove
  });

  const fens = [
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  ];
  const moments = [
    {
      ply: 0,
      san: 'e5',
      bestMove: 'c7c5'
    }
  ];
  const record = { fens, moves: [{ san: 'e5' }], humanColor: 'b' };
  trainer.start(record, moments, 0);

  // Level 1: Piece highlight
  trainer.requestHint();
  assert.ok(h.$('#reviewTrainerPrompt').text().includes('c7'));
  const hasSquareHighlight = h.boardView.calls.highlights.some(h => Array.isArray(h) && h.includes('c7')) ||
                             h.boardView.calls.feedback.some(f => f?.square === 'c7');
  assert.ok(hasSquareHighlight);

  // Level 2: Arrow
  trainer.requestHint();
  assert.equal(h.$('#reviewTrainerHintBtn').text(), 'Показать решение');
  const hasArrow = h.boardView.calls.arrows.some(a => a?.from === 'c7' && a?.to === 'c5');
  assert.ok(hasArrow);

  // Level 3: Reveal solution
  trainer.requestHint();
  assert.equal(trainer.isCompleted(), true);
  assert.ok(h.$('#reviewTrainerPrompt').text().includes('c5'));
  assert.equal(h.$('#reviewTrainerNextBtn').prop('disabled'), false);
  assert.equal(h.$('#reviewTrainerHintBtn').prop('disabled'), true);

  h.close();
});

test('showRefutation() demonstrates opponent reply and hideRefutation() restores position', () => {
  const h = createHarness();
  const trainer = createReviewTrainerController({
    $: h.$,
    Chess: h.Chess,
    store: h.store,
    eventBus: h.eventBus,
    boardView: h.boardView,
    moveHistoryView: h.moveHistoryView,
    playSound: h.playSound,
    playSoundForMove: h.playSoundForMove
  });

  const fens = [
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
  ];
  const moments = [
    {
      ply: 0,
      san: 'e5',
      bestMove: 'c7c5',
      refutationMove: 'g1f3'
    }
  ];
  const record = { fens, moves: [{ san: 'e5' }, { san: 'Nf3' }], humanColor: 'b' };
  trainer.start(record, moments, 0);

  // Show refutation
  trainer.showRefutation();
  assert.equal(h.$('#reviewTrainerRefutationBtn').text(), 'Вернуться к решению');
  assert.ok(h.$('#reviewTrainerPrompt').text().includes('Nf3') || h.$('#reviewTrainerPrompt').text().includes('g1f3'));
  // While refutation is shown, solver cannot make moves
  assert.equal(trainer.tryMove('c7', 'c5'), false);

  // Hide refutation
  trainer.hideRefutation();
  assert.equal(h.$('#reviewTrainerRefutationBtn').text(), 'Почему ход в партии — ошибка?');
  assert.equal(h.store.getState().game.fen(), fens[0]);
  assert.ok(h.$('#reviewTrainerPrompt').text().includes('e5'));

  // Solver can make moves again
  assert.equal(trainer.tryMove('c7', 'c5'), true);

  h.close();
});

test('nextMoment() advances through moments and finishes with summary', () => {
  const h = createHarness();
  let completedStats = null;
  const trainer = createReviewTrainerController({
    $: h.$,
    Chess: h.Chess,
    store: h.store,
    eventBus: h.eventBus,
    boardView: h.boardView,
    moveHistoryView: h.moveHistoryView,
    playSound: h.playSound,
    playSoundForMove: h.playSoundForMove,
    onComplete: (stats) => { completedStats = stats; }
  });

  const fens = [
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
  ];
  const moments = [
    { ply: 0, san: 'e5', bestMove: 'c7c5' },
    { ply: 1, san: 'd6', bestMove: 'b8c6' }
  ];
  const record = { fens, moves: [{ san: 'e5' }, { san: 'd6' }], humanColor: 'b' };
  trainer.start(record, moments, 0);

  assert.equal(h.$('#reviewTrainerPosition').text(), 'Момент 1 из 2');
  assert.equal(trainer.tryMove('c7', 'c5'), true);

  trainer.nextMoment();
  assert.equal(h.$('#reviewTrainerPosition').text(), 'Момент 2 из 2');
  assert.equal(h.store.getState().game.fen(), fens[1]);
  assert.equal(trainer.isCompleted(), false);

  // Solve moment 2
  assert.equal(trainer.tryMove('b8', 'c6'), true);
  trainer.nextMoment();

  assert.ok(h.$('#reviewTrainerPrompt').text().includes('Все ключевые моменты пройдены'));
  assert.deepEqual(completedStats, { total: 2, firstTry: 2, solved: 2 });

  h.close();
});

test('exit() cleans up state, removes arrows/highlights, hides trainer card', () => {
  const h = createHarness();
  const trainer = createReviewTrainerController({
    $: h.$,
    Chess: h.Chess,
    store: h.store,
    eventBus: h.eventBus,
    boardView: h.boardView,
    moveHistoryView: h.moveHistoryView,
    playSound: h.playSound,
    playSoundForMove: h.playSoundForMove
  });

  const fens = [
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  ];
  const moments = [
    { ply: 0, san: 'e5', bestMove: 'c7c5' }
  ];
  const record = { fens, moves: [{ san: 'e5' }], humanColor: 'b' };
  trainer.start(record, moments, 0);
  trainer.requestHint();

  assert.equal(trainer.isActive(), true);
  trainer.exit();

  assert.equal(trainer.isActive(), false);
  assert.equal(h.$('#reviewTrainerCard').prop('hidden'), true);
  assert.equal(h.store.getState().mode, 'free');

  h.close();
});

test('pawn promotion matches target piece in bestMove', () => {
  const h = createHarness();
  const trainer = createReviewTrainerController({
    $: h.$,
    Chess: h.Chess,
    store: h.store,
    eventBus: h.eventBus,
    boardView: h.boardView,
    moveHistoryView: h.moveHistoryView,
    playSound: h.playSound,
    playSoundForMove: h.playSoundForMove
  });

  const fen = 'k7/4P3/2K5/8/8/8/8/8 w - - 0 1';
  const moments = [
    { ply: 0, san: 'e8=R', bestMove: 'e7e8q' }
  ];
  const record = { fens: [fen], moves: [{ san: 'e8=R' }], humanColor: 'w' };
  trainer.start(record, moments, 0);

  // Wrong promotion piece (R instead of Q)
  assert.equal(trainer.tryMove('e7', 'e8', 'r'), false);
  assert.equal(trainer.isCompleted(), false);

  // Correct promotion piece
  assert.equal(trainer.tryMove('e7', 'e8', 'q'), true);
  assert.equal(trainer.isCompleted(), true);
  assert.equal(h.$('#reviewTrainerRefutationBtn').prop('hidden'), true);

  h.close();
});

test('prevMoment() navigates back to previous moment and start() validates inputs', () => {
  const h = createHarness();
  const trainer = createReviewTrainerController({
    $: h.$,
    Chess: h.Chess,
    store: h.store,
    eventBus: h.eventBus,
    boardView: h.boardView,
    moveHistoryView: h.moveHistoryView,
    playSound: h.playSound,
    playSoundForMove: h.playSoundForMove
  });

  // Invalid start calls should be safely ignored
  trainer.start(null, []);
  assert.equal(trainer.isActive(), false);

  trainer.start({ fens: ['8/8/8/8/8/8/8/8 w - - 0 1'] }, [{ ply: 0, bestMove: 'a1a2' }], 5);
  assert.equal(trainer.isActive(), false);

  const fens = [
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
  ];
  const moments = [
    { ply: 0, san: 'e5', bestMove: 'c7c5' },
    { ply: 1, san: 'd6', bestMove: 'b8c6' }
  ];
  const record = { fens, moves: [{ san: 'e5' }, { san: 'd6' }], humanColor: 'b' };
  trainer.start(record, moments, 0);

  trainer.nextMoment();
  assert.equal(h.$('#reviewTrainerPosition').text(), 'Момент 2 из 2');

  trainer.prevMoment();
  assert.equal(h.$('#reviewTrainerPosition').text(), 'Момент 1 из 2');
  assert.equal(h.store.getState().game.fen(), fens[0]);

  // Calling destroy cleans up and unbinds
  trainer.destroy();
  assert.equal(trainer.isActive(), false);

  h.close();
});

