import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { createEventBus } from '../src/core/event-bus.js';
import { createGameStore } from '../src/core/game-store.js';
import { createBotCoordinator } from '../src/services/bot-coordinator.js';

function setup() {
  const eventBus = createEventBus();
  const store = createGameStore({ game: new Chess() });
  store.setState({ orientation: 'black', settings: { ...store.getState().settings, botLevel: 5 } });
  const engine = { requestBotMove() {}, cancelBotMove() {}, setBotLevel() {} };
  let clock = 0;
  const bot = createBotCoordinator({ eventBus, store, engine, thinkTime: () => 50, now: () => clock });
  const moves = [];
  eventBus.on('bot:move-ready', result => moves.push(result.bestmove));
  return { store, bot, moves, advance: ms => { clock += ms; } };
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('an instant engine answer is held back until the thinking time has passed', async () => {
  const { store, bot, moves } = setup();
  bot.makeBotMove();
  bot.deliverBotMove({ bestmove: 'e2e4' });
  assert.deepEqual(moves, []);
  assert.equal(store.getState().isThinking, true);
  await wait(80);
  assert.deepEqual(moves, ['e2e4']);
  assert.equal(store.getState().isThinking, false);
});

test('a bot move for a position that changed meanwhile is dropped', async () => {
  const { store, bot, moves } = setup();
  bot.makeBotMove();
  bot.deliverBotMove({ bestmove: 'e2e4' });
  store.getState().game.move('d4');
  await wait(80);
  assert.deepEqual(moves, []);
});

test('cancelling stops a pending bot move', async () => {
  const { bot, moves } = setup();
  bot.makeBotMove();
  bot.deliverBotMove({ bestmove: 'e2e4' });
  bot.cancelBotSearch();
  await wait(80);
  assert.deepEqual(moves, []);
});

test('makeBotMove plays opening book move without querying engine', async () => {
  const eventBus = createEventBus();
  const store = createGameStore({ game: new Chess() });
  store.setState({ orientation: 'black', settings: { ...store.getState().settings, botLevel: 5 } });
  let engineCalled = false;
  const engine = {
    requestBotMove() { engineCalled = true; },
    cancelBotMove() {},
    setBotLevel() {}
  };
  const moves = [];
  eventBus.on('bot:move-ready', result => moves.push(result.bestmove));
  const bot = createBotCoordinator({
    eventBus,
    store,
    engine,
    thinkTime: () => 30,
    findBookMove: () => ({ uci: 'e2e4', san: 'e4' })
  });

  bot.makeBotMove();
  assert.equal(engineCalled, false, 'Engine should not be called when book move is found');
  assert.equal(store.getState().isThinking, true);
  await wait(50);
  assert.deepEqual(moves, ['e2e4']);
});

test('makeBotMove does nothing when it is human turn', () => {
  const eventBus = createEventBus();
  const store = createGameStore({ game: new Chess() });
  // Orientation is white, and game.turn() is 'w' -> Human turn!
  store.setState({ orientation: 'white', settings: { ...store.getState().settings, botLevel: 5 } });
  let engineCalled = false;
  const engine = {
    requestBotMove() { engineCalled = true; },
    cancelBotMove() {},
    setBotLevel() {}
  };
  const moves = [];
  eventBus.on('bot:move-ready', result => moves.push(result.bestmove));
  const bot = createBotCoordinator({
    eventBus,
    store,
    engine,
    thinkTime: () => 30,
    findBookMove: () => ({ uci: 'e2e4', san: 'e4' })
  });

  bot.makeBotMove();
  assert.equal(engineCalled, false);
  assert.equal(store.getState().isThinking, false);
  assert.deepEqual(moves, []);
});

test('deliverBotMove drops move if orientation changes to human turn before timer expires', async () => {
  const { store, bot, moves } = setup();
  bot.makeBotMove();
  bot.deliverBotMove({ bestmove: 'e2e4' });
  // Orientation flips to white (human's turn for 'w' in starting position)
  store.setState({ orientation: 'white' });
  await wait(80);
  assert.deepEqual(moves, [], 'Should not emit move when it is human turn');
});


