const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const runtime = fs.readFileSync(process.env.AGY_TEST_RUNTIME || path.join(__dirname, '../core/i18n-runtime.js'), 'utf8');
const dictionary = require('../dict/zh-CN.json');
const officialPluginDescriptions = require('../dict/scoped/official-plugin-descriptions.json');
const { installOfficialPluginDescriptionSourceCheck } = require('../core/official-plugin-description-source');

test('2.34 inline requests translate renderer controls while retaining request and answer payloads', async t => {
  const { document, translate } = await fixture(t, `
    <section data-testid="agent-response">
      <div data-testid="inline-card" data-inline-card-key="q1" data-inline-card-kind="question" data-inline-card-state="pending">
        <div class="text-compact font-semibold">Settings</div>
        <div role="radiogroup" aria-label="Settings">
          <button role="radio" data-testid="inline-card-option-1"><span>Open</span>
            <span class="rounded-full text-primary">Recommended</span>
            <span class="text-muted-foreground">Download</span>
          </button>
        </div>
        <div class="text-xs text-muted-foreground px-0.5">Select one or more options</div>
        <div class="shrink-0 gap-0.5"><button aria-label="Next question"></button></div>
        <textarea data-testid="inline-card-write-in" aria-label="Settings" placeholder="Search or enter a URL">Settings</textarea>
        <button data-testid="inline-card-in-chat">In chat</button>
        <button data-testid="inline-card-submit">Submit</button>
        <span data-testid="inline-card-expiry"><span>5m left</span></span>
      </div>
      <div data-testid="inline-card" data-inline-card-key="a1" data-inline-card-state="pending">
        <dl data-testid="inline-card-details"><dt>File</dt><dd>Download</dd></dl>
        <span data-testid="inline-card-risk">Settings</span>
        <button data-testid="inline-card-add-note">Add note</button>
      </div>
      <div data-testid="inline-card" data-inline-card-key="q2" data-inline-card-state="answered">
        <span class="text-muted-foreground">Answered: </span><span class="font-medium break-words">Settings</span>
      </div>
      <div data-testid="inline-card" data-inline-card-key="q3" data-inline-card-state="expired">
        <span>Expired · Action not taken</span><button data-testid="inline-card-retry">Ask to retry</button>
        <div data-testid="inline-card-error">Download</div>
      </div>
      <div data-testid="inline-permission-card" data-permission-action="run_command">
        <span data-testid="inline-permission-badge"><span>Runtime permission</span></span>
        <p>Settings</p>
        <pre>Download</pre>
        <div role="radiogroup" aria-label="Permission approval scope"></div>
        <input data-testid="inline-permission-deny-note" placeholder="Tell the agent what to do instead..." value="Open">
        <button data-testid="inline-permission-add-note">Deny with note</button>
        <button data-testid="inline-permission-allow">Allow</button>
      </div>
      <div class="prose"><div data-testid="inline-card" data-inline-card-key="example" data-inline-card-state="expired">
        <button data-testid="inline-card-retry">Ask to retry</button>
      </div></div>
    </section>`);
  const card = key => document.querySelector('[data-inline-card-key="' + key + '"]');
  const find = (root, testId) => root.querySelector('[data-testid="' + testId + '"]');
  assert.equal(card('q1').firstElementChild.textContent, 'Settings');
  const choices = card('q1').querySelector('[role="radiogroup"]');
  assert.equal(choices.getAttribute('aria-label'), 'Settings');
  assert.deepEqual([...choices.querySelectorAll('span')].map(el => el.textContent), ['Open', '推荐', 'Download']);
  assert.equal(card('q1').querySelector('.text-xs').textContent, '请选择一项或多项');
  assert.equal(find(card('q1'), 'inline-card-write-in').placeholder, 'Search or enter a URL');
  assert.equal(find(card('q1'), 'inline-card-write-in').value, 'Settings');
  assert.equal(find(card('q1'), 'inline-card-in-chat').textContent, '在会话中查看');
  assert.equal(find(card('q1'), 'inline-card-expiry').textContent, '剩余 5 分钟');
  assert.equal(card('a1').querySelector('dt').textContent, 'File');
  assert.equal(card('a1').querySelector('dd').textContent, 'Download');
  assert.equal(find(card('a1'), 'inline-card-add-note').textContent, '添加备注');
  assert.deepEqual([...card('q2').children].map(el => el.textContent), ['已回答： ', 'Settings']);
  assert.equal(card('q3').firstElementChild.textContent, '已过期 · 未执行操作');
  assert.equal(find(card('q3'), 'inline-card-retry').textContent, '请求重试');
  assert.equal(find(card('q3'), 'inline-card-error').textContent, 'Download');
  const permission = find(document, 'inline-permission-card');
  assert.equal(find(permission, 'inline-permission-badge').textContent, '运行时权限');
  assert.equal(permission.querySelector('p').textContent, 'Settings');
  assert.equal(permission.querySelector('pre').textContent, 'Download');
  assert.equal(permission.querySelector('[role="radiogroup"]').getAttribute('aria-label'), '权限批准范围');
  assert.equal(find(permission, 'inline-permission-deny-note').placeholder, '告诉智能体改做什么…');
  assert.equal(find(permission, 'inline-permission-deny-note').value, 'Open');
  assert.equal(find(permission, 'inline-permission-add-note').textContent, '拒绝并附上备注');
  assert.equal(find(permission, 'inline-permission-allow').textContent, '允许');
  assert.equal(find(card('example'), 'inline-card-retry').textContent, 'Ask to retry');
  translate(document.body);
  assert.equal(card('q1').querySelector('button[aria-label]').getAttribute('aria-label'), '下一个问题');
});

test('2.34 MCP App status localizes the prefix while retaining app names and diagnostics', async t => {
  const { document, translate } = await fixture(t, `
    <section data-testid="agent-response">
      <div data-testid="mcp-app-pane-loading" role="status">
        <span><span class="shimmer-text-mask"><span class="shimmer-text-content"></span></span></span>
      </div>
      <div data-testid="mcp-app-pane-error"></div>
      <div data-testid="mcp-app-view-error"></div>
    </section>
    <div class="shimmer-text-content" id="unrelated">Loading</div>`);
  const loading = document.querySelector('[data-testid="mcp-app-pane-loading"] .shimmer-text-content');
  const paneError = document.querySelector('[data-testid="mcp-app-pane-error"]');
  const viewError = document.querySelector('[data-testid="mcp-app-view-error"]');
  loading.append('Loading ', 'Settings');
  paneError.append('Could not load ', 'Open', ': ', 'Download');
  viewError.append('Could not load the app view: ', 'Settings');
  translate(document.body);
  assert.deepEqual([...loading.childNodes].map(node => node.nodeValue), ['正在加载 ', 'Settings']);
  assert.deepEqual([...paneError.childNodes].map(node => node.nodeValue), ['无法加载 ', 'Open', ': ', 'Download']);
  assert.deepEqual([...viewError.childNodes].map(node => node.nodeValue), ['无法加载应用视图： ', 'Settings']);
  assert.equal(document.querySelector('#unrelated').textContent, '加载中');
  translate(document.body);
  assert.equal(paneError.lastChild.nodeValue, 'Download');
});

