import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameReviewService, parseReviewEvaluation } from '../src/services/game-review.js';

test('parses UCI score lines and analyzes positions sequentially', async () => {
  assert.deepEqual(parseReviewEvaluation('info depth 10 score cp 34 pv e2e4'), { type: 'cp', value: 34, pv: 'e2e4' });
  const messages = [];
  const worker = { postMessage: message => messages.push(message), onmessage: null };
  const review = createGameReviewService({ worker });
  const pending = review.analyze({ fens: ['fen-a', 'fen-b'] });
  worker.onmessage({ data: 'info depth 10 score cp 10 pv e2e4' }); worker.onmessage({ data: 'bestmove e2e4' });
  worker.onmessage({ data: 'info depth 10 score mate -2 pv e7e5' }); worker.onmessage({ data: 'bestmove e7e5' });
  const report = await pending;
  assert.equal(report.status, 'complete');
  assert.equal(report.evaluations.length, 2);
  assert.deepEqual(messages.filter(message => message.startsWith('position')), ['position fen fen-a', 'position fen fen-b']);
});

import { classifySupportedMotif, findCriticalMoments, toWhitePerspective } from '../src/services/game-review.js';

const W = 'x w - - 0 1';
const B = 'x b - - 0 1';
const cp = value => ({ type: 'cp', value, pv: 'e2e4' });
const mate = value => ({ type: 'mate', value, pv: 'd1h5' });

test('parses mate 0 lines without a principal variation', () => {
  assert.deepEqual(parseReviewEvaluation('info depth 0 score mate 0'), { type: 'mate', value: 0, pv: null });
  assert.equal(parseReviewEvaluation('readyok'), null);
});

test('normalizes evaluations for white and black movers', () => {
  assert.equal(toWhitePerspective(cp(50), W), 50);
  assert.equal(toWhitePerspective(cp(50), B), -50);
  assert.ok(toWhitePerspective(mate(2), B) < -1000);
  assert.ok(toWhitePerspective(mate(0), W) < -1000);
  assert.equal(toWhitePerspective(cp(5000), W), 1000);
});

test('flags only human moves at or above the threshold, capped and ranked', () => {
  const fens = [W, B, W, B, W, B, W, B, W];
  const moves = fens.slice(1).map((_, index) => ({ san: `m${index}` }));
  // White-to-move scores are white's view; black-to-move scores are black's view.
  const scores = [cp(0), cp(79), cp(0), cp(80), cp(0), cp(300), cp(0), cp(-500), cp(0)];
  const evaluations = scores.map((evaluation, index) => ({ fen: fens[index], evaluation }));
  const moments = findCriticalMoments({ record: { fens, moves, humanColor: 'w' }, evaluations });
  assert.deepEqual(moments.map(moment => [moment.ply, moment.lossCp]), [[4, 300], [2, 80]]);
  assert.ok(moments.every(moment => moment.ply % 2 === 0));

  const blackMoments = findCriticalMoments({ record: { fens, moves, humanColor: 'b' }, evaluations, limit: 1 });
  assert.equal(blackMoments.length, 1);
});

test('classifies forced-mate changes and nothing else', () => {
  assert.deepEqual(classifySupportedMotif({ before: mate(2), after: cp(-100) }), { themes: ['mate'], confidence: 'high', kind: 'missed-mate' });
  assert.deepEqual(classifySupportedMotif({ before: cp(0), after: mate(3) }), { themes: ['mate'], confidence: 'high', kind: 'allowed-mate' });
  assert.equal(classifySupportedMotif({ before: cp(0), after: cp(400) }), null);
});

test('ignores stale review responses after cancellation', async () => {
  const worker = { postMessage() {}, onmessage: null };
  const review = createGameReviewService({ worker });
  const first = review.analyze({ fens: ['fen-a', 'fen-b'] });
  review.cancel();
  assert.equal((await first).status, 'cancelled');
  const second = review.analyze({ fens: ['fen-c'] });
  worker.onmessage({ data: 'info depth 10 score cp 999 pv a2a3' });
  worker.onmessage({ data: 'bestmove a2a3' });
  worker.onmessage({ data: 'readyok' });
  worker.onmessage({ data: 'info depth 10 score cp 12 pv e2e4' });
  worker.onmessage({ data: 'bestmove e2e4' });
  const report = await second;
  assert.deepEqual(report.evaluations, [{ fen: 'fen-c', evaluation: { type: 'cp', value: 12, pv: 'e2e4' } }]);
});

test('reports a worker error instead of hanging', async () => {
  const worker = { postMessage() {}, onmessage: null, onerror: null };
  const pending = createGameReviewService({ worker }).analyze({ fens: ['fen-a'] });
  worker.onerror(new Error('load failed'));
  assert.equal((await pending).status, 'error');
});

test('finishes a terminal position that reports depth 0 without bestmove', async () => {
  const messages = [];
  const worker = { postMessage: message => messages.push(message), onmessage: null };
  const pending = createGameReviewService({ worker }).analyze({ fens: ['fen-a', 'fen-mated'] });
  worker.onmessage({ data: 'info depth 10 score mate 1 pv a1a8' });
  worker.onmessage({ data: 'bestmove a1a8' });
  worker.onmessage({ data: 'info depth 0 score mate 0' });
  assert.equal(messages.at(-1), 'isready');
  worker.onmessage({ data: 'readyok' });
  const report = await pending;
  assert.equal(report.status, 'complete');
  assert.deepEqual(report.evaluations[1].evaluation, { type: 'mate', value: 0, pv: null });
});
