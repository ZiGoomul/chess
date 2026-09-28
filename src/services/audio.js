const SOUND_URLS = {
  move: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3',
  capture: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3',
  check: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3',
  castle: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/castle.mp3',
  gameEnd: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3',
  gameStart: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-start.mp3'
};

export function createAudio(game) {
  const sounds = Object.fromEntries(
    Object.entries(SOUND_URLS).map(([name, url]) => [name, new Audio(url)])
  );

  function playSound(type) {
    const sound = sounds[type];
    if (!sound) return;

    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  function playSoundForMove(move) {
    if (!move) {
      playSound('move');
    } else if (game.in_checkmate() || game.in_draw()) {
      playSound('gameEnd');
    } else if (game.in_check()) {
      playSound('check');
    } else if (move.flags && (move.flags.includes('c') || move.flags.includes('e'))) {
      playSound('capture');
    } else if (move.flags && (move.flags.includes('k') || move.flags.includes('q'))) {
      playSound('castle');
    } else {
      playSound('move');
    }
  }

  return { playSound, playSoundForMove };
}
