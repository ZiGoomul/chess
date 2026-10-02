function matches(puzzle, { themes, minRating, maxRating } = {}) {
  return (!themes?.length || themes.every(theme => puzzle.themes?.includes(theme))) &&
    (minRating == null || puzzle.rating >= minRating) && (maxRating == null || puzzle.rating <= maxRating);
}

export function createPuzzleCatalog({ builtIns, repository, fetchImpl = fetch, manifestUrl = '/puzzles/lichess/manifest.json' }) {
  async function list(filters = {}) {
    const imported = await repository.puzzles.list(filters);
    const byId = new Map(builtIns.filter(puzzle => matches(puzzle, filters)).map(puzzle => [puzzle.id, puzzle]));
    imported.forEach(puzzle => byId.set(puzzle.id, puzzle));
    return [...byId.values()];
  }
  return {
    list,
    async getCounts() {
      const imported = await repository.puzzles.list();
      return { total: new Set([...builtIns, ...imported].map(puzzle => puzzle.id)).size, imported: imported.length, builtIn: builtIns.length };
    },
    async loadNextBatch({ theme } = {}) {
      const manifestResponse = await fetchImpl(manifestUrl);
      if (!manifestResponse.ok) throw new Error(`Could not load puzzle manifest (${manifestResponse.status})`);
      const manifest = await manifestResponse.json();
      let batch;
      for (const candidate of manifest.batches || []) {
        if ((!theme || candidate.themes?.includes(theme)) && !await repository.batches.get(candidate.id)) { batch = candidate; break; }
      }
      if (!batch) return { added: 0, updated: 0, skipped: 0, batchId: null };
      const baseUrl = new URL(manifestUrl, globalThis.location?.href || 'http://localhost/');
      const response = await fetchImpl(new URL(batch.file, baseUrl).toString());
      if (!response.ok) throw new Error(`Could not load puzzle batch (${response.status})`);
      const puzzles = await response.json();
      let added = 0, updated = 0, skipped = 0;
      for (const puzzle of puzzles) {
        const existing = await repository.puzzles.get(puzzle.id);
        if (existing && JSON.stringify(existing) === JSON.stringify(puzzle)) skipped++;
        else if (existing) updated++;
        else added++;
      }
      await repository.puzzles.upsertMany(puzzles);
      await repository.batches.put({ id: batch.id, catalogVersion: manifest.catalogVersion, loadedAt: Date.now() });
      return { added, updated, skipped, batchId: batch.id };
    },
    async getRecommendation({ themes, targetRating } = {}) {
      const puzzles = await list({ themes });
      const scored = await Promise.all(puzzles.map(async puzzle => ({ puzzle, attempts: await repository.attempts.listByPuzzleId(puzzle.id) })));
      const candidates = scored.filter(({ attempts }) => attempts.length === 0);
      const source = candidates.length ? candidates : scored;
      if (!source.length) return null;
      source.sort((a, b) => Math.abs((a.puzzle.rating || targetRating || 0) - (targetRating || a.puzzle.rating || 0)) - Math.abs((b.puzzle.rating || targetRating || 0) - (targetRating || b.puzzle.rating || 0)) || (b.puzzle.popularity || 0) - (a.puzzle.popularity || 0));
      return source[0].puzzle;
    },
    clearLocalData: () => repository.clearUserData(),
    removePuzzles: ids => repository.puzzles.deleteMany(ids)
  };
}
