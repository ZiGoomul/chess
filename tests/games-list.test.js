import test from 'node:test';
import assert from 'node:assert/strict';
import { describeGame } from '../src/ui/games-list.js';

test('a games-list row names the outcome, reason, bot level and length', () => {
  const info = describeGame({ humanColor: 'b', result: '0-1', endReason: 'checkmate', botLevel: 10, moves: new Array(41).fill({}) }, null);
  assert.equal(info.outcome, 'win');
  assert.equal(info.title, 'Победа · мат');
  assert.equal(info.meta, 'Бот · ур. 10 · 21 ход');
  assert.equal(info.score, '1');
  assert.equal(info.accuracy, null);
});

test('draws keep their specific reason and losses by resignation say so', () => {
  assert.equal(describeGame({ humanColor: 'w', result: '1/2-1/2', endReason: 'draw', endDetail: 'пат', moves: [] }).title, 'Ничья · пат');
  assert.equal(describeGame({ humanColor: 'w', result: '0-1', endReason: 'resign', moves: [{}, {}] }).title, 'Поражение · вы сдались');
});
