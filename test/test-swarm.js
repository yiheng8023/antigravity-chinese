const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const { JSDOM } = require('jsdom');
const { patchSwarmFrames, START, END } = require('../core/swarm-frame-patch');
const data = require('../dict/scoped/swarm.json');
const runtime = fs.readFileSync(path.join(__dirname, '../core/swarm-i18n.js'), 'utf8');
const signature = '<nav data-testid="swarm-tabs"><button id="tabbtn-feed">Board</button></nav>';
const empty = '<section id="empty" data-testid="swarm-empty-state"><h2 id="empty-title">No swarm in this conversation</h2>' +
  '<p id="empty-body">Open this pane from a conversation to see its swarm. Swarms started there appear here automatically; start one with <code>/swarm</code>.</p>' +
  '<p class="empty-hint">Watching for a swarm</p></section>';

function domFor(t, extra = '', markers = true) {
  const dom = new JSDOM('<!doctype html><body>' + (markers ? signature + empty : '') + extra, {
    runScripts: 'outside-only', url: 'plugin://swarm--swarm_board-12345/'
  });
  t.after(() => dom.window.close());
  return dom;
}
function run(dom) { dom.window.eval('(' + runtime + ')(' + JSON.stringify(data) + ')'); }
function settle(dom) { return new Promise(resolve => dom.window.setTimeout(resolve, 0)); }

test('Swarm graph modes, GIF preview and member statuses translate only the built-in UI', async t => {
  const dom = domFor(t, `
    <div id="tab-graph">
      <div class="segmented" role="group" aria-label="Graph view">
        <button id="gview-hive" data-gview="hive" aria-pressed="true" title="Threads as cells, with each worker where it works">Hive</button>
        <button id="gview-mentions" data-gview="mentions" aria-pressed="false" title="Who @mentions whom">Mentions</button>
      </div>
      <button id="graph-export-gif" title="Export graph replay as an animated GIF"><span id="graph-export-gif-label">Export GIF</span></button>
    </div>
    <div id="gif-modal" role="dialog">
      <img id="gif-modal-img" data-testid="swarm-gif-modal-img" alt="Exported swarm graph replay" src="blob:preview">
      <span class="gif-modal-hint">Right-click image to save, or open in a new tab.</span>
      <a id="gif-modal-open" href="blob:preview">Open in new tab</a>
      <button id="gif-modal-close" aria-label="Close preview" title="Close"></button>
    </div>
    <div id="members">
      <span class="o2-mauth">Waiting</span>
      <span class="o2-mstat info" title="Waiting: turn ended, asleep on the board until a post wakes it">Waiting</span>
      <span class="o2-mstat bad" title="Killed: removed from the swarm">Killed</span>
    </div>
    <div class="msg-body"><img id="attached-image" alt="Exported swarm graph replay"><p>Export GIF</p></div>`);
  run(dom);
  const find = selector => dom.window.document.querySelector(selector);
  assert.equal(find('.segmented').getAttribute('aria-label'), '关系图视图');
  assert.equal(find('#gview-hive').textContent, '蜂巢视图');
  assert.equal(find('#gview-hive').getAttribute('aria-pressed'), 'true');
  assert.equal(find('#gview-mentions').textContent, '提及视图');
  assert.equal(find('#gview-mentions').dataset.gview, 'mentions');
  assert.equal(find('#graph-export-gif').title, '将关系图回放导出为 GIF 动图');
  const label = find('#graph-export-gif-label');
  assert.equal(label.textContent, '导出 GIF');
  const preview = find('#gif-modal-img');
  assert.equal(preview.alt, '导出的 Swarm 关系图回放');
  assert.equal(preview.getAttribute('src'), 'blob:preview');
  assert.equal(find('#gif-modal-open').textContent, '在新标签页中打开');
  assert.equal(find('#gif-modal-open').getAttribute('href'), 'blob:preview');
  assert.equal(find('#gif-modal-close').getAttribute('aria-label'), '关闭预览');
  assert.equal(find('.gif-modal-hint').textContent, '右键图片即可保存，或在新标签页中打开。');
  assert.equal(find('.o2-mstat.info').textContent, '等待中');
  assert.equal(find('.o2-mstat.info').title, '等待中：本轮已结束，收到新消息后唤醒');
  assert.equal(find('.o2-mstat.bad').textContent, '已终止');
  assert.equal(find('.o2-mstat.bad').title, '已终止：已从 Swarm 移除');
  assert.equal(find('.o2-mauth').textContent, 'Waiting');
  assert.equal(find('#attached-image').alt, 'Exported swarm graph replay');
  assert.equal(find('.msg-body p').textContent, 'Export GIF');

  find('#graph-export-gif').disabled = true;
  label.textContent = 'Exporting…';
  await settle(dom);
  assert.equal(label.textContent, '正在导出…');
  assert.equal(find('#graph-export-gif').disabled, true);
  find('.msg-body').append(preview);
  await settle(dom);
  assert.equal(preview.alt, 'Exported swarm graph replay');
});

