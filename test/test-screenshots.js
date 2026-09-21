/**
 * 客户端 UI 真实场景黄金语义断言与单源引擎回归测试套件 (Single-Source Golden Snapshots)
 *
 * 核心升级：
 * 1. 【单源引用】彻底废黜独立的 translateSingleUnit 影子副本，直接加载 core/i18n-runtime.js 生产引擎
 * 2. 【黄金语义断言】使用 assert.strictEqual 精确对比预期汉化结果，杜绝 res !== tc 的假阳性漏洞
 * 3. 【不变性模糊测试】针对时间倒计时、模型插值、子智能体数量等动态模板开展 Invariant Fuzzing
 */

const assert = require('assert');
const path = require('path');
const { createI18nEngine } = require('../core/i18n-runtime.js');
const dict = require('../dict/zh-CN.json');

const engine = createI18nEngine(dict);

console.log('🧪 === 开始执行单源引擎驱动的截图黄金语义回归测试 ===\n');

// 151 项来自历史真实截图与上游界面更新的黄金语义映射集
const goldenCases = [
  // Screenshot 1: App Settings (media_1789717290478.png)
  { input: "App Settings", expected: "应用设置" },
  { input: "Manage application settings.", expected: "管理应用程序设置。" },
  { input: "Prevent Sleep", expected: "阻止系统休眠" },
  { input: "Prevent the computer from sleeping while the app is running.", expected: "在应用运行期间阻止计算机进入休眠状态。" },
  { input: "Keep In Menu Bar", expected: "保持在菜单栏/托盘" },
  { input: "Show in the menu bar when closed. Right-click to quit.", expected: "关闭窗口后仍保留在菜单栏/系统托盘中。右键点击可彻底退出。" },
  { input: "Notifications", expected: "通知" },
  { input: "Notification Sounds", expected: "通知提示音" },
  { input: "Notification Settings", expected: "通知设置" },
  { input: "Network Proxy", expected: "网络代理" },
  { input: "Configure network proxy settings.", expected: "配置网络代理设置。" },
  { input: "Proxy Mode", expected: "代理模式" },
  { input: "Direct (no proxy)", expected: "直接连接 (不使用代理)" },
  { input: "Proxy URL", expected: "代理服务器地址" },
  { input: "Save Proxy Settings", expected: "保存代理设置" },
  { input: "Telemetry", expected: "遥测诊断" },
  { input: "Diagnostic Data", expected: "诊断数据" },
  { input: "Crash Reporting", expected: "崩溃报告" },
  { input: "Terminal", expected: "终端" },
  { input: "Terminal Shell", expected: "终端 Shell" },
  { input: "Auto Check for Updates", expected: "自动检查更新" },
  { input: "Language", expected: "语言" },
  { input: "Theme", expected: "主题风格" },
  { input: "General", expected: "通用" },
  { input: "Advanced", expected: "高级" },
  { input: "Shortcuts", expected: "快捷键" },
  { input: "Documentation", expected: "官方文档" },
  { input: "Report Issue", expected: "报告问题" },
  { input: "Quit", expected: "退出" },

  // Screenshot 2: Model & Quota (media_1789717346005.png)
  { input: "You currently don't have any MCP Servers installed.", expected: "您当前尚未安装任何 MCP 服务。" },
  { input: "Models & Usage", expected: "模型与用量" },
  { input: "Manage your model quota and credits.", expected: "管理您的模型配额与积分。" },
  { input: "Model Credits", expected: "模型积分" },
  { input: "Enable AI Credit Overages", expected: "启用超额 AI 积分计费" },
  { input: "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.", expected: "开启后，当模型配额耗尽时，Antigravity 将使用您的 AI 积分来完成模型请求。Antigravity 将始终优先消耗模型配额，然后再使用 AI 积分。" },
  { input: "Gemini Models", expected: "Gemini 模型" },
  { input: "Weekly Limit Remaining", expected: "每周剩余额度" },
  { input: "Five Hour Limit Remaining", expected: "5 小时剩余额度" },
  { input: "You have used some of your weekly limit, it will fully refresh in 6 days, 6 hours.", expected: "您已消耗了部分每周额度，将在 6 天 6 小时 后完全重置刷新。" },
  { input: "You have used some of your 5 hour limit, it will fully refresh in 3 hours, 21 minutes.", expected: "您已消耗了部分 5 小时额度，将在 3 小时 21 分钟 后完全重置刷新。" },
  { input: "Claude and GPT models", expected: "Claude 与 GPT 模型" },
  { input: "You have hit your 5-hour limit, so the weekly limit does not currently apply. Your 5-hour limit will refresh in 3 hours, 51 minutes.", expected: "您已达到 5 小时上限，因此每周额度当前不适用。您的 5 小时额度将在 3 小时 51 分钟 后重置刷新。" },
  { input: "You have hit your 5-hour limit, it will refresh in 3 hours, 51 minutes. If on a supported paid plan, you can use AI credits in the interim.", expected: "您已达到 5 小时上限，将在 3 小时 51 分钟 后重置刷新。如果使用的是支持的付费套餐，您可以在此期间使用 AI 积分。" },

  // Screenshot 3: Chat Settings (media_1789717420110.png)
  { input: "Chat Settings", expected: "对话设置" },
  { input: "Verbose Agent Chat", expected: "详细智能体对话输出" },
  { input: "Display and preserve intermediate thinking steps.", expected: "显示并保留中间思考过程步骤。" },
  { input: "Conversation Width", expected: "对话面板宽度" },
  { input: "Configure the maximum width of the conversation panel.", expected: "配置对话面板的最大显示宽度。" },
  { input: "Narrow", expected: "窄" },
  { input: "Wide", expected: "宽" },

  // Screenshot 4: Themes & Customization (media_1789717451009.png)
  { input: "Select light, dark, or inherit system settings.", expected: "选择浅色、深色或跟随系统设置。" },
  { input: "Preset", expected: "预设" },
  { input: "Default Light", expected: "默认浅色" },
  { input: "Default Dark", expected: "默认深色" },
  { input: "Background", expected: "背景色" },
  { input: "Foreground", expected: "前景色" },
  { input: "Accent", expected: "强调色" },

  // Screenshot 5: Application & Remote Control (media_1789750775653.png & media_1789750797195.png)
  { input: "Application", expected: "应用设置" },
  { input: "Manage Antigravity app settings.", expected: "管理 Antigravity 应用设置。" },
  { input: "Work with local agents from another device.", expected: "从其他设备与本地智能体协同工作。" },
  { input: "Device Name", expected: "设备名称" },
  { input: "Scan the code to open this device in Remote Control, or copy link.", expected: "扫描二维码在远程控制中打开此设备，或复制链接。" },

  // Screenshot 6: Permissions & Sandboxing (media_1789750937272.png & media_1789750959891.png)
  { input: "Configure allowed commands outside the sandbox.", expected: "配置沙箱外允许执行的命令。" },
  { input: "Configure external tools via Model Context Protocol.", expected: "通过模型上下文协议 (Model Context Protocol) 配置外部工具。" },
  { input: "No MCP servers installed", expected: "未安装 MCP 服务" },
  { input: "Build With Google Plugins", expected: "Build With Google 插件目录" },
  { input: "Browse and enable plugins from the Build With Google catalog.", expected: "浏览并启用 Build With Google 目录中的插件。" },

  // Screenshot 7: Inherit Global & Project Permissions (media_1789624999478.png)
  { input: "Inherit Global", expected: "继承全局设置" },
  { input: "Global Permissions", expected: "全局权限" },
  { input: "Project Permissions", expected: "项目权限" },
  { input: "Proceed in Sandbox", expected: "在沙箱中执行" },
  { input: "Require Review", expected: "需要复核" },
  { input: "Vetted (Preview)", expected: "已审查 (预览)" },
  { input: "Turbo", expected: "Turbo 极速" },
  { input: "Always Proceed", expected: "总是直接继续" },
  { input: 'Warning: "Always Proceed" is enabled without sandbox protection. This is very dangerous and we do not recommend doing this.', expected: '警告：“总是直接继续”在无沙箱保护的情况下已启用。这非常危险，我们不建议这样做。' },

  // Screenshot 8: Drawer Panel & Dynamic Status (media_1789625187011.png)
  { input: "Files Changed", expected: "已修改文件" },
  { input: "Skills Used", expected: "已使用技能" },
  { input: "See all (79)", expected: "查看全部 (79)" },
  { input: "(2 subagents)", expected: "(2 个子智能体)" },
  { input: "Thought for 12.5s", expected: "已思考 12.5 秒" },
  { input: "Jan 15 - Feb 3", expected: "1月 15日 - 2月 3日" },
  { input: "Sep 17, 2:25 PM", expected: "9月 17日 下午 2:25" },
  { input: "5 minutes ago", expected: "5 分钟前" },
  { input: "Just now", expected: "刚刚" },

  // Screenshot 9: Battle Mode & Surveys (media_1789756124531.png & media_1789756522985.png)
  { input: "Battle Mode", expected: "对决模式" },
  { input: "Best-of-N", expected: "多候选对决 (Best-of-N)" },
  { input: "Select Winner", expected: "选择优胜方案" },
  { input: "Winner Survey", expected: "优胜方案评选调查" },
  { input: "Both are good", expected: "两项均表现优秀" },
  { input: "Tie", expected: "平局" },

  // Screenshot 10: Inherits / Includes Complex Patterns (media_1789789564305.png)
  { input: "Inherits your Global Permissions when working in this project.", expected: "在此项目中工作时，继承您的全局权限。" },
  { input: "Inherits your Global Permissions", expected: "继承您的全局权限" },
  { input: "Also includes Global Permissions when working in this project.", expected: "在此项目中工作时也包含全局权限。" },
  { input: "Also includes Global Permissions when working in this project. Learn more.", expected: "在此项目中工作时也包含全局权限。了解更多。" },
  { input: "Also includes Global Permissions when working in this project", expected: "在此项目中工作时也包含全局权限" },

  // Screenshot 11: Dynamic Reset Counters
  { input: "Resets in 4d 13h", expected: "4 天 13 小时后重置" },
  { input: "Resets in 2h 35m", expected: "2 小时 35 分钟后重置" },
  { input: "Resets in 4d 13h.", expected: "4 天 13 小时后重置。" },
  { input: "Resets in 2h 35m.", expected: "2 小时 35 分钟后重置。" },
  { input: "Resets in 5m 20s", expected: "5 分 20 秒后重置" },
  { input: "Resets in 4d", expected: "4 天后重置" },
  { input: "Resets in 2h", expected: "2 小时后重置" },
  { input: "Resets in 35m", expected: "35 分钟后重置" },
  { input: "Resets in 10s", expected: "10 秒后重置" },
  { input: "Resets in less than a minute", expected: "不到 1 分钟后重置" },
  { input: "Resets soon", expected: "即将重置" },
  { input: "Refreshes in 4d 13h", expected: "4 天 13 小时后重置刷新" },
  { input: "Refreshes in 2h 35m", expected: "2 小时 35 分钟后重置刷新" },
  { input: "Contrast", expected: "对比度" },
  { input: "Strong", expected: "高对比度" },
  { input: "High Contrast", expected: "高对比度" },
  { input: "+ New", expected: "+ 新建" },
  { input: "New", expected: "新建" },

  // Screenshot 12: Scheduled Tasks (media_1789790849888.png)
  { input: "Search tasks...", expected: "搜索任务..." },
  { input: "No scheduled tasks configured.", expected: "尚未配置任何定时任务。" },
  { input: "New Scheduled Task", expected: "新建定时任务" },
  { input: "scheduled task", expected: "定时任务" },
  { input: "Name", expected: "名称" },
  { input: "Enter scheduled task name...", expected: "输入定时任务名称..." },
  { input: "Schedule", expected: "定时计划" },
  { input: "Daily", expected: "每天" },
  { input: "around", expected: "大约" },
  { input: "Prompt", expected: "提示词" },
  { input: "Enter a prompt for the agent to run...", expected: "输入供智能体执行的提示词..." },
  { input: "All scheduled tasks run as Flash.", expected: "所有定时任务均以 Flash 模型运行。" },
  { input: "Add Scheduled Task", expected: "添加定时任务" },

  // Screenshot 13: Search conversations (media_1789790888612.png)
  { input: "Search conversations...", expected: "搜索会话..." },

  // Screenshot 14: Display menu (media_1789790931048.png)
  { input: "Display", expected: "显示方式" },
  { input: "Project + Worktree", expected: "项目 + 工作树" },

  // Screenshot 15: Filter menu Only Unread (media_1789790951393.png)
  { input: "Only Unread", expected: "仅未读" },

  // Screenshot 16: Queued Messages Strategy Tooltips (media_1789793151370.png & media_1789793163093.png)
  { input: "Queue until after the current turn.", expected: "排队等待，直至当前轮次结束。" },
  { input: "Interrupt the agent and send immediately.", expected: "打断智能体并立即发送。" },

  // v2.15.0 Core Features: Conversation Actions, Skins, CL Status, Plugins
  { input: "Copy Conversation Markdown", expected: "复制会话 Markdown" },
  { input: "Archive This Conversation", expected: "归档此会话" },
  { input: "Find in Conversation", expected: "在会话中查找" },
  { input: "Pin This Conversation", expected: "置顶此会话" },
  { input: "Unpin This Conversation", expected: "取消置顶此会话" },
  { input: "Rename This Conversation", expected: "重命名此会话" },
  { input: "Move to New Group", expected: "移动到新分组" },
  { input: "Product Skin", expected: "产品界面风格" },
  { input: "Non-technical", expected: "非技术模式" },
  { input: "Simplified interface without developer tooling.", expected: "无开发者工具的简化界面。" },
  { input: "The full developer experience.", expected: "完整开发者体验。" },
  { input: "Workspace CL Status", expected: "工作区 CL 状态" },
  { input: "CL details unavailable", expected: "CL 详情不可用" },
  { input: "Create a Plugin with the Agent", expected: "与智能体一起创建插件" },
  { input: "This skill came from the marketplace, so you can add it again whenever you need it.", expected: "此技能来自应用市场，您可以随时按需再次添加。" },
  { input: "Undo restores your entire workspace to its state at this point.", expected: "撤销会将整个工作区恢复到此节点的状态。" },

  // History Menu & Batch Mark As Read (media_1789956060212.png)
  { input: "Mark 1 conversation as read", expected: "将 1 个会话标记为已读" },
  { input: "Mark all 5 conversations as read", expected: "将全部 5 个会话标记为已读" },
  { input: "Mark as Read", expected: "标记为已读" },
  { input: "Mark all as read", expected: "全部标记为已读" },
  { input: "Failed to mark all as read", expected: "无法全部标记为已读" },
  { input: "Are you sure you want to mark 1 conversation as read? This action cannot be undone.", expected: "您确定要将 1 个会话标记为已读吗？此操作无法撤销。" },
  { input: "Are you sure you want to mark all 3 conversations as read? This action cannot be undone.", expected: "您确定要将全部 3 个会话标记为已读吗？此操作无法撤销。" },
  { input: "Pinned Chats Only", expected: "仅固定会话" },
  { input: "Workspace + Worktree", expected: "工作区 + 工作树" },
  { input: "Archive Conversation", expected: "归档会话" }
];

