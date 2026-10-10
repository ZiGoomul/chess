import test from 'node:test';
import assert from 'node:assert/strict';
import { createPuzzleCatalog } from '../src/services/puzzle-catalog.js';

test('merges built-ins and chooses an unattempted nearby puzzle', async () => {
  const records = new Map([['lichess:one', { id: 'lichess:one', rating: 1200, popularity: 50, themes: ['fork'] }]]);
  const repository = { puzzles: { list: async () => [...records.values()], get: async id => records.get(id), upsertMany: async items => items.forEach(item => records.set(item.id, item)) }, attempts: { listByPuzzleId: async () => [] }, batches: { get: async () => null, put: async () => {} }, clearUserData: async () => records.clear() };
  const catalog = createPuzzleCatalog({ builtIns: [{ id: 'builtin-001', rating: 800, popularity: 1, themes: ['mate'] }], repository });
  assert.equal((await catalog.list()).length, 2);
  assert.equal((await catalog.getRecommendation({ themes: ['fork'], targetRating: 1100 })).id, 'lichess:one');
});

import { Chess } from 'chess.js';
import { parseLichessApiPuzzle } from '../src/services/lichess-puzzles.js';

const API_SAMPLE = {
  game: { pgn: 'e4 e5 Nf3 d6 Bc4 Be7 O-O Nf6 Re1 O-O d4 exd4 Nxd4 Bg4 f3 Bd7 Bf4 a6 a4 Nh5 Be3 c5 Nf5 Bxf5 exf5 Nf6 Nc3 Nc6 Nd5 Nxd5 Qxd5 Nb4 Qd2 Bf6 c3 Nc6 Rad1 Be7 Bf4 Ne5 Bxe5 dxe5 Rxe5 Bg5 f4' },
  puzzle: { id: '7F55w', rating: 1473, plays: 21511, solution: ['d8d2', 'd1d2', 'g5f4', 'd2d5', 'f4e5'], themes: ['middlegame', 'fork'], initialPly: 44 }
};

test('a Lichess API puzzle starts after the opponent\'s last move', () => {
  const puzzle = parseLichessApiPuzzle(API_SAMPLE, () => new Chess());
  assert.equal(puzzle.id, 'lichess:7F55w');
  assert.equal(puzzle.fen.split(' ')[1], 'b');
  assert.deepEqual(puzzle.moves, API_SAMPLE.puzzle.solution);
  assert.deepEqual(puzzle.lastMove, { from: 'f3', to: 'f4' });
  assert.equal(puzzle.rating, 1473);
  assert.equal(parseLichessApiPuzzle({ ...API_SAMPLE, puzzle: { ...API_SAMPLE.puzzle, solution: ['a1a8'] } }, () => new Chess()), null);
});

function memoryRepository({ puzzles = [], attempts = [] } = {}) {
  const records = new Map(puzzles.map(puzzle => [puzzle.id, puzzle]));
  return {
    records,
    puzzles: { list: async () => [...records.values()], get: async id => records.get(id), upsertMany: async items => items.forEach(item => records.set(item.id, item)) },
    attempts: { list: async () => attempts, listByPuzzleId: async id => attempts.filter(attempt => attempt.puzzleId === id) },
    batches: { get: async () => null, put: async () => {} }
  };
}

test('next() saves an online puzzle and skips ones already solved', async () => {
  const repository = memoryRepository({ attempts: [{ puzzleId: 'lichess:old', solved: true }] });
  const served = [{ id: 'lichess:old' }, { id: 'lichess:new' }];
  const onlineSource = { next: async () => served.shift() };
  const catalog = createPuzzleCatalog({ builtIns: [], repository, onlineSource });

  const result = await catalog.next({ theme: 'fork' });
  assert.equal(result.source, 'online');
  assert.equal(result.puzzle.id, 'lichess:new');
  assert.ok(repository.records.has('lichess:new'));
});

test('next() falls back to an unsolved saved puzzle when Lichess is unreachable', async () => {
  const repository = memoryRepository({
    puzzles: [{ id: 'saved:solved', themes: ['fork'] }, { id: 'saved:fresh', themes: ['fork'] }],
    attempts: [{ puzzleId: 'saved:solved', solved: true }]
  });
  const onlineSource = { next: async () => { throw new Error('offline'); } };
  const catalog = createPuzzleCatalog({ builtIns: [], repository, onlineSource, fetchImpl: async () => ({ ok: false, status: 404 }) });

  const result = await catalog.next({ theme: 'fork' });
  assert.equal(result.source, 'offline');
  assert.equal(result.puzzle.id, 'saved:fresh');
  assert.equal(result.error.message, 'offline');
  assert.deepEqual(await catalog.getCounts(), { total: 2, imported: 2, builtIn: 0, solved: 1 });
});

import { describePuzzleThemes } from '../src/ui/puzzle-themes.js';

test('puzzle themes read in Russian with the tactical motif first', () => {
  assert.equal(describePuzzleThemes(['middlegame', 'advantage', 'fork', 'long', 'capturingDefender']), 'Вилка · Уничтожение защиты · Миттельшпиль');
  assert.equal(describePuzzleThemes(['unknownTheme']), '');
});
