import { test } from 'node:test';
import assert from 'node:assert';
import { loadStoredSettings, saveStoredSettings, DEFAULT_SETTINGS } from '../src/storage/settings-storage.js';

function createMockStorage(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        }
    };
}

test('returns default settings when storage is empty', () => {
    const storage = createMockStorage();
    const settings = loadStoredSettings(storage);
    assert.deepStrictEqual(settings, DEFAULT_SETTINGS);
});

test('persists and loads partial settings updates', () => {
    const storage = createMockStorage();
    saveStoredSettings({ theme: 'light', botLevel: 5 }, storage);
    
    const loaded = loadStoredSettings(storage);
    assert.strictEqual(loaded.theme, 'light');
    assert.strictEqual(loaded.botLevel, 5);
    assert.strictEqual(loaded.boardTheme, DEFAULT_SETTINGS.boardTheme);
});

test('handles corrupted JSON gracefully', () => {
    const storage = createMockStorage({ chess_studies_settings_v1: 'not-json' });
    const settings = loadStoredSettings(storage);
    assert.deepStrictEqual(settings, DEFAULT_SETTINGS);
});
