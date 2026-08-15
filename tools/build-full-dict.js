const fs = require('fs');
const path = require('path');

const categorized = JSON.parse(fs.readFileSync(path.join(__dirname, 'categorized_ui.json'), 'utf-8'));
const currentDictPath = path.join(__dirname, '..', 'dict', 'zh-CN.json');
const currentDict = JSON.parse(fs.readFileSync(currentDictPath, 'utf-8'));

const exact = { ...currentDict.exact };

// Comprehensive Dictionary Definitions for Antigravity WebUI
const bulkTranslations = {
  // Sidebar & Navigation
  "Conversation History": "会话历史",
  "Scheduled Tasks": "定时任务",
  "Projects": "项目列表",
  "Conversations": "会话列表",
  "No conversations yet": "暂无会话",
  "CLI Project": "CLI 项目",
  "Install IDE": "安装 IDE",
  "Install IDE Extension": "安装 IDE 插件",
  "No projects yet": "暂无项目",
  "Open Folder": "打开文件夹",
  "Open Workspace": "打开工作区",
  "New Project": "新建项目",
  "Create Project": "创建项目",
  "Recent Projects": "最近项目",
  "Open Recent": "打开最近",
  "Recent Conversations": "最近会话",
  "Clear All History": "清除所有历史",

  // Settings Tabs & Sections
  "Account": "账户",
  "General": "通用",
  "Appearance": "外观",
  "Models": "模型配置",
  "Customizations": "自定义扩展",
  "Browser": "浏览器",
  "App": "应用设置",
  "Shortcuts": "快捷键",
  "Keyboard Shortcuts": "快捷键设置",
  "Provide Feedback": "提供反馈",
  "Not in Project": "未归属项目",
  "Settings": "设置",
  "Preferences": "首选项",
  "User Settings": "用户设置",
  "Workspace Settings": "工作区设置",

  // Settings - General & Execution
  "Execution": "执行策略",
  "Queued Messages": "排队消息",
  "Configure when follow-up messages are sent.": "配置后续追问消息的发送时机。",
  "Queue": "排队等待",
  "Send Immediately": "立即发送",
  "Agent Settings": "智能体设置",
  "Security Preset": "安全预设",
  "Choose a predefined security preset for the agent. This controls terminal auto-execution policy, and file access policy.": "为智能体选择预定义的安全预设，用于控制终端自动执行与文件访问策略。",
  "Learn more about Default": "了解“默认”预设的详情",
  "Default": "默认",
  "Strict": "严格",
  "Relaxed": "宽松",
  "Custom": "自定义",
  "Agent Behavior": "智能体行为",
  "Artifact Review Policy": "产物审查策略",
  "Specifies Agent's behavior when asking for review on artifacts, which are documents it creates to enable a richer conversation experience.": "指定智能体在创建产物文档时请求用户审查与反馈的行为策略。",
  "Always Proceed": "总是直接继续",
  "Ask Before Proceeding": "继续前始终询问",
  "Never Proceed Automatically": "从不自动继续",
  "File Permissions": "文件权限",
  "File Access Rules": "文件访问规则",
  "Configure allowed and denied paths for file reads and writes.": "配置文件读写的允许与禁止路径。",
  "Network Permissions": "网络权限",
  "Network Access Rules": "网络访问规则",
  "Configure allowed and denied URLs for reading.": "配置允许与禁止访问的 URL 规则。",
  "Terminal & Tooling Permissions": "终端与工具权限",
  "Terminal Commands": "终端命令权限",
  "Configure allowed terminal commands.": "配置允许自动执行的终端命令规则。",
  "Commands Outside Sandbox": "沙箱外命令执行",
  "Allow commands outside workspace sandbox": "允许在工作区沙箱外执行命令",
  "Open": "配置 / 打开",
  "Edit": "编辑",
  "Add Rule": "添加规则",
  "Delete Rule": "删除规则",

  // Settings - Appearance
  "Theme": "主题风格",
  "Dark Theme": "深色主题",
  "Light Theme": "浅色主题",
  "System Theme": "跟随系统",
  "Dark": "深色",
  "Light": "浅色",
  "System": "跟随系统",
  "Inherit from System": "继承系统主题",
  "Font Size": "字体大小",
  "Font Family": "字体系列",
  "Line Height": "行高",
  "Zoom Level": "界面缩放",
  "Interface Scale": "界面比例",
  "Color Theme": "颜色主题",

  // Settings - Models
  "Model Selection": "模型选择",
  "Default Model": "默认模型",
  "Active Model": "当前模型",
  "Model Provider": "模型提供商",
  "API Key": "API 密钥",
  "API Key is configured": "API 密钥已配置",
  "Set API Key": "设置 API 密钥",
  "Temperature": "采样温度",
  "Thinking Budget": "思考预算",
  "Thinking Budget (Tokens)": "思考预算 (Tokens)",
  "Max Output Tokens": "最大输出 Token",
  "Context Window": "上下文窗口大小",
  "Rate Limit": "速率限制",
  "Streaming": "流式输出",
  "Enable Thinking Mode": "开启深度思考模式",

  // Settings - Customizations
  "Rules": "规则库",
  "Global Rules": "全局规则",
  "Project Rules": "项目规则",
  "Skills": "技能库",
  "Installed Skills": "已安装技能",
  "Built-in Skills": "内置技能",
  "Custom Skills": "自定义技能",
  "MCP Servers": "MCP 服务",
  "Model Context Protocol Servers": "模型上下文协议 (MCP) 服务",
  "Add MCP Server": "添加 MCP 服务",
  "Sidecars": "伴随服务",
  "Hooks": "钩子函数",
  "Plugins": "插件",
  "Extensions": "扩展插件",

  // Settings - Browser & Automation
  "Browser Automation": "浏览器自动化",
  "Headless Mode": "无头模式",
  "Enable Browser Tool": "启用浏览器工具",
  "Proxy Settings": "代理设置",
  "HTTP Proxy": "HTTP 代理",
  "HTTPS Proxy": "HTTPS 代理",
  "No Proxy": "不使用代理",

  // Settings - App & Updates
  "Auto Update": "自动更新",
  "Automatically download and install updates": "自动下载并安装更新",
  "Check for Updates on Startup": "启动时检查更新",
  "Telemetry & Analytics": "遥测与分析",
  "Help improve the product by sending anonymous usage data": "通过发送匿名使用数据帮助改进产品",
  "Version": "版本信息",
  "About": "关于",
  "About Antigravity": "关于 Antigravity",
  "Release Notes": "发行说明",
  "Check for Updates": "检查更新",
  "Check for Updates...": "检查更新...",
  "Restart to Update": "重启以更新",
  "You are on the latest version": "您当前已是最新版本",

  // Chat & Agent Interaction
  "New Chat": "新建对话",
  "New Conversation": "新建会话",
  "Clear History": "清除历史",
  "Clear Conversation": "清空会话",
  "Delete Conversation": "删除会话",
  "Rename Conversation": "重命名会话",
  "Conversation Name": "会话名称",
  "Implementation Plan": "实施方案",
  "Walkthrough": "完成总结",
  "Artifacts": "产物文档",
  "Artifact": "产物",
  "Thinking": "深度思考中",
  "Thought Process": "思考过程",
  "Thinking Process": "思考流程",
  "Thought": "思考",
  "Proceed": "继续执行",
  "Approve": "批准",
  "Reject": "拒绝",
  "Cancel": "取消",
  "Confirm": "确认",
  "Save": "保存",
  "Save All": "全部保存",
  "Discard": "放弃修改",
  "Discard Changes": "放弃所有更改",
  "Apply": "应用",
  "Accept": "接受",
  "Accept Changes": "接受更改",
  "Reject Changes": "拒绝更改",
  "Retry": "重试",
  "Stop": "停止",
  "Stop Generating": "停止生成",
  "Delete": "删除",
  "Copy": "复制",
  "Copied!": "已复制！",
  "Cut": "剪切",
  "Paste": "粘贴",
  "Select All": "全选",
  "Undo": "撤销",
  "Redo": "重做",
  "Refresh": "刷新",
  "Loading...": "加载中...",
  "Searching...": "正在搜索...",
  "Analyzing...": "正在分析...",
  "Working...": "处理中...",
  "Ready": "就绪",
  "Done": "完成",
  "Failed": "失败",
  "Success": "成功",
  "Error": "错误",
  "Warning": "警告",
  "Info": "提示",
  "Tokens": "Token 统计",
  "Tokens Used": "已用 Token",
  "Conversation ID": "会话 ID",
  "Context": "上下文",
  "Model": "模型",
  "Subagents": "子智能体",
  "Continuous Mode": "持续模式",
  "Planning Mode": "规划模式",
  "Execution Mode": "执行模式",
  "Browse": "浏览",
  "Submit": "提交",
  "Skip": "跳过",
  "Close": "关闭",
  "Back": "返回",
  "Next": "下一步",
  "Finish": "完成",

  // Diff & Editor
  "Working Changes": "工作区变更",
  "Staged Changes": "暂存的更改",
  "Unstaged Changes": "未暂存的更改",
  "Previous Change": "上一处变更",
  "Next Change": "下一处变更",
  "Collapse All": "全部折叠",
  "Expand All": "全部展开",
  "Show Diff": "显示差异对比",
  "Inline Diff": "内联对比",
  "Side by Side Diff": "并排对比",
  "Revert Changes": "撤回修改",
  "Keep Changes": "保留修改",

  // Menu Items
  "File": "文件",
  "Edit": "编辑",
  "View": "视图",
  "Window": "窗口",
  "Help": "帮助",
  "Terminal": "终端",
  "Selection": "选择",
  "Go": "前往",
  "Run": "运行",
  "New Window": "新建窗口",
  "Close Window": "关闭窗口",
  "Toggle Full Screen": "切换全屏",
  "Toggle Developer Tools": "切换开发者工具",
  "Reload Window": "重新加载窗口",
  "Minimize": "最小化",
  "Zoom In": "放大",
  "Zoom Out": "缩小",
  "Reset Zoom": "重置缩放",
  "Docs": "官方文档",
  "Documentation": "官方文档",
  "Report Issue": "报告问题",
  "Feedback": "用户反馈"
};

// Merge into exact
Object.assign(exact, bulkTranslations);

// Also scan categorized items and add smart title translations
let addedCount = 0;
for (const cat of ['settings', 'navigation', 'agent', 'general']) {
  for (const item of categorized[cat]) {
    if (!exact[item]) {
      // If ends with colon
      if (item.endsWith(':') && exact[item.slice(0, -1)]) {
        exact[item] = exact[item.slice(0, -1)] + '：';
        addedCount++;
      }
    }
  }
}

const finalDict = {
  exact,
  patterns: currentDict.patterns
};

fs.writeFileSync(currentDictPath, JSON.stringify(finalDict, null, 2));

console.log(`Total exact dictionary entries: ${Object.keys(exact).length}`);
