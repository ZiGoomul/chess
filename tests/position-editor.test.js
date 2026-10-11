import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { describeUnplayablePosition } from '../src/app/position-editor.js';

test('a normal position can be played from the editor', () => {
  assert.equal(describeUnplayablePosition(new Chess().fen(), Chess), null);
});

test('the editor explains why a position cannot be played', () => {
  assert.match(describeUnplayablePosition('8/8/8/8/8/8/8/4K3 w - - 0 1', Chess), /по одному королю/);
  assert.match(describeUnplayablePosition('4k3/8/8/8/8/8/8/P3K3 w - - 0 1', Chess), /Пешки/);
  assert.match(describeUnplayablePosition('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1', Chess), /Чёрный король под шахом/);
});
