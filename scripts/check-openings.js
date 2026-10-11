/**
 * Checks the opening courses against outside sources and prints a report.
 *
 *   npm run check-openings              engine check only (chessdb.cn, no key needed)
 *   LICHESS_TOKEN=... npm run check-openings
 *                                       also checks popularity in Lichess masters games
 *
 * Engine check: a student move that is clearly worse than the best move is flagged, and so is
 * an opponent move that is a real mistake (the student should then know how to punish it).
 * Popularity check: replies of the opponent played in at least MIN_SHARE of masters games
 * that the course does not cover. Answers are cached in .cache/openings so reruns are quick.
 */
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chess.js';
import { openingCourses } from '../src/data/openings.js';

const STUDENT_LOSS_CP = 40;
const OPPONENT_LOSS_CP = 100;
const MIN_SHARE = 0.1;
const MIN_GAMES = 50;
const REQUEST_GAP_MS = 400;
const CACHE_DIR = '.cache/openings';

// Moves the engine likes less but that are main theory, kept on purpose: "line id:san" → why
export const ACCEPTED = {
    'kid-classical:f4': 'главная линия Мар-дель-Платы; движки недооценивают пешечный штурм',
    'dragon-yugoslav:Ne5': 'основной ход: после 12.h4 h5 (вариант Сольтиса) позиция равная'
};

const RUSSIAN_PIECES = { K: 'Кр', Q: 'Ф', R: 'Л', B: 'С', N: 'К' };
const ru = san => (san.startsWith('O-O') ? san.replace(/O/g, '0') : san.replace(/^[KQRBN]/, letter => RUSSIAN_PIECES[letter]));
const numbered = (ply, san) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '…'}${ru(san)}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Every position of a course with the repertoire moves played in it. */
export function coursePositions(course) {
  const positions = new Map();
  for (const line of course.lines) {
    const game = new Chess();
    line.moves.forEach((step, ply) => {
      const fen = game.fen();
      const key = line.moves.slice(0, ply).map(item => item.san).join(' ');
      if (!positions.has(key)) positions.set(key, { fen, ply, path: key, moves: new Map() });
      const entry = positions.get(key);
      if (!entry.moves.has(step.san)) entry.moves.set(step.san, line);
      game.move(step.san);
    });
  }
  return [...positions.values()];
}

async function cached(name, load) {
  const file = join(CACHE_DIR, `${name}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    const value = await load();
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(file, JSON.stringify(value));
    await sleep(REQUEST_GAP_MS);
    return value;
  }
}

const cacheName = (prefix, fen) => `${prefix}-${fen.replace(/[^a-zA-Z0-9]/g, '_')}`;

/** chessdb.cn: scores (centipawns, side to move) of the known moves of a position. */
function engineMoves(fen) {
  return cached(cacheName('cdb', fen), async () => {
    const url = `https://www.chessdb.cn/cdb.php?action=queryall&json=1&board=${encodeURIComponent(fen)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`chessdb: HTTP ${response.status}`);
    const data = await response.json();
    return data.status === 'ok' ? data.moves.map(move => ({ san: move.san, score: move.score })) : null;
  });
}

/** Lichess masters database: how often each move was played. */
function mastersMoves(fen, token) {
  return cached(cacheName('masters', fen), async () => {
    const url = `https://explorer.lichess.ovh/masters?moves=12&topGames=0&fen=${encodeURIComponent(fen)}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Lichess: HTTP ${response.status}`);
    const data = await response.json();
    return data.moves.map(move => ({ san: move.san, games: move.white + move.draws + move.black }));
  });
}

async function checkCourse(course, token) {
  const findings = [];
  for (const position of coursePositions(course)) {
    const studentToMove = (position.ply % 2 === 0 ? 'w' : 'b') === course.color;
    const engine = await engineMoves(position.fen).catch(error => ({ error }));
    if (engine?.error) {
      findings.push(`  ! ${position.path || 'начальная позиция'}: ${engine.error.message}`);
    } else if (!engine) {
      findings.push(`  ? после ${position.path || 'начала'}: позиции нет в базе chessdb`);
    } else {
      const best = Math.max(...engine.map(move => move.score));
      for (const [san, line] of position.moves) {
        const lineName = line.name;
        if (ACCEPTED[`${line.id}:${san}`]) continue;
        const known = engine.find(move => move.san === san);
        if (!known) {
          findings.push(`  ? ${numbered(position.ply, san)} («${lineName}»): хода нет в базе chessdb`);
          continue;
        }
        const loss = best - known.score;
        const bestSan = engine.find(move => move.score === best).san;
        if (studentToMove && loss > STUDENT_LOSS_CP) {
          findings.push(`  ✗ ${numbered(position.ply, san)} («${lineName}»): хуже лучшего на ${loss} сп, лучше ${ru(bestSan)}`);
        } else if (!studentToMove && loss > OPPONENT_LOSS_CP) {
          findings.push(`  ⚠ ${numbered(position.ply, san)} у соперника («${lineName}») — ошибка на ${loss} сп; стоит показать, как её наказать`);
        }
      }
    }

    if (token && !studentToMove) {
      const masters = await mastersMoves(position.fen, token).catch(error => ({ error }));
      if (masters?.error) {
        findings.push(`  ! Lichess: ${masters.error.message}`);
        continue;
      }
      const total = masters.reduce((sum, move) => sum + move.games, 0);
      if (total < MIN_GAMES) continue;
      for (const move of masters) {
        const share = move.games / total;
        if (share >= MIN_SHARE && !position.moves.has(move.san)) {
          findings.push(`  + после ${position.path}: соперник часто играет ${numbered(position.ply, move.san)} (${Math.round(share * 100)}% партий мастеров) — ответа нет`);
        }
      }
    }
  }
  return findings;
}

async function main() {
  const token = process.env.LICHESS_TOKEN || '';
  if (!token) console.log('LICHESS_TOKEN не задан — проверяю только ходы движком (chessdb.cn).\n');
  for (const course of openingCourses) {
    const findings = await checkCourse(course, token);
    console.log(`${course.name}: ${findings.length ? `замечаний ${findings.length}` : 'замечаний нет'}`);
    findings.forEach(line => console.log(line));
    console.log('');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
