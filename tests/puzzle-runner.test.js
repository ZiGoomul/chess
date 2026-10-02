import test from 'node:test';
import assert from 'node:assert/strict';
import { applyUciMove, moveToUci, parseUciMove } from '../src/services/puzzle-runner.js';

test('parses and applies canonical UCI moves', () => {
  assert.deepEqual(parseUciMove('e7e8q'), { from: 'e7', to: 'e8', promotion: 'q' });
  assert.equal(parseUciMove('e2-e4'), null);
  assert.equal(moveToUci({ from: 'e2', to: 'e4' }), 'e2e4');
  const calls = [];
  assert.deepEqual(applyUciMove({ move: move => { calls.push(move); return move; } }, 'e2e4'), { from: 'e2', to: 'e4' });
  assert.deepEqual(calls, [{ from: 'e2', to: 'e4' }]);
});
