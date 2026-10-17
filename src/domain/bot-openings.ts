import { Chess, type ChessInstance } from 'chess.js';

export interface BookMoveCandidate {
  uci: string;
  san: string;
  weight: number;
}

export const HUMAN_OPENING_LINES: readonly string[] = [
  // 1.e4 e5 — Italian Game & Giuoco Piano
  'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 O-O O-O d6 h3 a6 Bb3 Ba7 Re1 h6 Nbd2 Re8 Nf1 Be6 Bc2 d5 exd5 Bxd5 Ng3 Qd7',
  'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d3 d6 c3 a6 Bb3 Ba7 h3 h6 Re1 O-O Nbd2 Re8 Nf1 Be6',
  'e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6 c3 d6 O-O a6 Bb3 Ba7 Nbd2 O-O h3 Be6 Re1 Re8',

  // 1.e4 e5 — Two Knights Defense & Fried Liver
  'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3 O-O O-O d6 Bb3 a6 h3 h6 Re1 Re8 Nbd2 Be6',
  'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6 Nf3 e4 Ne5 Bd6 d4 exd3 Nxd3 Qc7',

  // 1.e4 e5 — Ruy Lopez (Spanish)
  'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7 Nbd2 Bb7 Bc2 Re8 Nf1 Bf8 Ng3 g6',
  'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5 exd5 Nxd5 Nxe5 Nxe5 Rxe5 c6 d4 Bd6 Re1 Qh4 g3 Qh3',
  'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1 Bd6 Be3 b6 Nc3 Ne7',
  'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8 Nc3 Ke8 h3',

  // 1.e4 e5 — Scotch Game
  'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nc3 Bb4 Nxc6 bxc6 Bd3 d5 exd5 cxd5 O-O O-O Bg5 c6 Qf3 Be7',
  'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7 Bc4 Ne5 Be2 Qg6 O-O d6 f3 O-O',

  // 1.e4 e5 — Petrov & Philidor
  'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Bd6 O-O O-O c4 c6 Nc3 Nxc3 bxc3 Bg4',
  'e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7 Bc4 Be7 O-O O-O Re1 c6 a4 b6',

  // 1.e4 e5 — Vienna & Bishop Opening
  'e4 e5 Nc3 Nf6 Bc4 Bc5 d3 d6 f4 Nc6 Nf3 Bg4',
  'e4 e5 Bc4 Nf6 d3 c6 Nf3 d5 Bb3 Bd6 Nc3 dxe4 dxe4 O-O Bg5 Qe7',

  // 1.e4 e5 — Scholar attempts (typical beginner level 800)
  'e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6 Ne2 Bg7 Nbc3 d6 d3 O-O Bg5 h6',
  'e4 e5 Bc4 Bc5 Qh5 Qe7 Nf3 d6 Nc3 Nf6 Qg5 O-O',

  // 1.e4 e5 — Four Knights
  'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3 d6 Bg5 Bxc3 bxc3 Qe7 Re1 Nd8 d4 Ne6',

  // 1.e4 c5 — Sicilian Defense (Najdorf, Dragon, Scheveningen, Classical, Kan, Alapin, Closed)
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O Nbd7 g4 b5 g5 b4 Ne2 Ne8 f4 a5 f5 a4',
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 Bc4 Bd7 O-O-O Rc8 Bb3 Ne5 h4 h5 Bg5 Rc5',
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6 Be2 Be7 O-O O-O Be3 Nc6 f4 Qc7 Kh1 a6 a4 Re8 Bf3 Rb8',
  'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5 Nd5 Be7 Bxf6 Bxf6 c3 O-O Nc2 Bg5',
  'e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6 Bd3 Bc5 Nb3 Be7 O-O d6 c4 Nf6 Nc3 b6 Be3 Bb7 f4 Nbd7 Qf3 O-O',
  'e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3 e6 Be2 Be7 O-O O-O Be3 cxd4 cxd4 Nc6 Nc3 Qd6',
  'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6 Be3 e5 Qd2 Nge7 Bh6 O-O h4 f6 Bxg7 Kxg7',

  // 1.e4 e6 — French Defense (Winawer, Classical, Tarrasch, Advance, Exchange)
  'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4 O-O Bd3 Nbc6 Qh5 Ng6 Nf3 Qc7 Be3 c4 Bxg6 fxg6 Qg4 Qf7',
  'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O Nf3 c5 Qd2 Nc6 O-O-O a6 dxc5 Qxc5 Bd3 b5',
  'e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5 c3 Nc6 Ne2 cxd4 cxd4 Nb6 O-O Bd7 f4 g6 Nf3 Be7',
  'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 Bd3 Bd7 O-O cxd4 cxd4 Nxd4 Nxd4 Qxd4 Nc3 a6 Qe2 Ne7 Kh1 Nc6 f4',
  'e4 e6 d4 d5 exd5 exd5 Bd3 Bd6 Nf3 Ne7 O-O O-O Re1 Bf5 Bg5 f6 Bh4 Qd7 c3 Nbc6',

  // 1.e4 c6 — Caro-Kann Defense (Classical, Advance, Panov)
  'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6 Bd2 Ngf6 O-O-O Be7 Kb1 O-O',
  'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 Qb6 Nc3 Nc6 O-O Qxb2 Qe1 cxd4 Bxd4 Nxd4 Nxd4 Bb4 Ndb5 Ba5',
  'e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Be7 cxd5 Nxd5 Bd3 Nc6 O-O O-O Re1 Bf6 Be4 Nce7',

  // 1.e4 d5 — Scandinavian Defense
  'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 Bf5 Bd2 c6 Bc4 e6 Qe2 Bb4 O-O-O Nbd7 a3 Bxc3 Bxc3 Qc7 Ne5 Nxe5 dxe5 Nd5 Bd2 O-O-O',
  'e4 d5 exd5 Nf6 d4 Nxd5 c4 Nb6 Nf3 g6 Nc3 Bg7 Be3 O-O Be2 Bg4 b3 Nc6 O-O e5 d5 Ne7',

  // 1.e4 d6 / g6 — Pirc & Modern
  'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O c6 a4 Nbd7 h3 e5 Be3 Re8 dxe5 dxe5 Nd2 Qe7 Nc4 Nc5',
  'e4 g6 d4 Bg7 Nf3 d6 c4 Nd7 Nc3 e5 Be2 Ne7 O-O O-O Be3 h6 dxe5 dxe5 Qd2 Kh7 Rad1',

  // 1.d4 d5 — Queen's Gambit Declined & Slav & QGA
  'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6 Bd3 dxc4 Bxc4 Nd5 Bxe7 Qxe7 O-O Nxc3 Rxc3 e5',
  'd4 d5 c4 e6 Nc3 Nf6 Nf3 Be7 Bg5 h6 Bh4 O-O e3 b6 Rc1 Bb7 Bd3 Nbd7 O-O c5 Qe2 Ne4 Bxe7 Qxe7 cxd5 exd5',
  'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 c6 e3 Be7 Bd3 Nbd7 Qc2 O-O Nge2 Re8 O-O Nf8 f3 Be6',
  'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O O-O Qe2 Nbd7 e4 Bg6 Bd3 Bh5 e5 Nd5 Nxd5 cxd5 Qe3',
  'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5 Bd3 Bb7 O-O a6 e4 c5 d5 Qc7 dxe6 fxe6',
  'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6 Qe2 b5 Bb3 Bb7 Rd1 Nbd7 Nc3 Qb8 e4 cxd4 Nxd4 Bd6',

  // 1.d4 — London System
  'd4 d5 Bf4 Nf6 e3 e6 Nf3 Bd6 Bg3 O-O Nbd2 c5 c3 Nc6 Bd3 b6 Ne5 Bb7 f4 Ne7 Qf3 Nf5 Bf2 Be7 g4 Nd6',
  'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3 Nbd7 O-O b6 a4 a5 Bh2 Bb7 Na3 Ne4 c3 e5 Nc4 Qe7',
  'd4 d5 Bf4 c5 e3 Nc6 c3 Qb6 Qb3 c4 Qc2 Bf5 Qxf5 Qxb2 Qxd5 Qxa1 Qb5 O-O-O Bxc4 e6 Ne2 Bd6 O-O',

  // 1.d4 Nf6 — King's Indian & Gruenfeld & Benoni
  'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7 Be3 f5 f3 f4 Bf2 g5 a4 Ng6 a5 Rf7',
  'd4 Nf6 c4 g6 g3 Bg7 Bg2 O-O Nc3 d6 Nf3 Nbd7 O-O e5 e4 c6 h3 Qb6 Re1 exd4 Nxd4 Re8 Re2 Nc5 Bf4',
  'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 e5 d5 c6 Qd2 cxd5 cxd5 a6 Nge2 Nbd7 g4 h5 h3 b5 O-O-O Nb6',
  'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Nf3 c5 Rb1 O-O Be2 cxd4 cxd4 Qa5+ Bd2 Qxa2 O-O Bg4 Bg5 h6 Be3 Nc6',
  'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 Nf3 Bg7 Be2 O-O O-O a6 a4 Bg4 Nd2 Bxe2 Qxe2 Nbd7 Nc4 Nb6',

  // 1.d4 Nf6 — Nimzo-Indian & Queen's Indian
  'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6 a3 Bxc3 bxc3 dxc4 Bxc4 Qc7 Bd3 e5 Qc2 Re8',
  'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6 Bg5 Bb7 f3 h6 Bh4 d5 e3 Nbd7 cxd5 exd5 Bd3 Re8 Ne2',
  'd4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7 Bg2 c6 Bc3 d5 Ne5 Nfd7 Nxd7 Nxd7 Nd2 O-O O-O Rc8 e4 b5',

  // 1.c4 — English Opening
  'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 Bb4 Bg2 O-O O-O Re8 Nd5 e4 Ne1 d6 a3 Bc5 d3 exd3 Nxd3 h6 b4 Bd4 Rb1 Nxd5 cxd5 Ne5',
  'c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 Nf6 O-O O-O d4 cxd4 Nxd4 Nxd4 Qxd4 d6 Qd3 a6 Bd2 Rb8 Rac1 Be6 b3',

  // 1.Nf3 — Reti Opening
  'Nf3 d5 c4 c6 g3 Nf6 Bg2 Bf5 O-O e6 b3 Be7 Bb2 O-O d3 h6 Nbd2 a5 a3 Nbd7 Re1 Bh7 e4 Nc5'
];

