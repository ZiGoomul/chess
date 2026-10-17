import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import jqueryFactory from 'jquery';
import { Chess } from 'chess.js';
import { createEventBus } from '../src/core/event-bus.js';
import { createMaterialView } from '../src/ui/material-view.js';

function setup(theme) {
  const dom = new JSDOM(`<!doctype html><body>
    <select id="pieceThemeSelect"><option value="cburnett">cburnett</option><option value="merida">merida</option><option value="chesscom_neo">neo</option></select>
    <div id="topMaterial"></div><div id="bottomMaterial"></div></body>`);
  const $ = jqueryFactory(dom.window);
  $('#pieceThemeSelect').val(theme);
  const eventBus = createEventBus();
  createMaterialView({ $, eventBus, Chess });
  return { $, eventBus, close: () => dom.window.close() };
}

// White has taken a pawn
const AFTER_EXD5 = 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';

test('captured pieces are drawn in the piece set chosen in the settings', () => {
  const { $, eventBus, close } = setup('merida');
  eventBus.emit('game:move-made', { fen: AFTER_EXD5 });
  assert.equal($('#bottomMaterial img').attr('src'), 'https://lichess1.org/assets/piece/merida/bP.svg');
  close();
});

test('changing the piece set redraws the captured pieces', () => {
  const { $, eventBus, close } = setup('cburnett');
  eventBus.emit('game:move-made', { fen: AFTER_EXD5 });
  assert.equal($('#bottomMaterial img').attr('src'), '/pieces/cburnett/bP.svg');

  $('#pieceThemeSelect').val('chesscom_neo');
  eventBus.emit('settings:changed', { pieceTheme: 'chesscom_neo' });
  assert.equal($('#bottomMaterial img').attr('src'), 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bp.png');
  close();
});

test('pawn promotion does not count as opponent captured pawn', () => {
  const { $, eventBus, close } = setup('cburnett');
  // Position where White has 2 Queens, 7 Pawns (one pawn promoted to Queen), no captures
  const TWO_WHITE_QUEENS = 'rnbqkbnr/pppppppp/8/8/8/7Q/PPPPPPP1/RNBQKBNR b KQkq - 0 1';
  eventBus.emit('game:move-made', { fen: TWO_WHITE_QUEENS });

  // Black has captured 0 white pawns
  assert.equal($('#topMaterial img').length, 0);
  // Score for White is +8 (9 - 1: pawn promoted to Queen)
  assert.equal($('#bottomMaterial .material-score').text(), '+8');
  close();
});

