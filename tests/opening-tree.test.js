import test from 'node:test';
import assert from 'node:assert/strict';
import { continuations, linesThrough, pickLine } from '../src/domain/opening-tree.js';
import { findCourse, openingCourses } from '../src/data/openings.js';

const dragon = findCourse('dragon');

test('the lines through a position share its moves', () => {
  const start = ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'];
  assert.equal(linesThrough(dragon, start).length, dragon.lines.length);
  assert.deepEqual(continuations(dragon, start).map(item => item.san).sort(), ['Be2', 'Be3', 'f4']);
  assert.equal(continuations(dragon, [...start, 'Be3']).length, 1);
  assert.deepEqual(linesThrough(dragon, ['d4']), []);
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
