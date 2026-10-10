/**
 * @typedef {{ themes?: string[], minRating?: number, maxRating?: number, targetRating?: number, theme?: string }} PuzzleFilter
 */

/**
 * @param {any} puzzle
 * @param {PuzzleFilter} [filter]
 */
function matches(puzzle, { themes, minRating, maxRating } = {}) {
  return (!themes?.length || themes.every(theme => puzzle.themes?.includes(theme))) &&
    (minRating == null || puzzle.rating >= minRating) && (maxRating == null || puzzle.rating <= maxRating);
}

const ONLINE_ATTEMPTS = 3;

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Puzzles come from an online source when one is given (each one is saved locally),
 * otherwise from saved puzzles, preferring unsolved ones; the bundled batches seed an
 * empty offline catalog.
 */
export function createPuzzleCatalog({ builtIns, repository, onlineSource = null, fetchImpl = fetch, manifestUrl = '/puzzles/lichess/manifest.json' }) {
  async function list(filters = {}) {
    const imported = await repository.puzzles.list(filters);
    const byId = new Map(builtIns.filter(puzzle => matches(puzzle, filters)).map(puzzle => [puzzle.id, puzzle]));
    imported.forEach(puzzle => byId.set(puzzle.id, puzzle));
    return [...byId.values()];
  }
  async function solvedIds() {
    const attempts = await repository.attempts.list?.() || [];
    return new Set(attempts.filter(attempt => attempt.solved).map(attempt => attempt.puzzleId));
  }

  /** @param {PuzzleFilter} [filter] */
  async function loadBatch({ theme } = {}) {
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
  }

  async function nextOffline({ theme }, exclude) {
    const filters = theme ? { themes: [theme] } : {};
    let saved = await list(filters);
    if (!saved.length) {
      try {
        while ((await loadBatch({ theme })).batchId) { /* bundled batches until none are left */ }
      } catch { /* no bundled batches available */ }
      saved = await list(filters);
    }
    const solved = await solvedIds();
    const fresh = saved.filter(puzzle => !solved.has(puzzle.id) && puzzle.id !== exclude);
    const pool = fresh.length ? fresh : saved.filter(puzzle => puzzle.id !== exclude);
    return pool.length ? pickRandom(pool) : null;
  }

  return {
    list,
    async getCounts() {
      const imported = await repository.puzzles.list();
      const solved = await solvedIds();
      return {
        total: new Set([...builtIns, ...imported].map(puzzle => puzzle.id)).size,
        imported: imported.length,
        builtIn: builtIns.length,
        solved: solved.size
      };
    },
    /**
     * The next puzzle to solve: { puzzle, source: 'online' | 'offline' | 'none', error }.
     * @param {{ theme?: string, difficulty?: string, exclude?: string }} [options]
     */
    async next({ theme, difficulty, exclude } = {}) {
      let error = null;
      if (onlineSource) {
        const solved = await solvedIds();
        for (let attempt = 0; attempt < ONLINE_ATTEMPTS; attempt++) {
          try {
            const puzzle = await onlineSource.next({ theme, difficulty });
            if ((solved.has(puzzle.id) || puzzle.id === exclude) && attempt < ONLINE_ATTEMPTS - 1) continue;
            await repository.puzzles.upsertMany([puzzle]);
            return { puzzle, source: 'online', error: null };
          } catch (caught) {
            error = caught;
            break;
          }
        }
      }
      const puzzle = await nextOffline({ theme }, exclude);
      return { puzzle, source: puzzle ? 'offline' : 'none', error };
    },
    /** @param {PuzzleFilter} [filter] */
    loadNextBatch: loadBatch,
    /** @param {PuzzleFilter} [filter] */
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
