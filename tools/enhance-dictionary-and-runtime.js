const fs = require('fs');
const path = require('path');

const dictPath = path.join(__dirname, '..', 'dict', 'zh-CN.json');
const currentDict = require(dictPath);
const exact = { ...currentDict.exact };

// Comprehensive UI mappings extracted from all settings tabs, modals, and toolbars
const newExactEntries = {
  // === App Settings Tab (应用设置) ===
  "App Settings": "应用设置",
  "Manage application settings.": "管理应用程序设置。",
  "Prevent Sleep": "阻止系统休眠",
  "Prevent the computer from sleeping while the app is running.": "在应用运行期间阻止计算机进入休眠状态。",
  "Keep In Menu Bar": "保持在菜单栏/托盘",
  "Keep the app accessible from the menu bar and running in the background when all windows are closed.": "在关闭所有窗口后，保持应用在菜单栏/托盘中可访问并在后台继续运行。",
  "Notification Settings": "通知设置",
  "To modify notification settings, open your operating system's system preferences.": "若要修改通知设置，请打开您操作系统的系统设置。",
  "Open System Preferences": "打开系统偏好设置",
  "Ask anything, @ to mention, / for actions": "输入任何问题，输入 @ 提及，输入 / 执行操作",
  "Advanced Settings": "高级设置",

  // === Browser Settings Tab (浏览器设置) ===
  "Browser Settings": "浏览器设置",
  "Configure the browser subagent.": "配置浏览器子智能体。",
  "It requires Google Chrome to be installed.": "需要系统中已安装 Google Chrome 浏览器。",
  "Configure the browser subagent. It requires Google Chrome to be installed.": "配置浏览器子智能体。需要系统中已安装 Google Chrome 浏览器。",
  "Browser Javascript Execution Policy": "浏览器 JavaScript 执行策略",
  "Controls whether the agent can run custom JavaScript to automate complex browser actions.": "控制智能体是否可以运行自定义 JavaScript 来实现复杂的浏览器自动化操作。",
  "Request Review": "请求审查",
  "Actuation Permissions": "操作执行权限",
  "Browser Actuation Rules": "浏览器操作执行规则",
  "Configure allowed and denied URLs for browser actuation.": "配置允许与禁止进行浏览器操作的 URL 地址。",
  "Actuation": "操作执行",

  // === Customizations Tab (自定义扩展) ===
  "Configure default behaviors, skills, and MCP servers.": "配置默认行为策略、技能库及 MCP 服务。",
  "Token Usage": "Token 用量",
  "The breakdown below shows token usage from customizations like skills, rules, and MCP. If the budget is exceeded, large customizations will be truncated automatically.": "下方的明细展示了来自技能、规则及 MCP 等自定义扩展的 Token 占用情况。如果超出预算，大型自定义扩展将被自动截断。",
  "Installed MCP Servers": "已安装的 MCP 服务",
  "Open MCP Config": "打开 MCP 配置",
  "No MCP Servers": "暂无 MCP 服务",
  "You currently don't have any MCP Servers installed.": "您当前尚未安装任何 MCP 服务。",
  "You currently don't have any MCP Servers installed. Add an MCP server above or add a custom one via the MCP Config.": "您当前尚未安装任何 MCP 服务。可在上方添加 MCP 服务，或通过 MCP 配置文件添加自定义服务。",
  "Global": "全局",
  "Workspace": "工作区",

  // === Models & Usage Tab (模型与用量) ===
  "Models & Usage": "模型与用量",
  "Manage your model quota and credits.": "管理您的模型配额与积分。",
  "Plan": "套餐方案",
  "Model Credits": "模型积分",
  "Enable AI Credit Overages": "启用超额 AI 积分计费",
  "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.": "开启后，当模型配额耗尽时，Antigravity 将使用您的 AI 积分来完成模型请求。Antigravity 将始终优先消耗模型配额，然后再使用 AI 积分。",
  "Gemini Models": "Gemini 模型",
  "Claude and GPT models": "Claude 与 GPT 模型",
  "Weekly Limit Remaining": "每周剩余额度",
  "Five Hour Limit Remaining": "5 小时剩余额度",
  "Remaining": "剩余",
  "Quota Remaining": "剩余配额",

  // === Appearance Tab (外观) ===
  "Chat Settings": "对话设置",
  "Verbose Agent Chat": "详细智能体对话输出",
  "Display and preserve intermediate thinking steps.": "显示并保留中间思考过程步骤。",
  "Conversation Width": "对话面板宽度",
  "Configure the maximum width of the conversation panel.": "配置对话面板的最大显示宽度。",
  "Narrow": "窄",
  "Wide": "宽",
  "Select light, dark, or inherit system settings.": "选择浅色、深色或跟随系统设置。",
  "Preset": "预设",
  "Default Light": "默认浅色",
  "Default Dark": "默认深色",
  "Background": "背景色",
  "Foreground": "前景色",
  "Accent": "强调色",
  "浅色主题": "浅色主题",
  "深色主题": "深色主题",

  // === General & Account Navigation / 账户与通用导航 ===
  "Shortcuts": "快捷键",
  "Provide Feedback": "提供反馈",
  "Not in Project": "未归属项目",
  "Conversations": "会话列表",
  "Projects": "项目列表",
  "Scheduled Tasks": "定时任务",
  "Conversation History": "会话历史",
  "+ New Chat": "+ 新建对话",
  "Install IDE": "安装 IDE"
};

