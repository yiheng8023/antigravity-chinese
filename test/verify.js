const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dictContent = fs.readFileSync(path.join(__dirname, '..', 'dict', 'zh-CN.json'), 'utf-8');
const runtimeContent = fs.readFileSync(path.join(__dirname, '..', 'core', 'i18n-runtime.js'), 'utf-8');

console.log('🧪 ============================================================');
console.log('🧪 开始执行 Antigravity 汉化核心引擎自动化自查自验证测试套件');
console.log('🧪 ============================================================\n');

const mockHtml = `
<!DOCTYPE html>
<html>
<head><title>Antigravity - AI Coding Assistant</title></head>
<body>
  <!-- Sidebar -->
  <div class="sidebar">
    <button class="new-chat-btn">+ New Chat</button>
    <div class="nav-item">Conversation History</div>
    <div class="nav-item">Scheduled Tasks</div>
    <div class="nav-item">Projects</div>
    <div class="nav-item">CLI Project</div>
    <div class="nav-item">Install IDE</div>
  </div>

  <!-- Settings Dialog - Account Tab -->
  <div class="settings-modal" id="account-tab">
    <h2>Account</h2>
    <p class="subtitle">
      Manage your plan, credentials, and general preferences.
    </p>

    <div class="card">
      <label>Enable Telemetry</label>
      <div class="desc">
        When toggled on, Antigravity collects usage data to help Google enhance performance and features.
      </div>
    </div>

    <div class="card">
      <label>Marketing Emails</label>
      <div class="desc">
        Receive product updates, tips, and promotions from Google Antigravity via email.
      </div>
    </div>

    <div class="card plan-card">
      <div class="plan-title">Your Plan: Google AI Pro</div>
      <div class="plan-desc">You can upgrade to a Google AI Ultra plan to receive higher rate limits.</div>
      <button class="upgrade-btn">Upgrade</button>
    </div>

    <div class="card auth-card">
      <div class="email-label">Email</div>
      <button class="signout-btn">Sign Out</button>
    </div>

    <div class="footer-terms">
      By using this app, you agree to its <a href="#">Terms of Service</a>
    </div>
  </div>

  <!-- Settings Dialog - General Tab -->
  <div class="settings-modal" id="general-tab">
    <h2>General</h2>
    <p>Configure agent execution, queued message delivery, and permissions.</p>

    <div class="section">
      <h3>Execution</h3>
      <div class="item-title">Queued Messages</div>
      <div class="item-desc">Configure when follow-up messages are sent.</div>
      <button>Queue</button>
      <button>Send Immediately</button>
    </div>

    <div class="section">
      <h3>Agent Settings</h3>
      <div class="item-title">Security Preset</div>
      <div class="item-desc">
        Choose a predefined security preset for the agent. This controls terminal auto-execution policy, and file access policy.
      </div>
      <a>Learn more about Default</a>
    </div>

    <div class="section">
      <h3>Agent Behavior</h3>
      <div class="item-title">Artifact Review Policy</div>
      <div class="item-desc">
        Specifies Agent's behavior when asking for review on artifacts, which are documents it creates to enable a richer conversation experience.
      </div>
      <div>Always Proceed</div>
    </div>

    <div class="section">
      <h3>File Permissions</h3>
      <div class="item-title">File Access Rules</div>
      <div class="item-desc">Configure allowed and denied paths for file reads and writes.</div>
      <button>Open</button>
    </div>

    <div class="section">
      <h3>Terminal & Tooling Permissions</h3>
      <div class="item-title">Terminal Commands</div>
      <div class="item-desc">Configure allowed terminal commands.</div>
      <div class="item-title">Commands Outside Sandbox</div>
    </div>
  </div>

  <!-- Protected Code Area (MUST NOT BE TRANSLATED) -->
  <div class="monaco-editor">
    <div class="view-lines">
      <code>const isPending = false; // Queue and Send Immediately</code>
    </div>
  </div>
</body>
</html>
`;

// Create JSDOM with script execution enabled
const dom = new JSDOM(mockHtml, {
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
const win = dom.window;

// Setup globals on window
win.__AGY_I18N_DATA__ = JSON.parse(dictContent);

// Execute bundled preload script directly on window
const bundledScript = `
window.__AGY_I18N_DATA__ = ${dictContent};
${runtimeContent}
if (window.__AGY_RUN_FULL_SCAN__) {
  window.__AGY_RUN_FULL_SCAN__();
}
`;

win.eval(bundledScript);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failed++;
  }
}