test('Swarm screenshot empty state translates while the command and identifiers stay intact', t => {
  const dom = domFor(t);
  run(dom);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#empty-title').textContent, '此会话尚无 Swarm');
  assert.match(doc.querySelector('#empty-body').textContent, /^从会话中打开此面板/);
  assert.equal(doc.querySelector('#empty-body code').textContent, '/swarm');
  assert.match(doc.querySelector('#empty-body').textContent, /\/swarm。$/);
  assert.equal(doc.querySelector('.empty-hint').textContent, '等待 Swarm 启动');
  assert.equal(doc.querySelector('#tabbtn-feed').textContent, '看板');
  run(dom);
  assert.equal(doc.querySelector('#tabbtn-feed').textContent, '看板');
});

test('Swarm reconnects and asynchronous replacement of the empty state are localized', async t => {
  const dom = domFor(t, '<span id="live" title="Updates automatically"><span id="live-label">Live</span></span>');
  run(dom);
  const doc = dom.window.document;
  doc.querySelector('#live').title = 'Lost contact with the swarm sidecar; retrying';
  doc.querySelector('#live-label').textContent = 'Reconnecting';
  doc.querySelector('#empty-body').innerHTML = 'Swarms started in this conversation appear here automatically, with their board, members and @mention graph. Start one with <code>/swarm</code>.';
  await settle(dom);
  assert.equal(doc.querySelector('#live-label').textContent, '正在重新连接');
  assert.match(doc.querySelector('#live').title, /^已与 Swarm 辅助进程/);
  assert.match(doc.querySelector('#empty-body').textContent, /看板、成员和 @提及关系图/);
});

test('filters preserve names, channels, values, selected state and input text', t => {
  const dom = domFor(t, '<input id="f-search" placeholder="Search" aria-label="Search posts" value="Live">' +
    '<select id="f-agent"><option value="">From anyone</option><option value="Board" selected>Board</option></select>' +
    '<select id="f-channel"><option value="">All channels</option><option value="Live">Live</option></select>');
  run(dom);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#f-search').placeholder, '搜索');
  assert.equal(doc.querySelector('#f-search').value, 'Live');
  assert.equal(doc.querySelector('#f-agent option[value=""]').textContent, '所有发送者');
  assert.equal(doc.querySelector('#f-agent').value, 'Board');
  assert.equal(doc.querySelector('#f-agent option[value="Board"]').textContent, 'Board');
  assert.equal(doc.querySelector('#f-channel option[value="Live"]').textContent, 'Live');
});

test('messages, member roles, task titles, raw data and narrator HTML keep matching English', t => {
  const dom = domFor(t, '<h1 id="swarm-title">No swarm in this conversation</h1>' +
    '<div id="feed"><div class="msg"><div>Board</div><button id="raw-copy-label">Copy</button></div></div>' +
    '<div id="members"><article class="o2-mrow"><span class="o2-mauth">Live</span><span class="o2-mstat">Working</span>' +
    '<div class="o2-mrole">Board</div><div class="o2-mnow">Reconnecting</div></article></div>' +
    '<div id="ov-plain"><div class="o2-card"><b>Board</b></div></div>' +
    '<div id="ov-frame"><span id="live-label">Live</span></div><pre id="raw">Copy</pre><p>Board</p>');
  run(dom);
  const doc = dom.window.document;
  for (const [selector, source] of [['#swarm-title', 'No swarm in this conversation'], ['.msg', 'BoardCopy'],
    ['.o2-mauth', 'Live'], ['.o2-mstat', 'Working'], ['.o2-mrole', 'Board'], ['.o2-mnow', 'Reconnecting'],
    ['.o2-card', 'Board'], ['#ov-frame', 'Live'], ['#raw', 'Copy'], ['body > p', 'Board']]) {
    assert.equal(doc.querySelector(selector).textContent, source, selector);
  }
});

