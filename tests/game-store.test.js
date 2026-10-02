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

test('GameStore handles custom initialState', () => {
    const customGame = new Chess();
    customGame.move('e4');
    const store = createGameStore({ game: customGame, mode: 'puzzle' });
    const state = store.getState();
    assert.strictEqual(state.mode, 'puzzle');
    assert.strictEqual(state.game, customGame);
    assert.strictEqual(state.historyFENs[0], customGame.fen());
});

test('GameStore unsubscribe function works', () => {
    const store = createGameStore();
    let count = 0;
    const unsubscribe = store.subscribe(() => { count++; });
    
    store.setState({ mode: 'bot' });
    assert.strictEqual(count, 1);
    
    unsubscribe();
    store.setState({ mode: 'free' });
    assert.strictEqual(count, 1); // Should not increase
});

test('GameStore setState accepts an updater function', () => {
    const store = createGameStore();
    store.setState(prev => ({ currentViewPly: prev.currentViewPly + 1 }));
    assert.strictEqual(store.getState().currentViewPly, 1);
    store.setState(prev => ({ currentViewPly: prev.currentViewPly + 2 }));
    assert.strictEqual(store.getState().currentViewPly, 3);
});
