import { createReadStream, promises as fs } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse';
import { Chess } from 'chess.js';

export function parseLichessPuzzleRow(row, chessFactory = () => new Chess()) {
  const id = row.PuzzleId;
  const moves = String(row.Moves || '').trim().split(/\s+/);
  if (!id || moves.length < 2 || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(moves[0])) return null;
  try {
    const game = chessFactory();
    if (!game.load(row.FEN) || !game.move({ from: moves[0].slice(0, 2), to: moves[0].slice(2, 4), promotion: moves[0][4] })) return null;
    if (!moves.slice(1).every(move => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))) return null;
    return { id: `lichess:${id}`, source: 'lichess', sourceId: id, fen: game.fen(), moves: moves.slice(1), desc: row.Themes || 'Lichess puzzle', rating: Number(row.Rating), popularity: Number(row.Popularity), themes: String(row.Themes || '').split(/\s+/).filter(Boolean), sourceUrl: `https://lichess.org/training/${id}`, catalogVersion: '' };
  } catch { return null; }
}

export async function writePuzzleBatches({ input, outputDir, snapshotDate, minRating = 0, maxRating = Infinity, minPopularity = -Infinity, themes = [], batchSize = 100, limit = Infinity }) {
  const rows = [];
  const parser = (input === '-' ? process.stdin : createReadStream(input)).pipe(parse({ columns: true, relax_quotes: false, trim: true }));
  for await (const row of parser) {
    const puzzle = parseLichessPuzzleRow(row);
    if (puzzle && puzzle.rating >= minRating && puzzle.rating <= maxRating && puzzle.popularity >= minPopularity && (!themes.length || themes.every(theme => puzzle.themes.includes(theme)))) rows.push(puzzle);
    if (rows.length >= limit) break;
  }
  const catalogVersion = `lichess-${snapshotDate}`;
  await fs.mkdir(outputDir, { recursive: true });
  const batches = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    const id = `${catalogVersion}-${String(index / batchSize + 1).padStart(3, '0')}`;
    const file = `${id}.json`;
    const records = rows.slice(index, index + batchSize).map(puzzle => ({ ...puzzle, catalogVersion }));
    await fs.writeFile(join(outputDir, file), JSON.stringify(records));
    batches.push({ id, file, count: records.length });
  }
  const manifest = { catalogVersion, sourceSnapshotDate: snapshotDate, batches };
  await fs.writeFile(join(outputDir, 'manifest.json'), JSON.stringify(manifest));
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, outputDir, snapshotDate] = process.argv.slice(2);
  if (!input || !outputDir || !snapshotDate) throw new Error('Usage: import-lichess-puzzles <input.csv|-> <output-dir> <YYYY-MM-DD>');
  writePuzzleBatches({ input, outputDir, snapshotDate }).then(manifest => console.log(JSON.stringify(manifest)));
}