test('reparented UI restores its source including attributes without restoring over new content', async t => {
  const dom = domFor(t, '<button id="raw-copy" title="Copy to clipboard"><span id="raw-copy-label">Copy</span></button><div class="msg"></div>');
  run(dom);
  const doc = dom.window.document;
  const button = doc.querySelector('#raw-copy');
  assert.equal(button.title, '复制到剪贴板');
  doc.querySelector('.msg').appendChild(button);
  await settle(dom);
  assert.equal(button.title, 'Copy to clipboard');
  assert.equal(button.textContent, 'Copy');
  doc.body.appendChild(button);
  await settle(dom);
  assert.equal(button.textContent, '复制');
  button.firstElementChild.textContent = 'User replacement';
  doc.querySelector('.msg').appendChild(button);
  await settle(dom);
  assert.equal(button.textContent, 'User replacement');
});

test('message controls and fixed author hints translate without translating the author or body', async t => {
  const dom = domFor(t, '<div id="feed"><article class="msg"><header class="msg-head"><span class="msg-author" title="Not on the roster">Show more</span>' +
    '<span class="msg-note">not on roster</span></header><div class="msg-body">Show more</div>' +
    '<button class="msg-more" data-testid="swarm-message-more">Show more</button></article></div>');
  run(dom);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('.msg-author').textContent, 'Show more');
  assert.equal(doc.querySelector('.msg-author').title, '不在成员列表中');
  assert.equal(doc.querySelector('.msg-body').textContent, 'Show more');
  assert.equal(doc.querySelector('.msg-note').textContent, '不在成员列表中');
  const button = doc.querySelector('.msg-more');
  assert.equal(button.textContent, '展开更多');
  button.textContent = 'Show less';
  await settle(dom);
  assert.equal(button.textContent, '收起');
  doc.querySelector('.msg-body').appendChild(button);
  await settle(dom);
  assert.equal(button.textContent, 'Show less');
});

test('2.33 progress navigation translates without rewriting authored frame captions', t => {
  const dom = domFor(t, `<div id="ov-plain"><input class="o2-rswipe" aria-label="Compare then and now"></div>
    <div class="o2-tvstage"><button class="o2-tvnav prev" aria-label="Previous"></button><img alt="Previous"></div>
    <div class="o2-tvstrip" role="listbox" aria-label="Frames"><button aria-label="Frames">Frames</button></div>`);
  run(dom);
  const {document} = dom.window;
  assert.equal(document.querySelector('input').getAttribute('aria-label'), '对比前后画面');
  assert.equal(document.querySelector('.prev').getAttribute('aria-label'), '上一帧');
  assert.equal(document.querySelector('img').alt, 'Previous');
  assert.equal(document.querySelector('.o2-tvstrip').getAttribute('aria-label'), '画面列表');
  assert.equal(document.querySelector('.o2-tvstrip button').getAttribute('aria-label'), 'Frames');
});

test('fixed member controls translate while custom narrator labels remain authored', t => {
  const dom = domFor(t, '<div id="members" class="o2"><input class="o2-msin" placeholder="Search members">' +
    '<h3 class="o2-msec"><span>Active</span></h3><span class="o2-mstat info">Working</span></div>');
  dom.window.SwarmHive = { viewCopy: { ui: { custom: 'Working' } } };
  run(dom);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('.o2-msin').placeholder, '搜索成员');
  assert.equal(doc.querySelector('.o2-msec span').textContent, '活跃成员');
  assert.equal(doc.querySelector('.o2-mstat').textContent, 'Working');
});

