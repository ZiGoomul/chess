import { botLevelToRating, findCriticalMoments } from './game-review.js';

export const REVIEW_ENGINE_VERSION = 'stockfish-10.0.2/depth-10';

export function createPostGameReviewCoordinator({ repository, reviewService, getPuzzleCatalog = () => null, onProgress = () => {}, onReport = () => {} }) {
  async function recommend(record, moments) {
    const catalog = getPuzzleCatalog();
    if (!catalog) return null;
    const targetRating = botLevelToRating(record.botLevel);
    const motif = moments.find(moment => moment.motif)?.motif;
    if (motif) {
      const puzzle = await catalog.getRecommendation({ themes: motif.themes, targetRating });
      if (puzzle) return { puzzleId: puzzle.id, reason: 'motif', themes: motif.themes };
    }
    const puzzle = await catalog.getRecommendation({ targetRating });
    return puzzle ? { puzzleId: puzzle.id, reason: 'general', themes: [] } : null;
  }

  async function start(record) {
    const base = { gameId: record.id, engineVersion: REVIEW_ENGINE_VERSION };
    await repository.reviews.put({ ...base, status: 'analyzing' });
    onProgress({ gameId: record.id, completed: 0, total: record.fens?.length || 0 });
    const result = await reviewService.analyze(record, progress => onProgress({ gameId: record.id, ...progress }));
    let report;
    if (result.status === 'complete') {
      const moments = findCriticalMoments({ record, evaluations: result.evaluations });
      let recommendation = null;
      try { recommendation = await recommend(record, moments); } catch { recommendation = null; }
      report = { ...base, status: 'complete', evaluations: result.evaluations, moments, recommendation, completedAt: Date.now() };
    } else {
      report = { ...base, status: result.status, evaluations: result.evaluations };
    }
    await repository.reviews.put(report);
    onReport(report, record);
    return report;
  }

  return {
    start,
    cancel: () => reviewService.cancel(),
    async retry(gameId) {
      const record = await repository.games.get(gameId);
      if (!record) throw new Error(`Game ${gameId} not found`);
      return start(record);
    }
  };
}
