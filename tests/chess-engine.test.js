import test from 'node:test';
import assert from 'node:assert/strict';
import { createChessEngine, getBotSearchProfile, parseBestMove, parseHintInfo } from '../src/services/chess-engine.ts';

function createMockWorker() {
  return {
    messages: [],
    postMessage(message) { this.messages.push(message); },
    emit(data) { this.onmessage({ data }); }
  };
}

test('calibrates bot search profile across levels 1 to 20', () => {
  assert.deepEqual(getBotSearchProfile(1), { skillLevel: 0, depth: 1 });
  assert.deepEqual(getBotSearchProfile(2), { skillLevel: 1, depth: 2 });
  assert.deepEqual(getBotSearchProfile(3), { skillLevel: 2, depth: 3 });
  assert.deepEqual(getBotSearchProfile(4), { skillLevel: 3, depth: 4 });
  assert.deepEqual(getBotSearchProfile(5), { skillLevel: 5, depth: 5 });
  assert.deepEqual(getBotSearchProfile(10), { skillLevel: 10, depth: 8 });
  assert.deepEqual(getBotSearchProfile(15), { skillLevel: 15, depth: 12 });
  assert.deepEqual(getBotSearchProfile(20), { skillLevel: 20, depth: 16 });
});

test('sends calibrated Skill Level and depth commands to gameWorker', () => {
  const gameWorker = createMockWorker();
  const hintWorker = createMockWorker();
  const engine = createChessEngine({
    gameWorker,
    hintWorker,
    getCurrentFen: () => 'fen-one',
    onBotMove() {},
    onBotThinkingChange() {},
    onHint() {},
    onHintComplete() {}
  });

  engine.requestBotMove('fen-one', 1);
  assert.deepEqual(gameWorker.messages, [
    'setoption name Skill Level value 0',
    'position fen fen-one',
    'go depth 1'
  ]);
});

test('parses bestmove and defaults promotion to queen', () => {
  assert.deepEqual(parseBestMove('bestmove e7e8'), {
    from: 'e7',
    to: 'e8',
    promotion: 'q'
  });
  assert.deepEqual(parseBestMove('bestmove a7a8n'), {
    from: 'a7',
    to: 'a8',
    promotion: 'n'
  });
});

test('rejects missing or invalid bestmove coordinates', () => {
  assert.equal(parseBestMove('bestmove (none)'), null);
  assert.equal(parseBestMove('bestmove z9a1'), null);
});

test('parses MultiPV move and centipawn score', () => {
  assert.deepEqual(parseHintInfo('info depth 12 multipv 2 score cp -34 nodes 100 pv g1f3 d7d5'), {
    multipv: 2,
    move: 'g1f3',
    cp: -34,
    mate: null
  });
  assert.deepEqual(parseHintInfo('info depth 10 multipv 1 score cp 500 pv e7e8q e1e2'), {
    multipv: 1,
    move: 'e7e8q',
    cp: 500,
    mate: null
  });
});

test('parses mate score and ignores unrelated UCI lines', () => {
  assert.deepEqual(parseHintInfo('info depth 9 multipv 1 score mate 3 pv c2c4 a7a5'), {
    multipv: 1,
    move: 'c2c4',
    cp: null,
    mate: 3
  });
  assert.equal(parseHintInfo('bestmove e2e4'), null);
});

test('ignores a canceled bot result and accepts the latest search', () => {
  const gameWorker = createMockWorker();
  const hintWorker = createMockWorker();
  const appliedMoves = [];
  let currentFen = 'fen-one';
  const engine = createChessEngine({
    gameWorker,
    hintWorker,
    getCurrentFen: () => currentFen,
    onBotMove: move => appliedMoves.push(move),
    onBotThinkingChange() {},
    onHint() {},
    onHintComplete() {}
  });

  engine.requestBotMove('fen-one', 5);
  engine.cancelBotMove();
  currentFen = 'fen-two';
  engine.requestBotMove('fen-two', 5);

  gameWorker.emit('bestmove e2e4');
  assert.deepEqual(appliedMoves, []);
  assert.equal(engine.isThinking, true);

  gameWorker.emit('bestmove d2d4');
  assert.deepEqual(appliedMoves, [{ from: 'd2', to: 'd4', promotion: 'q' }]);
  assert.equal(engine.isThinking, false);
});

test('drains a canceled hint response before accepting the new search', () => {
  const gameWorker = createMockWorker();
  const hintWorker = createMockWorker();
  const hints = [];
  let currentFen = 'fen-one';
  const engine = createChessEngine({
    gameWorker,
    hintWorker,
    getCurrentFen: () => currentFen,
    onBotMove() {},
    onBotThinkingChange() {},
    onHint: info => hints.push(info),
    onHintComplete() {}
  });

  engine.requestHint('fen-one', 5);
  engine.requestHint('fen-two', 5);
  currentFen = 'fen-two';
  hintWorker.emit('bestmove e2e4');
  hintWorker.emit('info depth 8 multipv 1 score cp 25 pv g1f3');

  assert.deepEqual(hints, [{ multipv: 1, move: 'g1f3', cp: 25, mate: null }]);
});
