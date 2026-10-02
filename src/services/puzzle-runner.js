export function parseUciMove(uci) {
  if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  const move = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  if (uci.length === 5) move.promotion = uci[4];
  return move;
}

export function moveToUci(move) {
  if (!move?.from || !move?.to) return null;
  return `${move.from}${move.to}${move.promotion || ''}`.toLowerCase();
}

export function applyUciMove(game, uci) {
  const move = parseUciMove(uci);
  return move ? game.move(move) : null;
}
