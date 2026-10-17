import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameSession } from '../src/app/game-session.js';
import { createHarness, playMoves } from './helpers/harness.js';
import { createRatedGame } from '../src/app/rated-game.js';
import { createReviewTrainerController } from '../src/app/review-trainer-controller.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}

function setup(options, liveGameStorage = memoryStorage(), { rated = false } = {}) {
  const h = createHarness(options);
  h.$('body').append('<p id="gameOverRating" hidden></p><span id="ratedChip" hidden></span><input type="checkbox" id="timerEnableCb" checked><input id="timerBase" value="10">');
  const savedRatings = [];
  const rating = rated
    ? createRatedGame({ $: h.$, botLevelToRating: () => 1700, saveRatings: value => { savedRatings.push(value); } })
    : null;
  const puzzle = { isActive: () => false, exit() {} };
  const session = createGameSession({
    $: h.$, Chess: h.Chess, store: h.store, eventBus: h.eventBus, boardView: h.boardView, clock: h.clock,
    botCoordinator: h.botCoordinator, analysisCoordinator: h.analysisCoordinator, moveHistoryView: h.moveHistoryView,
    services: h.services, puzzle, getBotLevel: h.getBotLevel, clearSelection: h.clearSelection,
    playSound: h.playSound, playSoundForMove: h.playSoundForMove, saveStoredSettings: h.saveStoredSettings,
    liveGameStorage, rating
  });
  return { h, session, liveGameStorage, rating, savedRatings };
}

const RAPID = { enabled: true, baseMinutes: 10 };

const state = h => h.store.getState();

test('a legal move updates the game, history and status', () => {
  const { h, session } = setup();
  assert.equal(session.makeMove('e2', 'e4'), true);

  assert.equal(state(h).game.history().join(' '), 'e4');
  assert.equal(state(h).historyFENs.length, 2);
  assert.equal(state(h).currentViewPly, 1);
  assert.equal(h.$('#gameStatus').text(), 'Ход: Черные');
  h.close();
});

test('an illegal move is rejected and leaves the position alone', () => {
  const { h, session } = setup();
  assert.equal(session.makeMove('e2', 'e5'), false);
  assert.equal(state(h).historyFENs.length, 1);
  h.close();
});

test('a bot reply is applied to the game', () => {
  const { h, session } = setup();
  session.makeMove('e2', 'e4');
  h.eventBus.emit('bot:move-ready', { bestmove: 'e7e5' });

  assert.equal(state(h).game.history().join(' '), 'e4 e5');
  assert.equal(state(h).currentViewPly, 2);
  h.close();
});

test('moving from a past position replaces the later moves', () => {
  const { h, session } = setup();
  playMoves(h, ['e4', 'e5', 'Nf3', 'Nc6']);
  h.store.setState({ currentViewPly: 2 });

  assert.equal(session.makeMove('d2', 'd4'), true);
  assert.equal(state(h).game.history().join(' '), 'e4 e5 d4');
  assert.equal(state(h).historyFENs.length, 4);
  assert.equal(state(h).currentViewPly, 3);
  assert.equal(state(h).historyFENs.at(-1), state(h).game.fen());
  h.close();
});

test('checkmate shows the game-over overlay', () => {
  const { h, session } = setup();
  state(h).game.load('6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1');
  h.store.setState({ historyFENs: [state(h).game.fen()], currentViewPly: 0 });

  assert.equal(session.makeMove('e1', 'e8'), true);
  assert.match(h.$('#gameStatus').text(), /^Мат!/);
  assert.equal(h.$('#gameOverOverlay').css('display'), 'flex');
  h.close();
});

test('editor mode lets the side not on move make a move', () => {
  const { h, session } = setup({ botLevel: 0 });
  assert.equal(session.makeMove('e7', 'e5', 'bP'), true);

  assert.equal(state(h).game.get('e5').type, 'p');
  assert.equal(state(h).game.get('e5').color, 'b');
  h.close();
});

