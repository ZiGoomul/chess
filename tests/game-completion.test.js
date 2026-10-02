import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameCompletionCoordinator } from '../src/services/game-completion.js';

test('persists one completed game before starting its review', async () => {
  const calls = [];
  const coordinator = createGameCompletionCoordinator({ repository: { games: { put: async game => calls.push(['put', game.id]) } }, onStartReview: async game => calls.push(['review', game.id]), now: () => 5, createId: () => 'game-1' });
  coordinator.beginGame({ humanColor: 'w' });
  await coordinator.completeGame({ result: '1-0', fens: [] });
  await coordinator.completeGame({ result: '1-0', fens: [] });
  assert.deepEqual(calls, [['put', 'game-1'], ['review', 'game-1']]);
});
