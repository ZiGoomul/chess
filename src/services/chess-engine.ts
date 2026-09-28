export type ChessFile = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type ChessRank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type ChessSquare = `${ChessFile}${ChessRank}`;
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export interface BestMove {
  from: ChessSquare;
  to: ChessSquare;
  promotion: PromotionPiece;
}

export interface HintInfo {
  multipv: number;
  move: `${ChessSquare}${ChessSquare}`;
  cp: number | null;
  mate: number | null;
}

interface SearchRequest {
  id: number;
  fen: string;
}

interface EngineWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: string): void;
}

export interface ChessEngineOptions {
  gameWorker: EngineWorker;
  hintWorker: EngineWorker;
  getCurrentFen: () => string;
  onBotMove: (move: BestMove | null) => void;
  onBotThinkingChange: (thinking: boolean) => void;
  onHint: (info: HintInfo) => void;
  onHintComplete: () => void;
}

export interface ChessEngine {
  cancelBotMove: () => void;
  requestBotMove: (fen: string, level: number) => void;
  setBotLevel: (level: number) => void;
  requestHint: (fen: string, level: number) => void;
  readonly isThinking: boolean;
}

export function parseBestMove(line: string): BestMove | null {
  const match = /^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/.exec(line);
  if (!match) return null;

  return {
    from: match[1] as ChessSquare,
    to: match[2] as ChessSquare,
    promotion: (match[3] || 'q') as PromotionPiece
  };
}

export function parseHintInfo(line: string): HintInfo | null {
  if (!line.includes('info depth') || !line.includes(' pv ')) return null;

  const multipvMatch = /\bmultipv (\d+)/.exec(line);
  const moveMatch = /\b pv ([a-h][1-8][a-h][1-8])/.exec(line);
  if (!multipvMatch || !moveMatch) return null;

  const cpMatch = /\bscore cp (-?\d+)/.exec(line);
  const mateMatch = /\bscore mate (-?\d+)/.exec(line);
  return {
    multipv: Number(multipvMatch[1]),
    move: moveMatch[1] as HintInfo['move'],
    cp: cpMatch ? Number(cpMatch[1]) : null,
    mate: mateMatch ? Number(mateMatch[1]) : null
  };
}

export function createChessEngine({
  gameWorker,
  hintWorker,
  getCurrentFen,
  onBotMove,
  onBotThinkingChange,
  onHint,
  onHintComplete
}: ChessEngineOptions): ChessEngine {
  let nextSearchId = 0;
  let activeSearchId = 0;
  const searches: SearchRequest[] = [];
  let thinking = false;
  let nextHintId = 0;
  let activeHintId = 0;
  const hintSearches: SearchRequest[] = [];

  function setThinking(value: boolean): void {
    thinking = value;
    onBotThinkingChange(value);
  }

  function cancelBotMove(): void {
    if (activeSearchId) gameWorker.postMessage('stop');
    activeSearchId = 0;
    setThinking(false);
  }

  function requestBotMove(fen: string, level: number): void {
    if (thinking) cancelBotMove();

    const search = { id: ++nextSearchId, fen };
    searches.push(search);
    activeSearchId = search.id;
    setThinking(true);
    gameWorker.postMessage(`setoption name Skill Level value ${level}`);
    gameWorker.postMessage(`position fen ${fen}`);
    gameWorker.postMessage(`go depth ${level > 10 ? 15 : 10}`);
  }

  function setBotLevel(level: number): void {
    if (level > 0) gameWorker.postMessage(`setoption name Skill Level value ${level}`);
  }

  gameWorker.onmessage = event => {
    const line = event.data;
    if (typeof line !== 'string' || !line.startsWith('bestmove')) return;

    const search = searches.shift();
    if (!search || search.id !== activeSearchId || search.fen !== getCurrentFen() || !thinking) return;

    activeSearchId = 0;
    setThinking(false);
    onBotMove(parseBestMove(line));
  };

  function cancelHint(): void {
    if (activeHintId) hintWorker.postMessage('stop');
    activeHintId = 0;
  }

  function requestHint(fen: string, level: number): void {
    cancelHint();
    const search = { id: ++nextHintId, fen };
    hintSearches.push(search);
    activeHintId = search.id;
    hintWorker.postMessage(`setoption name Skill Level value ${level}`);
    hintWorker.postMessage('setoption name MultiPV value 3');
    hintWorker.postMessage(`position fen ${fen}`);
    hintWorker.postMessage(`go depth ${level > 10 ? 15 : 10}`);
  }

  hintWorker.onmessage = event => {
    const line = event.data;
    if (typeof line !== 'string') return;

    const search = hintSearches[0];
    if (!search) return;

    if (line.startsWith('bestmove')) {
      hintSearches.shift();
      if (search.id !== activeHintId || search.fen !== getCurrentFen()) return;
      activeHintId = 0;
      onHintComplete();
      return;
    }

    if (search.id !== activeHintId || search.fen !== getCurrentFen()) return;

    const info = parseHintInfo(line);
    if (info) onHint(info);
  };

  return {
    cancelBotMove,
    requestBotMove,
    setBotLevel,
    requestHint,
    get isThinking() { return thinking; }
  };
}