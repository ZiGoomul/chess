import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './helpers/harness.js';
import { createPostGameReviewView } from '../src/ui/post-game-review.js';

test('post-game review view allows selecting a moment and playing from it or playing best move', () => {
  const h = createHarness();
  const selectCalls = [];
  const playFromCalls = [];
  const playBestMoveCalls = [];

  const view = createPostGameReviewView({
    $: h.$,
    toSan: (_fen, uci) => uci === 'g1f3' ? 'Nf3' : uci,
    onSelectMoment: (record, moment) => selectCalls.push({ record, moment }),
    onCancel: () => {},
    onRetry: () => {},
    onSolvePuzzle: () => {},
    onPlayFromMoment: (record, moment) => playFromCalls.push({ record, moment }),
    onPlayBestMove: (record, moment) => playBestMoveCalls.push({ record, moment })
  });

  const record = {
    id: 'game-1',
    humanColor: 'w',
    fens: ['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'],
    moves: [{ san: 'e4' }, { san: 'e5' }]
  };
  const moment = {
    ply: 1,
    san: 'e5',
    lossCp: 120,
    beforeCp: 30,
    afterCp: -90,
    bestMove: 'g1f3'
  };
  const report = {
    gameId: 'game-1',
    status: 'complete',
    moments: [moment]
  };

  view.showReport(report, record, null);

  assert.equal(h.$('#reviewMomentsTitle').prop('hidden'), false);
  assert.equal(h.$('#openLastReviewBtn').prop('hidden'), false);
  assert.match(h.$('#reviewMoments li button').text(), /^\?!1… e5Лучше Nf3 · оценка \+0\.3 → −0\.9$/);
  assert.equal(h.$('#reviewMoments li').length, 1);
  assert.equal(h.$('#reviewPlayFromBtn').prop('hidden'), true);
  assert.equal(h.$('#reviewPlayBestMoveBtn').prop('hidden'), true);

  // Click the moment
  h.$('#reviewMoments li button').trigger('click');

  assert.equal(selectCalls.length, 1);
  assert.equal(selectCalls[0].moment.ply, 1);
  assert.equal(h.$('#reviewPlayFromBtn').prop('hidden'), false);
  assert.equal(h.$('#reviewPlayFromBtn').text(), 'Доиграть отсюда');
  assert.equal(h.$('#reviewPlayBestMoveBtn').prop('hidden'), false);
  assert.equal(h.$('#reviewPlayBestMoveBtn').text(), 'Сыграть Nf3');

  // Click "Доиграть с этой позиции"
  h.$('#reviewPlayFromBtn').trigger('click');
  assert.equal(playFromCalls.length, 1);
  assert.equal(playFromCalls[0].moment.ply, 1);
  assert.equal(h.$('#reviewPlayFromBtn').prop('hidden'), true);

  // Click moment again and click "Сыграть лучший ход"
  h.$('#reviewMoments li button').trigger('click');
  assert.equal(h.$('#reviewPlayBestMoveBtn').prop('hidden'), false);
  h.$('#reviewPlayBestMoveBtn').trigger('click');
  assert.equal(playBestMoveCalls.length, 1);
  assert.equal(playBestMoveCalls[0].moment.ply, 1);
  assert.equal(h.$('#reviewPlayBestMoveBtn').prop('hidden'), true);

  h.close();
});

import { evalGraphPath } from '../src/ui/post-game-review.js';

test('evaluation graph path fills from the bottom and carries over missing scores', () => {
  assert.equal(evalGraphPath([]), '');
  assert.equal(evalGraphPath([0, null]), 'M0 80 L0.0 40.0 L400.0 40.0 L400 80 Z');
});