console.log(`执行 ${goldenCases.length} 项黄金语义精确断言...`);
let passedCount = 0;
for (const gc of goldenCases) {
  const actual = engine.translate(gc.input);
  try {
    assert.strictEqual(actual, gc.expected, `Input: "${gc.input}" -> Expected: "${gc.expected}", but got: "${actual}"`);
    passedCount++;
  } catch (err) {
    console.error(`❌ [黄金语义断言失败] ${err.message}`);
    process.exit(1);
  }
}
console.log(`✅ [100% PASS] 全部 ${passedCount}/${goldenCases.length} 项黄金语义断言严格吻合！\n`);

// 动态模式不变性模糊测试 (Invariant Fuzzing)
console.log('🧪 === 执行动态模板不变性模糊测试 (Invariant Fuzzing) ===');

// 1. 思考时间动态模糊
const thoughtFuzz = [
  { in: "Thought for 1s", exp: "已思考 1 秒" },
  { in: "Thought for 45s", exp: "已思考 45 秒" },
  { in: "Thought for 2m", exp: "已思考 2 分钟" },
  { in: "Thought for 15m 30s", exp: "已思考 15 分 30 秒" },
  { in: "Thought for 1h", exp: "已思考 1 小时" },
  { in: "Thought for 2h 45m", exp: "已思考 2 小时 45 分钟" },
  { in: "Thought for 1h 20m 15s", exp: "已思考 1 小时 20 分 15 秒" }
];
for (const tc of thoughtFuzz) {
  assert.strictEqual(engine.translate(tc.in), tc.exp, `Thought Fuzz failed: ${tc.in}`);
}
console.log('✅ [PASS] 思考时间动态模式变异测试通过 (7/7)');

