import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { openingCourses, findLine } from '../src/data/openings.js';

test('every opening line is legal from the starting position and explains every move', () => {
  for (const course of openingCourses) {
    assert.ok(course.color === 'w' || course.color === 'b', `${course.id} has no side`);
    for (const line of course.lines) {
      const game = new Chess();
      line.moves.forEach((step, index) => {
        assert.ok(game.move(step.san), `${line.id}: move ${index + 1} ${step.san} is illegal`);
        assert.ok(step.why && step.why.length > 3, `${line.id}: move ${index + 1} has no explanation`);
      });
      // The line ends on a move of the student's side
      const lastMover = line.moves.length % 2 === 1 ? 'w' : 'b';
      assert.equal(lastMover, course.color, `${line.id} should end with the student's move`);
    }
  }
});

test('line ids are unique and can be looked up', () => {
  const ids = openingCourses.flatMap(course => course.lines.map(line => line.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(findLine('dragon-yugoslav').course.id, 'dragon');
  assert.equal(findLine('missing'), null);
});
