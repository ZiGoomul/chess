export function createGameCompletionCoordinator({ repository, onStartReview, now = () => Date.now(), createId = () => globalThis.crypto?.randomUUID?.() || `game-${now()}` }) {
  let current = null;
  let completed = null;
  return {
    beginGame(metadata) {
      if (!current) current = { id: createId(), startedAt: now(), ...metadata };
      return current.id;
    },
    async completeGame(outcome) {
      if (!current) return null;
      if (completed) return completed;
      completed = { ...current, ...outcome, completedAt: now() };
      await repository.games.put(completed);
      await onStartReview(completed);
      return completed;
    },
    reset() { current = null; completed = null; },
    get currentGameId() { return current?.id || null; }
  };
}
