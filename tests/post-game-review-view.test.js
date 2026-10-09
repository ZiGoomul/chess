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

  assert.match(h.$('#reviewStatus').text(), /^Разбор готов\. Ключевые моменты \(1\):/);
  assert.equal(h.$('#reviewMoments li').length, 1);
  assert.equal(h.$('#reviewPlayFromBtn').prop('hidden'), true);
  assert.equal(h.$('#reviewPlayBestMoveBtn').prop('hidden'), true);

  // Click the moment
  h.$('#reviewMoments li button').trigger('click');

  assert.equal(selectCalls.length, 1);
  assert.equal(selectCalls[0].moment.ply, 1);
  assert.equal(h.$('#reviewPlayFromBtn').prop('hidden'), false);
  assert.equal(h.$('#reviewPlayFromBtn').text(), 'Доиграть с этой позиции');
  assert.equal(h.$('#reviewPlayBestMoveBtn').prop('hidden'), false);
  assert.match(h.$('#reviewPlayBestMoveBtn').text(), /Сыграть лучший ход \(Nf3\)/);

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