console.log('--- 1. 验证侧边栏汉化 ---');
assert(win.document.querySelector('.sidebar .new-chat-btn').textContent.includes('新建对话'), '侧边栏按钮 "+ New Chat" -> "+ 新建对话"');
assert(win.document.querySelector('.sidebar').textContent.includes('会话历史'), '侧边栏 "Conversation History" -> "会话历史"');
assert(win.document.querySelector('.sidebar').textContent.includes('定时任务'), '侧边栏 "Scheduled Tasks" -> "定时任务"');
assert(win.document.querySelector('.sidebar').textContent.includes('项目列表'), '侧边栏 "Projects" -> "项目列表"');
assert(win.document.querySelector('.sidebar').textContent.includes('安装 IDE'), '侧边栏 "Install IDE" -> "安装 IDE"');

console.log('\n--- 2. 验证账户面板 (Account Tab) 全量汉化 ---');
const accountTab = win.document.getElementById('account-tab');
assert(accountTab.querySelector('h2').textContent === '账户', '标题 "Account" -> "账户"');
assert(accountTab.querySelector('.subtitle').textContent.includes('管理您的套餐方案、凭据及通用偏好。'), '副标题段落正确翻译');
assert(accountTab.querySelector('.card label').textContent.includes('启用遥测诊断'), '"Enable Telemetry" -> "启用遥测诊断"');
assert(accountTab.textContent.includes('开启后，Antigravity 将收集使用数据以帮助 Google 提升性能与产品功能。'), '遥测长段落说明正确翻译');
assert(accountTab.textContent.includes('营销与产品动态邮件'), '"Marketing Emails" -> "营销与产品动态邮件"');
assert(accountTab.textContent.includes('通过电子邮件接收来自 Google Antigravity 的产品更新、使用技巧与促销信息。'), '营销邮件长段落说明正确翻译');
assert(accountTab.querySelector('.plan-title').textContent.includes('当前方案：Google AI Pro 专业版') || accountTab.querySelector('.plan-title').textContent.includes('当前方案') || accountTab.querySelector('.plan-title').textContent.includes('专业版'), '"Your Plan: Google AI Pro" 复合子句正确翻译');
assert(accountTab.textContent.includes('您可以升级至 Google AI Ultra 以获取更高的请求配额与速率上限。'), '升级说明长段落正确翻译');
assert(accountTab.querySelector('.upgrade-btn').textContent === '立即升级', '"Upgrade" 按钮 -> "立即升级"');
assert(accountTab.querySelector('.email-label').textContent === '电子邮箱', '"Email" -> "电子邮箱"');
assert(accountTab.querySelector('.signout-btn').textContent === '退出登录', '"Sign Out" 按钮 -> "退出登录"');
assert(accountTab.querySelector('.footer-terms a').textContent === '服务条款', '嵌套链接 "Terms of Service" -> "服务条款"');
assert(accountTab.querySelector('.footer-terms').textContent.includes('使用此应用即表示您同意其'), '服务条款引导语正确翻译');

console.log('\n--- 3. 验证通用面板 (General Tab) 全量汉化 ---');
const generalTab = win.document.getElementById('general-tab');
assert(generalTab.querySelector('h2').textContent === '通用', '标题 "General" -> "通用"');
assert(generalTab.textContent.includes('配置智能体执行策略、排队消息发送规则及权限。'), '通用设置总说明正确翻译');
assert(generalTab.textContent.includes('执行策略'), '"Execution" -> "执行策略"');
assert(generalTab.textContent.includes('排队消息'), '"Queued Messages" -> "排队消息"');
assert(generalTab.textContent.includes('排队等待'), '"Queue" -> "排队等待"');
assert(generalTab.textContent.includes('立即发送'), '"Send Immediately" -> "立即发送"');
assert(generalTab.textContent.includes('安全预设'), '"Security Preset" -> "安全预设"');
assert(generalTab.textContent.includes('为智能体选择预定义的安全预设，用于控制终端自动执行与文件访问策略。'), '安全预设长段落正确翻译');
assert(generalTab.textContent.includes('产物审查策略'), '"Artifact Review Policy" -> "产物审查策略"');
assert(generalTab.textContent.includes('指定智能体在创建产物文档时请求用户审查与反馈的行为策略。'), '审查策略长段落正确翻译');
assert(generalTab.textContent.includes('总是直接继续'), '"Always Proceed" -> "总是直接继续"');
assert(generalTab.textContent.includes('文件访问规则'), '"File Access Rules" -> "文件访问规则"');
assert(generalTab.textContent.includes('配置文件读写的允许与禁止路径。'), '文件访问长段落正确翻译');
assert(generalTab.textContent.includes('终端命令权限'), '"Terminal Commands" -> "终端命令权限"');
assert(generalTab.textContent.includes('沙箱外命令执行'), '"Commands Outside Sandbox" -> "沙箱外命令执行"');

