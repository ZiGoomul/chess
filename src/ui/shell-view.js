import { loadStoredSettings, saveStoredSettings } from '../storage/settings-storage.js';

export function createShellView({ $, eventBus }) {
    function initShell() {
        const stored = loadStoredSettings();

        // Apply stored theme (default to dark)
        const theme = stored.theme || 'dark';
        $('body').attr('data-theme', theme);
        eventBus.emit('theme:changed', { theme: theme });

        // Apply stored board and piece themes
        if (stored.boardTheme) {
            $('#boardThemeSelect').val(stored.boardTheme);
            $('body').attr('data-board-theme', stored.boardTheme);
        } else {
            $('body').attr('data-board-theme', $('#boardThemeSelect').val());
        }

        if (stored.pieceTheme) {
            $('#pieceThemeSelect').val(stored.pieceTheme);
            eventBus.emit('settings:changed', { pieceTheme: stored.pieceTheme });
        }

        // --- Redesign Logic (Themes and Tabs) ---
        $('#themeToggleBtn').on('click', function() {
            const current = $('body').attr('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            $('body').attr('data-theme', next);
            saveStoredSettings({ theme: next });
            eventBus.emit('theme:changed', { theme: next });
        });

        $('.tab-btn').on('click', function() {
            const tabName = $(this).data('tab');
            $('.tab-btn').removeClass('active').attr('aria-selected', 'false').attr('tabindex', '-1');
            $(this).addClass('active').attr('aria-selected', 'true').attr('tabindex', '0');

            $('.tab-content').removeClass('is-active').attr('aria-hidden', 'true');
            $('#' + tabName).addClass('is-active').attr('aria-hidden', 'false');

            // The editor is a mode of its own tab only: entering it parks the bot level,
            // leaving it brings the bot (and the player badges) back
            const botLevel = $('#botLevel');
            if (tabName === 'tab-setup') {
                if (botLevel.val() !== '0') botLevel.data('playLevel', botLevel.val());
                $('body').addClass('is-editor-mode');
                botLevel.val('0').trigger('change');
            } else if (botLevel.val() === '0') {
                botLevel.val(botLevel.data('playLevel') || '10').trigger('change');
            } else {
                $('body').removeClass('is-editor-mode');
            }
        });

        // The left rail is the tab list (vertical; horizontal on phones)
        $('.app-nav-list').on('keydown', '.tab-btn', function(event) {
            const tabs = $('.tab-btn');
            let index = tabs.index(this);
            if (event.key === 'ArrowDown' || event.key === 'ArrowRight') index = (index + 1) % tabs.length;
            else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') index = (index - 1 + tabs.length) % tabs.length;
            else if (event.key === 'Home') index = 0;
            else if (event.key === 'End') index = tabs.length - 1;
            else return;

            event.preventDefault();
            tabs.eq(index).trigger('focus').trigger('click');
        });

        // Theme selects
        $('#pieceThemeSelect').on('change', function() {
            const selectedTheme = $(this).val();
            saveStoredSettings({ pieceTheme: selectedTheme });
            eventBus.emit('settings:changed', { pieceTheme: selectedTheme });
        });

        $('#boardThemeSelect').on('change', function() {
            const selectedTheme = $(this).val();
            $('body').attr('data-board-theme', selectedTheme);
            saveStoredSettings({ boardTheme: selectedTheme });
            eventBus.emit('settings:changed', { boardTheme: selectedTheme });
        });

        // FEN inputs
        $('#getFenBtn').on('click', function() {
            eventBus.emit('shell:get-fen-requested');
        });

        $('#setFenBtn').on('click', function() {
            const fen = $('#fenInput').val().trim();
            eventBus.emit('shell:set-fen-requested', { fen: fen });
        });

        $('#copyPgnBtn').on('click', function() {
            eventBus.emit('shell:get-pgn-requested');
        });

        $('#setPgnBtn').on('click', function() {
            const pgn = $('#pgnInput').val().trim();
            eventBus.emit('shell:set-pgn-requested', { pgn: pgn });
        });

        // Time Control Dialog
        $('#newGameBtn, #selectedTimeControlPill').on('click', function() {
            $('#customTimerBase').val($('#timerBase').val());
            $('#customTimerInc').val($('#timerInc').val());
            $('#timeControlDialog')[0].showModal();
        });

        $('#closeTimeControlBtn').on('click', function() {
            $('#timeControlDialog')[0].close();
        });

        $('#timeControlDialog').on('click', function(event) {
            if (event.target === this) this.close();
        });
        
        // Subscribe to eventBus events
        eventBus.on('clock:timeout', function() {
            // handle clock timeout if necessary in shell view
        });

        eventBus.on('board:fen-updated', function(data) {
             if (data && data.fen) {
                 $('#fenInput').val(data.fen);
             }
        });
    }

    initShell();

    return {
        // Any public methods if needed
    };
}
