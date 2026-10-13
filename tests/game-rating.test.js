import test from 'node:test';
import assert from 'node:assert/strict';
import { glicko2Update, inflateRd } from '../src/domain/glicko2.js';
import {
  NEW_PLAYER_RATING, ratingCategory, rateGameAgainstBot, formatRating, scoreForPlayer, isProvisional
} from '../src/domain/game-rating.js';

const DAY = 24 * 60 * 60 * 1000;

test('Glicko-2 matches the worked example of the paper', () => {
  const player = glicko2Update({ rating: 1500, rd: 200, vol: 0.06 }, [
    { opponentRating: 1400, opponentRd: 30, score: 1 },
    { opponentRating: 1550, opponentRd: 100, score: 0 },
    { opponentRating: 1700, opponentRd: 300, score: 0 }
  ]);
  assert.ok(Math.abs(player.rating - 1464.06) < 0.05, `rating ${player.rating}`);
  assert.ok(Math.abs(player.rd - 151.52) < 0.05, `rd ${player.rd}`);
  assert.ok(Math.abs(player.vol - 0.05999) < 0.00001, `vol ${player.vol}`);
});

test('idle time makes the rating less sure, up to the maximum', () => {
  const player = { rating: 1500, rd: 50, vol: 0.06 };
  assert.equal(inflateRd(player, 0, 350), 50);
  assert.ok(inflateRd(player, 30, 350) > 50);
  assert.equal(inflateRd(player, 100000, 350), 350);
});

test('the rating category follows the time control labels of the app', () => {
  assert.equal(ratingCategory({ enabled: true, baseMinutes: 1 }), 'bullet');
  assert.equal(ratingCategory({ enabled: true, baseMinutes: 3 }), 'blitz');
  assert.equal(ratingCategory({ enabled: true, baseMinutes: 10 }), 'rapid');
  assert.equal(ratingCategory({ enabled: true, baseMinutes: 60 }), 'classical');
  assert.equal(ratingCategory({ enabled: true, baseMinutes: 1440 }), 'daily');
  assert.equal(ratingCategory({ enabled: false, baseMinutes: 10 }), 'untimed');
});

test('a new player moves a lot, then less as the rating settles', () => {
  let player = NEW_PLAYER_RATING;
  const first = rateGameAgainstBot(player, 1700, 1, 0);
  assert.ok(first.delta > 100, `first win +${first.delta}`);
  assert.equal(first.player.games, 1);
  assert.equal(formatRating(first.player).endsWith('?'), true);

  player = first.player;
  for (let i = 0; i < 30; i++) player = rateGameAgainstBot(player, 1700, i % 2, i * 1000).player;
  assert.equal(isProvisional(player), false);
  const settled = rateGameAgainstBot(player, 1700, 1, 31 * 1000);
  assert.ok(settled.delta > 0 && settled.delta < first.delta / 3, `settled win +${settled.delta}`);
});

test('beating a stronger bot gains more than beating a weaker one; losing to a weaker one costs more', () => {
  const player = { ...NEW_PLAYER_RATING, rd: 80, games: 40, lastPlayedAt: 0 };
  assert.ok(rateGameAgainstBot(player, 2200, 1, 0).delta > rateGameAgainstBot(player, 800, 1, 0).delta);
  assert.ok(rateGameAgainstBot(player, 800, 0, 0).delta < rateGameAgainstBot(player, 2200, 0, 0).delta);
  assert.equal(Math.sign(rateGameAgainstBot(player, 1500, 0.5, 0).delta), 0);
});

test('a long break makes the next game count more', () => {
  const player = { ...NEW_PLAYER_RATING, rd: 60, games: 100, lastPlayedAt: 0 };
  const soon = rateGameAgainstBot(player, 1700, 1, DAY).delta;
  const later = rateGameAgainstBot(player, 1700, 1, 200 * DAY).delta;
  assert.ok(later > soon, `${later} > ${soon}`);
});

test('the score is from the player\'s side', () => {
  assert.equal(scoreForPlayer('1-0', 'w'), 1);
  assert.equal(scoreForPlayer('1-0', 'b'), 0);
  assert.equal(scoreForPlayer('0-1', 'b'), 1);
  assert.equal(scoreForPlayer('1/2-1/2', 'w'), 0.5);
});