test('a FEN request replaces the position and rejects invalid input', () => {
  const { h } = setup();
  h.$('body').append('<div id="fenError"></div>');
  h.eventBus.emit('shell:set-fen-requested', { fen: '8/8/8/8/8/8/8/K6k w - - 0 1' });
  assert.equal(state(h).game.fen(), '8/8/8/8/8/8/8/K6k w - - 0 1');
  assert.deepEqual(state(h).historyFENs, [state(h).game.fen()]);

  h.eventBus.emit('shell:set-fen-requested', { fen: 'not a fen' });
  assert.equal(state(h).game.fen(), '8/8/8/8/8/8/8/K6k w - - 0 1');
  assert.equal(h.$('#fenError').text(), 'Некорректная позиция FEN.');
  h.close();
});

test('playFromReviewMoment truncates the game to the moment position and updates status', () => {
  const { h, session } = setup();
  playMoves(h, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6']);
  const fens = state(h).historyFENs.slice();
  const record = {
    humanColor: 'w',
    botLevel: 10,
    fens,
    moves: [{ from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' }, { from: 'g1', to: 'f3' }, { from: 'b8', to: 'c6' }, { from: 'f1', to: 'c4' }, { from: 'g8', to: 'f6' }]
  };
  const moment = { ply: 2, bestMove: 'd2d4' }; // position before 2. Nf3

  session.playFromReviewMoment(record, moment);

  assert.equal(state(h).historyFENs.length, 3);
  assert.equal(state(h).currentViewPly, 2);
  assert.equal(state(h).game.history().join(' '), 'e4 e5');
  assert.match(h.$('#gameStatus').text(), /Ход: Белые/);
  h.close();
});

test('playBestMoveFromMoment plays the suggested best move and triggers bot move', () => {
  const { h, session } = setup();
  playMoves(h, ['e4', 'e5', 'Nf3', 'Nc6']);
  const fens = state(h).historyFENs.slice();
  const record = {
    humanColor: 'w',
    botLevel: 10,
    fens,
    moves: [{ from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' }, { from: 'g1', to: 'f3' }, { from: 'b8', to: 'c6' }]
  };
  const moment = { ply: 2, bestMove: 'd2d4' }; // best move at ply 2 is d4

  session.playBestMoveFromMoment(record, moment);

  assert.equal(state(h).game.history().join(' '), 'e4 e5 d4');
  assert.equal(state(h).currentViewPly, 3);
  assert.equal(state(h).historyFENs.length, 4);
  h.close();
});


test('the play panel moves from setup to the game on the first move and to the result on mate', () => {
  const { h, session } = setup();
  const phase = () => h.$('#tab-play').attr('data-phase');
  state(h).game.load('6k1/5ppp/8/n7/8/8/8/4R1K1 w - - 0 1');
  h.store.setState({ historyFENs: [state(h).game.fen()], currentViewPly: 0 });
  assert.equal(phase(), 'setup');

  session.makeMove('e1', 'e2');
  assert.equal(phase(), 'game');

  h.eventBus.emit('bot:move-ready', { bestmove: 'a5b3' });
  session.makeMove('e2', 'e8');
  assert.equal(phase(), 'review');
  assert.equal(h.$('#gameResultTitle').text(), 'Победа · мат');

  // Going back to the setup form is not undone by later status updates of the same final position
  session.setPanelPhase('setup');
  session.updateStatus();
  assert.equal(phase(), 'setup');
  h.close();
});

test('the result card names the outcome and stays closed once dismissed', () => {
  const { h, session } = setup();
  state(h).game.load('6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1');
  h.store.setState({ historyFENs: [state(h).game.fen()], currentViewPly: 0 });
  session.makeMove('e1', 'e8');

  assert.equal(h.$('#gameOverText').text(), 'Победа');
  assert.equal(h.$('#gameOverReason').text(), 'Мат · вы играли белыми');
  assert.equal(h.$('#gameOverScore').text(), '1 – 0');
  assert.equal(h.$('#gameOverOverlay').attr('data-outcome'), 'win');

  session.dismissOverlay();
  session.updateStatus();
  assert.equal(h.$('#gameOverOverlay').css('display'), 'none');
  h.close();
});

test('stalemate is reported as a draw with its reason', () => {
  const { h, session } = setup();
  state(h).game.load('7k/8/6Q1/8/8/8/8/K7 w - - 0 1');
  h.store.setState({ historyFENs: [state(h).game.fen()], currentViewPly: 0 });
  session.makeMove('g6', 'f7');

  assert.equal(h.$('#gameStatus').text(), 'Ничья: пат.');
  assert.equal(h.$('#gameOverText').text(), 'Ничья');
  assert.equal(h.$('#gameOverScore').text(), '½ – ½');
  h.close();
});

test('a pawn promotes to the chosen piece', () => {
  const { h, session } = setup();
  state(h).game.load('8/4P3/8/8/8/8/8/k6K w - - 0 1');
  h.store.setState({ historyFENs: [state(h).game.fen()], currentViewPly: 0 });
  assert.equal(session.makeMove('e7', 'e8', 'wP', 'n'), true);
  assert.deepEqual(state(h).game.get('e8'), { type: 'n', color: 'w' });
  h.close();
});


test('taking back removes the bot reply and the player\'s move', () => {
  const { h, session } = setup();
  session.makeMove('e2', 'e4');
  h.eventBus.emit('bot:move-ready', { bestmove: 'e7e5' });
  assert.equal(state(h).game.history().join(' '), 'e4 e5');

  assert.equal(session.takeBack(), true);
  assert.equal(state(h).game.history().length, 0);
  assert.equal(state(h).historyFENs.length, 1);
  assert.equal(session.takeBack(), false, 'nothing left to take back');
  h.close();
});

test('resigning ends the game as a loss', () => {
  const { h, session } = setup();
  session.makeMove('e2', 'e4');
  assert.equal(session.resign(), true);
  assert.equal(h.$('#gameOverText').text(), 'Поражение');
  assert.equal(h.$('#gameOverReason').text(), 'Вы сдались · вы играли белыми');
  assert.equal(h.$('#tab-play').attr('data-phase'), 'review');
  h.close();
});

test('a game in progress is saved after each move and can be resumed', () => {
  const storage = memoryStorage();
  const first = setup(undefined, storage);
  first.session.makeMove('e2', 'e4');
  first.h.eventBus.emit('bot:move-ready', { bestmove: 'c7c5' });
  first.session.makeMove('g1', 'f3');
  first.h.close();

  const { h, session } = setup(undefined, storage);
  assert.equal(session.resumeLiveGame(), true);
  assert.equal(state(h).game.history().join(' '), 'e4 c5 Nf3');
  assert.equal(state(h).historyFENs.length, 4);
  assert.equal(h.$('#tab-play').attr('data-phase'), 'game');
  h.close();
});

test('a finished game is no longer offered to resume', () => {
  const storage = memoryStorage();
  const { h, session } = setup(undefined, storage);
  session.makeMove('e2', 'e4');
  session.resign();
  assert.equal(session.resumeLiveGame(), false);
  h.close();
});

test('taking back every move leaves nothing to resume', () => {
  const { h, session } = setup();
  session.makeMove('e2', 'e4');
  h.eventBus.emit('bot:move-ready', { bestmove: 'e7e5' });
  session.takeBack();
  assert.equal(session.resumeLiveGame(), false);
  h.close();
});

test('reopening a finished game shows its result without the result card', () => {
  const { h, session } = setup();
  const start = '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1';
  const game = new h.Chess(start);
  const fens = [game.fen()];
  game.move('Re8#');
  fens.push(game.fen());
  session.presentFinishedGame({
    id: 'old', humanColor: 'w', botLevel: 15, result: '1-0', endReason: 'checkmate',
    fens, moves: game.history({ verbose: true }), timeControl: { enabled: true, baseMinutes: 5, incrementSeconds: 0 }
  });

  assert.equal(h.$('#gameResultTitle').text(), 'Победа · мат');
  assert.equal(h.$('#gameResultMeta').text(), 'Вы против: Бот · уровень 15 · 5 + 0');
  assert.equal(h.$('#gameOverOverlay').css('display'), 'none');
  h.close();
});

test('a rated game shows the rating change on the result card', () => {
  const { h, session, rating, savedRatings } = setup(undefined, memoryStorage(), { rated: true });
  rating.begin({ timeControl: RAPID, botLevel: 10, humanColor: 'w' });
  session.makeMove('e2', 'e4');
  session.resign();
  assert.match(h.$('#gameOverRating').text(), /^Рапид: \d+\? \(−\d+\)$/);
  assert.equal(h.$('#gameOverRating').prop('hidden'), false);
  assert.equal(savedRatings.at(-1).rapid.games, 1);
  h.close();
});

test('taking a move back makes the game unrated', () => {
  const { h, session, rating, savedRatings } = setup(undefined, memoryStorage(), { rated: true });
  rating.begin({ timeControl: RAPID, botLevel: 10, humanColor: 'w' });
  session.makeMove('e2', 'e4');
  h.eventBus.emit('bot:move-ready', { bestmove: 'e7e5' });
  session.takeBack();
  assert.equal(h.$('#ratedChip').text(), 'Без рейтинга');
  session.makeMove('d2', 'd4');
  session.resign();
  assert.equal(h.$('#gameOverRating').text(), 'Без рейтинга: вы брали ход назад');
  assert.deepEqual(savedRatings, []);
  h.close();
});

test('moving on from an earlier position also makes the game unrated', () => {
  const { h, session, rating } = setup(undefined, memoryStorage(), { rated: true });
  rating.begin({ timeControl: RAPID, botLevel: 10, humanColor: 'w' });
  session.makeMove('e2', 'e4');
  h.eventBus.emit('bot:move-ready', { bestmove: 'e7e5' });
  h.store.setState({ currentViewPly: 0 });
  session.makeMove('d2', 'd4');
  assert.equal(h.$('#ratedChip').text(), 'Без рейтинга');
  h.close();
});

test('a resumed game stays unrated after help taken before the reload', () => {
  const storage = memoryStorage();
  const first = setup(undefined, storage, { rated: true });
  first.rating.begin({ timeControl: RAPID, botLevel: 10, humanColor: 'w' });
  first.session.makeMove('e2', 'e4');
  first.rating.markUnrated('hint');
  first.h.eventBus.emit('bot:move-ready', { bestmove: 'e7e5' });
  first.h.close();

  const { h, session, savedRatings } = setup(undefined, storage, { rated: true });
  assert.equal(session.resumeLiveGame(), true);
  assert.equal(h.$('#ratedChip').text(), 'Без рейтинга');
  session.resign();
  assert.equal(h.$('#gameOverRating').text(), 'Без рейтинга: вы брали подсказку');
  assert.deepEqual(savedRatings, []);
  h.close();
});

test('a game played without pressing «Играть» shows no rating', () => {
  const { h, session } = setup(undefined, memoryStorage(), { rated: true });
  session.makeMove('e2', 'e4');
  session.resign();
  assert.equal(h.$('#gameOverRating').prop('hidden'), true);
  h.close();
});

test('after «Доиграть отсюда» on a finished game the bot answers the next move', () => {
  const { h, session } = setup();
  const moves = [['e2', 'e4'], ['e7', 'e5'], ['f1', 'c4'], ['b8', 'c6'], ['d1', 'h5'], ['g8', 'f6']];
  for (let i = 0; i < moves.length; i += 2) {
    session.makeMove(...moves[i]);
    h.eventBus.emit('bot:move-ready', { bestmove: moves[i + 1].join('') });
  }
  session.makeMove('h5', 'f7');
  assert.equal(h.$('#tab-play').attr('data-phase'), 'review');

  const record = {
    humanColor: 'w', botLevel: 10, fens: state(h).historyFENs.slice(),
    moves: [...moves, ['h5', 'f7']].map(([from, to]) => ({ from, to }))
  };
  session.playFromReviewMoment(record, { ply: 4, bestMove: 'g1f3' });
  assert.equal(h.$('#tab-play').attr('data-phase'), 'game');

  session.makeMove('g1', 'f3');
  h.eventBus.emit('bot:move-ready', { bestmove: 'g8f6' });
  assert.equal(state(h).game.history().join(' '), 'e4 e5 Bc4 Nc6 Nf3 Nf6');
  h.close();
});

test('when reviewTrainer is active via guided, session.makeMove routes to reviewTrainer.tryMove and switching tabs exits guided', () => {
  const h = createHarness();
  h.$('body').append('<button class="tab-btn" data-tab="tab-setup"></button><button class="tab-btn" data-tab="tab-puzzles"></button><button id="loadPuzzleBtn"></button>');

  let puzzleActive = false;
  let lessonActive = false;
  const puzzleMock = { isActive: () => puzzleActive, isCompleted: () => false, tryMove: () => false, exit: () => { puzzleActive = false; } };
  const lessonMock = { isActive: () => lessonActive, isCompleted: () => false, tryMove: () => false, exit: () => { lessonActive = false; } };

  let trainer;
  const guided = {
    isActive: () => puzzleMock.isActive() || lessonMock.isActive() || trainer.isActive(),
    isCompleted: () => (trainer.isActive() ? trainer.isCompleted() : (lessonMock.isActive() ? lessonMock.isCompleted() : puzzleMock.isCompleted())),
    tryMove: (source, target, promotion) => {
      if (trainer.isActive()) return trainer.tryMove(source, target, promotion);
      return lessonMock.isActive()
        ? lessonMock.tryMove(source, target, promotion)
        : puzzleMock.tryMove(source, target, promotion);
    },
    exit: (options) => {
      if (trainer.isActive()) trainer.exit(options);
      if (lessonMock.isActive()) lessonMock.exit(options);
      if (puzzleMock.isActive()) puzzleMock.exit(options);
    }
  };

  trainer = createReviewTrainerController({
    $: h.$,
    Chess: h.Chess,
    store: h.store,
    eventBus: h.eventBus,
    boardView: h.boardView,
    moveHistoryView: h.moveHistoryView,
    clearSelection: h.clearSelection,
    playSound: h.playSound,
    playSoundForMove: h.playSoundForMove,
    toSan: () => null,
    onComplete: () => {}
  });

  const session = createGameSession({
    $: h.$, Chess: h.Chess, store: h.store, eventBus: h.eventBus, boardView: h.boardView, clock: h.clock,
    botCoordinator: h.botCoordinator, analysisCoordinator: h.analysisCoordinator, moveHistoryView: h.moveHistoryView,
    services: h.services, puzzle: guided, getBotLevel: h.getBotLevel, clearSelection: h.clearSelection,
    playSound: h.playSound, playSoundForMove: h.playSoundForMove, saveStoredSettings: h.saveStoredSettings
  });

  h.$('.tab-btn[data-tab="tab-setup"], .tab-btn[data-tab="tab-puzzles"]').on('click', function() {
    guided.exit({ keepPosition: true });
    session.updateStatus();
  });
  h.$('#loadPuzzleBtn').on('click', function() {
    if (trainer.isActive()) trainer.exit({ keepPosition: true });
  });

  const record = {
    humanColor: 'b',
    fens: ['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1']
  };
  const moments = [{ ply: 0, bestMove: 'e7e5', san: 'e5' }];

  // Before trainer start, guided is inactive
  assert.equal(guided.isActive(), false);
  assert.equal(trainer.isActive(), false);

  // Start trainer
  trainer.start(record, moments, 0);
  assert.equal(trainer.isActive(), true);
  assert.equal(guided.isActive(), true);

  // session.makeMove routes to guided.tryMove -> trainer.tryMove
  // An incorrect move is rejected by trainer
  const wrongMoveResult = session.makeMove('d7', 'd5');
  assert.equal(wrongMoveResult, false);
  assert.equal(trainer.isCompleted(), false);

  // A correct move solves the trainer moment
  const correctMoveResult = session.makeMove('e7', 'e5');
  assert.equal(correctMoveResult, true);
  assert.equal(trainer.isCompleted(), true);
  assert.equal(guided.isCompleted(), true);

  // Switching to editor via tab-setup exits guided (and thus reviewTrainer)
  h.$('.tab-btn[data-tab="tab-setup"]').trigger('click');
  assert.equal(guided.isActive(), false);
  assert.equal(trainer.isActive(), false);

  // Restart trainer and verify puzzle loading exits trainer/guided
  trainer.start(record, moments, 0);
  assert.equal(guided.isActive(), true);
  assert.equal(trainer.isActive(), true);

  h.$('#loadPuzzleBtn').trigger('click');
  assert.equal(trainer.isActive(), false);
  assert.equal(guided.isActive(), false);

  // Restart trainer and verify switching to tab-puzzles exits trainer/guided
  trainer.start(record, moments, 0);
  assert.equal(guided.isActive(), true);
  h.$('.tab-btn[data-tab="tab-puzzles"]').trigger('click');
  assert.equal(guided.isActive(), false);
  assert.equal(trainer.isActive(), false);

  h.close();
});

