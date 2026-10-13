import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import jqueryFactory from 'jquery';
import { createRatedGame, describeRatingChange } from '../src/app/rated-game.js';
import { describeGame } from '../src/ui/games-list.js';

const PAGE = `<!doctype html><body>
  <input type="checkbox" id="timerEnableCb" checked><input id="timerBase" value="10">
  <input type="checkbox" id="autoHintCb"><input type="checkbox" id="highlightAttacksCb"><input type="checkbox" id="highlightDefensesCb">
  <button id="hintBtn"></button><select id="botLevel"><option value="10" selected>10</option><option value="0">0</option></select>
  <span id="bottomPlayerRating" hidden></span><span id="ratedChip" hidden></span><p id="playRatingNote"></p><div id="ratingsSummary"></div>
</body>`;

const RAPID = { enabled: true, baseMinutes: 10 };
const movesBy = (white, black) => color => (color === 'w' ? white : black);

function setup({ ratings = {} } = {}) {
  const dom = new JSDOM(PAGE);
  const $ = jqueryFactory(dom.window);
  const saved = [];
  const rating = createRatedGame({
    $, botLevelToRating: level => ({ 1: 800, 10: 1700 }[level] || 1500),
    initialRatings: ratings, saveRatings: value => { saved.push(value); }, now: () => 0
  });
  return { $, rating, saved, close: () => dom.window.close() };
}

test('a game played without help changes the rating of its time control', () => {
  const { $, rating, saved, close } = setup();
  assert.equal($('#bottomPlayerRating').text(), '1500?');
  assert.equal($('#playRatingNote').text(), 'Рейтинговая партия (Рапид, ваш рейтинг 1500?). Подсказка или ход назад сделают её нерейтинговой.');

  rating.begin({ timeControl: RAPID, botLevel: 10, humanColor: 'w' });
  assert.equal($('#ratedChip').prop('hidden'), false);
  assert.equal($('#ratedChip').text(), 'Рейтинговая · Рапид');

  const change = rating.complete({ result: '1-0', movesBy: movesBy(20, 20) });
  assert.equal(change.rated, true);
  assert.equal(change.category, 'rapid');
  assert.equal(change.before, 1500);
  assert.ok(change.delta > 0);
  assert.equal(saved.at(-1).rapid.games, 1);
  assert.equal($('#ratedChip').prop('hidden'), true);
  assert.equal($('#bottomPlayerRating').text(), `${change.after}?`);
  assert.match($('#ratingsSummary').text(), new RegExp(`Рапид ${change.after}\\?`));
  close();
});

test('any help makes the game unrated for good', () => {
  for (const takeHelp of [
    $ => $('#hintBtn').trigger('click'),
    $ => $('#autoHintCb').prop('checked', true).trigger('change'),
    $ => $('#highlightAttacksCb').prop('checked', true).trigger('change'),
    $ => $('#botLevel').val('0').trigger('change'),
    (_$, rating) => rating.markUnrated('takeback')
  ]) {
    const { $, rating, saved, close } = setup();
    rating.begin({ timeControl: RAPID, botLevel: 10, humanColor: 'w' });
    takeHelp($, rating);
    assert.equal($('#ratedChip').text(), 'Без рейтинга');
    // Switching the help off again does not make it rated
    $('#autoHintCb, #highlightAttacksCb').prop('checked', false).trigger('change');
    assert.equal($('#ratedChip').text(), 'Без рейтинга');
    const change = rating.complete({ result: '1-0', movesBy: movesBy(20, 20) });
    assert.equal(change.rated, false);
    assert.deepEqual(saved, []);
    close();
  }
});

test('a game started with help switched on is unrated, and the setup says so', () => {
  const { $, rating, close } = setup();
  $('#autoHintCb').prop('checked', true).trigger('change');
  assert.equal($('#playRatingNote').text(), 'Партия будет без рейтинга: включена авто-подсказка.');
  rating.begin({ timeControl: RAPID, botLevel: 10, humanColor: 'w' });
  assert.equal(rating.complete({ result: '0-1', movesBy: movesBy(5, 5) }).reason, 'autoHint');
  close();
});

test('a game without a move of the player is not rated', () => {
  const { rating, close } = setup();
  rating.begin({ timeControl: RAPID, botLevel: 10, humanColor: 'b' });
  assert.equal(rating.complete({ result: '1-0', movesBy: movesBy(1, 0) }).reason, 'noMoves');
  close();
});

test('the result counts for the colour chosen at the start', () => {
  const { rating, close } = setup();
  rating.begin({ timeControl: RAPID, botLevel: 10, humanColor: 'b' });
  assert.ok(rating.complete({ result: '0-1', movesBy: movesBy(10, 10) }).delta > 0);
  close();
});

