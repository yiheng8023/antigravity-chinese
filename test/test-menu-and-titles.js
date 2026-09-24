const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dictContent = fs.readFileSync(path.join(__dirname, '..', 'dict', 'zh-CN.json'), 'utf-8');
const runtimeContent = fs.readFileSync(path.join(__dirname, '..', 'core', 'i18n-runtime.js'), 'utf-8');

const mockHtml = `
<!DOCTYPE html>
<html>
<body>
  <div id="test-container">
    <div class="menu-item" id="item1">Command Palette</div>
    <div class="menu-item" id="item2">Maximize</div>
    <div class="menu-item" id="item3">Minimize</div>
    <div class="menu-item" id="item4">New Project</div>
    <div class="menu-item" id="item5">Create Project</div>
    <div class="menu-item" id="item6">Project</div>
    <div class="menu-item" id="item7">Connect to WSL</div>
    <div class="menu-item" id="item8">Reopen Locally</div>
    <div id="item9">Try 远程控制</div>
    <div id="item10">Get Started</div>
    <div id="item11">2 tools enabled</div>
    <div data-testid="plan-command-fyi-alert" id="planAlert">
      <span>Type <code>/</code> and select <code>plan</code> to have the agent generate a plan.</span>
    </div>
    <div id="pluginDesc">Core tools and knowledge required to develop for Android</div>
    <div class="chat-title" id="title1">Localization Project Setup</div>
    <div class="chat-title" id="title2">Initiating Localization Project...</div>
  </div>
</body>
</html>
`;

