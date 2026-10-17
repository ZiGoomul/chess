const STORE_NAMES = ['puzzles', 'attempts', 'batches', 'games', 'reviews'];

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(undefined);
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
      /** @param {{ themes?: string[], minRating?: number, maxRating?: number }} [filter] */
      list: async ({ themes, minRating, maxRating } = {}) => {
        let all;
        if (themes && themes.length > 0) {
          all = await read('puzzles', store => store.index('themes').getAll(themes[0]));
        } else {
          all = await read('puzzles', store => store.getAll());
        }
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
      listByPuzzleId: puzzleId => read('attempts', store => store.index('puzzleId').getAll(puzzleId)),
      list: () => read('attempts', store => store.getAll())
    },
    batches: {
      get: id => read('batches', store => store.get(id)),
      put: async batch => { await write('batches', transaction => transaction.objectStore('batches').put(batch)); }
    },
    games: {
      put: async game => { await write('games', transaction => transaction.objectStore('games').put(game)); },
      get: id => read('games', store => store.get(id)),
      listRecent: async (limit = 20) => {
        return new Promise((resolve, reject) => {
          const transaction = database.transaction('games', 'readonly');
          const index = transaction.objectStore('games').index('completedAt');
          const request = index.openCursor(null, 'prev');
          const results = [];
          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor && results.length < limit) {
              results.push(cursor.value);
              cursor.continue();
            } else {
              resolve(results);
            }
          };
          request.onerror = () => reject(request.error || new Error('Failed to read games'));
        });
      }
    },
    reviews: {
      put: async review => { await write('reviews', transaction => transaction.objectStore('reviews').put(review)); },
      get: gameId => read('reviews', store => store.get(gameId))
    },
    async clearUserData() { await write(STORE_NAMES, transaction => STORE_NAMES.forEach(name => transaction.objectStore(name).clear())); },
    close() { database.close(); }
  };
}
