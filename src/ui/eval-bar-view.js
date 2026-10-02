export function createEvalBarView({ $, eventBus }) {
    let currentOrientation = 'white';
    let currentEval = null;

    eventBus.on('board:orientation-changed', ({ orientation }) => {
        currentOrientation = orientation;
        render();
    });

    eventBus.on('engine:eval-updated', (payload) => {
        currentEval = payload;
        render();
    });

    function render() {
        if (!currentEval) return;
        const { cp, mate, isWhiteTurn } = currentEval;

        // If isWhiteTurn is not provided, fallback to true.
        // It's expected that the event emitter includes isWhiteTurn if it's relative to the side to move.
        const whiteTurn = isWhiteTurn !== undefined ? isWhiteTurn : true;
        
        let whiteScore = 0;
        let text = "";

        if (mate !== null && mate !== undefined) {
            let mateIn = parseInt(mate, 10);
            if (!whiteTurn) mateIn = -mateIn;
            
            text = (mateIn > 0 ? "M" : "-M") + Math.abs(mateIn);
            whiteScore = (mateIn > 0) ? 1000 : -1000;
        } else if (cp !== null && cp !== undefined) {
            let scoreCp = parseInt(cp, 10);
            if (!whiteTurn) scoreCp = -scoreCp;
            
            text = (scoreCp > 0 ? "+" : "") + (scoreCp / 100).toFixed(1);
            whiteScore = scoreCp;
        } else {
            return;
        }

        let percent = 50 + (whiteScore / 15);
        if (percent < 5 && mate === null) percent = 5;
        if (percent > 95 && mate === null) percent = 95;
        if (percent < 0) percent = 0;
        if (percent > 100) percent = 100;

        let isFlipped = (currentOrientation === 'black');
        let whiteBar = $('#evalBarWhite');
        let textEl = $('#evalBarText');

        textEl.text(text);

        if (isFlipped) {
            whiteBar.css({ bottom: 'auto', top: 0, height: percent + '%' });
        } else {
            whiteBar.css({ top: 'auto', bottom: 0, height: percent + '%' });
        }

        if (percent > 90) {
            textEl.css('color', '#333');
        } else {
            textEl.css('color', '#eaeaea');
        }
    }

    return {
        render
    };
}
