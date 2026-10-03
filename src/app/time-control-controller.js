/**
 * Time-control UI: preset buttons, the new-game dialog, custom inputs and the selected-control pill.
 */
import { describeTimeControl, describeCorrespondence } from '../domain/time-control.js';

const ICON_ATTRS = 'width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const SVG_ICONS = {
    clock: `<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    lightning: `<svg ${ICON_ATTRS}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    infinity: `<svg ${ICON_ATTRS}><path d="M18.178 8c5.096 0 5.096 8 0 8-2.688 0-4.364-2.502-6.178-5.322C10.186 7.858 8.51 5.356 5.822 5.356c-5.096 0-5.096 8 0 8 2.688 0 4.364-2.502 6.178-5.322"></path></svg>`,
    gear: `<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
};

const CORRESPONDENCE_MINUTES = 1440;

export function createTimeControlController({ $, Chess, store, clock, puzzle, saveStoredSettings }) {
    function showLabel({ text, icon }) {
        $('#selectedTimeText').text(text);
        $('.cc-pill-icon').html(SVG_ICONS[icon]);
    }

    function updateSelectedTimePill() {
        showLabel(describeTimeControl({
            enabled: $('#timerEnableCb').is(':checked'),
            baseMinutes: Number($('#timerBase').val()),
            incrementSeconds: Number($('#timerInc').val())
        }));
    }

    function updateTimePresetSelection() {
        const baseMinutes = Number($('#timerBase').val());
        const incrementSeconds = Number($('#timerInc').val());
        $('.cc-time-btn').each(function() {
            const selected = Number($(this).data('base')) === baseMinutes && Number($(this).data('inc')) === incrementSeconds;
            $(this).toggleClass('cc-time-btn-selected', selected);
        });
    }

    function refresh() {
        updateTimePresetSelection();
        updateSelectedTimePill();
    }

    function persist(overrides = {}) {
        saveStoredSettings({
            timerEnabled: $('#timerEnableCb').is(':checked'),
            timerBase: Number($('#timerBase').val()),
            timerInc: Number($('#timerInc').val()),
            ...overrides
        });
    }

    function startNewGameWithTime(enabled, baseMinutes, incrementSeconds) {
        const game = store.getState().game;
        const isNonInitialPosition = game.history().length > 0 || game.fen() !== new Chess().fen();
        if (isNonInitialPosition && !window.confirm('Начать новую партию? Текущая позиция будет сброшена.')) return;

        $('#timerEnableCb').prop('checked', enabled);
        $('#timerBase').val(baseMinutes);
        $('#timerInc').val(incrementSeconds);
        if (puzzle.isActive()) puzzle.exit();
        else $('#startPositionBtn').trigger('click');
        $('#timeControlDialog')[0].close();
        $('.tab-btn[data-tab="tab-play"]').trigger('click');
        refresh();
    }

    $('.time-control-option').on('click', function() {
        startNewGameWithTime(true, Number($(this).data('base')), Number($(this).data('inc')));
    });

    $('#startCustomTimeBtn').on('click', function() {
        const baseInput = $('#customTimerBase')[0];
        const incrementInput = $('#customTimerInc')[0];
        if (!baseInput.reportValidity() || !incrementInput.reportValidity()) return;
        startNewGameWithTime(true, Number(baseInput.value), Number(incrementInput.value));
    });

    $('#startUntimedGameBtn').on('click', function() {
        startNewGameWithTime(false, Number($('#timerBase').val()), Number($('#timerInc').val()));
    });

    $('#timerEnableCb, #timerBase, #timerInc').on('change', function() {
        clock.applySettings(true);
        refresh();
        persist();
    });

    $('.cc-time-btn').on('click', function() {
        const base = Number($(this).data('base'));
        const inc = Number($(this).data('inc'));
        const isCorrespondence = base >= CORRESPONDENCE_MINUTES;
        $('#timerEnableCb').prop('checked', !isCorrespondence);
        $('#timerBase').val(isCorrespondence ? 10 : base);
        $('#timerInc').val(inc);
        clock.applySettings(true);
        refresh();
        persist({ timerInc: inc });

        if (isCorrespondence) showLabel(describeCorrespondence(base));
    });

    $('#ccCustomTimeToggle').on('click', function() {
        $(this).toggleClass('cc-expanded');
        $('#ccCustomTimePanel').slideToggle(150);
    });

    $('#ccAdvancedSettingsToggle').on('click', function() {
        $(this).toggleClass('cc-expanded');
        $('#ccAdvancedSettings').slideToggle(150);
    });

    return { refresh };
}
