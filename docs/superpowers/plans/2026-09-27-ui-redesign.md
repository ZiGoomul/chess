# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the single-column utilitarian chess UI into a modern two-column layout with a tabbed sidebar and dark/light mode support.

**Architecture:** Plain HTML/CSS flexbox layout. CSS Custom Properties (variables) for theming. jQuery for tab switching and theme toggling.

**Tech Stack:** HTML, CSS, jQuery.

---

### Task 1: Global CSS Variables & Base Theming

**Files:**
- Modify: `style.css`
- Modify: `script.js`

- [ ] **Step 1: Define CSS variables in style.css**
```css
:root {
    --bg-color: #ffffff;
    --text-color: #333333;
    --panel-bg: #f8f9fa;
    --border-color: #e0e0e0;
    --accent-color: #3498db;
    --accent-hover: #2980b9;
    --shadow: 0 4px 12px rgba(0,0,0,0.1);
}

[data-theme="dark"] {
    --bg-color: #202020;
    --text-color: #e0e0e0;
    --panel-bg: #2d2d2d;
    --border-color: #444444;
    --accent-color: #3498db;
    --accent-hover: #2980b9;
    --shadow: 0 4px 12px rgba(0,0,0,0.5);
}

body {
    background-color: var(--bg-color);
    color: var(--text-color);
    transition: background-color 0.3s, color 0.3s;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    margin: 0;
    padding: 0;
    display: block; /* Remove previous flex centering */
}
```

- [ ] **Step 2: Add theme toggle logic to script.js**
```javascript
    // At the end of document.ready
    $('#themeToggleBtn').on('click', function() {
        var current = $('body').attr('data-theme');
        var next = current === 'dark' ? 'light' : 'dark';
        $('body').attr('data-theme', next);
    });
    
    // Set default dark theme if none is set
    if (!$('body').attr('data-theme')) {
        $('body').attr('data-theme', 'dark');
    }
```

- [ ] **Step 3: Commit**
```bash
git add style.css script.js
git commit -m "feat: add light/dark mode CSS variables and toggle logic"
```

### Task 2: Refactor HTML into Two Columns

**Files:**
- Modify: `index.html`
- Modify: `style.css`

- [ ] **Step 1: Create flexbox structure in index.html**
Replace the top-level `.container` and layout wrapper.

```html
<body>
    <div class="app-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: var(--panel-bg); box-shadow: var(--shadow); margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px; color: var(--text-color);">Шахматные этюды</h1>
        <button id="themeToggleBtn" style="padding: 8px 12px; border-radius: 20px; background: none; color: var(--text-color); border: 1px solid var(--border-color);">☀️ / 🌙</button>
    </div>

    <div class="main-layout" style="display: flex; gap: 30px; max-width: 1000px; margin: 0 auto; padding: 0 20px; align-items: flex-start;">
        <!-- Left Column: Board -->
        <div class="board-column" style="flex: 0 0 500px;">
            <!-- existing boardContainer goes here -->
        </div>

        <!-- Right Column: Sidebar -->
        <div class="sidebar-column" style="flex: 1; background: var(--panel-bg); border-radius: 8px; box-shadow: var(--shadow); padding: 20px; display: flex; flex-direction: column;">
            <!-- controls go here -->
        </div>
    </div>
```

- [ ] **Step 2: Add essential layout CSS to style.css**
```css
/* Update existing container */
.container {
    display: none; /* Hide old container styles if they conflict */
}
/* Re-style existing buttons to use variables */
button {
    background-color: var(--accent-color);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
button:hover {
    background-color: var(--accent-hover);
}
#boardContainer {
    box-shadow: var(--shadow);
}
```

- [ ] **Step 3: Commit**
```bash
git add index.html style.css
git commit -m "refactor: implement 2-column flexbox layout"
```

### Task 4: Sidebar Tabs & Relocating Controls

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `script.js`

- [ ] **Step 1: Create tabs structure in index.html inside sidebar-column**
Move all existing controls into three tab contents. Ensure we remove inline backgrounds that conflict with dark mode.

```html
        <div class="sidebar-column" style="flex: 1; background: var(--panel-bg); border-radius: 8px; box-shadow: var(--shadow); padding: 20px; display: flex; flex-direction: column; min-height: 500px;">
            <div class="tabs-header" style="display: flex; border-bottom: 1px solid var(--border-color); margin-bottom: 15px;">
                <button class="tab-btn active" data-tab="tab-play" style="flex: 1; background: none; color: var(--text-color); box-shadow: none; border-radius: 0; padding: 10px; border-bottom: 2px solid var(--accent-color); border-top: none; border-left: none; border-right: none; font-weight: bold;">Игра</button>
                <button class="tab-btn" data-tab="tab-setup" style="flex: 1; background: none; color: var(--text-color); box-shadow: none; border-radius: 0; padding: 10px; border: none; border-bottom: 2px solid transparent;">Редактор</button>
                <button class="tab-btn" data-tab="tab-style" style="flex: 1; background: none; color: var(--text-color); box-shadow: none; border-radius: 0; padding: 10px; border: none; border-bottom: 2px solid transparent;">Вид</button>
            </div>

            <div class="tab-content" id="tab-play">
                <!-- Move game-controls and hint-controls here. Remove inline hardcoded backgrounds -->
            </div>

            <div class="tab-content" id="tab-setup" style="display: none; flex-direction: column; gap: 15px;">
                <!-- Move controls (Flip, Start, Clear) and fen-controls here -->
            </div>

            <div class="tab-content" id="tab-style" style="display: none; flex-direction: column; gap: 15px;">
                <!-- Move pieceThemeSelect and boardThemeSelect here -->
            </div>
        </div>
```

- [ ] **Step 2: Add tab CSS**
```css
.tab-btn:hover {
    background-color: rgba(0,0,0,0.05);
    cursor: pointer;
}
[data-theme="dark"] .tab-btn:hover {
    background-color: rgba(255,255,255,0.05);
}
select, input[type="text"] {
    background-color: var(--bg-color);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    padding: 8px;
    border-radius: 4px;
}
```

- [ ] **Step 3: Add tab switching JS to script.js**
```javascript
    $('.tab-btn').on('click', function() {
        $('.tab-btn').removeClass('active').css('border-bottom', '2px solid transparent').css('font-weight', 'normal');
        $(this).addClass('active').css('border-bottom', '2px solid var(--accent-color)').css('font-weight', 'bold');
        
        $('.tab-content').hide();
        $('#' + $(this).data('tab')).css('display', 'flex'); // Use flex for our inner contents
    });
```

- [ ] **Step 4: Commit**
```bash
git add index.html style.css script.js
git commit -m "feat: implement sidebar tabs and relocate controls"
```