test('renderer refuses documents without both Swarm structure markers', t => {
  const dom = domFor(t, '<p id="empty-title">No swarm in this conversation</p>', false);
  run(dom);
  assert.equal(dom.window.__AGY_SWARM_I18N__, undefined);
  assert.equal(dom.window.document.querySelector('p').textContent, 'No swarm in this conversation');
});

function nativeHarness(t) {
  const app = new EventEmitter();
  const contents = new EventEmitter();
  const frames = new Map();
  const script = patchSwarmFrames('globalThis.originalMain = true;');
  vm.runInNewContext(script, {
    require: name => {
      assert.equal(name, 'electron');
      return { app, webContents: { getAllWebContents: () => [contents] },
        webFrameMain: { fromId: (pid, rid) => frames.get(pid + ':' + rid) } };
    }, URL
  });
  function load(url, dom = domFor(t), throws = false) {
    let calls = 0;
    const frame = { url, executeJavaScript: code => {
      calls++;
      if (throws) return Promise.reject(new Error('Destroyed during navigation'));
      dom.window.eval(code);
      return Promise.resolve();
    } };
    frames.set('1:2', frame);
    contents.emit('did-frame-finish-load', {}, false, 1, 2);
    return { dom, get calls() { return calls; } };
  }
  return { app, contents, frames, load };
}

test('native hook loads allowlisted child frames and survives reload without duplicate listeners', t => {
  const h = nativeHarness(t);
  h.app.emit('web-contents-created', {}, h.contents);
  assert.equal(h.contents.listenerCount('did-frame-finish-load'), 1);
  const first = h.load('plugin://swarm--swarm_board-12345/?token=fixture');
  assert.equal(first.calls, 1);
  assert.equal(first.dom.window.document.querySelector('#empty-title').textContent, '此会话尚无 Swarm');
  h.contents.emit('did-frame-finish-load', {}, true, 1, 2);
  assert.equal(first.calls, 2);
  assert.equal(first.dom.window.document.querySelector('#tabbtn-feed').textContent, '看板');
  const next = h.load('plugin://swarm--swarm_board-54321/');
  assert.equal(next.dom.window.document.querySelector('#tabbtn-feed').textContent, '看板');
});

test('native hook denies other plugins, external origins and non-root pages', t => {
  const h = nativeHarness(t);
  for (const url of ['https://swarm--swarm_board-12345/', 'plugin://other--swarm_board-12345/',
    'plugin://swarm--swarm_board-12345.evil/', 'plugin://swarm--swarm_board-12345/view.html',
    'plugin://swarm--swarm_board-12345:80/', 'plugin://user@swarm--swarm_board-12345/', 'about:blank']) {
    assert.equal(h.load(url).calls, 0, url);
  }
});

test('native hook tolerates removed frames and rejected execution', async t => {
  const h = nativeHarness(t);
  assert.doesNotThrow(() => h.contents.emit('did-frame-finish-load', {}, true, 99, 99));
  assert.equal(h.load('plugin://swarm--swarm_board-12345/', domFor(t), true).calls, 1);
  await new Promise(resolve => setImmediate(resolve));
});

test('main patch is byte stable on reinstall and leaves original code intact', () => {
  const source = '"use strict";\r\n// original trailing newline\r\n';
  const patched = patchSwarmFrames(source);
  assert.equal(patchSwarmFrames(patched), patched);
  assert.equal(patched.split(START).length, 2);
  assert.equal(patched.split(END).length, 2);
  assert.ok(patched.startsWith(source));
  assert.throws(() => patchSwarmFrames(source + '\n\n' + START), /Incomplete Swarm/);
});

test('scoped dictionary has valid, unique selectors and no blank translations', t => {
  const dom = domFor(t);
  assert.equal(new Set(data.selectors).size, data.selectors.length);
  for (const selector of data.selectors.concat(data.attributeSelectors)) assert.doesNotThrow(() => dom.window.document.querySelector(selector));
  for (const [source, target] of Object.entries(data.exact)) {
    assert.ok(source.trim());
    assert.equal(typeof target, 'string');
    assert.ok(target.trim());
  }
});