test('VS Code shortcut descriptions preserve scheme values and the command prefix', async t => {
  const { document } = await fixture(t, `
    <div role="radiogroup" aria-label="Keybinding Scheme">
      <button data-testid="scheme-option-vscode" value="vscode" aria-label="VS Code Default">VS Code Default</button>
      <button data-testid="scheme-option-agy" value="agy">Antigravity (AGY) Style</button>
    </div>
    <span id="shortcut-help">Inspect live bindings or record custom key chords filtered to <code>antigravity.</code> commands.</span>
    <span id="other">List of <code>antigravity.</code> commands.</span>
    <div data-testid="user-input-step">Keybinding Scheme</div>`);
  const group = document.querySelector('[role="radiogroup"]');
  assert.equal(group.getAttribute('aria-label'), '快捷键方案');
  assert.equal(group.firstElementChild.getAttribute('aria-label'), 'VS Code 默认方案');
  assert.deepEqual([...group.children].map(button => [button.value, button.textContent]),
    [['vscode', 'VS Code 默认方案'], ['agy', 'Antigravity（AGY）方案']]);
  assert.equal(document.querySelector('#shortcut-help').textContent,
    '查看现有快捷键或录制自定义组合键，列表仅显示前缀为 antigravity. 的命令。');
  assert.equal(document.querySelector('#shortcut-help code').textContent, 'antigravity.');
  assert.equal(document.querySelector('#other').textContent, 'List of antigravity. commands.');
  assert.equal(document.querySelector('[data-testid="user-input-step"]').textContent, 'Keybinding Scheme');
});

test('Dictation controls translate without changing language codes and user text', async t => {
  const hint = 'Search languages to add (e.g. English, Spanish, 中文, yue)...';
  const { document } = await fixture(t, `
    <input data-testid="dictation-languages-search-input" placeholder="${hint}" value="yue">
    <input id="other-input" placeholder="${hint}">
    <div role="status"><span>Retrying transcription (attempt 2)…</span><button aria-label="Stop transcription"></button></div>
    <div data-testid="user-input-step">Retrying transcription (attempt 2)…</div>`);
  const search = document.querySelector('[data-testid="dictation-languages-search-input"]');
  assert.equal(search.placeholder, '搜索要添加的语言（例如 English、Spanish、中文、yue）…');
  assert.equal(search.value, 'yue');
  assert.equal(document.querySelector('#other-input').placeholder, hint);
  assert.equal(document.querySelector('[role="status"]').textContent, '正在重试转写（第 2 次）…');
  assert.equal(document.querySelector('button').getAttribute('aria-label'), '停止转写');
  assert.equal(document.querySelector('[data-testid="user-input-step"]').textContent, 'Retrying transcription (attempt 2)…');
});

test('2.33 sign-in title translates only on the welcome screen', async t => {
  const { document } = await fixture(t, `<section>
    <div class="entrance-title text-3xl font-normal">Welcome to Antigravity!</div>
    <button>Continue with Google</button>
    <button>Copy sign-in link</button>
  </section>
  <div class="entrance-title text-3xl font-normal">Welcome to Example!</div>
  <div id="project-name">Welcome to Antigravity!</div>
  <div data-testid="user-input-step">Welcome to Antigravity!</div>`);
  assert.equal(document.querySelector('section .entrance-title').textContent, '欢迎使用 Antigravity！');
  assert.deepEqual([...document.querySelectorAll('section button')].map(button => button.textContent),
    ['通过 Google 继续', '复制登录链接']);
  assert.equal(document.querySelector('body > .entrance-title').textContent, 'Welcome to Example!');
  assert.equal(document.querySelector('#project-name').textContent, 'Welcome to Antigravity!');
  assert.equal(document.querySelector('[data-testid="user-input-step"]').textContent, 'Welcome to Antigravity!');
});

test('2.33 SSH and pull request controls preserve remote metadata with matching UI strings', async t => {
  const { document, translate } = await fixture(t, `
    <div data-testid="ssh-connect-dialog">
      <button data-ssh-host="Open"><span class="truncate" title="Open">Open</span><span>Connected</span></button>
      <span data-testid="ssh-config-file-name" tabindex="0">Settings</span>
      <button data-testid="ssh-connect-hidden-hosts-toggle">3 hidden hosts</button>
      <div data-testid="ssh-connect-host-group-label">SSH Config (Settings)</div>
      <div data-testid="ssh-connect-error"><span class="whitespace-pre-line">Settings</span><span class="text-foreground" id="ssh-failure"></span></div>
    </div>
    <div id="pr">
      <div class="text-compact gap-1.5"><a href="https://github.com/example/repo/pull/7"><span>Settings</span></a>
        <span class="text-compact"><span class="z-10">Open</span></span></div>
      <div class="text-compact font-medium text-foreground">Connect GitHub</div>
      <div class="line-clamp-4 whitespace-pre-wrap">Settings</div>
      <div class="grid-cols-[auto_1fr]"><span>Branch</span><span class="break-words min-w-0">Open</span></div>
      <button data-testid="github-hover-connect-plugin">Connect GitHub</button>
    </div>
    <span id="open">Open</span>
    <span data-testid="find-bar-match-count">2 of 4</span>
    <span id="turn-count">2 of 4</span>`);
  const read = selector => document.querySelector(selector).textContent;
  assert.equal(read('[data-ssh-host] .truncate'), 'Open');
  assert.equal(document.querySelector('[data-ssh-host] .truncate').title, 'Open');
  assert.equal(read('[data-ssh-host] span:last-child'), '已连接');
  assert.equal(read('[data-testid="ssh-config-file-name"]'), 'Settings');
  assert.equal(read('[data-testid="ssh-connect-hidden-hosts-toggle"]'), '3 台隐藏主机');
  assert.equal(read('[data-testid="ssh-connect-host-group-label"]'), 'SSH 配置（Settings）');
  assert.equal(read('.whitespace-pre-line'), 'Settings');
  const failure = document.querySelector('#ssh-failure');
  failure.append(document.createTextNode("Couldn't connect to "), document.createTextNode('Open'));
  translate(failure);
  assert.equal(failure.textContent, '无法连接到 Open');
  assert.equal(read('#pr a'), 'Settings');
  assert.equal(read('#pr .z-10'), '开放');
  assert.equal(read('#pr .font-medium'), 'Connect GitHub');
  assert.equal(read('#pr .line-clamp-4'), 'Settings');
  assert.equal(read('#pr .break-words'), 'Open');
  assert.equal(read('#pr button'), '连接 GitHub');
  assert.equal(read('#open'), '打开');
  assert.equal(read('[data-testid="find-bar-match-count"]'), '第 2 项，共 4 项');
  assert.equal(read('#turn-count'), '第 2 轮（共 4 轮）');
});

