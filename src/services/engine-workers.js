const STOCKFISH_SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';

export function createEngineWorkers() {
  const workerScript = new Blob(
    [`importScripts('${STOCKFISH_SCRIPT_URL}');`],
    { type: 'application/javascript' }
  );
  const workerUrl = URL.createObjectURL(workerScript);

  return {
    game: new Worker(workerUrl),
    hints: new Worker(workerUrl),
    review: new Worker(workerUrl),
    terminate() {
      this.game.terminate();
      this.hints.terminate();
      this.review.terminate();
      URL.revokeObjectURL(workerUrl);
    }
  };
}
