export function formatTime(ms) {
  if (ms <= 0) return '00:00.0';

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (ms < 10000) {
    const tenths = Math.floor((ms % 1000) / 100);
    return `${formatted}.${tenths}`;
  }
  return formatted;
}

export function createClock({ $, game, getBoard, getIsPuzzleMode, getCurrentViewPly, getHistoryLength, playSound, onTimeout = () => {} }) {
  let enabled = false;
  let whiteMs = 0;
  let blackMs = 0;
  let incrementMs = 0;
  let intervalId = null;
  let lastTickTime = 0;
  let running = false;
  let previousSettings = null;
  let timedOut = false;

  function updateClockUI() {
    if (!enabled || getIsPuzzleMode()) {
      $('#topClock, #bottomClock').hide();
      return;
    }
    $('#topClock, #bottomClock').show();

    const flipped = getBoard().orientation() === 'black';
    const topMs = flipped ? whiteMs : blackMs;
    const bottomMs = flipped ? blackMs : whiteMs;
    $('#topClock').text(formatTime(topMs));
    $('#bottomClock').text(formatTime(bottomMs));
    $('#topClock').toggleClass('danger', topMs < 10000 && topMs > 0);
    $('#bottomClock').toggleClass('danger', bottomMs < 10000 && bottomMs > 0);
    $('#topClock, #bottomClock').removeClass('active');

    if (game.game_over() || getCurrentViewPly() < getHistoryLength() - 1) return;

    const whiteToMove = game.turn() === 'w';
    const activeClock = flipped
      ? (whiteToMove ? '#topClock' : '#bottomClock')
      : (whiteToMove ? '#bottomClock' : '#topClock');
    $(activeClock).addClass('active');
  }

  function stopClock() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    running = false;
    updateClockUI();
  }

  function timeOut(winnerColor) {
    if (timedOut) return;
    timedOut = true;
    stopClock();
    $('#gameOverText').text(`ВРЕМЯ ВЫШЛО! Победили ${winnerColor}`);
    $('#gameOverOverlay').css('display', 'flex');
    playSound('gameEnd');
    onTimeout({ winnerColor: winnerColor === 'Белые' ? 'w' : 'b', loserColor: winnerColor === 'Белые' ? 'b' : 'w' });
  }

  function tickClock() {
    if (!running || !enabled) return;

    const now = Date.now();
    const delta = now - lastTickTime;
    lastTickTime = now;

    if (game.turn() === 'w') {
      whiteMs -= delta;
      if (whiteMs <= 0) {
        whiteMs = 0;
        timeOut('Чёрные');
      }
    } else {
      blackMs -= delta;
      if (blackMs <= 0) {
        blackMs = 0;
        timeOut('Белые');
      }
    }
    updateClockUI();
  }

  function startClock() {
    if (!enabled || running || timedOut || game.game_over() || getIsPuzzleMode()) return;
    if (game.history().length === 0) return;

    running = true;
    lastTickTime = Date.now();
    intervalId = setInterval(tickClock, 100);
    updateClockUI();
  }

  function applySettings(confirmRestart = false) {
    const settings = {
      enabled: $('#timerEnableCb').is(':checked'),
      baseMinutes: parseInt($('#timerBase').val(), 10),
      incrementSeconds: parseInt($('#timerInc').val(), 10)
    };

    const hasValidTimeControl = Number.isInteger(settings.baseMinutes) &&
      Number.isInteger(settings.incrementSeconds) &&
      settings.baseMinutes >= 1 && settings.baseMinutes <= 180 &&
      settings.incrementSeconds >= 0 && settings.incrementSeconds <= 60;

    if (!hasValidTimeControl) {
      const fallback = previousSettings || { enabled: false, baseMinutes: 5, incrementSeconds: 0 };
      $('#timerEnableCb').prop('checked', fallback.enabled);
      $('#timerBase').val(fallback.baseMinutes);
      $('#timerInc').val(fallback.incrementSeconds);
      return false;
    }

    const hasActiveGame = game.history().length > 0 && !game.game_over() && !getIsPuzzleMode();
    const changed = previousSettings && (
      settings.enabled !== previousSettings.enabled ||
      settings.baseMinutes !== previousSettings.baseMinutes ||
      settings.incrementSeconds !== previousSettings.incrementSeconds
    );

    if (confirmRestart && hasActiveGame && changed && !window.confirm('Изменение настроек сбросит оба таймера. Перезапустить часы?')) {
      $('#timerEnableCb').prop('checked', previousSettings.enabled);
      $('#timerBase').val(previousSettings.baseMinutes);
      $('#timerInc').val(previousSettings.incrementSeconds);
      return false;
    }

    stopClock();
    timedOut = false;
    enabled = settings.enabled;
    whiteMs = settings.baseMinutes * 60 * 1000;
    blackMs = whiteMs;
    incrementMs = settings.incrementSeconds * 1000;
    previousSettings = settings;

    if (enabled) $('#timerSettingsRow').css('display', 'flex');
    else $('#timerSettingsRow').hide();

    updateClockUI();
    if (hasActiveGame && enabled) startClock();
    return true;
  }

  function addIncrement(color) {
    if (!enabled || !running) return;
    if (color === 'w') whiteMs += incrementMs;
    else blackMs += incrementMs;
  }

  return {
    applySettings,
    addIncrement,
    startClock,
    stopClock,
    updateClockUI,
    get enabled() { return enabled; },
    get running() { return running; },
    get timedOut() { return timedOut; }
  };
}
