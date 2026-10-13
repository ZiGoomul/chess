/**
 * Whether the game in progress is rated, and the player's ratings per time control.
 *
 * A game is rated when it is started with «Играть» and played to the end without help: no hint,
 * no auto-hint, no highlighting of attacked and defended pieces, no take-back and no change of
 * the bot level. Any help makes the game unrated for good, and the player sees it at once.
 *
 * With «Играть на рейтинг» on, the hints and highlights are switched off for the length of the
 * game (onAssistsChange) while the training settings stay as they are.
 */
import {
    NEW_PLAYER_RATING, CATEGORY_LABELS, UNRATED_REASONS, ratingCategory, rateGameAgainstBot,
    formatRating, isProvisional, scoreForPlayer
} from '../domain/game-rating.js';

export function createRatedGame({
    $, botLevelToRating, initialRatings = {}, saveRatings = (_ratings) => {}, now = () => Date.now(),
    initialRatedMode = true, saveRatedMode = (_on) => {}, onAssistsChange = (_off) => {}
}) {
    let ratings = { ...initialRatings };
    // The game in progress: { category, botLevel, humanColor, assistsOff, unrated: reason | null }, or null
    let current = null;

    const ratedMode = () => $('#ratedModeCb').is(':checked');

    /** Replaces the game in progress, switching the help off or back on as it requires. */
    function setCurrent(next) {
        const wasOff = Boolean(current?.assistsOff);
        current = next;
        const isOff = Boolean(current?.assistsOff);
        if (wasOff !== isOff) onAssistsChange(isOff);
        render();
    }

    function selectedTimeControl() {
        return {
            enabled: $('#timerEnableCb').is(':checked'),
            baseMinutes: Number($('#timerBase').val())
        };
    }

    function ratingFor(category) {
        return ratings[category] || NEW_PLAYER_RATING;
    }

    /** Why a game started now would not be rated, or null. */
    function reasonAtStart() {
        if (ratedMode()) return null;
        if ($('#autoHintCb').is(':checked')) return 'autoHint';
        if ($('#highlightAttacksCb').is(':checked') || $('#highlightDefensesCb').is(':checked')) return 'highlights';
        return null;
    }

    function render() {
        const category = current ? current.category : ratingCategory(selectedTimeControl());
        const player = ratingFor(category);
        $('#bottomPlayerRating').text(formatRating(player)).prop('hidden', false)
            .attr('title', `${CATEGORY_LABELS[category]}: ${formatRating(player)}${isProvisional(player) ? ' — рейтинг ещё уточняется' : ''}`);

        const chip = $('#ratedChip').prop('hidden', !current);
        if (current) {
            chip.attr('data-rated', String(!current.unrated))
                .text(current.unrated ? 'Без рейтинга' : `Рейтинговая · ${CATEGORY_LABELS[current.category]}`)
                .attr('title', current.unrated
                    ? `Партия не рейтинговая: ${UNRATED_REASONS[current.unrated]}`
                    : current.assistsOff ? 'Подсказки и подсветка выключены до конца партии' : 'Помощь сделает партию нерейтинговой');
        }

        const startReason = reasonAtStart();
        const ratingText = `${CATEGORY_LABELS[category]}, ваш рейтинг ${formatRating(player)}`;
        let note;
        if (startReason) note = `Партия будет без рейтинга: ${UNRATED_REASONS[startReason]}.`;
        else if (ratedMode()) note = `Рейтинговая партия (${ratingText}). Подсказки и подсветка нападений выключатся до конца партии, ваши настройки не изменятся. Ход назад снимет рейтинг.`;
        else note = `Рейтинговая партия (${ratingText}). Подсказка или ход назад сделают её нерейтинговой.`;
        $('#playRatingNote').attr('data-rated', String(!startReason)).text(note);

        const played = Object.keys(CATEGORY_LABELS).filter(key => ratings[key]?.games > 0);
        const summary = $('#ratingsSummary').empty();
        if (!played.length) {
            summary.append($('<p class="panel-hint"></p>').text('Рейтинг появится после первой рейтинговой партии.'));
        }
        played.forEach(key => {
            summary.append($('<span class="panel-chip ratings-summary-chip"></span>')
                .attr('title', `Партий: ${ratings[key].games}`)
                .text(`${CATEGORY_LABELS[key]} ${formatRating(ratings[key])}`));
        });
    }

    /** A game started with «Играть». */
    function begin({ timeControl, botLevel, humanColor }) {
        setCurrent({ category: ratingCategory(timeControl), botLevel, humanColor, assistsOff: ratedMode(), unrated: reasonAtStart() });
    }

    function markUnrated(reason) {
        if (!current || current.unrated) return;
        current.unrated = reason;
        render();
    }

    /** The game was left or replaced: it is not rated. */
    function cancel() {
        if (current) setCurrent(null);
    }

    /**
     * The game ended. Returns what happened to the rating: { rated: true, category, before, after,
     * delta, provisional } or { rated: false, category, reason }, or null when no game was being tracked.
     * `movesBy(color)` counts the moves a side made.
     */
    function complete({ result, movesBy }) {
        if (!current) return null;
        const game = current;
        setCurrent(null);
        const reason = game.unrated || (movesBy(game.humanColor) > 0 ? null : 'noMoves');
        if (reason) {
            return { rated: false, category: game.category, reason };
        }
        const before = ratingFor(game.category);
        const { player, delta } = rateGameAgainstBot(before, botLevelToRating(game.botLevel), scoreForPlayer(result, game.humanColor), now());
        ratings = { ...ratings, [game.category]: player };
        saveRatings(ratings);
        render();
        return {
            rated: true,
            category: game.category,
            before: Math.round(before.rating),
            after: Math.round(player.rating),
            delta,
            provisional: isProvisional(player)
        };
    }

    /** For the saved game in progress, so a reload keeps it rated or not. */
    function snapshot() {
        return current ? { ...current } : null;
    }

    function restore(saved) {
        const valid = saved && CATEGORY_LABELS[saved.category] && (saved.humanColor === 'w' || saved.humanColor === 'b');
        setCurrent(valid ? { ...saved, assistsOff: Boolean(saved.assistsOff) } : null);
    }

    // Help taken during the game; with the help switched off, changing the settings does nothing
    const helpIsOn = () => current && !current.assistsOff;
    $('#hintBtn').on('click', () => { if (helpIsOn()) markUnrated('hint'); });
    $('#autoHintCb').on('change', function() {
        if ($(this).is(':checked') && helpIsOn()) markUnrated('autoHint');
        render();
    });
    $('#highlightAttacksCb, #highlightDefensesCb').on('change', function() {
        if ($(this).is(':checked') && helpIsOn()) markUnrated('highlights');
        render();
    });
    $('#ratedModeCb').prop('checked', initialRatedMode).on('change', function() {
        saveRatedMode($(this).is(':checked'));
        render();
    });
    $('#botLevel').on('change', () => markUnrated('botLevel'));

    render();

    return { begin, markUnrated, cancel, complete, snapshot, restore, render, getRatings: () => ratings };
}

/** "Рапид: 1512 (+12)" for a rated game, the reason for an unrated one. */
export function describeRatingChange(change) {
    if (!change) return '';
    if (!change.rated) return `Без рейтинга: ${UNRATED_REASONS[change.reason] || 'партия не рейтинговая'}`;
    const sign = change.delta > 0 ? '+' : change.delta < 0 ? '−' : '±';
    return `${CATEGORY_LABELS[change.category]}: ${change.after}${change.provisional ? '?' : ''} (${sign}${Math.abs(change.delta)})`;
}
