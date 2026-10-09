/**
 * Time-control UI: the time-control dialog (presets, custom, untimed) and the selected-control field.
 */
import { describeTimeControl } from '../domain/time-control.js';

const ICON_ATTRS = 'width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const SVG_ICONS = {
    clock: `<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    lightning: `<svg ${ICON_ATTRS}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    infinity: `<svg ${ICON_ATTRS}><path d="M18.178 8c5.096 0 5.096 8 0 8-2.688 0-4.364-2.502-6.178-5.322C10.186 7.858 8.51 5.356 5.822 5.356c-5.096 0-5.096 8 0 8 2.688 0 4.364-2.502 6.178-5.322"></path></svg>`,
    gear: `<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
};

export function createTimeControlController({ $, clock, saveStoredSettings }) {
    function showLabel({ text, icon }) {
        $('#selectedTimeText').text(text);
        $('.cc-pill-icon').html(SVG_ICONS[icon]);
    }

    function updateSelectedTimePill() {
        const timerCb = $('#timerEnableCb');
        showLabel(describeTimeControl({
            enabled: timerCb.length ? timerCb.is(':checked') : true,
            baseMinutes: Number($('#timerBase').val()),
            incrementSeconds: Number($('#timerInc').val())
        }));
    }

    function refresh() {
        updateSelectedTimePill();
        const enabled = $('#timerEnableCb').is(':checked');
        $('#gameTimeChip').text(enabled ? `${$('#timerBase').val()} + ${$('#timerInc').val()}` : 'Без часов');
    }

    function persist(overrides = {}) {
        const timerCb = $('#timerEnableCb');
        saveStoredSettings({
            timerEnabled: timerCb.length ? timerCb.is(':checked') : true,
            timerBase: Number($('#timerBase').val()),
            timerInc: Number($('#timerInc').val()),
            ...overrides
        });
    }

    // The dialog only picks the control; the game starts from the play panel.
    function selectTimeControl(enabled, baseMinutes, incrementSeconds) {
        $('#timerEnableCb').prop('checked', enabled);
        $('#timerBase').val(baseMinutes);
        $('#timerInc').val(incrementSeconds);
        $('#timeControlDialog')[0].close();
        clock.applySettings();
        refresh();
        persist();
    }

    $('.time-control-option').on('click', function() {
        selectTimeControl(true, Number($(this).data('base')), Number($(this).data('inc')));
    });

    $('#startCustomTimeBtn').on('click', function() {
        const baseInput = $('#customTimerBase')[0];
        const incrementInput = $('#customTimerInc')[0];
        if (!baseInput.reportValidity() || !incrementInput.reportValidity()) return;
        selectTimeControl(true, Number(baseInput.value), Number(incrementInput.value));
    });

    $('#startUntimedGameBtn').on('click', function() {
        selectTimeControl(false, Number($('#timerBase').val()), Number($('#timerInc').val()));
    });

    return { refresh };
}
