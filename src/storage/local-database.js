const STORE_NAMES = ['puzzles', 'attempts', 'batches', 'games', 'reviews'];

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
  });
}

export async function openLocalDatabase({ indexedDB = globalThis.indexedDB, databaseName = 'chess-studies' } = {}) {
  if (!indexedDB) throw new Error('IndexedDB is unavailable');
  const request = indexedDB.open(databaseName, 1);
  request.onupgradeneeded = () => {
    const database = request.result;
    const puzzles = database.createObjectStore('puzzles', { keyPath: 'id' });
    puzzles.createIndex('rating', 'rating');
    puzzles.createIndex('themes', 'themes', { multiEntry: true });
    database.createObjectStore('attempts', { keyPath: 'id' }).createIndex('puzzleId', 'puzzleId');
    database.createObjectStore('batches', { keyPath: 'id' });
    database.createObjectStore('games', { keyPath: 'id' }).createIndex('completedAt', 'completedAt');
    database.createObjectStore('reviews', { keyPath: 'gameId' });
  };
  const database = await requestResult(request);

  function read(storeName, action) {
    const transaction = database.transaction(storeName, 'readonly');
    const result = action(transaction.objectStore(storeName));
    return requestResult(result);
  }
  async function write(storeNames, action) {
    const transaction = database.transaction(storeNames, 'readwrite');
    action(transaction);
    await transactionDone(transaction);
  }
  return {
    puzzles: {
      get: id => read('puzzles', store => store.get(id)),
      list: async ({ themes, minRating, maxRating } = {}) => {
        const all = await read('puzzles', store => store.getAll());
        return all.filter(puzzle =>
          (!themes?.length || themes.every(theme => puzzle.themes?.includes(theme))) &&
          (minRating == null || puzzle.rating >= minRating) &&
          (maxRating == null || puzzle.rating <= maxRating));
      },
      upsertMany: async items => {
        await write('puzzles', transaction => items.forEach(item => transaction.objectStore('puzzles').put(item)));
      },
      deleteBySource: async source => {
        const records = await read('puzzles', store => store.getAll());
        await write('puzzles', transaction => records.filter(record => record.source === source).forEach(record => transaction.objectStore('puzzles').delete(record.id)));
      },
      deleteMany: async ids => {
        await write('puzzles', transaction => ids.forEach(id => transaction.objectStore('puzzles').delete(id)));
      }
    },
    attempts: {
      add: async attempt => {
        const record = { id: globalThis.crypto?.randomUUID?.() || `attempt-${Date.now()}-${Math.random()}`, ...attempt };
        await write('attempts', transaction => transaction.objectStore('attempts').put(record));
        return record;
      },
      listByPuzzleId: puzzleId => read('attempts', store => store.index('puzzleId').getAll(puzzleId))
    },
    batches: {
      get: id => read('batches', store => store.get(id)),
      put: async batch => { await write('batches', transaction => transaction.objectStore('batches').put(batch)); }
    },
    games: {
      put: async game => { await write('games', transaction => transaction.objectStore('games').put(game)); },
      get: id => read('games', store => store.get(id)),
      listRecent: async (limit = 20) => (await read('games', store => store.getAll())).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).slice(0, limit)
    },
    reviews: {
      put: async review => { await write('reviews', transaction => transaction.objectStore('reviews').put(review)); },
      get: gameId => read('reviews', store => store.get(gameId))
    },
    async clearUserData() { await write(STORE_NAMES, transaction => STORE_NAMES.forEach(name => transaction.objectStore(name).clear())); },
    close() { database.close(); }
  };
}
