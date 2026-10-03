import stockfishUrl from 'stockfish.js/stockfish.js?url';

export function createEngineWorkers() {
  return {
    game: new Worker(stockfishUrl),
    hints: new Worker(stockfishUrl),
    review: new Worker(stockfishUrl),
    terminate() {
      this.game.terminate();
      this.hints.terminate();
      this.review.terminate();
    }
  };
}
