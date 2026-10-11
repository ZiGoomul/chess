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
        $(this).prop('disabled', true).find('.action-btn-label').text('Анализ…');
        analysisCoordinator.requestHint();
    });

    eventBus.on('engine:hint-completed', function() {
        $('#hintBtn').prop('disabled', false).find('.action-btn-label').text('Подсказка');
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
        if (level === 0) {
            $('body').addClass('is-editor-mode');
        } else if (!$('.tab-btn[data-tab="tab-setup"]').hasClass('active')) {
            $('body').removeClass('is-editor-mode');
        }
        updateSettings({ botLevel: level });
        // Level 0 is the editor, a temporary mode: never restore it on the next visit
        if (level > 0) saveStoredSettings({ botLevel: level });
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

    // The right panel ends level with the bottom player badge
    function syncColumnsHeight() {
        const sidebarEl = $('.sidebar-column');
        const bottomPlayerEl = $('.bottom-player:visible');
        const boardEl = $('#myBoard .board-b72b1');
        if (!sidebarEl.length) return;

        sidebarEl.css({ height: '' });
        if (window.innerWidth <= 760) return;

        const anchorEl = bottomPlayerEl.length ? bottomPlayerEl : (boardEl.length ? boardEl : $('#myBoard'));
        if (!anchorEl.length) return;

        const anchorBottom = anchorEl.offset().top + anchorEl.outerHeight();
        const sidebarTop = sidebarEl.offset().top;
        if (anchorBottom > sidebarTop) {
            sidebarEl.css({ height: anchorBottom - sidebarTop });
        }
    }

    syncColumnsHeight();
    $(window).resize(syncColumnsHeight);
    eventBus.on('board:resized', syncColumnsHeight);
    $('.tab-btn').on('click', function() {
        setTimeout(syncColumnsHeight, 50);
    });

    if (typeof ResizeObserver !== 'undefined') {
        const boardCol = document.querySelector('.board-column');
        if (boardCol) {
            const observer = new ResizeObserver(syncColumnsHeight);
            observer.observe(boardCol);
        }
    }
}