// 2. 动态倒计时模糊测试
const countdownFuzz = [
  { in: "Resets in 7d", exp: "7 天后重置" },
  { in: "Resets in 12h", exp: "12 小时后重置" },
  { in: "Resets in 45m", exp: "45 分钟后重置" },
  { in: "Resets in 30s", exp: "30 秒后重置" },
  { in: "Resets in 3d 8h", exp: "3 天 8 小时后重置" },
  { in: "Resets in 5h 15m", exp: "5 小时 15 分钟后重置" },
  { in: "Resets in 2m 40s", exp: "2 分 40 秒后重置" }
];
for (const tc of countdownFuzz) {
  assert.strictEqual(engine.translate(tc.in), tc.exp, `Countdown Fuzz failed: ${tc.in}`);
}
console.log('✅ [PASS] 倒计时动态模式变异测试通过 (7/7)');

// 3. 插件、自动化与定时任务模型插值模糊测试
const interpolationFuzz = [
  { in: "All scheduled tasks run as Gemini-2.5-Pro.", exp: "所有定时任务均以 Gemini-2.5-Pro 模型运行。" },
  { in: "All plugins run as Claude-3.7-Sonnet.", exp: "所有插件均以 Claude-3.7-Sonnet 模型运行。" },
  { in: "All automations run as GPT-4o.", exp: "所有自动化任务均以 GPT-4o 模型运行。" }
];
for (const tc of interpolationFuzz) {
  assert.strictEqual(engine.translate(tc.in), tc.exp, `Interpolation Fuzz failed: ${tc.in}`);
}
console.log('✅ [PASS] 模型动态插值变异测试通过 (3/3)');

// 4. 标点与快捷键容差测试
const toleranceFuzz = [
  { in: "Documentation:", exp: "官方文档：" },
  { in: "Report Issue...", exp: "报告问题..." },
  { in: "Terminal (Ctrl+T)", exp: "终端 (Ctrl+T)" }
];
for (const tc of toleranceFuzz) {
  assert.strictEqual(engine.translate(tc.in), tc.exp, `Tolerance Fuzz failed: ${tc.in}`);
}
console.log('✅ [PASS] 标点与快捷键容差变异测试通过 (3/3)');

console.log('\n🎉 [单源黄金语义与模糊测试] 全部通过！无影子副本，真理单源闭环！\n');
