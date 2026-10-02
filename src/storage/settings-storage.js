const SETTINGS_KEY = 'chess_studies_settings_v1';

export const DEFAULT_SETTINGS = {
    theme: 'dark',
    boardTheme: 'wood',
    pieceTheme: 'chesscom_neo',
    botLevel: 10,
    hintLevel: 10,
    autoHint: false,
    highlightMoves: true,
    highlightAttacks: false,
    highlightDefenses: false,
    timerEnabled: true,
    timerBase: 10,
    timerInc: 5,
    playerColor: 'white'
};

function getStorage(customStorage) {
    if (customStorage) return customStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
    return null;
}

export function loadStoredSettings(storage) {
    const s = getStorage(storage);
    if (!s) return { ...DEFAULT_SETTINGS };
    try {
        const raw = s.getItem(SETTINGS_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveStoredSettings(partial, storage) {
    const s = getStorage(storage);
    if (!s) return { ...DEFAULT_SETTINGS, ...partial };
    try {
        const current = loadStoredSettings(s);
        const updated = { ...current, ...partial };
        s.setItem(SETTINGS_KEY, JSON.stringify(updated));
        return updated;
    } catch {
        return { ...DEFAULT_SETTINGS, ...partial };
    }
}
