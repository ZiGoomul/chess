import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio, createSoundFiles } from '../src/services/audio.js';

/** Audio element stand-in: the test decides when it loads or fails. */
function createFakeAudio() {
  const created = [];
  class FakeAudio {
    constructor() {
      this.listeners = {};
      this.played = 0;
      this.playResult = Promise.resolve();
      created.push(this);
    }
    addEventListener(name, listener) { this.listeners[name] = listener; }
    load() {}
    play() { this.played += 1; return this.playResult; }
    fire(name) { this.listeners[name]?.(); }
  }
  return { FakeAudio, created };
}

function createEventTarget() {
  const listeners = {};
  return {
    addEventListener: (name, listener) => { listeners[name] = listener; },
    fire: (name) => listeners[name]?.()
  };
}

const URLS = { move: 'https://example.test/move.mp3', capture: 'https://example.test/capture.mp3' };

function setup({ online = true } = {}) {
  const { FakeAudio, created } = createFakeAudio();
  const state = { online, time: 0 };
  const target = createEventTarget();
  const soundFiles = createSoundFiles({
    urls: URLS, AudioCtor: FakeAudio, isOnline: () => state.online, target, now: () => state.time
  });
  const synthesized = [];
  const audio = createAudio(null, { soundFiles, synthesize: (type) => { synthesized.push(type); } });
  const file = (url) => created.filter(item => item.src === url).at(-1);
  return { audio, created, state, target, synthesized, file };
}

test('online, a loaded file plays the familiar sound', () => {
  const { audio, synthesized, file } = setup();
  file(URLS.move).fire('canplaythrough');

  audio.playSound('move');
  assert.equal(file(URLS.move).played, 1);
  assert.deepEqual(synthesized, []);
});

test('a sound whose file has not loaded yet is synthesised', () => {
  const { audio, synthesized, file } = setup();
  audio.playSound('move');
  assert.equal(file(URLS.move).played, 0);
  assert.deepEqual(synthesized, ['move']);
});

test('offline, nothing is downloaded and every sound is synthesised', () => {
  const { audio, created, synthesized } = setup({ online: false });
  audio.playSound('capture');
  assert.equal(created.length, 0);
  assert.deepEqual(synthesized, ['capture']);
});

test('going offline after the files loaded switches to synthesised sounds', () => {
  const { audio, state, synthesized, file } = setup();
  file(URLS.move).fire('canplaythrough');
  state.online = false;
  audio.playSound('move');
  assert.equal(file(URLS.move).played, 0);
  assert.deepEqual(synthesized, ['move']);
});

test('a failed file is not requested on every move, and is retried when the connection returns', () => {
  const { audio, created, target, synthesized, file } = setup();
  file(URLS.move).fire('error');
  const requests = created.length;

  audio.playSound('move');
  audio.playSound('move');
  assert.equal(created.length, requests);
  assert.deepEqual(synthesized, ['move', 'move']);

  target.fire('online');
  assert.equal(created.length, requests + 1);
  file(URLS.move).fire('canplaythrough');
  audio.playSound('move');
  assert.equal(file(URLS.move).played, 1);
});

test('a file that fails to play falls back to the synthesised sound', async () => {
  const { audio, synthesized, file } = setup();
  const element = file(URLS.capture);
  element.fire('canplaythrough');
  element.playResult = Promise.reject(Object.assign(new Error('network'), { name: 'NotSupportedError' }));

  audio.playSound('capture');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(synthesized, ['capture']);
});

test('the sound switch and volume still apply', () => {
  const { audio, synthesized, file } = setup();
  file(URLS.move).fire('canplaythrough');
  audio.configure({ enabled: false });
  audio.playSound('move');
  audio.configure({ enabled: true, volume: 0 });
  audio.playSound('move');
  assert.equal(file(URLS.move).played, 0);
  assert.deepEqual(synthesized, []);

  audio.configure({ volume: 0.4 });
  audio.playSound('move');
  assert.equal(file(URLS.move).volume, 0.4);
});
