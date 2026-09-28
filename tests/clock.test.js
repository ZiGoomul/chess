import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime } from '../src/services/clock.js';

test('formats whole minutes and seconds', () => {
  assert.equal(formatTime(5 * 60 * 1000), '05:00');
  assert.equal(formatTime(61 * 1000), '01:01');
});

test('shows tenths during the final ten seconds', () => {
  assert.equal(formatTime(9900), '00:09.9');
  assert.equal(formatTime(1000), '00:01.0');
  assert.equal(formatTime(0), '00:00.0');
});
