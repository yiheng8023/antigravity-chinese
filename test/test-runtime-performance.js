const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const runtime = fs.readFileSync(process.env.AGY_TEST_RUNTIME || path.join(__dirname, '../core/i18n-runtime.js'), 'utf8');
const dictionary = require('../dict/zh-CN.json');
const turn = () => new Promise(resolve => setImmediate(resolve));

async function fixture(t) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const window = dom.window;
  const frames = [];
  window.requestAnimationFrame = cb => frames.push(cb);
  window.setInterval = () => 0;
  window.__AGY_I18N_DATA__ = {
    ...dictionary,
    officialPluginDescriptions: require('../dict/scoped/official-plugin-descriptions.json')
  };
  window.eval(runtime);
  await turn();
  async function frame() {
    const callbacks = frames.splice(0);
    for (const cb of callbacks) cb(window.performance.now());
    await turn();
  }
  async function drain() {
    for (let i = 0; frames.length && i < 500; i++) await frame();
    assert.equal(frames.length, 0, 'translation must drain without the 15-second fallback');
  }
  return { window, document: window.document, frame, drain };
}

test('settings-sized warm scans do not repeat DOM boundary selectors along every ancestor', async t => {
  const { window, document } = await fixture(t);
  const dialog = document.createElement('section');
  dialog.setAttribute('role', 'dialog');
  let parent = dialog;
  for (let i = 0; i < 24; i++) parent = parent.appendChild(document.createElement('div'));
  parent.innerHTML = '<section><h3>Settings</h3><p>General</p><button>Save</button></section>'.repeat(180);
  document.body.appendChild(dialog);
  window.__AGY_TRANSLATE_EL__(dialog);
  let selectors = 0;
  const original = window.Element.prototype.matches;
  window.Element.prototype.matches = function (...args) { selectors++; return original.apply(this, args); };
  try { window.__AGY_TRANSLATE_EL__(dialog); }
  finally { window.Element.prototype.matches = original; }
  const elements = dialog.querySelectorAll('*').length + 1;
  assert.ok(selectors <= elements * 20, `${selectors} selector calls for ${elements} elements exceed linear scan budget`);
  assert.equal(dialog.querySelector('h3').textContent, '设置');
});

test('a burst of more than 500 siblings is translated without dropping the tail', async t => {
  const { document, drain } = await fixture(t);
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 650; i++) {
    const span = document.createElement('span');
    span.textContent = 'Settings';
    fragment.appendChild(span);
  }
  document.body.appendChild(fragment);
  await turn();
  await drain();
  assert.equal([...document.body.children].filter(e => e.textContent === '设置').length, 650);
});

test('one large remounted subtree is split across frames and still protects authored copies', async t => {
  const { document, frame, drain } = await fixture(t);
  const section = document.createElement('section');
  section.innerHTML = '<span>Settings</span>'.repeat(1200) +
    '<div data-testid="user-input-step"><button>Settings</button></div>';
  document.body.appendChild(section);
  await turn();
  await frame();
  const done = () => [...section.children].filter(e => e.tagName === 'SPAN' && e.textContent === '设置').length;
  assert.ok(done() > 0 && done() < 1200, `first frame translated ${done()} rows; a root must not consume the entire frame`);
  await drain();
  assert.equal(done(), 1200);
  assert.equal(section.querySelector('[data-testid="user-input-step"]').textContent, 'Settings');
});

test('a newly opened settings sidebar runs ahead of an older scan within the frame budget', async t => {
  const { window, document, frame, drain } = await fixture(t);
  let clock = 0;
  Object.defineProperty(window.performance, 'now', { value: () => clock += 0.01 });
  const background = document.createElement('div');
  background.innerHTML = '<span>Settings</span>'.repeat(1200);
  document.body.appendChild(background);
  await turn();
  await frame();
  assert.equal(background.lastChild.textContent, 'Settings');

  const portal = document.createElement('div');
  portal.setAttribute('data-base-ui-portal', '');
  document.body.appendChild(portal);
  const settings = document.createElement('div');
  settings.className = 'settings-modal-backdrop';
  settings.innerHTML = `<div class="settings-modal-container" role="dialog">
    <div data-testid="settings-sidebar">
      <h1>Settings</h1><button data-testid="settings-nav-item-General"><span>General</span></button>
      <div data-testid="user-input-step">Settings</div>
    </div>
    <main><h2>Appearance</h2></main>
  </div>`;
  portal.appendChild(settings);
  await turn();
  await frame();
  assert.equal(settings.querySelector('h1').textContent, '设置');
  assert.equal(settings.querySelector('button').textContent, '通用');
  assert.equal(settings.querySelector('[data-testid="user-input-step"]').textContent, 'Settings');
  assert.equal(background.lastChild.textContent, 'Settings');
  await drain();
  assert.equal(background.lastChild.textContent, '设置');
  assert.equal(settings.querySelector('main h2').textContent, '外观');
});

test('content ownership is rechecked after yielding and moving a queued node', async t => {
  const { document, frame, drain } = await fixture(t);
  const section = document.createElement('section');
  section.innerHTML = '<span>Settings</span>'.repeat(1200);
  const content = document.createElement('div');
  content.setAttribute('data-testid', 'user-input-step');
  document.body.append(section, content);
  await turn();
  await frame();
  const late = section.lastElementChild;
  late.setAttribute('title', 'Settings');
  content.appendChild(late);
  await turn();
  await drain();
  assert.equal(late.textContent, 'Settings');
  assert.equal(late.title, 'Settings');
  section.appendChild(late);
  await turn();
  await drain();
  assert.equal(late.textContent, '设置');
  assert.equal(late.title, '设置');
});
