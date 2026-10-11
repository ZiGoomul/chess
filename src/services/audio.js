import { determineMoveSound } from '../domain/check-state.js';

const SOUND_URLS = {
  move: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3',
  capture: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3',
  check: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3',
  castle: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/castle.mp3',
  gameEnd: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3',
  gameStart: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-start.mp3'
};

let sharedAudioCtx = null;

export function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    try {
      sharedAudioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playSyntheticCheckSound(volume = 1) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    // Dual-frequency slide: distinctive sharp check tap
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.12);

    gain.gain.setValueAtTime(0.3 * volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.14);
  } catch {
    // Graceful fallback if audio context state fails
  }
}

export function createAudio(game) {
  const sounds = (typeof window !== 'undefined' && typeof Audio !== 'undefined')
    ? Object.fromEntries(
        Object.entries(SOUND_URLS).map(([name, url]) => [name, new Audio(url)])
      )
    : {};

  let enabled = true;
  let volume = 0.7;

  function playSound(type) {
    if (!enabled || volume <= 0) return;
    const sound = sounds[type];
    if (!sound) {
      if (type === 'check') playSyntheticCheckSound(volume);
      return;
    }

    try {
      sound.volume = volume;
      sound.currentTime = 0;
      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (type === 'check') {
            playSyntheticCheckSound(volume);
          }
        });
      }
    } catch {
      if (type === 'check') {
        playSyntheticCheckSound(volume);
      }
    }
  }

  /** @param {{ enabled?: boolean, volume?: number }} settings volume from 0 to 1 */
  function configure(settings) {
    if (typeof settings.enabled === 'boolean') enabled = settings.enabled;
    if (Number.isFinite(settings.volume)) volume = Math.max(0, Math.min(1, settings.volume));
  }

  function playSoundForMove(move, targetGame = null) {
    const activeGame = targetGame || game;
    const soundType = determineMoveSound(activeGame, move);
    playSound(soundType);
  }

  return { playSound, playSoundForMove, playSyntheticCheckSound, configure };
}
