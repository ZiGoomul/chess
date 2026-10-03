// chessboard.js expects a global jQuery, so it must be evaluated after jQuery is exposed.
import jQuery from 'jquery';

window.$ = window.jQuery = jQuery;
await import('@chrisoakman/chessboardjs/dist/chessboard-1.0.0.js');