test('a left game is not rated; a saved one keeps its state through a reload', () => {
  const { rating, saved, close } = setup();
  rating.begin({ timeControl: RAPID, botLevel: 10, humanColor: 'w' });
  rating.cancel();
  assert.equal(rating.complete({ result: '1-0', movesBy: movesBy(10, 10) }), null);

  rating.begin({ timeControl: { enabled: false, baseMinutes: 10 }, botLevel: 1, humanColor: 'w' });
  rating.markUnrated('hint');
  const snapshot = rating.snapshot();
  rating.cancel();
  rating.restore(snapshot);
  assert.equal(rating.complete({ result: '1-0', movesBy: movesBy(10, 10) }).reason, 'hint');
  assert.deepEqual(saved, []);
  close();
});

test('rating changes are described for the result card and the games list', () => {
  assert.equal(describeRatingChange({ rated: true, category: 'blitz', after: 1512, delta: 12, provisional: false }), 'Блиц: 1512 (+12)');
  assert.equal(describeRatingChange({ rated: true, category: 'rapid', after: 1390, delta: -110, provisional: true }), 'Рапид: 1390? (−110)');
  assert.equal(describeRatingChange({ rated: false, category: 'rapid', reason: 'takeback' }), 'Без рейтинга: вы брали ход назад');
  assert.equal(describeRatingChange(null), '');

  const info = describeGame({ result: '1-0', humanColor: 'w', moves: [], rating: { category: 'rapid', after: 1512, delta: 12 } }, null);
  assert.deepEqual(info.rating, { text: '+12', title: 'Рапид: 1512', sign: 1 });
  assert.equal(describeGame({ result: '1-0', humanColor: 'w', moves: [] }, null).rating, null);
});

function setupRatedMode({ ratedMode = true } = {}) {
  const dom = new JSDOM(PAGE.replace('</body>', '<input type="checkbox" id="ratedModeCb"></body>'));
  const $ = jqueryFactory(dom.window);
  const assists = [];
  const modes = [];
  const saved = [];
  const rating = createRatedGame({
    $, botLevelToRating: () => 1700, saveRatings: value => { saved.push(value); }, now: () => 0,
    initialRatedMode: ratedMode, saveRatedMode: on => { modes.push(on); }, onAssistsChange: off => { assists.push(off); }
  });
  return { $, rating, assists, modes, saved, close: () => dom.window.close() };
}

test('«Играть на рейтинг» switches the help off for the game and leaves the settings alone', () => {
  const { $, rating, assists, saved, close } = setupRatedMode();
  $('#autoHintCb, #highlightAttacksCb').prop('checked', true);
  rating.render();
  assert.match($('#playRatingNote').text(), /^Рейтинговая партия \(Рапид, ваш рейтинг 1500\?\)\. Подсказки и подсветка нападений выключатся до конца партии/);

  rating.begin({ timeControl: RAPID, botLevel: 10, humanColor: 'w' });
  assert.deepEqual(assists, [true]);
  assert.equal($('#ratedChip').text(), 'Рейтинговая · Рапид');

  // The switched-off help cannot spoil the game
  $('#hintBtn').trigger('click');
  $('#highlightDefensesCb').prop('checked', true).trigger('change');
  assert.equal($('#ratedChip').text(), 'Рейтинговая · Рапид');

  const change = rating.complete({ result: '1-0', movesBy: movesBy(20, 20) });
  assert.equal(change.rated, true);
  assert.equal(saved.length, 1);
  assert.deepEqual(assists, [true, false], 'the help comes back after the game');
  assert.equal($('#autoHintCb').is(':checked'), true, 'the settings are untouched');
  assert.equal($('#highlightAttacksCb').is(':checked'), true);
  close();
});

test('a take-back still makes a game with the help off unrated', () => {
  const { rating, close } = setupRatedMode();
  rating.begin({ timeControl: RAPID, botLevel: 10, humanColor: 'w' });
  rating.markUnrated('takeback');
  assert.equal(rating.complete({ result: '1-0', movesBy: movesBy(20, 20) }).reason, 'takeback');
  close();
});

test('the switch is remembered, and off it brings back the warning', () => {
  const { $, modes, close } = setupRatedMode({ ratedMode: true });
  assert.equal($('#ratedModeCb').is(':checked'), true);
  $('#autoHintCb').prop('checked', true);
  $('#ratedModeCb').prop('checked', false).trigger('change');
  assert.deepEqual(modes, [false]);
  assert.equal($('#playRatingNote').text(), 'Партия будет без рейтинга: включена авто-подсказка.');
  close();
});

test('the help stays off for a resumed game and comes back when it is left', () => {
  const { rating, assists, close } = setupRatedMode();
  rating.begin({ timeControl: RAPID, botLevel: 10, humanColor: 'w' });
  const snapshot = rating.snapshot();
  rating.cancel();
  rating.restore(snapshot);
  assert.deepEqual(assists, [true, false, true]);
  rating.cancel();
  assert.deepEqual(assists, [true, false, true, false]);
  close();
});
