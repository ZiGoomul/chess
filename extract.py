import os
import re

with open('/Users/eugene/Downloads/chess/script.js', 'r') as f:
    content = f.read()

# Remove the wrapper $(document).ready(function() { ... });
content = re.sub(r'^\$\(document\)\.ready\(function\(\)\s*\{', '', content)
content = re.sub(r'\}\);\s*$', '', content)

def extract_block(regex):
    global content
    match = re.search(regex, content, re.DOTALL)
    if match:
        block = match.group(0)
        content = content.replace(block, '')
        return block
    return ''

# ... we can extract functions by matching "function name(" and keeping brackets matched
def extract_func(func_name):
    global content
    pattern = r'function\s+' + func_name + r'\s*\([^)]*\)\s*\{'
    match = re.search(pattern, content)
    if not match:
        return ''
    start = match.start()
    depth = 0
    in_string = False
    string_char = ''
    i = match.end() - 1
    while i < len(content):
        c = content[i]
        if in_string:
            if c == string_char and content[i-1] != '\\':
                in_string = False
        else:
            if c in '"\'`':
                in_string = True
                string_char = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    break
        i += 1
    end = i + 1
    func_code = content[start:end]
    content = content[:start] + content[end:]
    return func_code

audio_funcs = ['playSound', 'playSoundForMove']
puzzles_funcs = ['loadRandomPuzzle', 'puzzleCompleted', 'exitPuzzleMode', 'playOpponentPuzzleMove']
timer_funcs = ['formatTime', 'updateClockUI', 'stopClock', 'tickClock', 'startClock', 'applyTimerSettings', 'timeOut']
ui_funcs = ['updateMoveHistory', 'goToPly', 'removeHighlights', 'highlightMove', 'drawHintArrows', 'clearArrows', 'updateStatus', 'updateMaterial']
engine_funcs = ['makeBotMove', 'getBestMove', 'autoHintIfNeeded', 'updateEvalBar']
main_funcs = ['onDragStart', 'onDrop', 'onSnapEnd']

audio_code = "\n".join([extract_func(f) for f in audio_funcs])
puzzles_code = "\n".join([extract_func(f) for f in puzzles_funcs])
timer_code = "\n".join([extract_func(f) for f in timer_funcs])
ui_code = "\n".join([extract_func(f) for f in ui_funcs])
engine_code = "\n".join([extract_func(f) for f in engine_funcs])
main_code = "\n".join([extract_func(f) for f in main_funcs])

# We also need to extract globals. We can just leave the remaining content in main.js
# Or carefully separate them.

with open('/Users/eugene/Downloads/chess/js/audio.js', 'w') as f:
    f.write(audio_code)
with open('/Users/eugene/Downloads/chess/js/puzzles.js', 'w') as f:
    f.write(puzzles_code)
with open('/Users/eugene/Downloads/chess/js/timer.js', 'w') as f:
    f.write(timer_code)
with open('/Users/eugene/Downloads/chess/js/ui.js', 'w') as f:
    f.write(ui_code)
with open('/Users/eugene/Downloads/chess/js/engine.js', 'w') as f:
    f.write(engine_code)
with open('/Users/eugene/Downloads/chess/js/main.js', 'w') as f:
    f.write(main_code + "\n" + content)

print("Done extracting!")
