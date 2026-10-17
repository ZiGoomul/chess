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
  <div id="gameOverOverlay"><div id="gameOverText"></div><p id="gameOverReason"></p><span id="gameOverScore"></span><span id="gameOverBotName"></span><p id="gameOverReviewNote"></p></div>
  <div id="reviewStatus"></div>
  <div id="reviewSummary" hidden><svg><path id="reviewEvalArea"></path></svg>
    <strong id="reviewAccuracyYou"></strong><strong id="reviewAccuracyBot"></strong>
    <ul id="reviewClassChips"></ul></div>
  <h3 id="reviewMomentsTitle" hidden></h3>
  <div id="reviewMomentNav" hidden><button id="reviewPrevMomentBtn"></button><span id="reviewMomentPosition"></span><button id="reviewNextMomentBtn"></button></div>
  <button id="openLastReviewBtn" hidden></button>
  <div id="tab-play" data-phase="setup"></div>
  <h2 id="gameResultTitle"></h2><p id="gameResultMeta"></p>
  <ol id="reviewMoments" hidden></ol>
  <button id="reviewCancelBtn" hidden></button>
  <button id="reviewRetryBtn" hidden></button>
  <button id="reviewPlayBestMoveBtn" hidden></button>
  <button id="reviewPlayFromBtn" hidden></button>
  <button id="reviewPracticeMomentBtn" hidden></button>
  <button id="reviewPuzzleBtn" hidden></button>
  <div id="reviewTrainerCard" hidden>
    <div id="reviewTrainerNav">
      <span id="reviewTrainerPosition"></span>
      <button id="reviewTrainerExitBtn"></button>
    </div>
    <div id="reviewTrainerPrompt"></div>
    <div id="reviewTrainerActions">
      <button id="reviewTrainerHintBtn"></button>
      <button id="reviewTrainerRefutationBtn" hidden></button>
      <button id="reviewTrainerNextBtn" disabled></button>
    </div>
  </div>
  <button id="reviewStartPracticeBtn" hidden></button>
  <span id="puzzleStreakCount"></span><span id="puzzleStreak"></span><span id="puzzleBestStreak"></span><button id="showSolutionBtn" hidden></button>
  <div id="puzzleStatusText"></div><div id="puzzleDescText"></div><span id="puzzlesScore"></span>
  <textarea id="pgnInput"></textarea><div id="pgnError"></div><button id="copyPgnBtn"></button>
  <button id="startPositionBtn"></button>
</body>`;

/** Board stand-in that records what the controllers ask it to draw. */
function createFakeBoardView() {
  const calls = { showMoveHints: [], removeHighlights: 0, feedback: [], arrows: [], highlights: [] };
  let currentOrientation = 'white';
  return {
    calls,
    showMoveHints: (square, destinations) => { calls.showMoveHints.push({ square, destinations }); },
    removeHighlights: () => { calls.removeHighlights += 1; },
    showSquareFeedback: (square, kind) => { calls.feedback.push({ square, kind }); },
    clearSquareFeedback: () => { calls.feedback.push(null); },
    drawArrow: (from, to, tone) => { calls.arrows.push({ from, to, tone }); },
    showGuideArrow: (from, to) => { calls.arrows.push({ from, to, tone: 'guide' }); },
    highlightSquares: (squares) => { calls.highlights.push(squares); },
    clearHighlights: () => { calls.highlights.push(null); },
    clearArrows: () => { calls.arrows.push(null); },
    clearLastMoveHighlight() {},
    highlightCheck() {},
    highlightAttackedPieces() {},
    orientation: (color) => {
      if (color) {
        currentOrientation = color;
        calls.orientation = color;
        return color;
      }
      return currentOrientation;
    },
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
  const botCoordinator = { cancelBotSearch() {}, makeBotMove() {}, updateStockfishLevel() {} };
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
