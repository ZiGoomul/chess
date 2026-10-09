import { JSDOM } from 'jsdom';
import jqueryFactory from 'jquery';
import { Chess } from 'chess.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createGameStore } from '../../src/core/game-store.js';

const PAGE = `<!doctype html><body>
  <select id="botLevel"><option value="0">editor</option><option value="10" selected>bot</option></select>
  <input type="checkbox" id="highlightMovesCb" checked>
  <input id="timerBase" value="10"><input id="timerInc" value="0">
  <div id="gameStatus"></div>
  <div id="gameOverOverlay"><div id="gameOverText"></div></div>
  <div id="reviewStatus"></div>
  <ol id="reviewMoments" hidden></ol>
  <button id="reviewCancelBtn" hidden></button>
  <button id="reviewRetryBtn" hidden></button>
  <button id="reviewPlayBestMoveBtn" hidden></button>
  <button id="reviewPlayFromBtn" hidden></button>
  <button id="reviewPuzzleBtn" hidden></button>
  <div id="puzzleStatusText"></div><div id="puzzleDescText"></div><span id="puzzlesScore"></span>
  <button id="startPositionBtn"></button>
</body>`;

/** Board stand-in that records what the controllers ask it to draw. */
function createFakeBoardView() {
  const calls = { showMoveHints: [], removeHighlights: 0 };
  return {
    calls,
    showMoveHints: (square, destinations) => { calls.showMoveHints.push({ square, destinations }); },
    removeHighlights: () => { calls.removeHighlights += 1; },
    clearArrows() {},
    clearLastMoveHighlight() {},
    highlightCheck() {},
    highlightAttackedPieces() {},
    orientation: () => 'white',
    getFen: () => '',
    flip() {}
  };
}

function createFakeClock() {
  return {
    timedOut: false,
    enabled: false,
    addIncrement() {},
    startClock() {},
    stopClock() {},
    applySettings() {},
    updateClockUI() {}
  };
}

export function createHarness({ botLevel = 10 } = {}) {
  const dom = new JSDOM(PAGE);
  globalThis.window = dom.window;
  const $ = jqueryFactory(dom.window);
  $('#botLevel').val(String(botLevel));

  const eventBus = createEventBus();
  const store = createGameStore({ game: new Chess() });
  const boardView = createFakeBoardView();
  const clock = createFakeClock();
  const moveHistoryView = {
    updateMoveHistory() {},
    goToPly: (ply) => { store.setState({ currentViewPly: ply }); }
  };
  const botCoordinator = { cancelBotSearch() {}, makeBotMove() {} };
  const analysisCoordinator = { autoHintIfNeeded() {}, drawHintArrows() {}, requestHint() {} };
  const services = { repository: null, puzzleCatalog: null, gameCompletion: null, postGameReview: null };
  const sounds = [];

  const clearSelection = () => {
    store.setState({ selectedSquare: null });
    boardView.removeHighlights();
  };

  return {
    $, Chess, store, eventBus, boardView, clock, moveHistoryView, botCoordinator, analysisCoordinator, services,
    sounds, clearSelection,
    getBotLevel: () => parseInt(String($('#botLevel').val()), 10),
    playSound: (name) => { sounds.push(name); },
    playSoundForMove: (move) => { sounds.push(move ? move.san : null); },
    saveStoredSettings() {},
    close() {
      dom.window.close();
      delete globalThis.window;
    }
  };
}

/** Plays SAN moves on the harness store as if they had been made in the UI. */
export function playMoves(h, sans) {
  const game = h.store.getState().game;
  const historyFENs = h.store.getState().historyFENs.slice();
  for (const san of sans) {
    game.move(san);
    historyFENs.push(game.fen());
  }
  h.store.setState({ historyFENs, currentViewPly: historyFENs.length - 1 });
}
