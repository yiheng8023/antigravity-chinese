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
  check('title1', 'Localization Project Setup'),
  check('title2', 'Initiating Localization Project...')
];

const allPassed = tests.every(Boolean);
if (!allPassed) {
  console.error('\n❌ 测试失败！');
  process.exit(1);
} else {
  console.log('\n🎉 所有菜单项与会话标题防误伤测试 100% 全部通过！');
}
