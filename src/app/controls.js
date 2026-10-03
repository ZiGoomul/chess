/**
 * Side-panel controls: hints, highlight toggles, bot level, board flip, move navigation,
 * and layout sync between the move list and the board.
 */
import { getDisplayedGame } from '../domain/position.js';

export function createControls({
    $, Chess, store, eventBus, boardView, clock, botCoordinator, analysisCoordinator, moveHistoryView,
    interaction, session, clearSelection, saveStoredSettings
}) {
    function updateSettings(partial) {
        store.setState({ settings: { ...store.getState().settings, ...partial } });
    }

    $('#hintBtn').on('click', function() {
        $(this).text('Анализ...').prop('disabled', true);
        analysisCoordinator.requestHint();
    });

    eventBus.on('engine:hint-completed', function() {
        $('#hintBtn').text('Подсказать лучший ход').prop('disabled', false);
    });

    $('#highlightAttacksCb, #highlightDefensesCb').on('change', function() {
        saveStoredSettings({
            highlightAttacks: $('#highlightAttacksCb').is(':checked'),
            highlightDefenses: $('#highlightDefensesCb').is(':checked')
        });
        boardView.highlightAttackedPieces(getDisplayedGame(store.getState(), Chess));
    });

    $('#highlightMovesCb').on('change', function() {
        saveStoredSettings({ highlightMoves: $(this).is(':checked') });
        interaction.refreshSelectionHints();
    });

    $('#botLevel').on('change', function() {
        clearSelection();
        botCoordinator.cancelBotSearch();
        const level = parseInt($(this).val(), 10);
        updateSettings({ botLevel: level });
        saveStoredSettings({ botLevel: level });
        eventBus.emit('settings:changed', { botLevel: level });
        session.updateStatus();
    });

    $('#hintLevel').on('change', function() {
        const level = parseInt($(this).val(), 10);
        updateSettings({ hintLevel: level });
        saveStoredSettings({ hintLevel: level });
    });

    $('#autoHintCb').on('change', function() {
        const autoHint = $(this).is(':checked');
        updateSettings({ autoHint });
        saveStoredSettings({ autoHint });
        analysisCoordinator.autoHintIfNeeded();
    });

    $('#flipOrientationBtn').on('click', function() {
        clearSelection();
        boardView.flip();
        eventBus.emit('board:orientation-changed', { orientation: boardView.orientation() });
        analysisCoordinator.drawHintArrows();
        clock.updateClockUI();
    });

    const lastPly = () => store.getState().historyFENs.length - 1;
    const currentPly = () => store.getState().currentViewPly;
    $('#navFirstBtn').on('click', function() { moveHistoryView.goToPly(0); });
    $('#navPrevBtn').on('click', function() { moveHistoryView.goToPly(currentPly() - 1); });
    $('#navNextBtn').on('click', function() { moveHistoryView.goToPly(currentPly() + 1); });
    $('#navLastBtn').on('click', function() { moveHistoryView.goToPly(lastPly()); });

    $('#moveHistoryList').on('click', '.move-text', function() {
        moveHistoryView.goToPly(parseInt($(this).data('ply'), 10) + 1);
    });

    $('#moveHistoryList').on('keydown', '.move-text', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        moveHistoryView.goToPly(parseInt($(this).data('ply'), 10) + 1);
    });

    function syncHistoryHeight() {
        const historyEl = $('.history-column');
        const boardEl = $('#myBoard .board-b72b1');
        if (!historyEl.length || !boardEl.length) return;
        historyEl.css({ height: '', marginTop: '' });
        const historyTop = historyEl.offset().top;
        const boardBottom = boardEl.offset().top + boardEl.outerHeight();
        if (historyTop > boardBottom) return;
        historyEl.css({ height: boardBottom - historyTop, marginTop: 0 });
    }
    syncHistoryHeight();
    $(window).resize(syncHistoryHeight);
}
