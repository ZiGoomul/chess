import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import jqueryFactory from 'jquery';
import { Chess } from 'chess.js';
import { createEventBus } from '../src/core/event-bus.js';
import { createReviewAnnotations } from '../src/ui/review-annotations.js';
import { createMoveHistoryView } from '../src/ui/move-history.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AFTER_F5 = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

function setup(historyFENs) {
  const calls = { shown: [], cleared: 0 };
  const boardView = {
    showMoveClass: (square, cls) => calls.shown.push({ square, cls }),
    clearMoveClass: () => { calls.cleared += 1; }
  };
  const eventBus = createEventBus();
  const hints = [];
  eventBus.on('engine:hints-updated', data => hints.push(data.hints[1]));
  const annotations = createReviewAnnotations({ Chess, boardView, eventBus, getHistoryFENs: () => historyFENs });
  const record = {
    fens: [START, AFTER_E4, AFTER_F5],
    moves: [{ san: 'e4', from: 'e2', to: 'e4' }, { san: 'f5', from: 'f7', to: 'f5' }]
  };
  const summary = { moves: [{ ply: 0, cls: 'best' }, { ply: 1, cls: 'mistake' }] };
  const evaluations = [{ evaluation: { pv: 'e2e4' } }, { evaluation: { pv: 'e7e5' } }];
  annotations.set(record, summary, evaluations);
  return { annotations, calls, hints };
}

test('review annotations badge the viewed move and point at the better move', () => {
  const { annotations, calls, hints } = setup([START, AFTER_E4, AFTER_F5]);
  assert.equal(annotations.classForPly(1), 'mistake');

  annotations.showForViewPly(2);
  assert.deepEqual(calls.shown, [{ square: 'f5', cls: 'mistake' }]);
  assert.deepEqual(hints, ['e7e5']);

  annotations.showForViewPly(1);
  assert.deepEqual(calls.shown.at(-1), { square: 'e4', cls: 'best' });
  assert.deepEqual(hints, ['e7e5'], 'no arrow when the played move was best');
});

test('review annotations stay silent for a different game', () => {
  const { annotations, calls, hints } = setup([START, AFTER_E4]);
  assert.equal(annotations.classForPly(0), null);
  annotations.showForViewPly(1);
  assert.deepEqual(calls.shown, []);
  assert.deepEqual(hints, []);
  assert.ok(calls.cleared > 0);
});

test('move history shows a class badge next to reviewed moves', () => {
  const { window } = new JSDOM('<!doctype html><body><div id="moveHistoryList"></div></body>');
  const $ = jqueryFactory(window);
  const game = new Chess();
  game.move('e4'); game.move('f5');
  const view = createMoveHistoryView({
    $, game, getBoard: () => null, getHistoryFENs: () => [START, AFTER_E4, AFTER_F5],
    getCurrentViewPly: () => 2, setCurrentViewPly() {}, clearArrows() {}, onPositionChange() {},
    getMoveClass: ply => (ply === 1 ? 'mistake' : null)
  });
  view.updateMoveHistory();
  assert.equal($('.move-class-badge').length, 1);
  assert.equal($('.move-text[data-ply="1"] .move-class-badge').text(), '?');
  assert.match($('.move-text[data-ply="1"]').attr('aria-label'), /\(Ошибка\)$/);
});
