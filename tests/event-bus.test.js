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
