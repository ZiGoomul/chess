import stockfishUrl from 'stockfish.js/stockfish.js?url';

export interface EngineWorker {
  onmessage: ((event: MessageEvent<any>) => void) | null;
  onerror: ((event: any) => void) | null;
  postMessage(message: any, transfer?: Transferable[]): void;
  terminate(): void;
}

export function createLazyWorker(createInstance: () => Worker): EngineWorker {
  let worker: Worker | null = null;
  let onmessageHandler: ((event: MessageEvent<any>) => void) | null = null;
  let onerrorHandler: ((event: any) => void) | null = null;

  function ensureWorker(): Worker {
    if (!worker) {
      worker = createInstance();
      if (onmessageHandler) worker.onmessage = onmessageHandler;
      if (onerrorHandler) worker.onerror = onerrorHandler;
    }
    return worker;
  }

  return {
    get onmessage() {
      return onmessageHandler;
    },
    set onmessage(handler: ((event: MessageEvent<any>) => void) | null) {
      onmessageHandler = handler;
      if (worker) worker.onmessage = handler;
    },
    get onerror() {
      return onerrorHandler;
    },
    set onerror(handler: ((event: any) => void) | null) {
      onerrorHandler = handler;
      if (worker) worker.onerror = handler;
    },
    postMessage(message: any, transfer?: Transferable[]) {
      const instance = ensureWorker();
      if (transfer) {
        instance.postMessage(message, transfer);
      } else {
        instance.postMessage(message);
      }
    },
    terminate() {
      if (worker) {
        worker.terminate();
        worker = null;
      }
    }
  };
}

export function createEngineWorkers(url: string = stockfishUrl): {
  game: EngineWorker;
  hints: EngineWorker;
  review: EngineWorker;
  terminate(): void;
} {
  const game = createLazyWorker(() => new Worker(url));
  const hints = createLazyWorker(() => new Worker(url));
  const review = createLazyWorker(() => new Worker(url));

  return {
    game,
    hints,
    review,
    terminate() {
      game.terminate();
      hints.terminate();
      review.terminate();
    }
  };
}