test('completed review shows accuracy and move classes for the human and the bot', () => {
  const h = createHarness();
  const view = createPostGameReviewView({
    $: h.$, toSan: () => null, onSelectMoment() {}, onCancel() {}, onRetry() {}, onSolvePuzzle() {}
  });
  const record = {
    id: 'game-2',
    humanColor: 'w',
    fens: ['x w - - 0 1', 'x b - - 0 1', 'x w - - 0 2'],
    moves: [{ san: 'e4', from: 'e2', to: 'e4' }, { san: 'Qh4', from: 'd8', to: 'h4' }]
  };
  const evaluations = [
    { evaluation: { type: 'cp', value: 30, pv: 'e2e4' } },
    { evaluation: { type: 'cp', value: -30, pv: 'e7e5' } },
    { evaluation: { type: 'cp', value: 400, pv: 'd1h5' } }
  ];

  view.showReport({ gameId: 'game-2', status: 'complete', evaluations, moments: [] }, record, null);

  assert.equal(h.$('#reviewSummary').prop('hidden'), false);
  assert.equal(h.$('#reviewAccuracyYou').text(), '100.0');
  assert.equal(h.$('#reviewClassChips li').length, 6);
  assert.equal(h.$('#reviewClassChips .review-class--best').text(), '★Лучший · 1');
  assert.equal(h.$('#reviewClassChips .review-class--blunder').text(), '??Зевок · 0');
  assert.match(h.$('#reviewEvalArea').attr('d'), /^M0 80 /);
});

test('key moments are listed in game order and can be stepped through', () => {
  const h = createHarness();
  const selected = [];
  const view = createPostGameReviewView({
    $: h.$, toSan: () => null, onSelectMoment: (_record, moment) => selected.push(moment.ply), onCancel() {}, onRetry() {}, onSolvePuzzle() {}
  });
  const record = { id: 'g', humanColor: 'w', fens: ['x w - - 0 1'], moves: [] };
  const moments = [
    { ply: 20, san: 'Qxb7', lossCp: 300, beforeCp: -40, afterCp: -310 },
    { ply: 8, san: 'h3', lossCp: 150, beforeCp: 60, afterCp: -90 }
  ];
  view.showReport({ gameId: 'g', status: 'complete', moments }, record, null);

  assert.deepEqual(h.$('#reviewMoments strong').map((_, el) => h.$(el).text()).get(), ['5. h3', '11. Qxb7']);
  assert.equal(h.$('#reviewMomentNav').prop('hidden'), false);

  h.$('#reviewNextMomentBtn').trigger('click');
  assert.equal(h.$('#reviewMomentPosition').text(), 'Момент 1 из 2');
  h.$('#reviewNextMomentBtn').trigger('click');
  assert.equal(h.$('#reviewMomentPosition').text(), 'Момент 2 из 2');
  assert.equal(h.$('#reviewNextMomentBtn').prop('disabled'), true);
  assert.deepEqual(selected, [8, 20]);
  h.close();
});

test('post-game review view displays start practice button and triggers onStartPractice', () => {
  const h = createHarness();
  let practiceCalledWith = null;
  const view = createPostGameReviewView({
    $: h.$,
    toSan: () => null,
    onSelectMoment: () => {},
    onCancel: () => {},
    onRetry: () => {},
    onSolvePuzzle: () => {},
    onStartPractice: (record, moments) => {
      practiceCalledWith = { record, moments };
    }
  });

  const record = {
    id: 'game-practice-1',
    humanColor: 'w',
    fens: ['fen-0', 'fen-1'],
    moves: [{ san: 'e4' }]
  };
  const moments = [
    { ply: 1, san: 'e5', lossCp: 150, beforeCp: 30, afterCp: -120, bestMove: 'g1f3' }
  ];
  const report = {
    gameId: 'game-practice-1',
    status: 'complete',
    moments
  };

  view.showReport(report, record, null);

  const startBtn = h.$('#reviewStartPracticeBtn');
  assert.equal(startBtn.prop('hidden'), false);
  assert.equal(startBtn.text(), 'Работа над ошибками (1)');

  startBtn.trigger('click');
  assert.ok(practiceCalledWith);
  assert.equal(practiceCalledWith.record.id, 'game-practice-1');
  assert.equal(practiceCalledWith.moments.length, 1);
  assert.equal(practiceCalledWith.moments[0].ply, 1);

  h.close();
});

