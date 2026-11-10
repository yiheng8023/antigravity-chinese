const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const runtime = fs.readFileSync(path.join(__dirname, '../core/i18n-runtime.js'), 'utf8');
const dictionary = require('../dict/zh-CN.json');

function settle(window) {
  return new Promise(resolve => window.setTimeout(resolve, 40));
}

async function fixture(t, html) {
  const dom = new JSDOM('<!doctype html><body>' + html + '</body>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.__AGY_I18N_DATA__ = dictionary;
  window.eval(runtime);
  await settle(window);
  return { window, document: window.document, translate: window.__AGY_TRANSLATE_EL__ };
}

test('sent user messages preserve dictionary matches, nested labels and attributes', async t => {
  const { document } = await fixture(t, `
    <button id="settings">Settings</button>
    <div data-testid="user-input-step" title="Settings" aria-label="New conversation">
      Settings<span title="Settings" aria-label="New conversation">New conversation</span>
    </div>`);
  const message = document.querySelector('[data-testid="user-input-step"]');
  assert.equal(document.querySelector('#settings').textContent, '设置');
  assert.equal(message.firstChild.nodeValue.trim(), 'Settings');
  assert.equal(message.querySelector('span').textContent, 'New conversation');
  for (const element of [message, message.querySelector('span')]) {
    assert.equal(element.title, 'Settings');
    assert.equal(element.getAttribute('aria-label'), 'New conversation');
  }
});

test('protected messages keep split React text fragments and their original nodes', async t => {
  const { document, translate } = await fixture(t, '<div data-testid="user-input-step"></div>');
  const message = document.querySelector('[data-testid="user-input-step"]');
  const first = document.createTextNode('New ');
  const second = document.createTextNode('conversation');
  message.append(first, second);
  translate(message);
  assert.equal(first.nodeValue, 'New ');
  assert.equal(second.nodeValue, 'conversation');
  assert.equal(message.childNodes.length, 2);
  assert.equal(message.childNodes[0], first);
  assert.equal(message.childNodes[1], second);
});

for (const messageType of ['agent-message', 'agent-response']) {
  test(`${messageType} protects plain and nested assistant text without hiding real controls`, async t => {
    const { document } = await fixture(t, `
      <div data-testid="${messageType}" title="Settings">
        New conversation
        <div id="answer"><span>Settings</span><p>New conversation</p></div>
        <button id="action" title="Settings">Settings</button>
        <div id="status" role="status"><span>Working</span></div>
        <span id="role-button" role="button">Settings</span>
      </div>`);
    const message = document.querySelector('[data-testid="' + messageType + '"]');
    assert.equal(message.firstChild.nodeValue.trim(), 'New conversation');
    assert.equal(message.title, 'Settings');
    assert.equal(document.querySelector('#answer span').textContent, 'Settings');
    assert.equal(document.querySelector('#answer p').textContent, 'New conversation');
    assert.equal(document.querySelector('#action').textContent, '设置');
    assert.equal(document.querySelector('#action').title, '设置');
    assert.equal(document.querySelector('#status').textContent, '正在运行');
    assert.equal(document.querySelector('#role-button').textContent, '设置');
  });
}

test('assistant containers never combine split authored fragments into a translated label', async t => {
  const { document, translate } = await fixture(t, '<div id="messages"></div>');
  for (const messageType of ['agent-message', 'agent-response']) {
    const message = document.createElement('div');
    message.setAttribute('data-testid', messageType);
    const first = document.createTextNode('New ');
    const second = document.createTextNode('conversation');
    message.append(first, second);
    document.querySelector('#messages').appendChild(message);
    translate(message);
    assert.equal(first.nodeValue, 'New ', messageType);
    assert.equal(second.nodeValue, 'conversation', messageType);
  }
});

for (const bodyClass of ['prose', 'markdown']) {
  test(`${bodyClass} text and embedded buttons remain authored content`, async t => {
    const { document } = await fixture(t, `
      <div data-testid="agent-message">
        <section class="${bodyClass}" title="Settings">
          <p>Settings</p><span>New conversation</span>
          <button title="Settings" aria-label="New conversation">Settings</button>
        </section>
        <button id="outside">Settings</button>
      </div>`);
    const body = document.querySelector('section');
    assert.equal(body.querySelector('p').textContent, 'Settings');
    assert.equal(body.querySelector('span').textContent, 'New conversation');
    assert.equal(body.title, 'Settings');
    assert.equal(body.querySelector('button').textContent, 'Settings');
    assert.equal(body.querySelector('button').title, 'Settings');
    assert.equal(body.querySelector('button').getAttribute('aria-label'), 'New conversation');
    assert.equal(document.querySelector('#outside').textContent, '设置');
  });
}

test('file trees and deeply nested file labels preserve text and accessibility attributes', async t => {
  const { document } = await fixture(t, `
    <div role="tree" title="Settings">
      <div role="treeitem"><div><div><span title="Settings" aria-label="New conversation">Settings</span></div></div></div>
    </div>
    <div role="treeitem" id="detached-item"><span>New conversation</span></div>
    <button id="settings">Settings</button>`);
  const tree = document.querySelector('[role="tree"]');
  assert.equal(tree.title, 'Settings');
  assert.equal(tree.querySelector('span').textContent, 'Settings');
  assert.equal(tree.querySelector('span').title, 'Settings');
  assert.equal(tree.querySelector('span').getAttribute('aria-label'), 'New conversation');
  assert.equal(document.querySelector('#detached-item').textContent, 'New conversation');
  assert.equal(document.querySelector('#settings').textContent, '设置');
});

test('file path breadcrumbs retain their file labels and attributes', async t => {
  const { document } = await fixture(t, `
    <nav aria-label="File path breadcrumbs"><span title="Settings">New conversation</span></nav>
    <button id="ui">New conversation</button>`);
  const breadcrumb = document.querySelector('nav span');
  assert.equal(breadcrumb.textContent, 'New conversation');
  assert.equal(breadcrumb.title, 'Settings');
  assert.equal(document.querySelector('#ui').textContent, '新建会话');
});

// These shapes were inspected in the Windows Antigravity App 2.29.0 DOM.
// They use dictionary matches as authored text to expose accidental rewrites.
test('App 2.29 user-message-content preserves quoted text without an outer message wrapper', async t => {
  const { document } = await fixture(t, `
    <div data-testid="user-message-content"><div data-quotable class="whitespace-pre-wrap text-sm">
      <span title="Settings">New conversation</span>
    </div></div>
    <button id="ui">Settings</button>`);
  assert.equal(document.querySelector('[data-quotable] span').textContent, 'New conversation');
  assert.equal(document.querySelector('[data-quotable] span').title, 'Settings');
  assert.equal(document.querySelector('#ui').textContent, '设置');
});

test('App 2.29 planner response text and markdown-root preserve assistant content', async t => {
  const { document } = await fixture(t, `
    <div data-testid="planner-response-text"><div data-markdown-root>
      <p><span>Settings</span></p><p><strong>New conversation</strong></p>
      <button title="Settings">Settings</button>
    </div></div>
    <div data-markdown-root><p>New conversation</p></div>
    <button id="ui">Settings</button>`);
  const response = document.querySelector('[data-testid="planner-response-text"]');
  assert.equal(response.querySelector('p span').textContent, 'Settings');
  assert.equal(response.querySelector('strong').textContent, 'New conversation');
  assert.equal(response.querySelector('button').textContent, 'Settings');
  assert.equal(response.querySelector('button').title, 'Settings');
  assert.equal(document.querySelector('body > [data-markdown-root] p').textContent, 'New conversation');
  assert.equal(document.querySelector('#ui').textContent, '设置');
});

test('App 2.29 sidebar conversation names remain unchanged while row actions translate', async t => {
  const { document } = await fixture(t, `
    <div data-testid="conversation-row-sidebar" class="agy-sidebar-row">
      <div><a class="agy-button agy-button-custom" role="button" href="#conversation" aria-label="Settings"></a></div>
      <div class="pointer-events-none"><div><span class="truncate text-sm" title="Settings">New conversation</span></div></div>
      <div><div class="agy-row-actions">
        <button data-testid="conversation-archive-button" aria-label="Settings">Settings</button>
        <button data-testid="conversation-pin-button" title="Settings">Settings</button>
      </div></div>
    </div>
    <div class="truncate" id="ordinary-label">Settings</div>`);
  const row = document.querySelector('[data-testid="conversation-row-sidebar"]');
  assert.equal(row.querySelector('a').getAttribute('aria-label'), 'Settings');
  assert.equal(row.querySelector('span.truncate').textContent, 'New conversation');
  assert.equal(row.querySelector('span.truncate').title, 'Settings');
  for (const button of row.querySelectorAll('button')) assert.equal(button.textContent, '设置');
  assert.equal(row.querySelector('[data-testid="conversation-archive-button"]').getAttribute('aria-label'), '设置');
  assert.equal(row.querySelector('[data-testid="conversation-pin-button"]').title, '设置');
  assert.equal(document.querySelector('#ordinary-label').textContent, '设置');
});

test('App 2.29 project header and breadcrumb names preserve their text', async t => {
  const { document } = await fixture(t, `
    <button data-testid="project-header" data-project-label="Settings" title="Settings">
      <div><div><div><span class="truncate text-sm">Settings</span></div></div></div>
    </button>
    <span data-testid="breadcrumb-segment"><span class="truncate inline-block" title="Settings">New conversation</span></span>
    <button id="ordinary-project-control"><span class="truncate">Settings</span></button>`);
  const header = document.querySelector('[data-testid="project-header"]');
  assert.equal(header.textContent.trim(), 'Settings');
  assert.equal(header.title, 'Settings');
  assert.equal(header.getAttribute('data-project-label'), 'Settings');
  const breadcrumb = document.querySelector('[data-testid="breadcrumb-segment"] span');
  assert.equal(breadcrumb.textContent, 'New conversation');
  assert.equal(breadcrumb.title, 'Settings');
  assert.equal(document.querySelector('#ordinary-project-control').textContent, '设置');
});

test('App 2.29 quoted file pills retain file names without blocking unrelated buttons', async t => {
  const { document } = await fixture(t, `
    <button class="inline-pill" data-uri="file:///workspace/Settings" data-quotable-inline
      title="Settings" aria-label="New conversation"><span>Settings</span></button>
    <button id="uri-only" data-uri="file:///workspace/other">Settings</button>
    <button id="quotable-only" data-quotable-inline>Settings</button>
    <button id="ordinary">Settings</button>`);
  const pill = document.querySelector('button.inline-pill');
  assert.equal(pill.textContent, 'Settings');
  assert.equal(pill.title, 'Settings');
  assert.equal(pill.getAttribute('aria-label'), 'New conversation');
  assert.equal(pill.getAttribute('data-uri'), 'file:///workspace/Settings');
  for (const id of ['uri-only', 'quotable-only', 'ordinary']) {
    assert.equal(document.querySelector('#' + id).textContent, '设置', id);
  }
});

test('the explicit localization skip marker protects its entire subtree', async t => {
  const { document } = await fixture(t, `
    <section data-ag-localization-skip title="Settings">
      <div><button title="Settings">New conversation</button></div>
    </section>
    <button id="ui">Settings</button>`);
  assert.equal(document.querySelector('section').title, 'Settings');
  assert.equal(document.querySelector('section button').textContent, 'New conversation');
  assert.equal(document.querySelector('section button').title, 'Settings');
  assert.equal(document.querySelector('#ui').textContent, '设置');
});

test('ordinary settings paragraphs and controls still translate next to protected content', async t => {
  const { document } = await fixture(t, `
    <section><h2>Settings</h2><p>Folder where files downloaded in the built-in browser are saved.</p>
      <button title="Start Voice mode" aria-label="Start Voice mode">New conversation</button></section>
    <div data-testid="user-input-step"><p>Folder where files downloaded in the built-in browser are saved.</p></div>`);
  assert.equal(document.querySelector('h2').textContent, '设置');
  assert.equal(document.querySelector('section p').textContent, '内置浏览器下载文件的保存文件夹。');
  assert.equal(document.querySelector('section button').textContent, '新建会话');
  assert.equal(document.querySelector('section button').title, '启动语音模式');
  assert.equal(document.querySelector('section button').getAttribute('aria-label'), '启动语音模式');
  assert.equal(document.querySelector('[data-testid="user-input-step"] p').textContent,
    'Folder where files downloaded in the built-in browser are saved.');
});

test('MutationObserver protects deeply added content while continuing to translate new UI', async t => {
  const { window, document } = await fixture(t, '<div id="ui"></div>');
  for (const attributes of ['data-testid="user-input-step"', 'class="prose"', 'role="treeitem"',
    'data-testid="planner-response-text"', 'data-markdown-root']) {
    const boundary = document.createElement('div');
    boundary.innerHTML = '<section ' + attributes + '><div><div><div><div><span></span></div></div></div></div></section>';
    document.body.appendChild(boundary);
    await settle(window);
    const label = document.createElement('span');
    label.title = 'Settings';
    label.textContent = 'New conversation';
    boundary.querySelector('span').appendChild(label);
    await settle(window);
    assert.equal(label.textContent, 'New conversation', attributes);
    assert.equal(label.title, 'Settings', attributes);
  }
  const button = document.createElement('button');
  button.textContent = 'Settings';
  document.querySelector('#ui').appendChild(button);
  await settle(window);
  assert.equal(button.textContent, '设置');
});

test('MutationObserver characterData updates cannot bypass a content ancestor', async t => {
  const { window, document } = await fixture(t, `
    <div data-testid="user-input-step"><div><div><div><div><span>seed</span></div></div></div></div></div>
    <button id="ui">seed</button>`);
  const messageText = document.querySelector('[data-testid="user-input-step"] span').firstChild;
  const uiText = document.querySelector('#ui').firstChild;
  messageText.nodeValue = 'New conversation';
  uiText.nodeValue = 'Settings';
  await settle(window);
  assert.equal(messageText.nodeValue, 'New conversation');
  assert.equal(uiText.nodeValue, '设置');
});

test('a previously scanned node respects its current content boundary after reparenting', async t => {
  const { window, document } = await fixture(t, `
    <div id="ui"><span id="moving">seed</span></div>
    <div data-testid="user-input-step"></div>`);
  const moving = document.querySelector('#moving');
  const text = moving.firstChild;
  document.querySelector('[data-testid="user-input-step"]').appendChild(moving);
  text.nodeValue = 'Settings';
  await settle(window);
  assert.equal(text.nodeValue, 'Settings');

  document.querySelector('#ui').appendChild(moving);
  text.nodeValue = 'New conversation';
  await settle(window);
  assert.equal(text.nodeValue, '新建会话');
});

test('plan command alerts respect protected spans while translating normal UI', async t => {
  const { document } = await fixture(t, `
    <div data-testid="plan-command-fyi-alert"><span data-ag-localization-skip>Type</span></div>
    <div data-testid="plan-command-fyi-alert"><span data-markdown-root>Type</span></div>
    <div data-testid="plan-command-fyi-alert"><span data-testid="user-message-content">Type</span></div>
    <div data-testid="plan-command-fyi-alert"><span id="normal-alert">Type</span></div>`);
  for (const selector of ['[data-ag-localization-skip]', '[data-markdown-root]', '[data-testid="user-message-content"]']) {
    const span = document.querySelector(selector);
    assert.equal(span.textContent, 'Type', selector);
  }
  assert.equal(document.querySelector('#normal-alert').textContent, '输入');
});

test('a file tree preserves item names and translates controls inside the same item', async t => {
  const { document } = await fixture(t, `
    <div role="tree"><button role="treeitem" title="Settings">
      <span>Settings</span>
    </button><div role="treeitem" aria-label="Settings">
      <span title="Settings">Settings</span>
      <button id="file-link" data-uri="file:///workspace/Settings" title="Settings">Settings</button>
      <div><button id="more" aria-label="More actions">More actions</button></div>
    </div></div>`);
  assert.equal(document.querySelector('[role="treeitem"] span').textContent, 'Settings');
  assert.equal(document.querySelector('[role="treeitem"][aria-label]').getAttribute('aria-label'), 'Settings');
  assert.equal(document.querySelector('span[title]').title, 'Settings');
  assert.equal(document.querySelector('#file-link').textContent, 'Settings');
  assert.equal(document.querySelector('#file-link').title, 'Settings');
  assert.equal(document.querySelector('#more').textContent, '更多操作');
  assert.equal(document.querySelector('#more').getAttribute('aria-label'), '更多操作');
});

test('reparenting an already translated node restores its text and attributes', async t => {
  const { window, document } = await fixture(t, `
    <div id="ui"><span id="moving" title="Settings">Settings</span></div>
    <div data-testid="user-input-step"></div>`);
  const moving = document.querySelector('#moving');
  const message = document.querySelector('[data-testid="user-input-step"]');
  assert.equal(moving.textContent, '设置');
  assert.equal(moving.title, '设置');
  message.appendChild(moving);
  await settle(window);
  assert.equal(moving.textContent, 'Settings');
  assert.equal(moving.title, 'Settings');
  document.querySelector('#ui').appendChild(moving);
  await settle(window);
  assert.equal(moving.textContent, '设置');
  assert.equal(moving.title, '设置');
});

test('a reparented fragmented label and plan hint recover their original nodes', async t => {
  const { window, document, translate } = await fixture(t, `
    <div id="split"></div>
    <div data-testid="plan-command-fyi-alert"><span id="hint">Type</span></div>
    <div data-markdown-root></div>`);
  const split = document.querySelector('#split');
  const first = document.createTextNode('New ');
  const second = document.createTextNode('conversation');
  split.append(first, second);
  translate(split);
  const hint = document.querySelector('#hint');
  const alert = hint.parentElement;
  assert.equal(split.textContent, '新建会话');
  assert.equal(hint.textContent, '输入');
  document.querySelector('[data-markdown-root]').append(split, hint);
  await settle(window);
  assert.deepEqual([...split.childNodes], [first, second]);
  assert.equal(first.nodeValue, 'New ');
  assert.equal(second.nodeValue, 'conversation');
  assert.equal(hint.textContent, 'Type');
  alert.appendChild(hint);
  window.__AGY_RUN_FULL_SCAN__();
  assert.equal(hint.textContent, '输入');
});

test('renderer writes equal to a previous translation remain authored values', async t => {
  const { window, document } = await fixture(t, `
    <span id="moving" title="Settings">Settings</span>
    <div data-testid="user-input-step"></div>`);
  const moving = document.querySelector('#moving');
  assert.equal(moving.textContent, '设置');
  assert.equal(moving.title, '设置');
  moving.firstChild.nodeValue = '设置';
  moving.title = '设置';
  document.querySelector('[data-testid="user-input-step"]').appendChild(moving);
  // A scan can run before the queued observer callback handles renderer writes.
  window.__AGY_RUN_FULL_SCAN__();
  await settle(window);
  assert.equal(moving.textContent, '设置');
  assert.equal(moving.title, '设置');
});

test('legacy message controls translate while unmarked nested authored buttons stay intact', async t => {
  const { document } = await fixture(t, `
    <div data-testid="agent-response">
      <div><button id="authored" title="Settings">Settings</button></div>
      <button id="direct">Settings</button>
      <div role="toolbar"><div><button id="toolbar">More actions</button></div></div>
    </div>`);
  assert.equal(document.querySelector('#authored').textContent, 'Settings');
  assert.equal(document.querySelector('#authored').title, 'Settings');
  assert.equal(document.querySelector('#direct').textContent, '设置');
  assert.equal(document.querySelector('#toolbar').textContent, '更多操作');
});

test('voice transcripts preserve authored text and fragments while nearby controls translate', async t => {
  const { window, document } = await fixture(t, `
    <section data-testid="live-docked" aria-label="Voice mode">
      <button data-testid="voice-call-end" aria-label="End Voice mode"></button>
      <div data-testid="live-docked-scroll">
        <div data-testid="live-user-turn"><p id="spoken">Settings</p></div>
        <div data-testid="live-agent-turn"><p id="reply" data-testid="live-lead"><span>New</span><span> </span><span>conversation</span></p></div>
      </div>
    </section>
    <ol data-testid="live-transcript">
      <li><p id="transcript" data-testid="transcript-line-text" title="Settings">Settings</p></li>
    </ol>
    <p id="status">Couldn't connect</p>`);
  assert.equal(document.querySelector('#spoken').textContent, 'Settings');
  assert.deepEqual([...document.querySelector('#reply').children].map(node => node.textContent),
    ['New', ' ', 'conversation']);
  const transcript = document.querySelector('#transcript');
  assert.equal(transcript.textContent, 'Settings');
  assert.equal(transcript.title, 'Settings');
  transcript.firstChild.nodeValue = 'New conversation';
  await settle(window);
  assert.equal(transcript.textContent, 'New conversation');
  assert.equal(document.querySelector('[data-testid="live-docked"]').getAttribute('aria-label'), '语音模式');
  assert.equal(document.querySelector('[data-testid="voice-call-end"]').getAttribute('aria-label'), '结束语音模式');
  assert.equal(document.querySelector('#status').textContent, '无法连接');
});

test('updated browser and voice notices retain hosts and actions while conversation text stays original', async t => {
  const { document } = await fixture(t, `
    <div data-testid="browser-cert-interstitial">
      <h1>Your connection is not private</h1>
      <p id="warning">Attackers might be trying to steal your information from <strong>example.com:8443</strong> (for example, passwords, messages, or credit cards).</p>
      <button id="proceed">Proceed to example.com:8443 (unsafe)</button>
    </div>
    <p id="voice">Your sign-in needs an update. <button data-testid="voice-sign-in">Sign in again</button> to use Voice.</p>
    <div data-testid="webview-device-chooser-bubble">
      <button data-testid="webview-device-chooser-option" data-device-id="unit-1"><span>Settings</span></button>
      <button data-testid="webview-device-chooser-connect">Connect</button>
    </div>
    <div data-testid="user-input-step"><div data-testid="user-message-content">Knowledge Work</div></div>
    <div data-testid="transcript-line-text">No microphone found. Connect one.</div>`);
  assert.equal(document.querySelector('#warning strong').textContent, 'example.com:8443');
  assert.match(document.querySelector('#warning').textContent, /攻击者可能试图窃取您在 .*上的信息/);
  assert.equal(document.querySelector('#proceed').textContent, '继续前往 example.com:8443（不安全）');
  assert.equal(document.querySelector('#voice button').textContent, '重新登录');
  assert.match(document.querySelector('#voice').textContent, /您的登录状态需要更新。请.*以使用语音模式。/);
  assert.equal(document.querySelector('[data-testid="webview-device-chooser-option"]').textContent, 'Settings');
  assert.equal(document.querySelector('[data-testid="webview-device-chooser-connect"]').textContent, '连接');
  assert.equal(document.querySelector('[data-testid="user-message-content"]').textContent, 'Knowledge Work');
  assert.equal(document.querySelector('[data-testid="transcript-line-text"]').textContent, 'No microphone found. Connect one.');
});
