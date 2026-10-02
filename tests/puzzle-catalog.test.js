import test from 'node:test';
import assert from 'node:assert/strict';
import { createPuzzleCatalog } from '../src/services/puzzle-catalog.js';

test('merges built-ins and chooses an unattempted nearby puzzle', async () => {
  const records = new Map([['lichess:one', { id: 'lichess:one', rating: 1200, popularity: 50, themes: ['fork'] }]]);
  const repository = { puzzles: { list: async () => [...records.values()], get: async id => records.get(id), upsertMany: async items => items.forEach(item => records.set(item.id, item)) }, attempts: { listByPuzzleId: async () => [] }, batches: { get: async () => null, put: async () => {} }, clearUserData: async () => records.clear() };
  const catalog = createPuzzleCatalog({ builtIns: [{ id: 'builtin-001', rating: 800, popularity: 1, themes: ['mate'] }], repository });
  assert.equal((await catalog.list()).length, 2);
  assert.equal((await catalog.getRecommendation({ themes: ['fork'], targetRating: 1100 })).id, 'lichess:one');
});
