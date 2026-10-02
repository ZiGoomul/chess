export function createShellView({ $, eventBus, store }) {
    function initShell() {
        // --- Redesign Logic (Themes and Tabs) ---
        $('#themeToggleBtn').on('click', function() {
            var current = $('body').attr('data-theme');
            var next = current === 'dark' ? 'light' : 'dark';
            $('body').attr('data-theme', next);
            eventBus.emit('theme:changed', { theme: next });
        });
        
        // Set default dark theme
        if (!$('body').attr('data-theme')) {
            $('body').attr('data-theme', 'dark');
        }

        $('.tab-btn').on('click', function() {
            $('.tab-btn').removeClass('active').attr('aria-selected', 'false').attr('tabindex', '-1')
                .css('border-bottom', '2px solid transparent').css('font-weight', 'normal');
            $(this).addClass('active').attr('aria-selected', 'true').attr('tabindex', '0')
                .css('border-bottom', '2px solid var(--accent-color)').css('font-weight', 'bold');
            
            $('.tab-content').hide().attr('aria-hidden', 'true');
            $('#' + $(this).data('tab')).css('display', 'flex').attr('aria-hidden', 'false');
        });

        $('.tabs-header').on('keydown', '.tab-btn', function(event) {
            var tabs = $('.tab-btn');
            var index = tabs.index(this);
            if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
            else if (event.key === 'ArrowLeft') index = (index - 1 + tabs.length) % tabs.length;
            else if (event.key === 'Home') index = 0;
            else if (event.key === 'End') index = tabs.length - 1;
            else return;

            event.preventDefault();
            tabs.eq(index).trigger('focus').trigger('click');
        });

        // Theme selects
        $('#pieceThemeSelect').on('change', function() {
            var theme = $(this).val();
            eventBus.emit('settings:changed', { pieceTheme: theme });
        });

        $('#boardThemeSelect').on('change', function() {
            var theme = $(this).val();
            $('body').attr('data-board-theme', theme);
            eventBus.emit('settings:changed', { boardTheme: theme });
        });
        
        // Apply initial board theme
        $('body').attr('data-board-theme', $('#boardThemeSelect').val());

        // FEN inputs
        $('#getFenBtn').on('click', function() {
            eventBus.emit('shell:get-fen-requested');
        });

        $('#setFenBtn').on('click', function() {
            var fen = $('#fenInput').val().trim();
            eventBus.emit('shell:set-fen-requested', { fen: fen });
        });

        // Time Control Dialog
        $('#newGameBtn').on('click', function() {
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