export function normalizeFen(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

type PositionTreeMap = Map<string, BookMoveCandidate[]>;

let cachedTree: PositionTreeMap | null = null;

export function buildOpeningTree(lines: readonly string[] = HUMAN_OPENING_LINES): PositionTreeMap {
  const tree: PositionTreeMap = new Map();

  for (const line of lines) {
    const game = new Chess();
    const tokens = line.trim().split(/\s+/);

    for (const token of tokens) {
      const fenKey = normalizeFen(game.fen());
      const move = game.move(token);
      if (!move) break;

      const uci = `${move.from}${move.to}${move.promotion || ''}`;
      const candidates = tree.get(fenKey) || [];

      const existing = candidates.find(c => c.uci === uci);
      if (existing) {
        existing.weight += 1;
      } else {
        candidates.push({ uci, san: move.san, weight: 1 });
      }

      tree.set(fenKey, candidates);
    }
  }

  return tree;
}

export function getOpeningTree(): PositionTreeMap {
  if (!cachedTree) {
    cachedTree = buildOpeningTree();
  }
  return cachedTree;
}

export function getMaxBookPly(level: number): number {
  if (level <= 1) return 4;   // Level 1 (~800): 2 full moves (opening fundamentals)
  if (level <= 2) return 6;   // Level 2 (~900): 3 full moves
  if (level <= 3) return 6;   // Level 3 (~1000): 3 full moves
  if (level <= 5) return 8;   // Level 4-5 (~1100-1200): 4 full moves
  if (level <= 10) return 12; // Level 10 (~1700): 6 full moves
  if (level <= 15) return 16; // Level 15 (~2200): 8 full moves
  return 24;                 // Level 20 (~3000+): 12 full moves
}

export function findOpeningBookMove(
  game: ChessInstance,
  level: number,
  random: () => number = Math.random
): { uci: string; san: string } | null {
  if (level <= 0) return null;

  const currentPly = typeof game.history === 'function' ? game.history().length : 0;
  if (currentPly >= getMaxBookPly(level)) {
    return null;
  }

  const fenKey = normalizeFen(game.fen());
  const tree = getOpeningTree();
  const candidates = tree.get(fenKey);

  if (!candidates || candidates.length === 0) {
    return null;
  }

  // Choose weighted candidate
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = random() * totalWeight;
  let selected = candidates[0];

  for (const candidate of candidates) {
    if (roll < candidate.weight) {
      selected = candidate;
      break;
    }
    roll -= candidate.weight;
  }

  // Verify move is legal in current position
  const legalMoves = game.moves({ verbose: true });
  const isLegal = legalMoves.some(
    m => `${m.from}${m.to}${m.promotion || ''}` === selected.uci || m.san === selected.san
  );

  if (!isLegal) {
    return null;
  }

  return { uci: selected.uci, san: selected.san };
}
