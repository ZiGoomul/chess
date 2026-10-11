import test from 'node:test';
import assert from 'node:assert/strict';
import { continuations, linesThrough, pickLine } from '../src/domain/opening-tree.js';
import { findCourse, openingCourses } from '../src/data/openings.js';

const dragon = findCourse('dragon');

test('the lines through a position share its moves', () => {
  const start = ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'];
  assert.equal(linesThrough(dragon, ['e4', 'c5']).length, dragon.lines.length);
  // After 1.e4 c5 White may leave the open Sicilian
  assert.deepEqual(continuations(dragon, ['e4', 'c5']).map(item => item.san).sort(), ['Nc3', 'Nf3', 'b3', 'c3', 'd4', 'f4']);
  assert.deepEqual(continuations(dragon, ['e4', 'c5', 'Nf3', 'd6']).map(item => item.san).sort(), ['Bb5+', 'c3', 'd4']);
  assert.deepEqual(continuations(dragon, start).map(item => item.san).sort(), ['Bc4', 'Be2', 'Be3', 'f4', 'g3']);
  assert.equal(continuations(dragon, [...start, 'Be3']).length, 1);
  assert.deepEqual(linesThrough(dragon, ['d4']), []);
});

test('the King\'s Indian forks where White chooses a system', () => {
  const kid = findCourse('kid');
  assert.deepEqual(continuations(kid, ['d4', 'Nf6']).map(item => item.san).sort(), ['Bg5', 'Nf3', 'c4']);
  assert.deepEqual(continuations(kid, ['d4', 'Nf6', 'Nf3', 'g6']).map(item => item.san).sort(), ['Bf4', 'Bg5', 'e3']);
  const base = ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6'];
  assert.deepEqual(continuations(kid, base).map(item => item.san).sort(), ['Be2', 'Nf3', 'f3', 'f4', 'h3']);
  const classical = [...base, 'Nf3', 'O-O', 'Be2', 'e5'];
  assert.deepEqual(continuations(kid, classical).map(item => item.san).sort(), ['Be3', 'O-O', 'd5', 'dxe5']);
  assert.deepEqual(continuations(kid, [...classical, 'O-O', 'Nc6', 'd5', 'Ne7']).map(item => item.san).sort(), ['Nd2', 'Ne1', 'b4']);
});

test('picking a line prefers lines not yet done', () => {
  const done = new Set(dragon.lines.slice(1).map(line => line.id));
  for (let i = 0; i < 5; i++) {
    assert.equal(pickLine(dragon, [], line => done.has(line.id), () => 0.99).id, dragon.lines[0].id);
  }
  assert.equal(pickLine(dragon, ['d4']), null);
});

test('no line ends where another goes on, so every line can be finished', () => {
  for (const course of openingCourses) {
    for (const line of course.lines) {
      const sans = line.moves.map(move => move.san);
      assert.deepEqual(linesThrough(course, sans), [], `${line.id} is the start of another line`);
    }
  }
});
