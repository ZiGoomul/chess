var DEFAULT_SETTINGS = { highlightAttacks: true, highlightDefenses: true };
var statusEl = document.getElementById('status');

chrome.storage.sync.get(DEFAULT_SETTINGS, function (settings) {
    Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
        var input = document.getElementById(key);
        input.checked = Boolean(settings[key]);
        input.addEventListener('change', function () {
            var update = {};
            update[key] = input.checked;
            chrome.storage.sync.set(update);
        });
    });
});

function setStatus(text, className) {
    statusEl.textContent = text;
    statusEl.className = 'status ' + className;
}

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs[0];
    if (!tab || !/^https:\/\/(www\.)?chess\.com\//.test(tab.url || '')) {
        setStatus('Откройте chess.com', 'off');
        return;
    }
    chrome.tabs.sendMessage(tab.id, { type: 'csh-status' }, function (response) {
        if (chrome.runtime.lastError || !response) {
            setStatus('Обновите страницу chess.com', 'off');
        } else if (!response.allowed) {
            setStatus('На этой странице отключено', 'off');
        } else if (!response.boards) {
            setStatus('Доска не найдена', 'off');
        } else {
            setStatus('Активно', 'on');
        }
    });
});
