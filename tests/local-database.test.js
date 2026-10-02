import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { openLocalDatabase } from '../src/storage/local-database.js';

test('persists catalog records and clears user data', async () => {
  const name = `chess-test-${Date.now()}`;
  const database = await openLocalDatabase({ databaseName: name });
  await database.puzzles.upsertMany([{ id: 'lichess:x', rating: 1200, themes: ['fork'] }]);
  assert.equal((await database.puzzles.get('lichess:x')).rating, 1200);
  await database.attempts.add({ puzzleId: 'lichess:x', completed: true });
  assert.equal((await database.attempts.listByPuzzleId('lichess:x')).length, 1);
  await database.clearUserData();
  assert.equal(await database.puzzles.get('lichess:x'), undefined);
  database.close();
});
