import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import source from '../tokens.json' with { type: 'json' };
import { allTokens, getThemeConcepts, isEditableColor, parseSavedTheme, resolveTheme, themes, themeBootScript, themeStyle } from '../src/themes.ts';

test('every theme defines every semantic role with an acyclic dependency graph', () => {
  const keys = allTokens.map((token) => token.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const theme of themes) {
    const values = resolveTheme(theme.id);
    assert.deepEqual(Object.keys(values), keys);
    function visit(key, ancestors = []) {
      assert.ok(values[key], `Missing ${theme.id}/${key}`);
      assert.ok(!ancestors.includes(key), `Circular dependency: ${ancestors.join(' -> ')} -> ${key}`);
      for (const match of values[key].matchAll(/var\(--theme-([\w-]+)\)/g)) visit(match[1], [...ancestors, key]);
    }
    keys.forEach((key) => visit(key));
  }
});
test('overrides keep downstream semantic aliases live and can be removed', () => {
  const custom = resolveTheme('studio', { accent: '#123456', 'button-primary': '#abcdef' });
  assert.equal(custom.accent, '#123456');
  assert.equal(custom['button-primary'], '#abcdef');
  assert.equal(custom['button-primary-hover'].includes('accent-hover'), true);
  assert.equal(resolveTheme('studio', { accent: '#123456' })['button-primary'], 'var(--theme-accent)');
  assert.notEqual(resolveTheme('clarity').accent, '#123456');
});
test('dark mode has independent surfaces and both component and legacy mappings', () => {
  const dark = themeStyle('night');
  assert.equal(dark.colorScheme, 'dark');
  assert.equal(dark['--shadow-soft'], 'none');
  assert.notEqual(dark['--theme-background'], dark['--theme-surface']);
  assert.equal(dark['--primary-foreground'], 'var(--theme-button-primary-foreground)');
  assert.equal(dark['--ds-color-canvas'], 'var(--theme-background)');
  assert.equal(themeStyle('studio').colorScheme, 'light');
});
test('switching back to light mode restores shadows without a CSS variable file', () => {
  const style = { ...themeStyle('night'), ...themeStyle('studio') };
  assert.equal(style['--shadow-soft'], source.shadow.soft);
  assert.equal(style['--shadow-float'], source.shadow.float);
});
test('saved state round trips all theme customizations', () => {
  const saved = { version: 1, activeId: 'night', overrides: { studio: { accent: '#123456' }, night: { background: 'oklch(12% 0 0)' } }, savedAt: '2026-10-23T12:00:00.000Z' };
  assert.deepEqual(parseSavedTheme(JSON.stringify(saved)), saved);
});
test('invalid or obsolete saved data cannot become a theme', () => {
  for (const raw of [null, '{', '{}', '{"version":2}', JSON.stringify({ version: 1, activeId: 'unknown', overrides: {}, savedAt: new Date().toISOString() })]) assert.equal(parseSavedTheme(raw), null);
  const base = { version: 1, activeId: 'studio', overrides: {}, savedAt: new Date().toISOString() };
  for (const overrides of [[], { other: {} }, { studio: { unknown: '#fff' } }, { studio: { accent: 'var(--foreground)' } }, { studio: { accent: '#fff;display:none' } }, { studio: { accent: 123 } }]) assert.equal(parseSavedTheme(JSON.stringify({ ...base, overrides })), null);
});
test('editor accepts literal CSS colors and rejects references and injected CSS', () => {
  for (const value of ['#abc', '#abcdef', '#ABCDEF99', 'transparent', 'rgb(255 0 0 / 50%)', 'oklch(0.6 0.1 280)', 'hsl(20, 30%, 50%)']) assert.equal(isEditableColor(value), true, value);
  for (const value of ['#12', 'var(--accent)', 'currentColor', 'url(https://example.com)', '#fff;--theme-background:red', '<script>', 'rgb(var(--x))']) assert.equal(isEditableColor(value), false, value);
});
test('boot restores saved mode and only valid known overrides before hydration', () => {
  const applied = {};
  const root = { style: { setProperty: (key, value) => { applied[key] = value; } }, classList: { toggle: (key, value) => { applied[key] = value; } }, dataset: {} };
  const saved = { version: 1, activeId: 'night', overrides: { night: { accent: '#123456', unknown: '#fff', background: 'var(--unknown)' } } };
  runInNewContext(themeBootScript(), { localStorage: { getItem: () => JSON.stringify(saved) }, document: { documentElement: root }, CSS: { supports: () => true } });
  assert.equal(root.style.colorScheme, 'dark');
  assert.equal(root.dataset.theme, 'night');
  assert.equal(applied.dark, true);
  assert.equal(applied['--theme-accent'], '#123456');
  assert.equal(applied['--theme-unknown'], undefined);
  assert.notEqual(applied['--theme-background'], 'var(--unknown)');
});
test('boot tolerates unavailable storage and corrupt saved data', () => {
  assert.doesNotThrow(() => runInNewContext(themeBootScript(), { localStorage: { getItem: () => { throw new Error('blocked'); } } }));
  assert.doesNotThrow(() => runInNewContext(themeBootScript(), { localStorage: { getItem: () => '{' } }));
});


test('concept palettes omit derived roles, linked roles, primitives and transparency', () => {
  for (const theme of themes) {
    const concepts = getThemeConcepts(theme.id, (value) => value.toLowerCase());
    const roles = concepts.flatMap((concept) => concept.roles.map((role) => role.key));
    assert.ok(roles.includes('background'));
    assert.ok(roles.includes('accent'));
    for (const key of ['white', 'black', 'snow', 'eclipse', 'accent-hover', 'accent-soft', 'button-primary', 'button-ghost']) assert.ok(!roles.includes(key), `${theme.id}/${key}`);
    assert.ok(concepts.every((concept) => !concept.value.includes('var(') && !concept.value.includes('color-mix(') && concept.value !== 'transparent'));
  }
});
test('concept palettes merge equivalent color formats and preserve their uses', () => {
  const normalize = (value) => ['#fff', '#ffffff', 'rgb(255 255 255)'].includes(value.toLowerCase()) ? 'white' : value.toLowerCase();
  const concepts = getThemeConcepts('studio', normalize, { background: '#FFF', foreground: '#FFFFFF', surface: 'rgb(255 255 255)' });
  const white = concepts.filter((concept) => normalize(concept.value) === 'white');
  assert.equal(white.length, 1);
  for (const key of ['background', 'foreground', 'surface']) assert.ok(white[0].roles.some((role) => role.key === key));
});
test('concepts reflect independent custom colors and remove them after restoring a link', () => {
  const normalize = (value) => value.toLowerCase();
  const modified = getThemeConcepts('studio', normalize, { 'button-primary': '#123456' });
  assert.ok(modified.some((concept) => concept.value === '#123456' && concept.roles.some((role) => role.key === 'button-primary')));
  assert.ok(!getThemeConcepts('studio', normalize).some((concept) => concept.roles.some((role) => role.key === 'button-primary')));
  assert.ok(!getThemeConcepts('reading', normalize).some((concept) => concept.value === '#123456'));
});
