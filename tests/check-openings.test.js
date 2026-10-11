import test from 'node:test';
import assert from 'node:assert/strict';
import { coursePositions, ACCEPTED } from '../scripts/check-openings.js';
import { findCourse, findLine } from '../src/data/openings.js';

test('each position of a course is checked once, with every repertoire move played in it', () => {
  const dragon = findCourse('dragon');
  const positions = coursePositions(dragon);
  const afterC5 = positions.find(position => position.path === 'e4 c5');
  assert.deepEqual([...afterC5.moves.keys()].sort(), ['Nc3', 'Nf3', 'b3', 'c3', 'd4', 'f4']);
  assert.equal(new Set(positions.map(position => position.path)).size, positions.length);
});

test('accepted engine exceptions point at real moves of real lines', () => {
  for (const key of Object.keys(ACCEPTED)) {
    const [lineId, san] = key.split(':');
    const found = findLine(lineId);
    assert.ok(found, `${lineId} does not exist`);
    assert.ok(found.line.moves.some(move => move.san === san), `${key} is not in the line`);
  }
});