test('2.33 SSH project picker localizes only the submenu trigger and search placeholder', async t => {
  const { document } = await fixture(t, `<div role="menu">
    <div role="menuitem" data-testid="project-selector-ssh-host-trigger">
      <span class="flex"><span class="truncate">SSH Host</span></span>
    </div>
    <div role="menuitem"><span id="project-name">SSH Host</span></div>
  </div>
  <div role="menu">
    <div data-testid="project-selector-ssh-host-search">
      <input placeholder="Search Hosts…" value="SSH Host">
    </div>
    <div data-testid="ssh-host-project-item" data-ssh-host="SSH Host" data-ssh-config-file="Search Hosts…">
      <span class="truncate" title="SSH Host">SSH Host</span>
      <span class="truncate" title="Search Hosts…">Search Hosts…</span>
    </div>
    <input id="other-search" placeholder="Search Hosts…">
  </div>`);
  const trigger = document.querySelector('[data-testid="project-selector-ssh-host-trigger"] .truncate');
  const search = document.querySelector('[data-testid="project-selector-ssh-host-search"] input');
  assert.equal(trigger.textContent, 'SSH 主机');
  assert.equal(search.placeholder, '搜索主机…');
  assert.equal(search.value, 'SSH Host');
  assert.equal(document.querySelector('#project-name').textContent, 'SSH Host');
  assert.equal(document.querySelector('#other-search').placeholder, 'Search Hosts…');
  const host = document.querySelector('[data-testid="ssh-host-project-item"]');
  assert.equal(host.getAttribute('data-ssh-host'), 'SSH Host');
  assert.equal(host.getAttribute('data-ssh-config-file'), 'Search Hosts…');
  assert.deepEqual(Array.from(host.children, el => [el.textContent, el.title]), [
    ['SSH Host', 'SSH Host'], ['Search Hosts…', 'Search Hosts…']
  ]);
});

test('2.33 side question insert action translates without changing a matching answer', async t => {
  const { document } = await fixture(t, `<div data-testid="side-question-answer">
    <div class="prose">Insert into main conversation</div>
    <button data-testid="side-question-insert-to-main" aria-label="Insert into main conversation">Insert into main conversation</button>
  </div>`);
  assert.equal(document.querySelector('.prose').textContent, 'Insert into main conversation');
  const action = document.querySelector('button');
  assert.equal(action.textContent, '插入主会话');
  assert.equal(action.getAttribute('aria-label'), '插入主会话');
});

function settle(window) {
  return new Promise(resolve => window.setTimeout(resolve, 40));
}