const dom = new JSDOM(mockHtml, {
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
const win = dom.window;

const bundledScript = `
window.__AGY_I18N_DATA__ = ${dictContent};
${runtimeContent}
if (window.__AGY_RUN_FULL_SCAN__) {
  window.__AGY_RUN_FULL_SCAN__();
}
`;

win.eval(bundledScript);

const doc = win.document;

console.log('=== 验证菜单项与用户标题防误伤 ===');

function check(id, expected) {
  const actual = doc.getElementById(id).textContent.trim();
  const pass = actual === expected;
  console.log((pass ? '✅ [PASS] ' : '❌ [FAIL] ') + id + ': "' + actual + '"' + (pass ? '' : ' (Expected: "' + expected + '")'));
  return pass;
}

const tests = [
  check('item1', '命令面板'),
  check('item2', '最大化'),
  check('item3', '最小化'),
  check('item4', '新建项目'),
  check('item5', '创建项目'),
  check('item6', '项目'),
  check('item7', '连接到 WSL'),
  check('item8', '在本地重新打开'),
  check('item9', '体验远程控制'),
  check('item10', '开始体验'),
  check('item11', '已启用 2 个工具'),
  check('planAlert', '输入 / 并选择 plan 以让智能体生成计划。'),
  check('pluginDesc', '开发 Android 应用所需的核心工具与知识'),
  check('title1', 'Localization Project Setup'),
  check('title2', 'Initiating Localization Project...')
];

const allPassed = tests.every(Boolean);

console.log('\n=== 验证主进程系统托盘协同注入与 WSL 补丁 ===');
const os = require('os');
const { patchMainFile, patchTrayFile, patchMenuFile, patchIpcHandlersFile, patchWslFile } = require('../cli');

const tmpMain = path.join(os.tmpdir(), `agy_test_main_${Date.now()}.js`);
const tmpTray = path.join(os.tmpdir(), `agy_test_tray_${Date.now()}.js`);
const tmpMenu = path.join(os.tmpdir(), `agy_test_menu_${Date.now()}.js`);
const tmpIpc = path.join(os.tmpdir(), `agy_test_ipc_${Date.now()}.js`);
const tmpWsl = path.join(os.tmpdir(), `agy_test_wsl_${Date.now()}.js`);

const mockMainContent = `
(0, tray_1.createTray)([
    {
        id: 'running-agents',
        label: 'No agents running',
        enabled: false,
    },
    { type: 'separator' },
    {
        label: \`Open \${electron_1.app.getName()}\`,
        click: () => (0, utils_1.showOrCreateWindow)((0, languageServer_1.getLsPort)()),
    },
    {
        label: 'Open ' + electron_1.app.getName(),
        click: () => {},
    },
    {
        label: 'Quit',
        click: () => {
            electron_1.app.quit();
        },
    },
]);

const quitDialog = {
    type: 'question',
    buttons: ['Cancel', 'Quit'],
    defaultId: 1,
    cancelId: 0,
    title: 'Confirm Quit',
    message: 'Are you sure you want to quit?',
    detail: 'There may be agents or background tasks running.',
};
electron_1.dialog.showErrorBox('Binary not found', 'msg');
electron_1.dialog.showErrorBox('Startup failed', 'msg');

const wslDistroDialog = {
    title: 'WSL distro not found',
    detail: 'Antigravity opened on Windows instead.',
};
`;

const mockTrayContent = `
function updateTrayAgentCount(count) {
    if (tray && contextMenu) {
        const countItem = contextMenu.items.find((item) => item.id === 'running-agents');
        if (countItem) {
            countItem.label =
                (count > 0 ? \`\${count}\` : 'No') +
                    ' agent' +
                    (count === 1 ? '' : 's') +
                    ' running';
            tray.setContextMenu(contextMenu);
        }
    }
}
`;

const mockMenuContent = `
const menuItems = [
    { label: 'Connect to WSL' },
    { label: 'Reopen Locally' }
];
`;

const mockIpcContent = `
dialog.showMessageBox({
    message: 'Folder is on the Windows filesystem',
});
`;

const mockWslContent = `
const w = {
    warning: 'This folder is on the Windows filesystem. Accessing it from WSL (via /mnt) can be slow — for best performance keep projects inside the WSL filesystem.',
    error: 'This location cannot be opened in WSL: ' + winPath
};
`;

fs.writeFileSync(tmpMain, mockMainContent, 'utf-8');
fs.writeFileSync(tmpTray, mockTrayContent, 'utf-8');
fs.writeFileSync(tmpMenu, mockMenuContent, 'utf-8');
fs.writeFileSync(tmpIpc, mockIpcContent, 'utf-8');
fs.writeFileSync(tmpWsl, mockWslContent, 'utf-8');

patchMainFile(tmpMain);
patchTrayFile(tmpTray);
patchMenuFile(tmpMenu);
patchIpcHandlersFile(tmpIpc);
patchWslFile(tmpWsl);

const patchedMain = fs.readFileSync(tmpMain, 'utf-8');
const patchedTray = fs.readFileSync(tmpTray, 'utf-8');
const patchedMenu = fs.readFileSync(tmpMenu, 'utf-8');
const patchedIpc = fs.readFileSync(tmpIpc, 'utf-8');
const patchedWsl = fs.readFileSync(tmpWsl, 'utf-8');

try {
  fs.unlinkSync(tmpMain);
  fs.unlinkSync(tmpTray);
  fs.unlinkSync(tmpMenu);
  fs.unlinkSync(tmpIpc);
  fs.unlinkSync(tmpWsl);
} catch (e) {}

const trayTests = [
  { name: 'main.js 托盘初始未运行文本已汉化', pass: patchedMain.includes("label: '无正在运行的智能体'") },
  { name: 'main.js 托盘打开客户端模板字符串文本已汉化', pass: patchedMain.includes("label: `打开 ${electron_1.app.getName()}`") },
  { name: 'main.js 托盘打开客户端加号拼接文本正确包含 label 键（防语法崩溃）', pass: patchedMain.includes("label: '打开 ' + electron_1.app.getName()") },
  { name: 'main.js 托盘退出选项已汉化', pass: patchedMain.includes("label: '退出'") && !patchedMain.includes("label: 'Quit'") },
  { name: 'main.js 原生退出确认弹窗标题与提示已汉化', pass: patchedMain.includes("title: '确认退出'") && patchedMain.includes("message: '您确定要退出吗？'") },
  { name: 'main.js 原生退出确认弹窗按钮已汉化', pass: patchedMain.includes("buttons: ['取消', '退出']") },
  { name: 'main.js 启动错误提示框已汉化', pass: patchedMain.includes("'未找到二进制文件'") && patchedMain.includes("'启动失败'") },
  { name: 'main.js WSL 未找到发行版弹窗已汉化', pass: patchedMain.includes("'未找到 WSL 发行版'") && patchedMain.includes("'Antigravity 已改为在 Windows 本地打开。'") },
  { name: 'tray.js 动态数量更新逻辑已汉化', pass: patchedTray.includes("${count} 个正在运行的智能体") && patchedTray.includes("'无正在运行的智能体'") },
  { name: 'menu.js WSL 连接与返回本地菜单项已汉化', pass: patchedMenu.includes("label: '连接到 WSL'") && patchedMenu.includes("label: '在本地重新打开'") },
  { name: 'ipcHandlers.js WSL 文件系统弹窗已汉化', pass: patchedIpc.includes("message: '文件夹位于 Windows 文件系统上'") },
  { name: 'wsl.js 性能警告与错误提示已汉化', pass: patchedWsl.includes("此文件夹位于 Windows 文件系统上") && patchedWsl.includes("此位置无法在 WSL 中打开：") }
];

let trayAllPassed = true;
for (const tt of trayTests) {
  console.log((tt.pass ? '✅ [PASS] ' : '❌ [FAIL] ') + tt.name);
  if (!tt.pass) trayAllPassed = false;
}

console.log('\n=== 验证自杀防御门禁机制 (Suicide Prevention Safety Gate) ===');
const { isProtectedEnvironment, closeAntigravitySafely, confirmCloseClient } = require('../cli');

const prevAgent = process.env.ANTIGRAVITY_AGENT;
const prevNoKill = process.env.AGY_NO_KILL;

let safetyAllPassed = true;
function assertSafety(condition, name) {
  console.log((condition ? '✅ [PASS] ' : '❌ [FAIL] ') + name);
  if (!condition) safetyAllPassed = false;
}

try {
  // 1. 测试智能体环境变量防护
  process.env.ANTIGRAVITY_AGENT = '1';
  assertSafety(isProtectedEnvironment() === true, 'isProtectedEnvironment 在 ANTIGRAVITY_AGENT=1 时准确返回 true');
  assertSafety(closeAntigravitySafely() === false, 'closeAntigravitySafely 在受保护状态下拒绝执行 taskkill 并返回 false');
  assertSafety(confirmCloseClient('Antigravity') === false, 'confirmCloseClient 在受保护状态下拒绝并返回 false');

  // 2. 测试 AGY_NO_KILL 环境变量防护
  delete process.env.ANTIGRAVITY_AGENT;
  process.env.AGY_NO_KILL = '1';
  assertSafety(isProtectedEnvironment() === true, 'isProtectedEnvironment 在 AGY_NO_KILL=1 时准确返回 true');
  assertSafety(closeAntigravitySafely() === false, 'closeAntigravitySafely 在 AGY_NO_KILL=1 时拒绝执行 taskkill 并返回 false');
} finally {
  if (prevAgent !== undefined) process.env.ANTIGRAVITY_AGENT = prevAgent;
  else delete process.env.ANTIGRAVITY_AGENT;
  if (prevNoKill !== undefined) process.env.AGY_NO_KILL = prevNoKill;
  else delete process.env.AGY_NO_KILL;
}

if (!allPassed || !trayAllPassed || !safetyAllPassed) {
  console.error('\n❌ 测试失败！');
  process.exit(1);
} else {
  console.log('\n🎉 所有菜单项、托盘协同、主进程弹窗与自杀防御测试 100% 全部通过！');
  process.exit(0);
}
