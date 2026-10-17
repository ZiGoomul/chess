import test from 'node:test';
import assert from 'node:assert/strict';
import { createLazyWorker } from '../src/services/engine-workers.ts';

test('createLazyWorker does not instantiate worker until postMessage', () => {
  let created = 0;
  const posted = [];
  function fakeWorkerFactory() {
    created++;
    return {
      onmessage: null,
      onerror: null,
      postMessage(msg) { posted.push(msg); },
      terminate() {}
    };
  }

  const lazy = createLazyWorker(fakeWorkerFactory);
  assert.equal(created, 0);

  lazy.onmessage = () => {};
  assert.equal(created, 0);

  lazy.postMessage('isready');
  assert.equal(created, 1);
  assert.deepEqual(posted, ['isready']);

  lazy.postMessage('go depth 10');
  assert.equal(created, 1); // Not created again
  assert.deepEqual(posted, ['isready', 'go depth 10']);
});
