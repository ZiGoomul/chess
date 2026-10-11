import { determineMoveSound } from '../domain/check-state.js';


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

// Short wooden "tock": a burst of filtered noise; higher / softer for a move, lower / fuller for a capture
function playTock(ctx, at, { frequency, duration, gain }) {
  const length = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = 2.5;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.001, at + duration);
  source.connect(filter);
  filter.connect(amp);
  amp.connect(ctx.destination);
  source.start(at);
}

// Soft two-note chime for the start and end of a game
function playChime(ctx, at, notes, gain) {
  notes.forEach((frequency, index) => {
    const start = at + index * 0.12;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  });
}

/** Plays a game sound synthesised in the browser; no files, works offline. */
export function playSynthesizedSound(type, volume = 1) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    if (type === 'move') playTock(ctx, now, { frequency: 1700, duration: 0.07, gain: 0.9 * volume });
    else if (type === 'capture') {
      playTock(ctx, now, { frequency: 1100, duration: 0.09, gain: 1.2 * volume });
      playTock(ctx, now + 0.035, { frequency: 2300, duration: 0.05, gain: 0.5 * volume });
    } else if (type === 'castle') {
      playTock(ctx, now, { frequency: 1700, duration: 0.07, gain: 0.8 * volume });
      playTock(ctx, now + 0.11, { frequency: 1500, duration: 0.07, gain: 0.8 * volume });
    } else if (type === 'check') playSyntheticCheckSound(volume);
    else if (type === 'gameStart') playChime(ctx, now, [523, 784], 0.18 * volume);
    else if (type === 'gameEnd') playChime(ctx, now, [784, 523], 0.18 * volume);
  } catch {
    // Audio is a nicety; ignore a context that cannot play
  }
}

export function createAudio(game) {
  let enabled = true;
  let volume = 0.7;

  function playSound(type) {
    if (!enabled || volume <= 0) return;
    playSynthesizedSound(type, volume);
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
