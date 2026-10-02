import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostGameReviewCoordinator } from '../src/services/post-game-review.js';

const W = 'x w - - 0 1';
const B = 'x b - - 0 1';

function createRepository(game) {
  const reviews = [];
  return { reviews: { put: async review => reviews.push(review) }, games: { get: async () => game }, saved: reviews };
}

function stubReview(result) {
  return { analyze: async () => result, cancel() {} };
}

const record = { id: 'g1', humanColor: 'w', botLevel: 5, fens: [W, B], moves: [{ san: 'Qh5' }] };

test('persists a completed report without a puzzle match', async () => {
  const repository = createRepository(record);
  const catalog = { getRecommendation: async () => null };
  const coordinator = createPostGameReviewCoordinator({ repository, reviewService: stubReview({ status: 'complete', evaluations: [] }), getPuzzleCatalog: () => catalog });
  const report = await coordinator.start(record);
  assert.deepEqual(repository.saved.map(item => item.status), ['analyzing', 'complete']);
  assert.deepEqual(report.moments, []);
  assert.equal(report.recommendation, null);
});

test('uses a motif puzzle when the theme matches and falls back otherwise', async () => {
  const evaluations = [{ evaluation: { type: 'mate', value: 1, pv: 'd1f7' } }, { evaluation: { type: 'cp', value: 0, pv: null } }];
  const requests = [];
  const catalog = { getRecommendation: async ({ themes, targetRating }) => { requests.push([themes, targetRating]); return themes ? { id: 'mate-1' } : { id: 'any' }; } };
  const coordinator = createPostGameReviewCoordinator({ repository: createRepository(record), reviewService: stubReview({ status: 'complete', evaluations }), getPuzzleCatalog: () => catalog });
  const report = await coordinator.start(record);
  assert.deepEqual(report.recommendation, { puzzleId: 'mate-1', reason: 'motif', themes: ['mate'] });
  assert.deepEqual(requests, [[['mate'], 1200]]);

  catalog.getRecommendation = async ({ themes }) => (themes ? null : { id: 'any' });
  assert.equal((await coordinator.start(record)).recommendation.reason, 'general');
});

test('stores cancelled reviews and retries from the saved game', async () => {
  const repository = createRepository(record);
  const results = [{ status: 'cancelled', evaluations: [] }, { status: 'complete', evaluations: [] }];
  const coordinator = createPostGameReviewCoordinator({ repository, reviewService: { analyze: async () => results.shift(), cancel() {} } });
  assert.equal((await coordinator.start(record)).status, 'cancelled');
  assert.equal((await coordinator.retry('g1')).status, 'complete');
  assert.deepEqual(repository.saved.map(item => item.status), ['analyzing', 'cancelled', 'analyzing', 'complete']);
});