for (const [k, v] of Object.entries(newExactEntries)) {
  exact[k] = v;
}

// Additional dynamic patterns for rate limits, times, and budgets
const dynamicPatterns = [
  {
    "regex": "^([\\d\\.]+)% of the customization budget is available\\.$",
    "replacement": "$1% 的自定义扩展预算可用。"
  },
  {
    "regex": "^Show (\\d+) breakdowns?$",
    "replacement": "显示 $1 项明细"
  },
  {
    "regex": "^Hide (\\d+) breakdowns?$",
    "replacement": "隐藏 $1 项明细"
  },
  {
    "regex": "^You have used some of your weekly limit, it will fully refresh in (.+)\\.$",
    "replacement": "您已消耗了部分每周额度，将在 $1 后完全重置刷新。"
  },
  {
    "regex": "^You have used some of your 5 hour limit, it will fully refresh in (.+)\\.$",
    "replacement": "您已消耗了部分 5 小时额度，将在 $1 后完全重置刷新。"
  },
  {
    "regex": "^You have hit your 5-hour limit, so the weekly limit does not currently apply\\. Your 5-hour limit will refresh in (.+)\\.$",
    "replacement": "您已达到 5 小时上限，因此每周额度当前不适用。您的 5 小时额度将在 $1 后重置刷新。"
  },
  {
    "regex": "^You have hit your 5-hour limit, it will refresh in (.+)\\. If on a supported paid plan, you can use AI credits in the interim\\.$",
    "replacement": "您已达到 5 小时上限，将在 $1 后重置刷新。如果使用的是支持的付费套餐，您可以在此期间使用 AI 积分。"
  },
  {
    "regex": "(\\d+) days?, (\\d+) hours?",
    "replacement": "$1 天 $2 小时"
  },
  {
    "regex": "(\\d+) hours?, (\\d+) minutes?",
    "replacement": "$1 小时 $2 分钟"
  },
  {
    "regex": "(\\d+) days?",
    "replacement": "$1 天"
  },
  {
    "regex": "(\\d+) hours?",
    "replacement": "$1 小时"
  },
  {
    "regex": "(\\d+) minutes?",
    "replacement": "$1 分钟"
  },
  {
    "regex": "^(\\d+) files? changed$",
    "replacement": "$1 个文件已修改"
  },
  {
    "regex": "^(\\d+) insertions?\\(\\+\\)$",
    "replacement": "$1 行新增(+)"
  },
  {
    "regex": "^(\\d+) deletions?\\(-\\)$",
    "replacement": "$1 行删除(-)"
  },
  {
    "regex": "^Step (\\d+) of (\\d+)$",
    "replacement": "第 $1 步（共 $2 步）"
  },
  {
    "regex": "^Task (\\d+) running$",
    "replacement": "正在运行任务 $1"
  },
  {
    "regex": "^Saved at (\\d{1,2}:\\d{2}(?::\\d{2})?)$",
    "replacement": "已于 $1 保存"
  },
  {
    "regex": "^(\\d+) active subagents?$",
    "replacement": "$1 个运行中的子智能体"
  },
  {
    "regex": "^Created (\\d+) files?$",
    "replacement": "已创建 $1 个文件"
  },
  {
    "regex": "^Modified (\\d+) files?$",
    "replacement": "已修改 $1 个文件"
  },
  {
    "regex": "^Thinking for (\\d+)s$",
    "replacement": "已思考 $1 秒"
  },
  {
    "regex": "^Stopped after (\\d+) steps?$",
    "replacement": "已在 $1 步后停止"
  }
];

const updatedDict = {
  exact: exact,
  patterns: dynamicPatterns
};

fs.writeFileSync(dictPath, JSON.stringify(updatedDict, null, 2));
console.log('Successfully updated dict/zh-CN.json with', Object.keys(exact).length, 'exact entries and', dynamicPatterns.length, 'patterns.');