test('selecting a moment shows practice moment button and triggers onPracticeMoment', () => {
  const h = createHarness();
  let practicedMoment = null;
  const view = createPostGameReviewView({
    $: h.$,
    toSan: () => null,
    onSelectMoment: () => {},
    onCancel: () => {},
    onRetry: () => {},
    onSolvePuzzle: () => {},
    onPracticeMoment: (record, moment) => {
      practicedMoment = { record, moment };
    }
  });

  const record = {
    id: 'game-practice-2',
    humanColor: 'w',
    fens: ['fen-0', 'fen-1'],
    moves: [{ san: 'e4' }]
  };
  const moment = { ply: 1, san: 'e5', lossCp: 150, beforeCp: 30, afterCp: -120, bestMove: 'g1f3' };
  view.showReport({ gameId: 'game-practice-2', status: 'complete', moments: [moment] }, record, null);

  const practiceMomentBtn = h.$('#reviewPracticeMomentBtn');
  assert.equal(practiceMomentBtn.prop('hidden'), true);

  // Click the moment
  h.$('#reviewMoments li button').trigger('click');
  assert.equal(practiceMomentBtn.prop('hidden'), false);
  assert.equal(practiceMomentBtn.text(), 'Исправить этот момент');

  practiceMomentBtn.trigger('click');
  assert.ok(practicedMoment);
  assert.equal(practicedMoment.record.id, 'game-practice-2');
  assert.equal(practicedMoment.moment.ply, 1);
  assert.equal(practiceMomentBtn.prop('hidden'), true);

  h.close();
});

test('showPracticeCard and hidePracticeCard toggle practice card and moments list', () => {
  const h = createHarness();
  const view = createPostGameReviewView({
    $: h.$,
    toSan: () => null,
    onSelectMoment: () => {},
    onCancel: () => {},
    onRetry: () => {},
    onSolvePuzzle: () => {}
  });

  const record = { id: 'game-practice-3', humanColor: 'w', fens: ['fen-0', 'fen-1'], moves: [] };
  const moments = [
    { ply: 1, san: 'e5', lossCp: 150, beforeCp: 30, afterCp: -120, bestMove: 'g1f3' },
    { ply: 3, san: 'd5', lossCp: 200, beforeCp: 10, afterCp: -190, bestMove: 'd2d4' }
  ];
  view.showReport({ gameId: 'game-practice-3', status: 'complete', moments }, record, null);

  assert.equal(h.$('#reviewMoments').prop('hidden'), false);
  assert.equal(h.$('#reviewMomentsTitle').prop('hidden'), false);
  assert.equal(h.$('#reviewStartPracticeBtn').prop('hidden'), false);
  assert.equal(h.$('#reviewTrainerCard').prop('hidden'), true);

  view.showPracticeCard();

  assert.equal(h.$('#reviewMoments').prop('hidden'), true);
  assert.equal(h.$('#reviewMomentsTitle').prop('hidden'), true);
  assert.equal(h.$('#reviewMomentNav').prop('hidden'), true);
  assert.equal(h.$('#reviewStartPracticeBtn').prop('hidden'), true);
  assert.equal(h.$('#reviewTrainerCard').prop('hidden'), false);

  view.hidePracticeCard();

  assert.equal(h.$('#reviewMoments').prop('hidden'), false);
  assert.equal(h.$('#reviewMomentsTitle').prop('hidden'), false);
  assert.equal(h.$('#reviewMomentNav').prop('hidden'), false);
  assert.equal(h.$('#reviewStartPracticeBtn').prop('hidden'), false);
  assert.equal(h.$('#reviewTrainerCard').prop('hidden'), true);

  h.close();
});
