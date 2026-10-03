import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const stylesDir = new URL('../styles/', import.meta.url);
const stylesheets = readdirSync(stylesDir).filter(name => name.endsWith('.css'));

test('stylesheets do not use !important', () => {
  for (const name of stylesheets) {
    const css = readFileSync(new URL(name, stylesDir), 'utf8');
    assert.equal(css.includes('!important'), false, `${name} contains !important`);
  }
});

test('index.html has no inline style attributes', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(/\sstyle="/.test(html), false);
});

test('every theme token used by the stylesheets is defined for both themes', () => {
  const base = readFileSync(new URL('base.css', stylesDir), 'utf8');
  const root = base.slice(base.indexOf(':root'), base.indexOf('[data-theme="dark"]'));
  const used = new Set();
  for (const name of stylesheets) {
    const css = readFileSync(new URL(name, stylesDir), 'utf8');
    for (const match of css.matchAll(/var\((--[\w-]+)/g)) used.add(match[1]);
  }
  for (const token of used) {
    assert.match(root, new RegExp(`${token}:`), `${token} is not defined in :root`);
  }
});

test('move hint dots have generated content so they render', () => {
  const css = readFileSync(new URL('board.css', stylesDir), 'utf8');
  const rule = css.match(/\.move-dest-marker::after\s*\{([^}]*)\}/);
  assert.ok(rule, 'missing .move-dest-marker::after rule');
  assert.match(rule[1], /content:/);
});
