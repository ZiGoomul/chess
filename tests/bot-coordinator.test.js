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