console.log('\n--- 4. 验证代码保护机制（确保不误伤代码与终端） ---');
const codeContent = win.document.querySelector('.monaco-editor code').textContent;
assert(codeContent === 'const isPending = false; // Queue and Send Immediately', 'Monaco Editor 与代码区内容被严格保护，未被误翻译！');

console.log('\n--- 5. 验证 Antigravity 官方插件套件完整性 ---');
const pluginJsonPath = path.join(__dirname, '..', 'plugins', 'chinese-toolkit', 'plugin.json');
assert(fs.existsSync(pluginJsonPath), '插件清单 plugins/chinese-toolkit/plugin.json 存在');
const pluginData = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
assert(pluginData.name === 'antigravity-chinese-toolkit', '插件名称规范对齐 antigravity-chinese-toolkit');

const rulesPath = path.join(__dirname, '..', 'plugins', 'chinese-toolkit', 'rules', 'chinese-interaction-rules.md');
assert(fs.existsSync(rulesPath), '插件规则 rules/chinese-interaction-rules.md 存在且非空');

const skillPath = path.join(__dirname, '..', 'plugins', 'chinese-toolkit', 'skills', 'i18n-diagnostics', 'SKILL.md');
assert(fs.existsSync(skillPath), '插件技能 skills/i18n-diagnostics/SKILL.md 存在');
const skillContent = fs.readFileSync(skillPath, 'utf-8');
assert(skillContent.includes('name: i18n-diagnostics'), '插件技能包含合法 YAML frontmatter 定义');

console.log('\n--- 6. 验证跨平台路径探测器 (macOS / Linux / Windows) ---');
const { getCandidateAsarPaths } = require('../cli');

// 1. Windows 候选路径校验
const winPaths = getCandidateAsarPaths('win32', 'C:\\Users\\TestUser');
assert(winPaths.length >= 3, 'Windows 包含至少 3 组候选路径');
assert(winPaths.some(p => p.includes('AppData') && p.includes('antigravity')), 'Windows 包含 LocalAppData 路径');
assert(winPaths.some(p => p.includes('Program Files') && p.includes('antigravity')), 'Windows 包含 ProgramFiles 路径');

// 2. macOS 候选路径校验
const macPaths = getCandidateAsarPaths('darwin', '/Users/TestUser').map(p => p.replace(/\\/g, '/'));
assert(macPaths.length >= 2, 'macOS 包含系统与用户级 2 组候选路径');
assert(macPaths.includes('/Applications/Antigravity.app/Contents/Resources/app.asar'), 'macOS 包含全局 /Applications 路径');
assert(macPaths.includes('/Users/TestUser/Applications/Antigravity.app/Contents/Resources/app.asar'), 'macOS 包含用户级 Applications 路径');

// 3. Linux 候选路径校验
const linuxPaths = getCandidateAsarPaths('linux', '/home/testuser').map(p => p.replace(/\\/g, '/'));
assert(linuxPaths.length >= 4, 'Linux 包含 /opt, /usr/lib, /usr/share, ~/.local 4 组候选路径');
assert(linuxPaths.includes('/opt/antigravity/resources/app.asar'), 'Linux 包含 /opt 路径');
assert(linuxPaths.includes('/usr/lib/antigravity/resources/app.asar'), 'Linux 包含 /usr/lib 路径');
assert(linuxPaths.includes('/usr/share/antigravity/resources/app.asar'), 'Linux 包含 /usr/share 路径');
assert(linuxPaths.includes('/home/testuser/.local/share/antigravity/resources/app.asar'), 'Linux 包含 ~/.local/share 路径');

console.log('\n============================================================');
console.log(`📊 测试完成: 共 ${passed + failed} 项断言, 通过 ${passed} 项, 失败 ${failed} 项`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
