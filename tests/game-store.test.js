// tests/game-store.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { createGameStore } from '../src/core/game-store.js';
import { Chess } from 'chess.js';

test('GameStore initializes with default state and allows subscription', () => {
    const store = createGameStore();
    const state = store.getState();
    assert.strictEqual(state.mode, 'free');
    assert.strictEqual(state.historyFENs.length, 1);
    
    let notified = false;
    store.subscribe(() => { notified = true; });
    store.setState({ mode: 'bot' });
    
    assert.strictEqual(notified, true);
    assert.strictEqual(store.getState().mode, 'bot');
});
