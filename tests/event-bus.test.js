import { test } from 'node:test';
import assert from 'node:assert';
import { createEventBus } from '../src/core/event-bus.js';

test('EventBus allows publish and subscribe', () => {
    const bus = createEventBus();
    let received = null;
    bus.on('test:event', (payload) => { received = payload; });
    bus.emit('test:event', { data: 123 });
    assert.deepStrictEqual(received, { data: 123 });
});

test('EventBus allows unsubscribe', () => {
    const bus = createEventBus();
    let count = 0;
    const handler = () => count++;
    bus.on('test:event', handler);
    bus.off('test:event', handler);
    bus.emit('test:event');
    assert.strictEqual(count, 0);
});

test('EventBus on returns unsubscribe function', () => {
    const bus = createEventBus();
    let count = 0;
    const handler = () => count++;
    const unsubscribe = bus.on('test:event', handler);
    unsubscribe();
    bus.emit('test:event');
    assert.strictEqual(count, 0);
});

test('Multiple listeners for the same event execute correctly', () => {
    const bus = createEventBus();
    let count = 0;
    bus.on('test:event', () => count++);
    bus.on('test:event', () => count += 2);
    bus.emit('test:event');
    assert.strictEqual(count, 3);
});

test('An error in one listener doesn\'t block another listener from executing', () => {
    const bus = createEventBus();
    let count = 0;
    bus.on('test:event', () => { throw new Error('Test Error'); });
    bus.on('test:event', () => count++);
    
    const originalError = console.error;
    let logged = false;
    console.error = () => { logged = true; };
    
    bus.emit('test:event');
    
    console.error = originalError;
    assert.strictEqual(count, 1);
    assert.strictEqual(logged, true);
});

test('The empty Set is deleted when the last listener is removed', () => {
    const bus = createEventBus();
    const handler = () => {};
    bus.on('test:event', handler);
    assert.strictEqual(bus.getListenersMap().has('test:event'), true);
    bus.off('test:event', handler);
    assert.strictEqual(bus.getListenersMap().has('test:event'), false);
});
