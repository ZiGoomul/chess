// Рисует подсветку нападений и защит поверх доски chess.com.
(function () {
    'use strict';

    var CH = globalThis.ChessHighlighter;
    var OVERLAY_CLASS = 'csh-overlay';
    var DEFAULT_SETTINGS = { highlightAttacks: true, highlightDefenses: true };

    var settings = Object.assign({}, DEFAULT_SETTINGS);
    var boardObservers = new Map();
    var renderScheduled = false;

    function squareStyle(square, flipped) {
        var file = 'abcdefgh'.indexOf(square[0]);
        var rank = Number(square[1]) - 1;
        var col = flipped ? 7 - file : file;
        var row = flipped ? rank : 7 - rank;
        return 'left:' + col * 12.5 + '%;top:' + row * 12.5 + '%;';
    }

    // Два слоя: заливка клеток (под фигурами) и бейджи со счётчиками (над фигурами).
    function getLayer(boardEl, name) {
        var layer = boardEl.querySelector(':scope > .' + OVERLAY_CLASS + '.' + name);
        if (!layer) {
            layer = document.createElement('div');
            layer.className = OVERLAY_CLASS + ' ' + name;
            if (name === 'csh-tint') boardEl.insertBefore(layer, boardEl.firstChild);
            else boardEl.appendChild(layer);
        }
        return layer;
    }

    function removeLayers(boardEl) {
        boardEl.querySelectorAll(':scope > .' + OVERLAY_CLASS).forEach(function (layer) {
            layer.remove();
        });
    }

    function setLayerHtml(boardEl, name, html) {
        var layer = getLayer(boardEl, name);
        if (layer.innerHTML !== html) layer.innerHTML = html;
    }

    function renderBoard(boardEl) {
        var enabled = CH.isHighlightAllowed(location.pathname, document) &&
            (settings.highlightAttacks || settings.highlightDefenses);
        if (!enabled) {
            removeLayers(boardEl);
            return;
        }

        var result = CH.computeHighlights(CH.readPieces(boardEl));
        var flipped = CH.isFlipped(boardEl);
        var tintHtml = '';
        var badgeHtml = '';
        var square;

        if (settings.highlightAttacks) {
            for (square in result.attacks) {
                var attack = result.attacks[square];
                var colorClass = 'csh-attacked-by-' + (attack.by === 'w' ? 'white' : 'black');
                var pos = squareStyle(square, flipped);
                tintHtml += '<div class="csh-square ' + colorClass + '" style="' + pos + '"></div>';
                badgeHtml += '<div class="csh-square ' + colorClass + '-badge" style="' + pos + '">' +
                    '<span class="csh-badge csh-attack-badge">' + attack.count + '</span></div>';
            }
        }
        if (settings.highlightDefenses) {
            for (square in result.defenders) {
                badgeHtml += '<div class="csh-square" style="' + squareStyle(square, flipped) + '">' +
                    '<span class="csh-badge csh-defense-badge">' + result.defenders[square] + '</span></div>';
            }
        }

        setLayerHtml(boardEl, 'csh-tint', tintHtml);
        setLayerHtml(boardEl, 'csh-badges', badgeHtml);
    }

    function renderAll() {
        renderScheduled = false;
        CH.findBoards(document).forEach(function (boardEl) {
            watchBoard(boardEl);
            renderBoard(boardEl);
        });
    }

    function scheduleRender() {
        if (renderScheduled) return;
        renderScheduled = true;
        requestAnimationFrame(renderAll);
    }

    function isOwnMutation(mutation) {
        var target = mutation.target;
        return target.nodeType === 1 &&
            (target.classList.contains(OVERLAY_CLASS) || target.closest('.' + OVERLAY_CLASS));
    }

    function watchBoard(boardEl) {
        if (boardObservers.has(boardEl)) return;
        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                if (!isOwnMutation(mutations[i])) {
                    scheduleRender();
                    return;
                }
            }
        });
        observer.observe(boardEl, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class']
        });
        boardObservers.set(boardEl, observer);
    }

    function forgetDetachedBoards() {
        boardObservers.forEach(function (observer, boardEl) {
            if (!boardEl.isConnected) {
                observer.disconnect();
                boardObservers.delete(boardEl);
            }
        });
    }

    // chess.com — SPA: доски появляются и исчезают, URL меняется без перезагрузки.
    var lastPath = location.pathname;

    function checkPathChange() {
        if (location.pathname === lastPath) return false;
        lastPath = location.pathname;
        scheduleRender();
        return true;
    }

    var lastAllowed = CH.isHighlightAllowed(location.pathname, document);

    // Партия закончилась (появилась кнопка «Game Review») или страница сменилась.
    function checkAllowedChange() {
        var allowed = CH.isHighlightAllowed(location.pathname, document);
        if (allowed === lastAllowed) return false;
        lastAllowed = allowed;
        scheduleRender();
        return true;
    }

    new MutationObserver(function () {
        forgetDetachedBoards();
        if (checkPathChange() || checkAllowedChange()) return;
        var boards = CH.findBoards(document);
        for (var i = 0; i < boards.length; i++) {
            if (!boardObservers.has(boards[i])) {
                scheduleRender();
                return;
            }
        }
    }).observe(document.documentElement, { childList: true, subtree: true });

    setInterval(checkPathChange, 500);

    chrome.storage.sync.get(DEFAULT_SETTINGS, function (stored) {
        settings = Object.assign({}, DEFAULT_SETTINGS, stored);
        scheduleRender();
    });

    chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'sync') return;
        for (var key in changes) settings[key] = changes[key].newValue;
        scheduleRender();
    });

    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
        if (message && message.type === 'csh-status') {
            sendResponse({
                allowed: CH.isHighlightAllowed(location.pathname, document),
                boards: CH.findBoards(document).length
            });
        }
    });
})();
