// The game in progress, so a reload or a closed tab can pick it up again.
const LIVE_GAME_KEY = 'chess_studies_live_game_v1';

function getStorage(storage) {
  if (storage) return storage;
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

export function saveLiveGame(snapshot, storage) {
  const s = getStorage(storage);
  try { s?.setItem(LIVE_GAME_KEY, JSON.stringify(snapshot)); } catch { /* storage full or blocked */ }
}

export function loadLiveGame(storage) {
  const s = getStorage(storage);
  try {
    const raw = s?.getItem(LIVE_GAME_KEY);
    const snapshot = raw ? JSON.parse(raw) : null;
    return snapshot && typeof snapshot.startFen === 'string' && Array.isArray(snapshot.moves) ? snapshot : null;
  } catch {
    return null;
  }
}

export function clearLiveGame(storage) {
  const s = getStorage(storage);
  try { s?.removeItem(LIVE_GAME_KEY); } catch { /* blocked */ }
}