async function fixture(t, html, options = {}) {
  const dom = new JSDOM('<!doctype html><body>' + html + '</body>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: options.url || (options.pluginDescriptions ? 'https://127.0.0.1:1500/' : undefined)
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.__AGY_I18N_DATA__ = options.pluginDescriptions ? { ...dictionary, officialPluginDescriptions } : dictionary;
  options.beforeStart?.(window.document);
  if (options.pluginDescriptions) window.eval(`(${installOfficialPluginDescriptionSourceCheck})(${JSON.stringify(officialPluginDescriptions)})`);
  window.eval(runtime);
  await settle(window);
  return { window, document: window.document, translate: window.__AGY_TRANSLATE_EL__ };
}

test('complete shortcut rows translate descriptions and toggle labels while authored copies stay intact', async t => {
  const { document } = await fixture(t, `
    <section><h3>Submit Prompt (Alternate to Enter)</h3>
      <p>Enter always submits. This adds a second shortcut.</p>
      <button title="Pin / Unpin Conversation">Pin / Unpin Conversation</button></section>
    <div data-testid="user-input-step">Enter always submits. This adds a second shortcut.</div>
    <div data-testid="workspace-customizations-view"><span class="font-medium truncate" data-tooltip-id="skill">Pin / Unpin Conversation</span></div>`);
  assert.equal(document.querySelector('section p').textContent, 'Enter 始终用于提交。此处可添加第二个提交快捷键。');
  assert.equal(document.querySelector('section button').textContent, '置顶 / 取消置顶会话');
  assert.equal(document.querySelector('section button').title, '置顶 / 取消置顶会话');
  assert.equal(document.querySelector('[data-testid="user-input-step"]').textContent, 'Enter always submits. This adds a second shortcut.');
  assert.equal(document.querySelector('[data-tooltip-id="skill"]').textContent, 'Pin / Unpin Conversation');
});

test('terminal select-all shortcut translates its label and accessibility text while preserving the chord', async t => {
  const { document } = await fixture(t, `
    <div data-testid="shortcut-row-terminalSelectAll">
      <span>Terminal: Select All</span>
      <button aria-label="Shortcut Ctrl+Shift+A for Terminal: Select All">Ctrl+Shift+A</button>
      <button aria-label="Remove shortcut Ctrl+Shift+A for Terminal: Select All"></button>
      <button aria-label="Add shortcut for Terminal: Select All"></button>
      <button aria-label="Reset Terminal: Select All to default"></button>
    </div>
    <div title="Managed by application menu"></div>
    <button id="unrelated-reset" aria-label="Reset Terminal: Select All to default"></button>
    <div data-testid="user-input-step">Terminal: Select All</div>`);
  const row = document.querySelector('[data-testid="shortcut-row-terminalSelectAll"]');
  assert.equal(row.querySelector('span').textContent, '终端：全选');
  const buttons = [...row.querySelectorAll('button')];
  assert.equal(buttons[0].textContent, 'Ctrl+Shift+A');
  assert.deepEqual(buttons.map(button => button.getAttribute('aria-label')), [
    '终端：全选的快捷键：Ctrl+Shift+A', '移除终端：全选的快捷键：Ctrl+Shift+A',
    '为终端：全选添加快捷键', '将终端：全选恢复为默认设置'
  ]);
  assert.equal(document.querySelector('[title]').title, '由应用菜单管理');
  assert.equal(document.querySelector('#unrelated-reset').getAttribute('aria-label'), 'Reset Terminal: Select All to default');
  assert.equal(document.querySelector('[data-testid="user-input-step"]').textContent, 'Terminal: Select All');
});

test('project deletion row localizes the dynamic label and counts and retains authored project and automation names', async t => {
  const { document } = await fixture(t, `
    <h3>Danger Zone</h3>
    <div>
      <div class="flex-1 flex flex-col gap-0.5">
        <div class="flex items-center gap-1.5"><span id="project-label">Delete project</span></div>
        <span class="text-sm text-muted-foreground whitespace-pre-wrap"><span>Permanently delete <strong>Settings</strong> including <strong>2 active conversations and 1 archived conversation</strong>.</span></span>
      </div>
      <div class="shrink-0"><button data-testid="delete-project-button">Delete Project</button></div>
    </div>
    <div>
      <div class="flex-1 flex flex-col gap-0.5">
        <div class="flex items-center gap-1.5"><span id="workspace-label">Delete workspace</span></div>
        <span class="text-sm text-muted-foreground whitespace-pre-wrap"><span>This workspace is managed by the <strong>Terminal: Select All</strong> automation and can only be deleted by deleting that automation.</span></span>
      </div>
      <div class="shrink-0"><button data-testid="delete-project-button" disabled>Delete Workspace</button></div>
    </div>
    <span id="outside-row">Delete project</span>`);
  assert.equal(document.querySelector('h3').textContent, '危险区域');
  assert.equal(document.querySelector('#project-label').textContent, '删除项目');
  assert.equal(document.querySelector('#workspace-label').textContent, '删除工作区');
  assert.equal(document.querySelector('#outside-row').textContent, 'Delete project');
  assert.deepEqual([...document.querySelectorAll('strong')].map(strong => strong.textContent), [
    'Settings', '2 个活跃会话和 1 个已归档会话', 'Terminal: Select All'
  ]);
});

test('side-question chrome translates without rewriting the question, answer or quoted command', async t => {
  const { document } = await fixture(t, `
    <div data-testid="side-question-panel">
      <span data-testid="side-question-question"><span class="shrink-0">Side Question:</span><span class="truncate">Settings</span></span>
      <div data-testid="side-question-answer"><span class="opacity-70 animate-pulse">Thinking...</span><div>Settings<button>Log in</button></div></div>
      <button>Side Questions</button>
    </div>
    <div class="selection-quote-popup"><button>Ask /btw</button></div>
    <div data-testid="user-input-step">Ask /btw</div>`);
  assert.equal(document.querySelector('.shrink-0').textContent, '旁路提问：');
  assert.equal(document.querySelector('.truncate').textContent, 'Settings');
  assert.equal(document.querySelector('[data-testid="side-question-answer"] > div').textContent, 'SettingsLog in');
  assert.equal(document.querySelector('.animate-pulse').textContent, '深度思考中...');
  assert.equal(document.querySelector('[data-testid="side-question-panel"] > button').textContent, '旁路提问');
  assert.equal(document.querySelector('.selection-quote-popup button').textContent, '提问 /btw');
  assert.equal(document.querySelector('[data-testid="user-input-step"]').textContent, 'Ask /btw');
});

test('relative clocks translate only UI timestamps, including updates and reparenting', async t => {
  const { window, document } = await fixture(t, `
    <div data-testid="agent-message"><div data-testid="cascade-system-message-toolbar"><span id="clock" data-screenshot-volatile="true" data-tooltip-id="time" class="text-sm whitespace-nowrap">1mo ago</span></div>
      <div class="prose"><span data-screenshot-volatile="true" data-tooltip-id="fake" class="whitespace-nowrap">1mo ago</span></div></div>
    <div data-testid="conversation-row-sidebar"><span class="tabular-nums" data-screenshot-volatile="true">2w</span></div><p>1mo ago</p>`);
  const clock = document.querySelector('#clock');
  assert.equal(clock.textContent, '1个月前');
  assert.equal(document.querySelector('.tabular-nums').textContent, '2周');
  assert.equal(document.querySelector('.prose span').textContent, '1mo ago');
  assert.equal(document.querySelector('p').textContent, '1mo ago');
  clock.textContent = 'about 2h ago';
  await settle(window);
  assert.equal(clock.textContent, '约 2小时前');
  document.querySelector('.prose').appendChild(clock);
  await settle(window);
  assert.equal(clock.textContent, 'about 2h ago');
});

test('customization route translates only its fixed home breadcrumb, never resource or project names', async t => {
  const html = `<div id="crumbs"><div><span data-testid="breadcrumb-segment">Customizations</span></div><div><span data-testid="breadcrumb-segment">Customizations</span></div></div>`;
  const ui = await fixture(t, html, { url: 'https://127.0.0.1/customizations/gdocs' });
  const crumbs = ui.document.querySelectorAll('[data-testid="breadcrumb-segment"]');
  assert.equal(crumbs[0].textContent, '自定义扩展');
  assert.equal(crumbs[1].textContent, 'Customizations');
  ui.window.history.pushState({}, '', '/conversations/example');
  ui.document.body.appendChild(ui.document.createElement('hr'));
  await settle(ui.window);
  assert.equal(crumbs[0].textContent, 'Customizations');
  const project = await fixture(t, html, { url: 'https://127.0.0.1/conversations/example' });
  for (const crumb of project.document.querySelectorAll('[data-testid="breadcrumb-segment"]')) assert.equal(crumb.textContent, 'Customizations');
});

for (const ownership of ['project', 'unassigned']) {
  test(`all reviewed UI phrases retain source as customization content in ${ownership} settings`, async t => {
    const { document, translate } = await fixture(t, '<div data-testid="workspace-customizations-view"></div><button id="action">Commands</button>');
    const sources = require('./fixtures/app-2.32.1-ui.json').ui;
    const root = document.querySelector('[data-testid="workspace-customizations-view"]');
    root.setAttribute('data-owner-fixture', ownership);
    const fragment = document.createDocumentFragment();
    const fields = [];
    for (const text of sources) {
      const field = document.createElement('span');
      field.className = 'font-medium truncate';
      field.setAttribute('data-tooltip-id', 'resource-' + fields.length);
      field.title = text;
      field.textContent = text;
      fragment.append(field);
      fields.push(field);
    }
    root.append(fragment);
    translate(root);
    fields.forEach((field, i) => {
      assert.equal(field.textContent, sources[i]);
      assert.equal(field.title, sources[i]);
    });
    assert.equal(document.querySelector('#action').textContent, '命令');
  });
}

test('App 2.32 MCP status UI translates while server names, tools and diagnostics retain source', async t => {
  const { document } = await fixture(t, `
    <span data-testid="plugin-status-indicator" aria-label="2 MCP servers failed to start"></span>
    <div data-testid="mcp-server-row">
      <span class="font-medium shrink-0 text-foreground" title="Settings">Settings</span>
      <div class="text-sm text-red-500 break-words min-w-0 flex-1">Error: <span>Settings</span></div>
      <div class="text-sm text-red-500 break-words mt-1">Settings</div>
      <button aria-pressed="true" aria-label="Settings">Settings</button>
      <span class="px-2 py-0.5 rounded-full text-[11px] leading-4 border shrink-0">Settings</span>
      <button id="fix">Fix with Agent</button><button id="restart">Restart</button>
    </div>
    <button id="outside">Settings</button>`);
  assert.equal(document.querySelector('[data-testid="plugin-status-indicator"]').getAttribute('aria-label'), '2 个 MCP 服务器启动失败');
  const row = document.querySelector('[data-testid="mcp-server-row"]');
  assert.equal(row.querySelector('span[title]').textContent, 'Settings');
  assert.equal(row.querySelector('span[title]').title, 'Settings');
  assert.equal(row.querySelector('div').textContent, 'Error: Settings');
  assert.equal(row.querySelector('div.mt-1').textContent, 'Settings');
  assert.equal(row.querySelector('[aria-pressed]').textContent, 'Settings');
  assert.equal(row.querySelector('[aria-pressed]').getAttribute('aria-label'), 'Settings');
  assert.equal(row.querySelector('span.rounded-full').textContent, 'Settings');
  assert.equal(document.querySelector('#fix').textContent, '使用智能体修复');
  assert.equal(document.querySelector('#restart').textContent, '重启');
  assert.equal(document.querySelector('#outside').textContent, '设置');
});

test('App 2.32 sign-in controls translate without rewriting authorization input or model names', async t => {
  const { document } = await fixture(t, `
    <div data-testid="onboarding-auth-code-panel">
      <label>Authorization code</label><input type="password" placeholder="Paste authorization code" value="Settings">
      <button>Submit code</button>
    </div>
    <button title="Jump to Previous Prompt">Submit Prompt (Alternate to Enter)</button>
    <div data-testid="model-selector-item">Gemini 4 Hydrogen</div>
    <div data-testid="user-input-step">Copy sign-in link</div>`);
  assert.equal(document.querySelector('label').textContent, '授权码');
  assert.equal(document.querySelector('input').placeholder, '粘贴授权码');
  assert.equal(document.querySelector('input').value, 'Settings');
  assert.equal(document.querySelector('button').textContent, '提交授权码');
  assert.equal(document.querySelector('button[title]').title, '跳转到上一条提示词');
  assert.equal(document.querySelector('button[title]').textContent, '提交提示词（替代 Enter）');
  assert.equal(document.querySelector('[data-testid="model-selector-item"]').textContent, 'Gemini 4 Hydrogen');
  assert.equal(document.querySelector('[data-testid="user-input-step"]').textContent, 'Copy sign-in link');
});

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

test('marketplace and browser notices translate around links without changing their targets', async t => {
  const { document } = await fixture(t, `
    <p id="browser-rule">Configure allowed and denied URLs for the browser subagent (invoked with /browser). Requires <a href="https://www.google.com/chrome/">Google Chrome</a>.</p>
    <section data-testid="customizations-marketplace">
      <h2>Business</h2>
      <button aria-label="See more in Business"><svg></svg>See 19 more</button>
      <h3>Gmail</h3><p>Search, read, draft, and send emails in Gmail.</p>
      <footer aria-label="Marketplace notice"><p>Google does not control the availability or functionality of third party developer tools. Your data from third party developer tools connected to your Antigravity instance may be shared with Google. Google will protect any such data in accordance with the Google Privacy Policy, found here: <a href="https://policies.google.com/privacy">https://policies.google.com/privacy</a></p></footer>
    </section>`);
  const rule = document.querySelector('#browser-rule');
  assert.match(rule.textContent, /通过 \/browser 调用.*需要安装 Google Chrome/);
  assert.equal(rule.querySelector('a').getAttribute('href'), 'https://www.google.com/chrome/');
  const market = document.querySelector('[data-testid="customizations-marketplace"]');
  assert.equal(market.querySelector('h2').textContent, '商务');
  assert.equal(market.querySelector('button').textContent, '再查看 19 项');
  assert.equal(market.querySelector('button').getAttribute('aria-label'), '在商务中查看更多');
  assert.equal(market.querySelector('h3').textContent, 'Gmail');
  assert.equal(market.querySelector(':scope > p').textContent, '搜索、阅读、起草和发送 Gmail 邮件。');
  const notice = market.querySelector('footer');
  assert.match(notice.textContent, /可能会与 Google 共享/);
  assert.equal(notice.querySelector('a').getAttribute('href'), 'https://policies.google.com/privacy');
});

for (const scope of ['project', 'unassigned']) {
  test(`customization metadata retains author text in ${scope} settings`, async t => {
    const { document } = await fixture(t, `
      <section id="${scope}"><div data-testid="workspace-customizations-view">
        <h3>Skills</h3><h3>Rules</h3><h3>Plugins</h3><h3>Custom Agents</h3>
        ${['skill', 'rule', 'plugin', 'agent'].map(kind => `
          <div class="group flex items-start justify-between gap-3 px-3 py-2 border-border" data-kind="${kind}">
            <div class="flex flex-col gap-0.5 min-w-0 flex-1 space-y-0">
              <div class="flex items-center gap-2">
                <span class="font-medium truncate" data-tooltip-id="${kind}-name">automation</span>
                <span class="text-blue-400">Global</span>
                <span class="text-green-400">Settings</span>
                <span class="text-purple-400">Plugin: <span>Settings</span></span>
              </div>
              <div class="text-sm text-muted-foreground line-clamp-2 mt-1" title="Code Preview">Settings<span>New conversation</span></div>
            </div>
            <button aria-label="Copy path">Copy Path</button>
          </div>`).join('')}
      </div></section>`);
    for (const row of document.querySelectorAll('[data-kind]')) {
      assert.equal(row.querySelector('[data-tooltip-id]').textContent, 'automation');
      assert.equal(row.querySelector('.line-clamp-2').textContent, 'SettingsNew conversation');
      assert.equal(row.querySelector('.line-clamp-2').title, 'Code Preview');
      assert.equal(row.querySelector('.text-green-400').textContent, 'Settings');
      assert.equal(row.querySelector('.text-purple-400').textContent, 'Plugin: Settings');
      assert.equal(row.querySelector('.text-blue-400').textContent, '全局');
      assert.equal(row.querySelector('button').textContent, '复制路径');
      assert.equal(row.querySelector('button').getAttribute('aria-label'), '复制路径');
    }
    assert.deepEqual([...document.querySelectorAll('h3')].map(el => el.textContent), ['技能库', '规则库', '插件', '自定义智能体']);
  });
}

function pluginDescriptionFiber(el, name, provenance, rootState = {}) {
  const source = el.textContent;
  const plugin = {
    $typeName: 'exa.language_server_pb.Plugin',
    name,
    description: source,
    path: '/fixture/plugins/' + name,
    isGlobal: true,
    isBuiltin: false,
    ...provenance
  };
  const root = { tag: 3, stateNode: rootState };
  if (!rootState.current) rootState.current = root;
  let parent = root;
  for (let i = 0; i < 150; i++) parent = { return: parent };
  const owner = { key: name, memoizedProps: { plugin }, return: parent };
  const row = {
    memoizedProps: { description: source, path: plugin.path, deleteTitle: 'Delete plugin' },
    return: owner
  };
  const fiber = { stateNode: el, memoizedProps: { children: source }, return: { return: { return: row } } };
  return { fiber, owner, root, rootState };
}

const docsPluginOrigin = {
  installedFrom: {
    marketplace: 'antigravity-plugins-official',
    id: 'antigravity-plugins-official/plugin/gdocs'
  }
};

test('project and unassigned settings localize verified official descriptions and preserve identical custom copy', async t => {
  const text = 'Read, draft, and edit docs.';
  const swarmText = 'Unlock the power of agent swarms.';
  const row = (id, name, description) => `
    <article>
      <span class="font-medium truncate" data-tooltip-id="${id}">${name}</span>
      <div class="text-sm text-muted-foreground line-clamp-2 mt-1" data-case="${id}" title="Settings">${description}</div>
      <button>Copy Path</button>
    </article>`;
  const view = tag => `
    <section id="${tag}" data-testid="project-customizations-content">
      <div data-testid="workspace-customizations-view">
        ${row('docs', 'Google Docs', text)}
        ${row('local-docs', 'Google Docs', text)}
        ${row('other-origin', 'Google Docs', text)}
        ${row('swarm', 'Swarm', swarmText)}
        ${row('local-swarm', 'Swarm', swarmText)}
        ${row('edited', 'Google Docs', 'Settings')}
        ${row('guidance', 'Modern Web Guidance', 'Keep your coding agent up to date with the latest web best practices.')}
      </div>
    </section>`;
  const { document } = await fixture(t, view('project') + view('unassigned') + `
    <div data-testid="user-input-step">${view('quoted')}</div>`, {
    pluginDescriptions: true,
    beforeStart(doc) {
      for (const el of doc.querySelectorAll('[data-case]')) {
        const kind = el.getAttribute('data-case');
        const swarm = kind.endsWith('swarm');
        const name = swarm ? 'swarm' : kind === 'guidance' ? 'modern-web-guidance-plugin' : 'gdocs';
        let provenance = {};
        if (kind === 'swarm') provenance = { isBuiltin: true };
        if (kind === 'docs' || kind === 'edited') provenance = docsPluginOrigin;
        if (kind === 'other-origin') provenance = { installedFrom: { ...docsPluginOrigin.installedFrom, id: 'antigravity-plugins-official/plugin/other' } };
        if (kind === 'guidance') provenance = { installedFrom: { ...docsPluginOrigin.installedFrom, id: 'antigravity-plugins-official/plugin/modern-web-guidance-plugin' } };
        el.__reactFiber$fixture = pluginDescriptionFiber(el, name, provenance).fiber;
      }
    }
  });
  for (const id of ['project', 'unassigned']) {
    const view = document.querySelector('#' + id);
    const get = kind => view.querySelector('[data-case="' + kind + '"]');
    assert.equal(get('docs').textContent, '读取、起草和编辑文档。');
    assert.equal(get('docs').title, 'Settings');
    assert.equal(get('local-docs').textContent, text);
    assert.equal(get('other-origin').textContent, text);
    assert.equal(get('swarm').textContent, '发挥多智能体协作的优势。');
    assert.equal(get('local-swarm').textContent, swarmText);
    assert.equal(get('edited').textContent, 'Settings');
    assert.equal(get('guidance').textContent, '让您的编码智能体紧跟最新的 Web 最佳实践。');
    assert.equal(view.querySelector('[data-tooltip-id="guidance"]').textContent, 'Modern Web Guidance');
    assert.equal(view.querySelector('[data-tooltip-id="docs"]').textContent, 'Google Docs');
    assert.equal(view.querySelector('button').textContent, '复制路径');
  }
  assert.equal(document.querySelector('#quoted [data-case="docs"]').textContent, text);
});

test('official description translation follows the committed renderer and restores when moved into user content', async t => {
  const source = 'Read, draft, and edit docs.';
  let official, local;
  const { document, translate } = await fixture(t, `
    <section data-testid="project-customizations-content"><div data-testid="workspace-customizations-view">
      <div id="description" class="text-sm text-muted-foreground line-clamp-2 mt-1">${source}</div>
    </div></section>
    <div data-testid="user-input-step"></div>`, {
    pluginDescriptions: true,
    beforeStart(doc) {
      const el = doc.querySelector('#description');
      official = pluginDescriptionFiber(el, 'gdocs', docsPluginOrigin);
      local = pluginDescriptionFiber(el, 'gdocs', {}, official.rootState);
      official.fiber.alternate = local.fiber;
      local.fiber.alternate = official.fiber;
      el.__reactFiber$fixture = official.fiber;
    }
  });
  const el = document.querySelector('#description');
  assert.equal(el.textContent, '读取、起草和编辑文档。');
  official.rootState.current = local.root;
  translate(el.firstChild);
  assert.equal(el.textContent, source);
  official.rootState.current = official.root;
  translate(el);
  assert.equal(el.textContent, '读取、起草和编辑文档。');
  local.owner.return = official.root;
  translate(el);
  assert.equal(el.textContent, source);
  local.owner.return = local.root;
  translate(el);
  assert.equal(el.textContent, '读取、起草和编辑文档。');
  document.querySelector('[data-testid="user-input-step"]').append(el);
  translate(el);
  assert.equal(el.textContent, source);
});

test('marketplace, installed cards, and detail headers share the official copy and preserve local lookalikes', async t => {
  const english = 'Read, draft, and edit docs.';
  const chinese = '读取、起草和编辑文档。';
  const summary = 'Unlock the power of agent swarms.';
  const card = (id, name, text) => `
    <article data-testid="customization-card" data-card-name="${name}">
      <div class="font-medium text-foreground truncate"><a>${name}</a></div>
      <div class="text-sm text-muted-foreground truncate" id="${id}">${text}</div>
    </article>`;
  const detail = (id, name) => `
    <section data-testid="plugin-detail">
      <div>
        <h1 class="text-xl font-medium truncate">${name}</h1>
        <p id="${id}" class="text-muted-foreground leading-relaxed">${english}</p>
      </div>
      <section class="prose"><p>${english}</p></section>
    </section>`;
  const { document, translate } = await fixture(t, `
    <div data-testid="customizations-marketplace">
      ${card('market', 'Google Docs', english)}
      ${card('other-market', 'Google Docs', english)}
      ${card('skill', 'Google Docs', english)}
    </div>
    <div data-testid="customizations-installed"><div data-testid="customizations-installed-plugins">
      ${card('installed', 'Google Docs', english)}
      ${card('copy', 'Google Docs', english)}
      ${card('built-in', 'Swarm', 'Unlock the power of agent <span class="font-semibold text-foreground">swarm</span>s.')}
    </div></div>
    ${detail('detail', 'Google Docs')}
    ${detail('preview', 'Google Docs')}
    ${detail('local-detail', 'Google Docs')}
    ${detail('edited-detail', 'Google Docs')}`, {
    pluginDescriptions: true,
    beforeStart(doc) {
      const makeRoot = () => {
        const root = { tag: 3 };
        root.stateNode = { current: root };
        return root;
      };
      const canonical = docsPluginOrigin.installedFrom;
      const official = {
        $typeName: 'exa.language_server_pb.Plugin', name: 'gdocs', displayName: 'Google Docs',
        path: '/official/gdocs', description: english, isGlobal: true, isBuiltin: false,
        ...docsPluginOrigin
      };
      const local = { ...official, path: '/local/gdocs', installedFrom: undefined };
      const swarm = {
        $typeName: 'exa.language_server_pb.Plugin', name: 'swarm', displayName: 'Swarm',
        path: '/builtin/plugins/swarm', description: summary, isGlobal: true, isBuiltin: true
      };
      const catalogEntry = { ...canonical, description: english, kind: {case: 'plugin'} };
      const marketRoute = '/customizations/marketplaces/$marketplace/plugins/$pluginId';
      for (const [id, plugin, to, search] of [
        ['market', official, marketRoute, canonical],
        ['other-market', official, marketRoute, {...canonical, marketplace: 'local'}],
        ['skill', official, '/customizations/marketplaces/$marketplace/skills/$skillId', canonical],
        ['installed', official], ['copy', local], ['built-in', swarm]
      ]) {
        const el = doc.getElementById(id);
        const root = makeRoot();
        const owner = {
          key: plugin.path,
          memoizedProps: { name: plugin.displayName, description: plugin.description, to, search },
          return: { memoizedProps: {plugins: [official, local, swarm]}, return: root }
        };
        el.__reactFiber$fixture = {
          stateNode: el, memoizedProps: {children: {props: {text: plugin.description}}},
          return: {stateNode: el.parentElement, return: owner}
        };
      }
      for (const [id, installedPlugin] of [
        ['detail', official], ['preview', undefined], ['local-detail', local],
        ['edited-detail', {...official, description: 'Settings'}]
      ]) {
        const el = doc.getElementById(id);
        const header = {
          memoizedProps: {description: english}, return: makeRoot(),
          sibling: {memoizedProps: { installedPlugin, catalogEntry, pluginPreview: undefined }}
        };
        el.__reactFiber$fixture = {stateNode: el, memoizedProps: {children: english}, return: {return: header}};
      }
    }
  });
  const text = id => document.getElementById(id).textContent;
  for (const id of ['market', 'installed', 'detail', 'preview']) assert.equal(text(id), chinese);
  for (const id of ['other-market', 'skill', 'copy', 'local-detail', 'edited-detail']) assert.equal(text(id), english);
  const builtIn = document.getElementById('built-in');
  assert.equal(builtIn.textContent, '发挥多智能体协作的优势。');
  const highlight = builtIn.querySelector('span.font-semibold');
  assert.ok(highlight);
  const list = builtIn.__reactFiber$fixture.return.return.return;
  list.memoizedProps.plugins[2].isBuiltin = false;
  translate(highlight.firstChild);
  assert.equal(builtIn.textContent, summary);
  assert.equal(highlight.textContent, 'swarm');
  for (const el of document.querySelectorAll('h1, .font-medium.text-foreground.truncate')) {
    assert.ok(['Google Docs', 'Swarm'].includes(el.textContent));
  }
  for (const el of document.querySelectorAll('.prose p')) assert.equal(el.textContent, english);
});

test('featured descriptions and their tooltips use the same verified partner text', async t => {
  const source = "Up-to-date documentation lookup. Pull version-specific documentation and code examples directly from source repositories into your coding agent's context.";
  const expected = officialPluginDescriptions[source].translation;
  const { document, translate } = await fixture(t, `
    <section data-testid="featured-carousel">
      <button data-testid="featured-carousel-member-tile" data-member-name="Settings" aria-label="Settings, Installed" title="Settings"></button>
      <div role="tabpanel"><div>
        <h3 class="font-semibold truncate">Settings</h3>
        <p id="verified" class="text-muted-foreground line-clamp-3" title="${source}">${source}</p>
        <a aria-label="Details for Settings">Details</a></div>
        <div><p id="unverified" class="text-muted-foreground line-clamp-3" title="${source}">${source}</p></div>
      </div>
    </section>`, {
    pluginDescriptions: true,
    beforeStart(doc) {
      for (const [id, marketplace] of [['verified', 'antigravity-plugins-partners'], ['unverified', 'antigravity-plugins-official']]) {
        const el = doc.getElementById(id);
        const root = { tag: 3 };
        root.stateNode = { current: root };
        el.__reactFiber$fixture = {
          stateNode: el, memoizedProps: { children: source, title: source },
          return: { return: {
            return: root, memoizedProps: { member: { description: source, item: {
              kind: { case: 'plugin' }, marketplace, id: marketplace + '/plugin/context7', description: source
            } } }
          } }
        };
      }
    }
  });
  const verified = document.getElementById('verified');
  const unverified = document.getElementById('unverified');
  assert.equal(verified.textContent, expected);
  assert.equal(verified.title, expected);
  assert.equal(unverified.textContent, source);
  assert.equal(unverified.title, source);
  assert.equal(document.querySelector('h3').textContent, 'Settings');
  assert.equal(document.querySelector('button').title, 'Settings');
  assert.equal(document.querySelector('button').getAttribute('aria-label'), 'Settings，已安装');
  assert.equal(document.querySelector('a').getAttribute('aria-label'), '查看详情：Settings');

  const fiber = verified.__reactFiber$fixture;
  fiber.return.return.memoizedProps.member.item.id = 'antigravity-plugins-partners/plugin/another-plugin';
  translate(verified);
  assert.equal(verified.textContent, source);
  assert.equal(verified.title, source);
});

test('host settings, marketplace sections, disclosure and review controls translate in their own surfaces', async t => {
  const notice = 'Google does not control the availability or functionality of third party developer tools. Your data from third party developer tools connected to your Antigravity instance may be shared with Google. Google will protect any such data in accordance with the Google Privacy Policy, found here:';
  const policy = 'https://policies.google.com/privacy';
  const { document } = await fixture(t, `
    <div id="setting">Queued messages</div>
    <div data-testid="customizations-marketplace"><section aria-label="Science"><div><h2>Science</h2>
      <p>Agent skills, databases, and interactive viewers for scientific research.</p></div>
      <div><button aria-label="See more in Science">See more</button></div></section></div>
    <button data-testid="marketplace-category-option-science"><span>Science</span></button>
    <span data-testid="marketplace-category-chip">Science<button aria-label="Clear category"></button></span>
    <div data-testid="customizations-installed-plugins"><button aria-label="See 3 more plugins">See 3 more</button></div>
    <div id="elsewhere">Science</div>
    <main data-testid="plugin-detail">
      <p class="text-muted-foreground leading-relaxed">${notice}</p>
      <p data-testid="third-party-tools-disclaimer" class="text-muted-foreground leading-relaxed">${notice} <span><a href="${policy}">${policy}</a></span></p>
    </main>
    <div data-testid="agent-message">
      <div data-testid="changed-files-card"><div data-testid="changed-files-card-header">
        <div><span class="truncate">2 files changed</span></div>
        <button data-testid="changed-files-card-review"><span>Review</span></button>
      </div></div>
      <div class="prose"><button>Review</button><span>Queued messages</span></div>
    </div>`);
  const section = document.querySelector('section');
  assert.equal(document.getElementById('setting').textContent, '排队消息');
  assert.equal(section.getAttribute('aria-label'), '科研');
  assert.equal(section.querySelector('h2').textContent, '科研');
  assert.equal(section.querySelector('p').textContent, '面向科研的智能体技能、数据库和交互式查看器。');
  assert.equal(section.querySelector('button').getAttribute('aria-label'), '在科研中查看更多');
  assert.equal(document.querySelector('[data-testid="marketplace-category-option-science"]').textContent, '科研');
  assert.equal(document.querySelector('[data-testid="marketplace-category-chip"]').textContent, '科研');
  assert.equal(document.querySelector('[data-testid="customizations-installed-plugins"] button').getAttribute('aria-label'), '再查看 3 个插件');
  assert.equal(document.getElementById('elsewhere').textContent, 'Science');
  const disclosure = document.querySelector('[data-testid="third-party-tools-disclaimer"]');
  assert.equal(disclosure.firstChild.textContent.trim(), dictionary.exact[notice]);
  assert.equal(disclosure.querySelector('a').getAttribute('href'), policy);
  assert.equal(document.querySelector('main p:not([data-testid])').textContent, notice);
  assert.equal(document.querySelector('[data-testid="changed-files-card-review"]').textContent, '审查');
  assert.equal(document.querySelector('[data-testid="changed-files-card-header"] .truncate').textContent, '2 个文件已修改');
  assert.equal(document.querySelector('.prose button').textContent, 'Review');
  assert.equal(document.querySelector('.prose span').textContent, 'Queued messages');
});

test('customization cards and details preserve metadata while actions translate', async t => {
  const { document } = await fixture(t, `
    <article data-testid="customization-card" data-card-name="Settings">
      <img alt="Settings">
      <div class="font-medium text-foreground truncate"><a aria-label="Open Settings">Settings</a></div>
      <div class="text-sm text-muted-foreground truncate"><mark>Code Preview</mark></div>
      <button>Install</button>
    </article>
    <main data-testid="plugin-detail">
      <h1 class="text-xl font-medium truncate">Settings</h1>
      <p class="text-muted-foreground leading-relaxed">Chat Layout</p>
      <span class="font-medium flex-shrink-0">automation</span>
      <span class="text-muted-foreground truncate" title="Settings">Code Preview</span>
      <div data-testid="plugin-hook-list"><button>Stop<span>Settings</span></button></div>
      <button data-testid="plugin-suggested-prompt-row">New conversation</button>
      <footer><dt>Developer</dt><dd data-testid="plugin-detail-footer-author">Settings</dd>
        <dt>Version</dt><dd data-testid="plugin-detail-footer-version">Download</dd></footer>
      <button aria-label="Delete plugin">Delete plugin</button>
    </main>
    <div role="dialog"><h2>Settings</h2><div data-testid="doc-row-modal">
      <div class="font-mono break-all"><span>Settings</span><button>Copy Path</button></div>
      <p class="text-muted-foreground leading-relaxed">Code Preview</p>
    </div><button>Close</button></div>
    <div role="dialog" id="plugin-modal"><h1 class="text-xl font-medium truncate">Settings</h1>
      <p class="text-muted-foreground leading-relaxed">Code Preview</p><button>Install</button></div>
    <span id="ordinary" class="font-medium flex-shrink-0">Settings</span>`);
  const card = document.querySelector('article');
  assert.equal(card.querySelector('a').textContent, 'Settings');
  assert.equal(card.querySelector('a').getAttribute('aria-label'), 'Open Settings');
  assert.equal(card.querySelector('img').alt, 'Settings');
  assert.equal(card.querySelector('mark').textContent, 'Code Preview');
  assert.equal(card.querySelector('button').textContent, '安装');
  const detail = document.querySelector('main');
  assert.equal(detail.querySelector('h1').textContent, 'Settings');
  assert.equal(detail.querySelector('p').textContent, 'Chat Layout');
  assert.equal(detail.querySelector('.font-medium.flex-shrink-0').textContent, 'automation');
  assert.equal(detail.querySelector('[title]').title, 'Settings');
  assert.equal(detail.querySelector('[title]').textContent, 'Code Preview');
  assert.equal(detail.querySelector('[data-testid="plugin-hook-list"]').textContent, 'StopSettings');
  assert.equal(detail.querySelector('[data-testid="plugin-suggested-prompt-row"]').textContent, 'New conversation');
  assert.equal(detail.querySelector('[data-testid="plugin-detail-footer-author"]').textContent, 'Settings');
  assert.equal(detail.querySelector('[data-testid="plugin-detail-footer-version"]').textContent, 'Download');
  assert.deepEqual([...detail.querySelectorAll('dt')].map(el => el.textContent), ['开发者', '版本信息']);
  assert.equal(detail.lastElementChild.getAttribute('aria-label'), '删除插件');
  const dialog = document.querySelector('[role="dialog"]');
  assert.equal(dialog.querySelector('h2').textContent, 'Settings');
  assert.equal(dialog.querySelector('p').textContent, 'Code Preview');
  assert.equal(dialog.querySelector('span').textContent, 'Settings');
  assert.equal(dialog.querySelector('button').textContent, '复制路径');
  assert.equal(dialog.lastElementChild.textContent, '关闭');
  const pluginModal = document.querySelector('#plugin-modal');
  assert.equal(pluginModal.querySelector('h1').textContent, 'Settings');
  assert.equal(pluginModal.querySelector('p').textContent, 'Code Preview');
  assert.equal(pluginModal.querySelector('button').textContent, '安装');
  assert.equal(document.querySelector('#ordinary').textContent, '设置');
});

test('customization fields restore source text after reparenting and preserve later author edits', async t => {
  const { document, translate, window } = await fixture(t, `
    <div id="outside"><span class="font-medium truncate" data-tooltip-id="name">automation</span></div>
    <div data-testid="workspace-customizations-view" id="inside"></div>`);
  const name = document.querySelector('[data-tooltip-id]');
  assert.equal(name.textContent, '自动化任务');
  document.querySelector('#inside').append(name);
  translate(name);
  assert.equal(name.textContent, 'automation');
  name.textContent = 'Settings';
  await settle(window);
  assert.equal(name.textContent, 'Settings');
  document.querySelector('#outside').append(name);
  translate(name);
  assert.equal(name.textContent, '设置');
});

test('appearance and URL hints translate while the Swarm description retains its source', async t => {
  const { document, translate } = await fixture(t, `
    <button id="preview">Code Preview</button>
    <h3 id="layout">Chat Layout</h3>
    <article data-testid="customization-card" data-card-name="Swarm">
      <div class="font-medium text-foreground truncate">Swarm</div>
      <div class="text-sm text-muted-foreground truncate" id="description">Unlock the power of agent swarms.</div>
    </article>
    <input id="address" type="url" placeholder="Search or enter a URL" value="https://example.com/Code%20Preview?q=Chat+Layout">
    <pre><code>Code Preview\nChat Layout\n/swarm</code></pre>
    <div data-testid="user-input-step">Code Preview<span>Search or enter a URL</span></div>`);
  assert.equal(document.querySelector('#preview').textContent, '代码预览');
  assert.equal(document.querySelector('#layout').textContent, '对话布局');
  assert.equal(document.querySelector('#description').textContent, 'Unlock the power of agent swarms.');
  assert.equal(document.querySelector('[data-card-name="Swarm"] .font-medium').textContent, 'Swarm');
  const address = document.querySelector('#address');
  assert.equal(address.placeholder, '搜索或输入网址');
  assert.equal(address.value, 'https://example.com/Code%20Preview?q=Chat+Layout');
  address.value = 'Search or enter a URL';
  translate(document.body);
  assert.equal(address.value, 'Search or enter a URL');
  assert.equal(document.querySelector('code').textContent, 'Code Preview\nChat Layout\n/swarm');
  const message = document.querySelector('[data-testid="user-input-step"]');
  assert.equal(message.firstChild.nodeValue, 'Code Preview');
  assert.equal(message.querySelector('span').textContent, 'Search or enter a URL');
});

test('2.31 download approvals and voice cards distinguish controls from generated content', async t => {
  const { document } = await fixture(t, `
    <div>
      <h3>Allow the browser agent to download a file?</h3>
      <dl data-testid="permission-download-details"><dt>File</dt><dd>Settings</dd><dt>Save to</dt><dd>Download</dd></dl>
      <button id="approve">Yes, allow this download</button>
    </div>
    <button data-testid="voice-transcript-card" aria-label="Open Voice transcript, 2m 05s. Settings">
      <span>Voice transcript</span><span>Open</span>
      <span data-testid="voice-transcript-summary">
        <span data-testid="voice-transcript-summary-lead">Settings</span>
        <span data-testid="voice-transcript-summary-point"><span>New conversation</span></span>
      </span>
    </button>
    <span data-testid="voice-transcript-summary-pending">Summarizing call…</span>
    <div data-testid="gcp-project-combobox-option-demo" data-project-id="demo"><span>Settings</span></div>
    <button data-testid="gcp-project-combobox-trigger" aria-label="Toggle Google Cloud projects"></button>`);
  assert.deepEqual([...document.querySelectorAll('dd')].map(el => el.textContent), ['Settings', 'Download']);
  assert.deepEqual([...document.querySelectorAll('dt')].map(el => el.textContent), ['文件', '保存到']);
  assert.equal(document.querySelector('h3').textContent, '允许浏览器智能体下载文件吗？');
  assert.equal(document.querySelector('#approve').textContent, '是，允许本次下载');
  const card = document.querySelector('[data-testid="voice-transcript-card"]');
  assert.equal(card.firstElementChild.textContent, '语音转写');
  assert.equal(card.getAttribute('aria-label'), '打开语音转写，2m 05s. Settings');
  assert.equal(card.querySelector('[data-testid="voice-transcript-summary-lead"]').textContent, 'Settings');
  assert.equal(card.querySelector('[data-testid="voice-transcript-summary-point"]').textContent, 'New conversation');
  assert.equal(document.querySelector('[data-testid="voice-transcript-summary-pending"]').textContent, '正在总结通话…');
  assert.equal(document.querySelector('[data-project-id]').textContent, 'Settings');
  assert.equal(document.querySelector('[data-testid="gcp-project-combobox-trigger"]').getAttribute('aria-label'), '展开或收起 Google Cloud 项目列表');
});
