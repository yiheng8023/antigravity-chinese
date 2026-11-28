#!/usr/bin/env node

/**
 * Antigravity Chinese Localization CLI
 * Cross-platform patcher and lifecycle manager (Windows / macOS / Linux)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { getUnpackArgs, verifyUnpackedOutput, extractFileFromAsar } = require('./core/asar-unpack');
const { patchSwarmFrames } = require('./core/swarm-frame-patch');
const { installOfficialPluginDescriptionSourceCheck } = require('./core/official-plugin-description-source');

const PROJECT_ROOT = __dirname;
const DICT_PATH = path.join(PROJECT_ROOT, 'dict', 'zh-CN.json');
const RUNTIME_PATH = path.join(PROJECT_ROOT, 'core', 'i18n-runtime.js');
const {
  findVsCodeExtensionDir,
  isVsCodeExtensionPatched,
  installVsCodePatch,
  restoreVsCodePatch
} = require('./core/vscode-patch');

// Platform paths
function getCandidateAsarPaths(platform = os.platform(), homedir = os.homedir()) {

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    return [
      path.join(localAppData, 'Programs', 'antigravity', 'resources', 'app.asar'),
      path.join(programFiles, 'antigravity', 'resources', 'app.asar'),
      path.join(programFiles, 'Google Antigravity', 'resources', 'app.asar'),
      path.join(homedir, 'AppData', 'Roaming', 'antigravity', 'resources', 'app.asar'),
    ];
  } else if (platform === 'darwin') {
    return [
      '/Applications/Antigravity.app/Contents/Resources/app.asar',
      path.join(homedir, 'Applications', 'Antigravity.app', 'Contents', 'Resources', 'app.asar'),
    ];
  } else {
    // Linux
    const applicationsDir = path.join(homedir, 'Applications');
    const portableParents = new Set([
      path.join(applicationsDir, 'Portable'),
      applicationsDir,
      path.dirname(PROJECT_ROOT),
    ]);
    const portableNames = ['Antigravity', 'antigravity', `Antigravity-${process.arch}`];
    return [
      '/opt/antigravity/resources/app.asar',
      '/usr/lib/antigravity/resources/app.asar',
      '/usr/share/antigravity/resources/app.asar',
      path.join(homedir, '.local', 'share', 'antigravity', 'resources', 'app.asar'),
      ...Array.from(portableParents).flatMap(parent =>
        portableNames.map(name => path.join(parent, name, 'resources', 'app.asar'))
      ),
    ];
  }
}

// 冷启动断电与异常中断自愈守卫 (Cold-Boot Crash-Resilient Auto-Healing)
function tryRecoverSwappedAsar(targetAsarPath) {
  if (!targetAsarPath) return false;
  const swapOldPath = path.join(path.dirname(targetAsarPath), 'app.asar.swap-old');
  if (!fs.existsSync(targetAsarPath) && fs.existsSync(swapOldPath)) {
    try {
      fs.renameSync(swapOldPath, targetAsarPath);
      console.log(`🛡️ [冷启动崩溃自愈] 检测到断电/异常中断遗留的暂存文件 ${swapOldPath}，已自动安全复原为 ${targetAsarPath}！`);
      return true;
    } catch (e) {
      try {
        fs.copyFileSync(swapOldPath, targetAsarPath);
        fs.rmSync(swapOldPath, { force: true });
        console.log(`🛡️ [冷启动崩溃自愈] 通过降级复制成功复原 ${targetAsarPath}！`);
        return true;
      } catch (copyErr) {}
    }
  }
  return false;
}

function findAsarPath(customPath) {
  if (customPath) {
    const resolved = path.resolve(customPath);
    const isDirectory = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory();
    const candidates = isDirectory ? [
      path.join(resolved, 'resources', 'app.asar'),
      path.join(resolved, 'app.asar'),
      path.join(resolved, 'Contents', 'Resources', 'app.asar')
    ] : [resolved];
    for (const candidate of candidates) {
      tryRecoverSwappedAsar(candidate);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }

    console.error(`❌ 指定路径未找到 app.asar: ${customPath}`);
    process.exit(1);
  }

  const candidates = getCandidateAsarPaths();
  for (const p of candidates) {
    tryRecoverSwappedAsar(p);
    if (fs.existsSync(p) && fs.statSync(p, { throwIfNoEntry: false })?.isFile()) {
      return p;
    }
  }
  return null;
}

function isProcessRunning() {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      const stdout = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', { encoding: 'utf-8' });
      return stdout.toLowerCase().includes('antigravity.exe');
    } else {
      const stdout = execSync('pgrep -i antigravity || true', { encoding: 'utf-8' });
      return stdout.trim().length > 0;
    }
  } catch (e) {
    return false;
  }
}

function isProtectedEnvironment() {
  return Boolean(
    process.env.ANTIGRAVITY_AGENT ||
    process.env.ANTIGRAVITY_CONVERSATION_ID ||
    process.env.ANTIGRAVITY_AGENTAPI_EXE ||
    process.env.AGY_NO_KILL === '1' ||
    process.env.NODE_ENV === 'test'
  );
}

function confirmCloseClient(appName = 'Antigravity') {
  if (isProtectedEnvironment()) {
    console.warn(`\n🛡️ [安全保护拦截] 当前正运行于 ${appName} 智能体会话/受保护环境中，绝对禁止强杀或关闭宿主客户端！`);
    return false;
  }

  const args = process.argv.slice(2);
  if (args.includes('--force') || args.includes('-f') || args.includes('-y') || args.includes('--yes')) {
    return true;
  }

  if (!process.stdin.isTTY) {
    console.error(`\n⚠️ 检测到 ${appName} 客户端当前正在运行！`);
    console.error(`为保护未保存的工作，安装器已安全暂停。请先手动退出客户端，或附加 --force 参数执行。`);
    return false;
  }

  console.log(`\n⚠️ 检测到 ${appName} 客户端当前正在运行！`);
  console.log(`为避免文件写入冲突并保护您正在进行的对话与未保存工作，请确认是否允许关闭客户端继续？`);
  process.stdout.write(`👉 输入 [y/N] 确认关闭并继续 (默认 N 取消): `);

  try {
    const buffer = Buffer.alloc(1024);
    const bytesRead = fs.readSync(0, buffer, 0, 1024, null);
    const answer = buffer.toString('utf8', 0, bytesRead).trim().toLowerCase();
    if (answer === 'y' || answer === 'yes') {
      return true;
    }
  } catch (e) {}

  return false;
}

function closeAntigravitySafely() {
  // 安全铁律：严禁在 Antigravity 智能体会话内部或显式保护模式下强杀自身宿主进程！
  if (isProtectedEnvironment()) {
    console.warn('🛡️ [安全保护拦截] 检测到当前运行于 Antigravity 智能体会话或受保护环境中，已严正拦截强杀宿主进程，防止会话与客户端崩溃！');
    return false;
  }

  try {
    if (os.platform() === 'win32') {
      execSync('taskkill /F /IM Antigravity.exe', { stdio: 'ignore' });
    } else {
      execSync('pkill -i antigravity || true', { stdio: 'ignore' });
    }
    return true;
  } catch (e) {
    return false;
  }
}

function findAsarExecutableOnPath() {
  const pathEnv = process.env.PATH || process.env.Path || '';
  const dirs = pathEnv.split(path.delimiter).filter(Boolean);
  const names = process.platform === 'win32' ? ['asar.cmd', 'asar.exe', 'asar'] : ['asar'];
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      } catch (_) {}
    }
  }
  return null;
}

function formatAsarExecCommand(subArgs) {
  const localAsarBin = path.join(__dirname, 'node_modules', '.bin', os.platform() === 'win32' ? 'asar.cmd' : 'asar');
  if (fs.existsSync(localAsarBin)) return `"${localAsarBin}" ${subArgs}`;
  const pathAsarBin = findAsarExecutableOnPath();
  if (pathAsarBin) return `"${pathAsarBin}" ${subArgs}`;
  return `npx -y @electron/asar@3.2.14 ${subArgs}`;
}

// 计算 ASAR 内容指纹，用于版本化纯净备份（官方升级后指纹变化即重建基线）
function copyTreeSync(srcPath, dstPath) {
  const st = fs.statSync(srcPath);
  if (!st.isDirectory()) {
    fs.mkdirSync(path.dirname(dstPath), { recursive: true });
    fs.copyFileSync(srcPath, dstPath);
    return;
  }
  fs.mkdirSync(dstPath, { recursive: true });
  for (const entry of fs.readdirSync(srcPath)) {
    copyTreeSync(path.join(srcPath, entry), path.join(dstPath, entry));
  }
}

function getFileIdentity(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    return {
      size: buf.length,
      fp: crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16),
      sha256: crypto.createHash('sha256').update(buf).digest('hex')
    };
  } catch (e) {
    return null;
  }
}

function getAsarFingerprint(asarPath) {
  return getFileIdentity(asarPath)?.fp || null;
}

function ensureAsarTool() {
  try {
    execSync('npx --version', { stdio: 'ignore' });
    return true;
  } catch (e) {
    console.error('❌ 需要系统中安装 Node.js 和 npx 工具。');
    process.exit(1);
  }
}

function getBundleScript() {
  const dictContent = fs.readFileSync(DICT_PATH, 'utf-8');
  const runtimeContent = fs.readFileSync(RUNTIME_PATH, 'utf-8');
  const pluginDescriptions = fs.readFileSync(path.join(PROJECT_ROOT, 'dict/scoped/official-plugin-descriptions.json'), 'utf-8');
  const checkPluginSource = `(${installOfficialPluginDescriptionSourceCheck})(${pluginDescriptions.trim()});`;

  return `
// --- Antigravity Chinese Localization Injection Start ---
(function() {
  try {
    window.__AGY_I18N_DATA__ = ${dictContent.trim()};
    window.__AGY_I18N_DATA__.officialPluginDescriptions = ${pluginDescriptions.trim()};
    ${runtimeContent}
    if (window.top === window) {
      require('electron').webFrame.executeJavaScript(${JSON.stringify(checkPluginSource)}).catch(() => {});
    }
  } catch(e) {
    console.error('[AGY-i18n] Runtime Injection Error:', e);
  }
})();
// --- Antigravity Chinese Localization Injection End ---
`;
}

function patchMenuFile(menuFilePath) {
  if (!fs.existsSync(menuFilePath)) return;
  let content = fs.readFileSync(menuFilePath, 'utf-8');
  
  const replacements = [
    { from: "'New Window'", to: "'新建窗口'" },
    { from: '"New Window"', to: '"新建窗口"' },
    { from: "'Docs'", to: "'官方文档'" },
    { from: '"Docs"', to: '"官方文档"' },
    { from: "'Command Palette'", to: "'命令面板'" },
    { from: '"Command Palette"', to: '"命令面板"' },
    { from: "'Maximize'", to: "'最大化'" },
    { from: '"Maximize"', to: '"最大化"' },
    { from: "'Minimize'", to: "'最小化'" },
    { from: '"Minimize"', to: '"最小化"' },
    { from: "'Close Window'", to: "'关闭窗口'" },
    { from: '"Close Window"', to: '"关闭窗口"' },
    { from: "'Toggle Full Screen'", to: "'切换全屏'" },
    { from: '"Toggle Full Screen"', to: '"切换全屏"' },
    { from: "'Zoom In'", to: "'放大'" },
    { from: '"Zoom In"', to: '"放大"' },
    { from: "'Zoom Out'", to: "'缩小'" },
    { from: '"Zoom Out"', to: '"缩小"' },
    { from: "'Reset Zoom'", to: "'重置缩放'" },
    { from: '"Reset Zoom"', to: '"重置缩放"' },
    { from: "'Toggle Developer Tools'", to: "'切换开发者工具'" },
    { from: '"Toggle Developer Tools"', to: '"切换开发者工具"' },
    { from: 'updater_1.MenuUpdateStep.CheckForUpdates', to: '"检查更新"' },
    { from: "'Connect to WSL'", to: "'连接到 WSL'" },
    { from: '"Connect to WSL"', to: '"连接到 WSL"' },
    { from: "'Reopen Locally'", to: "'在本地重新打开'" },
    { from: '"Reopen Locally"', to: '"在本地重新打开"' },
  ];

  for (const r of replacements) {
    content = content.split(r.from).join(r.to);
  }

  fs.writeFileSync(menuFilePath, content, 'utf-8');
}

function patchIpcHandlersFile(ipcFilePath) {
  if (!fs.existsSync(ipcFilePath)) return;
  let content = fs.readFileSync(ipcFilePath, 'utf-8');
  const replacements = [
    { from: "'Open workspace'", to: "'打开工作区'" },
    { from: '"Open workspace"', to: '"打开工作区"' },
    { from: "'Open workspaces'", to: "'打开多个工作区'" },
    { from: '"Open workspaces"', to: '"打开多个工作区"' },
    { from: "'Folder is on the Windows filesystem'", to: "'文件夹位于 Windows 文件系统上'" },
    { from: '"Folder is on the Windows filesystem"', to: '"文件夹位于 Windows 文件系统上"' },
    { from: "'Select Download Folder'", to: "'选择下载文件夹'" },
    { from: '"Select Download Folder"', to: '"选择下载文件夹"' }
  ];
  for (const r of replacements) {
    content = content.split(r.from).join(r.to);
  }

  // 深度注入：原生右键上下文菜单（Native Context Menu）多语言拦截守卫
  const contextMenuHeader = 'function buildContextMenuTemplate(items, onSelect) {';
  if (content.includes(contextMenuHeader)) {
    // 动态聚合词典中所有的短 UI 标签，实现原生右键菜单全量覆盖
    const baseMenuMap = {
      // 基础编辑与文本操作
      'Cut': '剪切',
      'Copy': '复制',
      'Paste': '粘贴',
      'Select All': '全选',
      'Undo': '撤销',
      'Redo': '重做',

      // 会话与项目上下文
      'Rename': '重命名',
      'Mark Unread': '标记为未读',
      'Mark Read': '标记为已读',
      'Split': '拆分',
      'Fork': '分支',
      'Archive': '归档',
      'Delete': '删除',
      'View Debug': '查看调试信息',
      'Share': '分享',
      'Pin': '置顶',
      'Unpin': '取消置顶',
      'Duplicate': '创建副本',

      // 复制二级子菜单 (Copy Submenu)
      'Conversation Name': '会话名称',
      'Conversation ID': '会话 ID',
      'Project Name': '项目名称',
      'Project ID': '项目 ID',
      'File Path': '文件路径',
      'Relative Path': '相对路径',
      'Branch Name': '分支名称',
      'Commit Hash': '提交哈希',
      'Copy Path': '复制路径',
      'Copy Relative Path': '复制相对路径',
      'Copy Link': '复制链接',
      'Copy Markdown': '复制 Markdown',
      'Copy Content': '复制内容',

      // 拆分二级子菜单 (Split Submenu)
      'Split Right': '向右拆分',
      'Split Down': '向下拆分',
      'Split Up': '向上拆分',
      'Split Left': '向左拆分',
      'Replace With New': '替换为新会话',
      'Replace with New': '替换为新会话',
      'Replace with new': '替换为新会话',
      'Move to Group': '移动到分组',
      'Move to group': '移动到分组',

      // 标签页与窗口管理
      'Close': '关闭',
      'Close Others': '关闭其他',
      'Close to the Right': '关闭右侧',
      'Close Saved': '关闭已保存',
      'Close All': '全部关闭',
      'Open in New Window': '在新窗口中打开',
      'Open in Browser': '在浏览器中打开',
      'Show in File Explorer': '在文件资源管理器中显示',
      'Show in Explorer': '在文件资源管理器中显示',
      'Reveal in File Explorer': '在文件资源管理器中显示',
      'Open in File Explorer': '在文件资源管理器中打开',
      'Show in Finder': '在访达中显示',
      'Reveal in Finder': '在访达中显示',
      'Show in File Manager': '在文件管理器中显示'
    };

    // 尝试融合编译好的 zh-CN 字典短词条
    const mergedMap = {};
    if (fs.existsSync(DICT_PATH)) {
      try {
        const d = JSON.parse(fs.readFileSync(DICT_PATH, 'utf-8'));
        if (d && d.exact) {
          for (const [k, v] of Object.entries(d.exact)) {
            if (k.length > 0 && k.length <= 40 && typeof v === 'string') {
              mergedMap[k] = v;
            }
          }
        }
      } catch (_) {}
    }
    Object.assign(mergedMap, baseMenuMap);

    const injection = `
const __AGY_CONTEXT_MENU_MAP__ = ${JSON.stringify(mergedMap)};
function __agyTranslateContextLabel__(lbl) {
  if (!lbl || typeof lbl !== 'string') return lbl;
  return __AGY_CONTEXT_MENU_MAP__[lbl] || lbl;
}
`;
    // 若已注入过旧版本，先剥离
    const existingInjectionRegex = /\n?const __AGY_CONTEXT_MENU_MAP__ = [\s\S]*?function __agyTranslateContextLabel__[\s\S]*?\n}\n/g;
    if (existingInjectionRegex.test(content)) {
      content = content.replace(existingInjectionRegex, '');
    }
    content = injection + content;
    content = content.split("label: item.label ?? ''").join("label: __agyTranslateContextLabel__(item.label ?? '')");
  }

  fs.writeFileSync(ipcFilePath, content, 'utf-8');
}

function patchIdeWizardFile(wizardFilePath) {
  if (!fs.existsSync(wizardFilePath)) return;
  let content = fs.readFileSync(wizardFilePath, 'utf-8');
  const replacements = [
    { from: 'Welcome to Antigravity', to: '欢迎使用 Antigravity' },
    { from: 'Setting up…', to: '正在准备…' },
    { from: 'Welcome to the new Antigravity!', to: '欢迎体验全新的 Antigravity！' },
    { from: "Antigravity has been redesigned to put agents first with new capabilities. If you'd still like a code editor, you can download it as a separate app named <b>Antigravity IDE</b>.", to: 'Antigravity 经过全面重构，以强大的智能体为核心。如果您仍需要代码编辑器，可下载独立的 <b>Antigravity IDE</b> 应用。' },
    { from: 'Download the Antigravity IDE', to: '下载 Antigravity IDE' },
    { from: 'Explore the new Antigravity', to: '开始探索全新 Antigravity' }
  ];
  for (const r of replacements) {
    content = content.split(r.from).join(r.to);
  }
  fs.writeFileSync(wizardFilePath, content, 'utf-8');
}

function patchUpdaterFile(updaterFilePath) {
  if (!fs.existsSync(updaterFilePath)) return;
  let content = fs.readFileSync(updaterFilePath, 'utf-8');
  const replacements = [
    { from: "title: 'Check for Updates'", to: "title: '检查更新'" },
    { from: 'title: "Check for Updates"', to: 'title: "检查更新"' },
    { from: "message: 'No updates available'", to: "message: '暂无可用更新'" },
    { from: 'message: "No updates available"', to: 'message: "暂无可用更新"' },
    { from: "buttons: ['OK']", to: "buttons: ['确定']" },
    { from: 'buttons: ["OK"]', to: 'buttons: ["确定"]' },
    { from: 'MenuUpdateStep["CheckForUpdates"] = "Check for Updates"', to: 'MenuUpdateStep["CheckForUpdates"] = "检查更新"' },
    { from: 'MenuUpdateStep["CheckingForUpdates"] = "Checking for Updates..."', to: 'MenuUpdateStep["CheckingForUpdates"] = "正在检查更新..."' },
    { from: 'MenuUpdateStep["DownloadingUpdate"] = "Downloading Update..."', to: 'MenuUpdateStep["DownloadingUpdate"] = "正在下载更新..."' },
    { from: 'MenuUpdateStep["RestartToUpdate"] = "Restart to Update"', to: 'MenuUpdateStep["RestartToUpdate"] = "重启以应用更新"' }
  ];
  for (const r of replacements) {
    content = content.split(r.from).join(r.to);
  }
  fs.writeFileSync(updaterFilePath, content, 'utf-8');
}

function patchMainFile(mainFilePath) {
  if (!fs.existsSync(mainFilePath)) return;
  let content = fs.readFileSync(mainFilePath, 'utf-8');

  // 1. 系统托盘静态初始文本与右键菜单项
  content = content.replace(/label:\s*['"]No agents running['"]/g, "label: '无正在运行的智能体'");
  content = content.replace(/label:\s*`Open \$\{([^\}]+)\}`/g, "label: `打开 ${$1}`");
  content = content.replace(/label:\s*['"]Open ['"]\s*\+\s*([a-zA-Z0-9_\.]+\.getName\(\))/g, "label: '打开 ' + $1");
  content = content.replace(/label:\s*['"]Quit['"]/g, "label: '退出'");

  // 2. 原生退出二次确认对话框、错误与启动弹窗
  content = content.replace(/title:\s*['"]Confirm Quit['"]/g, "title: '确认退出'");
  content = content.replace(/message:\s*['"]Are you sure you want to quit\?['"]/g, "message: '您确定要退出吗？'");
  content = content.replace(/detail:\s*['"]There may be agents or background tasks running\.['"]/g, "detail: '可能仍有正在运行的智能体或后台任务。'");
  content = content.replace(/buttons:\s*\[\s*['"]Cancel['"]\s*,\s*['"]Quit['"]\s*\]/g, "buttons: ['取消', '退出']");
  content = content.replace(/['"]Binary not found['"]/g, "'未找到二进制文件'");
  content = content.replace(/['"]Startup failed['"]/g, "'启动失败'");

  // 3. macOS dock 菜单支持
  content = content.replace(/label:\s*['"]New Window['"]/g, "label: '新建窗口'");

  // 4. WSL 弹窗与系统提示
  content = content.replace(/title:\s*['"]WSL distro not found['"]/g, "title: '未找到 WSL 发行版'");
  content = content.replace(/['"]WSL distro not found['"]/g, "'未找到 WSL 发行版'");
  content = content.replace(/The WSL distro \\?"\$\{WSL_DISTRO\}\\?" is no longer installed\./g, 'WSL 发行版“${WSL_DISTRO}”已不再安装。');
  content = content.replace(/['"]Antigravity opened on Windows instead\.['"]/g, "'Antigravity 已改为在 Windows 本地打开。'");

  content = patchSwarmFrames(content);
  fs.writeFileSync(mainFilePath, content, 'utf-8');
}

function patchWslFile(wslFilePath) {
  if (!fs.existsSync(wslFilePath)) return;
  let content = fs.readFileSync(wslFilePath, 'utf-8');
  content = content.replace(/This folder is on the Windows filesystem\. Accessing it from WSL \(via \/mnt\) can be slow — for best performance keep projects inside the WSL filesystem\./g, '此文件夹位于 Windows 文件系统上。从 WSL 访问该目录（通过 /mnt）可能会较慢 —— 为获得最佳性能，建议将项目保留在 WSL 文件系统内。');
  content = content.replace(/This location cannot be opened in WSL:/g, '此位置无法在 WSL 中打开：');
  content = content.replace(/Downloading the Antigravity binary(?:\u2026|\\u2026|\.{3})/g, '正在下载 Antigravity 二进制组件…');
  content = content.replace(/Installing into \$\{distro\}(?:\u2026|\\u2026|\.{3})/g, '正在安装至 ${distro}…');
  fs.writeFileSync(wslFilePath, content, 'utf-8');
}

function patchProvisionSplashFile(splashFilePath) {
  if (!fs.existsSync(splashFilePath)) return;
  let content = fs.readFileSync(splashFilePath, 'utf-8');
  content = content.replace(/Setting up WSL:\s*\$\{escapeHtml\(distro\)\}/g, '正在准备 WSL 环境：${escapeHtml(distro)}');
  fs.writeFileSync(splashFilePath, content, 'utf-8');
}

function patchTrayFile(trayFilePath) {
  if (!fs.existsSync(trayFilePath)) return;
  let content = fs.readFileSync(trayFilePath, 'utf-8');

  // 动态更新运行中智能体计数文本 (例如 "No agents running", "1 agent running", "2 agents running")
  const dynamicRegex = /\(count\s*>\s*0\s*\?\s*`\$\{count\}`\s*:\s*['"]No['"]\)\s*\+\s*['"] agent['"]\s*\+\s*\(count\s*===\s*1\s*\?\s*['"]['"]\s*:\s*['"]s['"]\)\s*\+\s*['"] running['"]/g;
  if (dynamicRegex.test(content)) {
    content = content.replace(dynamicRegex, "(count > 0 ? `${count} 个正在运行的智能体` : '无正在运行的智能体')");
  } else {
    // 兼容其他格式变体
    content = content.split("' agent' + (count === 1 ? '' : 's') + ' running'").join("' 个正在运行的智能体'");
    content = content.split('" agent" + (count === 1 ? "" : "s") + " running"').join('" 个正在运行的智能体"');
    content = content.split("'No agents running'").join("'无正在运行的智能体'");
    content = content.split('"No agents running"').join('"无正在运行的智能体"');
  }

  fs.writeFileSync(trayFilePath, content, 'utf-8');
}

const MIN_NODE_VERSION = 18;

function runPreflightCheck(customPath) {
  const checks = [];
  let allPassed = true;

  // 1. Node.js 运行时最低版本检测 (支持所有更高版本，绝不限制上限)
  const nodeVerStr = process.version.replace(/^v/, '');
  const majorVer = parseInt(nodeVerStr.split('.')[0], 10);
  const nodePassed = !isNaN(majorVer) && majorVer >= MIN_NODE_VERSION;
  checks.push({
    name: 'Node.js 运行时版本',
    detail: `当前: v${nodeVerStr} (要求: >= v${MIN_NODE_VERSION}.0.0)`,
    passed: nodePassed,
    critical: true
  });
  if (!nodePassed) allPassed = false;

  // 2. ASAR / NPX 打包工具可用性检查
  const localAsarBin = path.join(__dirname, 'node_modules', '.bin', os.platform() === 'win32' ? 'asar.cmd' : 'asar');
  const hasAsarCli = fs.existsSync(localAsarBin) || !!findAsarExecutableOnPath();
  let npxPassed = false;
  try {
    execSync('npx --version', { stdio: 'ignore' });
    npxPassed = true;
  } catch (e) {}
  const toolReady = hasAsarCli || npxPassed;
  checks.push({
    name: 'ASAR/NPX 资源解构工具',
    detail: hasAsarCli ? '已就绪 (本地/PATH asar)' : (npxPassed ? '已就绪 (npx)' : '未检测到 asar 或 npx 工具 (请安装 Node.js 环境)'),
    passed: toolReady,
    critical: true
  });
  if (!toolReady) allPassed = false;

  // 3. 客户端安装与 asar 路径探测
  const asarPath = findAsarPath(customPath);
  const installPassed = !!asarPath;
  checks.push({
    name: 'Antigravity 客户端安装状态',
    detail: installPassed ? `已找到 (${asarPath})` : '未自动探测到客户端安装路径',
    passed: installPassed,
    critical: true
  });
  if (!installPassed) allPassed = false;

  // 4. 进程占用与文件锁状态
  const running = isProcessRunning();
  checks.push({
    name: '进程占用与文件锁状态',
    detail: running ? '运行中 (安装器将自动安全释放文件锁)' : '已就绪 (未运行，无文件锁占用)',
    passed: true,
    critical: false
  });

  return {
    allPassed,
    asarPath,
    checks
  };
}

function writeJsonFileAtomic(targetPath, data, fsOps = fs) {
  const writeFn = typeof fsOps.writeFileSync === 'function' ? fsOps.writeFileSync : fs.writeFileSync;
  const renameFn = typeof fsOps.renameSync === 'function' ? fsOps.renameSync : fs.renameSync;
  const tmpPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  try {
    writeFn(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    renameFn(tmpPath, targetPath);
  } catch (err) {
    try { if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { force: true }); } catch (_) {}
    throw err;
  }
}

/**
 * 以严格非覆盖语义将已验证候选文件 srcPath 置入 destPath，全程绑定同一候选身份 expectedId：
 * - 优先使用内核原子 linkSync（目标已存在必返 EEXIST）；
 * - 不支持硬链接（EXDEV/ENOTSUP/ENOSYS/EPERM/EACCES）时，使用内核单系统调用
 *   O_WRONLY | O_CREAT | O_EXCL 独占创建写入（杜绝 existsSync + renameSync 两步窗口覆盖新包）。
 */
function placeFileNoOverwrite(srcPath, destPath, expectedId, fsOps = fs) {
  const srcId = getFileIdentity(srcPath);
  if (!srcId) {
    const missingErr = new Error(`Candidate file missing: ${srcPath}`);
    missingErr.code = 'ENOENT';
    throw missingErr;
  }
  if (expectedId && srcId.sha256 !== expectedId.sha256) {
    const mismatchErr = new Error(`Candidate identity mismatch before placement: ${srcPath}`);
    mismatchErr.code = 'ERR_CANDIDATE_MISMATCH';
    throw mismatchErr;
  }

  const linkFn = typeof fsOps.linkSync === 'function' ? fsOps.linkSync : fs.linkSync;
  const hardLinkAllowed = fsOps.linkSync !== false && typeof linkFn === 'function';
  if (hardLinkAllowed) {
    try {
      linkFn(srcPath, destPath);
      try { fs.rmSync(srcPath, { force: true }); } catch (_) {}
      return srcId.sha256;
    } catch (linkErr) {
      if (linkErr && linkErr.code === 'EEXIST') throw linkErr;
      if (!linkErr || !['EXDEV', 'ENOTSUP', 'ENOSYS', 'EPERM', 'EACCES'].includes(linkErr.code)) {
        throw linkErr;
      }
    }
  }

  const payload = fs.readFileSync(srcPath);
  const payloadSha = crypto.createHash('sha256').update(payload).digest('hex');
  if (payloadSha !== srcId.sha256 || (expectedId && payloadSha !== expectedId.sha256)) {
    const mismatchErr = new Error(`Candidate changed before exclusive write: ${srcPath}`);
    mismatchErr.code = 'ERR_CANDIDATE_MISMATCH';
    throw mismatchErr;
  }

  const openFn = typeof fsOps.openSync === 'function' ? fsOps.openSync : fs.openSync;
  const writeFn = typeof fsOps.writeSync === 'function' ? fsOps.writeSync : fs.writeSync;
  const closeFn = typeof fsOps.closeSync === 'function' ? fsOps.closeSync : fs.closeSync;
  const exclFlags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL;
  const fd = openFn(destPath, exclFlags, 0o644);
  try {
    let written = 0;
    while (written < payload.length) {
      const n = writeFn(fd, payload, written, payload.length - written, null);
      if (typeof n !== 'number' || n <= 0) break;
      written += n;
    }
    if (written !== payload.length) {
      const ioErr = new Error(`Short exclusive write to ${destPath}: ${written}/${payload.length}`);
      ioErr.code = 'EIO';
      throw ioErr;
    }
    try { fs.fsyncSync(fd); } catch (_) {}
  } catch (writeErr) {
    try { closeFn(fd); } catch (_) {}
    // 仅当目标确实是本次尚未写完的半截前缀时清理，绝不误删并发到达的其他新包
    try {
      if (fs.existsSync(destPath)) {
        const diskBuf = fs.readFileSync(destPath);
        if (diskBuf.length <= payload.length) {
          const diskSha = crypto.createHash('sha256').update(diskBuf).digest('hex');
          const prefixSha = crypto.createHash('sha256').update(payload.subarray(0, diskBuf.length)).digest('hex');
          if (diskSha === prefixSha) fs.rmSync(destPath, { force: true });
        }
      }
    } catch (_) {}
    throw writeErr;
  }
  closeFn(fd);
  try { fs.rmSync(srcPath, { force: true }); } catch (_) {}
  return payloadSha;
}

/**
 * 统一的跨过程 ASAR + 元数据原子提交事务引擎：
 * - 来源校验、移走原包后身份复核、候选锁定置入、正式元数据提交、回滚及暂存清理全部绑定同一候选身份；
 * - 验证正式路径之后、移走原包之前若官方新版到达，移走后立即检出并将官方新版无覆盖归位，绝不发布旧补丁；
 * - 回滚时严格核验目标归属与身份，绝不误删或覆盖上游新版本。
 */
function commitCandidateSwap({
  asarPath,
  swapOldAsar,
  metaPath,
  candidateWorkPath,
  sourceId,
  candidateId,
  restoreTargetPath,
  stagedAsar = null,
  stagedMetaPath = null,
  upstreamConflictStatus = 'aborted_upstream_update',
  maxAttempts = 5,
  retryDelayMs = 400,
  fsOps = fs,
  beforeSwapAttempt = null,
  onBeforeSwapAttempt = null,
  onBeforePlacePatched = null,
  onBeforeWriteMeta = null
}) {
  const renameFn = typeof fsOps.renameSync === 'function' ? fsOps.renameSync : fs.renameSync;
  let swappedOld = false;
  let placedPatched = false;
  let placedSha256 = null;
  let lastError = null;
  let upstreamAbort = null;

  const isForeignFile = (id) => !!id &&
    id.sha256 !== sourceId.sha256 &&
    id.sha256 !== candidateId.sha256 &&
    (!placedSha256 || id.sha256 !== placedSha256);

  const cleanupStagedOwnedByCandidate = (onlyIfMatched) => {
    const liveAsarFp = getFileIdentity(asarPath)?.fp || null;
    if (stagedMetaPath && fs.existsSync(stagedMetaPath)) {
      let removeMeta = !onlyIfMatched;
      try {
        const sm = JSON.parse(fs.readFileSync(stagedMetaPath, 'utf8'));
        const matchesThisRun = sm && sm.sourceFingerprint === sourceId.fp && sm.stagedFingerprint === candidateId.fp;
        const freshForLive = liveAsarFp && sm && sm.sourceFingerprint === liveAsarFp;
        if (onlyIfMatched ? matchesThisRun : !freshForLive) removeMeta = true;
        if (onlyIfMatched && !matchesThisRun) removeMeta = false;
      } catch (_) {}
      if (removeMeta) {
        try { fs.rmSync(stagedMetaPath, { force: true }); } catch (_) {}
      }
    }
    if (stagedAsar && fs.existsSync(stagedAsar)) {
      const sId = getFileIdentity(stagedAsar);
      if (sId && sId.sha256 === candidateId.sha256) {
        try { fs.rmSync(stagedAsar, { force: true }); } catch (_) {}
      } else if (!onlyIfMatched) {
        // stale 场景下若无与之匹配的新鲜 stagedMeta，也可清理与旧 candidate 同指纹的过期 staged
        const hasFreshMeta = stagedMetaPath && fs.existsSync(stagedMetaPath);
        if (!hasFreshMeta && sId && sId.fp === candidateId.fp) {
          try { fs.rmSync(stagedAsar, { force: true }); } catch (_) {}
        }
      }
    }
  };

  const finalizeUpstreamPreserved = (reasonCode) => {
    if (fs.existsSync(candidateWorkPath)) {
      try { fs.rmSync(candidateWorkPath, { force: true }); } catch (_) {}
    }
    if (restoreTargetPath && restoreTargetPath !== stagedAsar && fs.existsSync(restoreTargetPath)) {
      try { fs.rmSync(restoreTargetPath, { force: true }); } catch (_) {}
    }
    // 只有确认正式路径已被外部文件占据时，才安全清理确认属于旧来源的 swapOldAsar
    if (swappedOld && fs.existsSync(asarPath) && fs.existsSync(swapOldAsar)) {
      const swapId = getFileIdentity(swapOldAsar);
      if (!swapId || swapId.sha256 === sourceId.sha256 || isForeignFile(getFileIdentity(asarPath))) {
        try { fs.rmSync(swapOldAsar, { force: true }); } catch (_) {}
      }
    }
    cleanupStagedOwnedByCandidate(false);
    return { status: upstreamConflictStatus, reasonCode, sourceFingerprint: sourceId.fp, rollbackErrors: [] };
  };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (typeof onBeforeSwapAttempt === 'function') {
      onBeforeSwapAttempt({ attempt, asarPath, sourceFingerprint: sourceId.fp });
    }
    if (!swappedOld && typeof beforeSwapAttempt === 'function') {
      const preResult = beforeSwapAttempt();
      if (preResult === 'stale') {
        return { status: 'stale', rollbackErrors: [] };
      }
    }
    if (!swappedOld) {
      const livePre = getFileIdentity(asarPath);
      if (!livePre || livePre.sha256 !== sourceId.sha256) {
        return finalizeUpstreamPreserved('UPSTREAM_UPDATED_BEFORE_SWAP');
      }
    }
    if (swappedOld && !placedPatched && fs.existsSync(asarPath)) {
      return finalizeUpstreamPreserved('UPSTREAM_UPDATED_BETWEEN_RENAMES');
    }

    try {
      if (!swappedOld) {
        if (fs.existsSync(swapOldAsar)) fs.rmSync(swapOldAsar, { force: true });
        renameFn(asarPath, swapOldAsar);
        swappedOld = true;

        // 移走后立刻核验：实际移走的必须严格等于本次验证过的 sourceId；
        // 若“验证 -> 移走”窗口内官方刚完成更新，实际被移走的是新版 B，立即无覆盖放回正式路径并中止！
        const movedId = getFileIdentity(swapOldAsar);
        if (!movedId || movedId.sha256 !== sourceId.sha256) {
          if (fs.existsSync(asarPath)) {
            return finalizeUpstreamPreserved('UPSTREAM_UPDATED_RIGHT_AFTER_MOVE');
          }
          if (movedId) {
            try {
              placeFileNoOverwrite(swapOldAsar, asarPath, movedId, fsOps);
              swappedOld = false;
              return finalizeUpstreamPreserved('RESTORED_MOVED_UPSTREAM_PACKAGE');
            } catch (restoreMovedErr) {
              if (restoreMovedErr && restoreMovedErr.code === 'EEXIST') {
                return finalizeUpstreamPreserved('SUPERSEDED_MOVED_UPSTREAM_PACKAGE');
              }
              lastError = restoreMovedErr;
              return {
                status: 'error',
                error: restoreMovedErr,
                rollbackErrors: [{ step: 'restore_moved_upstream', from: swapOldAsar, to: asarPath, error: restoreMovedErr }],
                recovery: {
                  asarExists: fs.existsSync(asarPath),
                  swapOldExists: fs.existsSync(swapOldAsar),
                  stagedExists: stagedAsar ? fs.existsSync(stagedAsar) : false,
                  stagedMetaExists: stagedMetaPath ? fs.existsSync(stagedMetaPath) : false,
                  tempNewExists: !stagedAsar && restoreTargetPath ? fs.existsSync(restoreTargetPath) : false,
                  originalFileLocation: fs.existsSync(swapOldAsar) ? swapOldAsar : null
                }
              };
            }
          }
          return finalizeUpstreamPreserved('MOVED_SOURCE_MISSING');
        }
      }

      if (!placedPatched) {
        if (typeof onBeforePlacePatched === 'function') {
          onBeforePlacePatched({ attempt, asarPath, swapOldAsar, candidateWorkPath, stagedAsar });
        }
        if (fs.existsSync(asarPath)) {
          return finalizeUpstreamPreserved('UPSTREAM_ARRIVED_BEFORE_PLACE');
        }
        placedSha256 = placeFileNoOverwrite(candidateWorkPath, asarPath, candidateId, fsOps);
        placedPatched = true;
        // 若 stagedAsar 与本候选内容完全一致则原子认领消费；若另一并发过程已将其更新为别的内容，保留外部新 staged
        if (stagedAsar && fs.existsSync(stagedAsar) && getFileIdentity(stagedAsar)?.sha256 === candidateId.sha256) {
          try { fs.rmSync(stagedAsar, { force: true }); } catch (_) {}
        }
      }

      if (typeof onBeforeWriteMeta === 'function') {
        onBeforeWriteMeta(asarPath);
      }
      const livePlacedId = getFileIdentity(asarPath);
      if (!livePlacedId || livePlacedId.sha256 !== candidateId.sha256) {
        upstreamAbort = 'UPSTREAM_REPLACED_PLACED_ASAR';
        break;
      }

      writeJsonFileAtomic(metaPath, {
        patched: true,
        patchedFingerprint: candidateId.fp,
        patchedSha256: candidateId.sha256,
        sourceFingerprint: sourceId.fp,
        timestamp: Date.now()
      }, fsOps);

      // 仅在全部原子提交成功后，清理属于本轮的回滚备份与匹配候选身份的残留 staged
      if (fs.existsSync(swapOldAsar) && getFileIdentity(swapOldAsar)?.sha256 === sourceId.sha256) {
        try { fs.rmSync(swapOldAsar, { force: true, maxRetries: 6, retryDelay: 50 }); } catch (_) {}
      }
      if (fs.existsSync(candidateWorkPath)) {
        try { fs.rmSync(candidateWorkPath, { force: true }); } catch (_) {}
      }
      cleanupStagedOwnedByCandidate(true);
      return { status: 'applied', rollbackErrors: [] };
    } catch (err) {
      if (err && err.code === 'EEXIST') {
        upstreamAbort = 'UPSTREAM_EEXIST_ON_PLACE';
        break;
      }
      if (swappedOld && !placedPatched && fs.existsSync(asarPath)) {
        upstreamAbort = 'UPSTREAM_ON_RETRY_GAP';
        break;
      }
      if (placedPatched && fs.existsSync(asarPath) && isForeignFile(getFileIdentity(asarPath))) {
        upstreamAbort = 'UPSTREAM_REPLACED_ON_META_FAIL';
        break;
      }
      lastError = err;
      const isLockErr = err && (err.code === 'EPERM' || err.code === 'EBUSY');
      if (isLockErr && attempt < maxAttempts - 1) {
        if (retryDelayMs > 0) {
          try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, retryDelayMs); } catch (_) {}
        }
        continue;
      }
      break;
    }
  }

  if (upstreamAbort) {
    return finalizeUpstreamPreserved(upstreamAbort);
  }

  // 严格按身份与所有权执行回滚
  const rollbackErrors = [];
  if (placedPatched) {
    const liveId = getFileIdentity(asarPath);
    if (liveId && isForeignFile(liveId)) {
      return finalizeUpstreamPreserved('UPSTREAM_UPDATED_DURING_ROLLBACK');
    }
    if (liveId && liveId.sha256 === candidateId.sha256) {
      try {
        if (restoreTargetPath === stagedAsar && stagedAsar) {
          if (!fs.existsSync(stagedAsar)) {
            renameFn(asarPath, stagedAsar);
          } else {
            // 并发已写入新版 staged 时不动外部新文件，把当前已置入但未提交的补丁撤回私有工作区
            if (fs.existsSync(candidateWorkPath)) fs.rmSync(candidateWorkPath, { force: true });
            renameFn(asarPath, candidateWorkPath);
          }
        } else if (restoreTargetPath) {
          if (fs.existsSync(restoreTargetPath)) fs.rmSync(restoreTargetPath, { force: true });
          renameFn(asarPath, restoreTargetPath);
        } else {
          fs.rmSync(asarPath, { force: true });
        }
        placedPatched = false;
      } catch (rbErr1) {
        rollbackErrors.push({
          step: restoreTargetPath === stagedAsar ? 'restore_staged' : 'restore_patched',
          from: asarPath,
          to: restoreTargetPath || candidateWorkPath,
          error: rbErr1
        });
      }
    } else if (!fs.existsSync(asarPath)) {
      placedPatched = false;
    }
  }

  if (swappedOld && !placedPatched) {
    if (fs.existsSync(asarPath)) {
      const liveId = getFileIdentity(asarPath);
      if (liveId && liveId.sha256 !== sourceId.sha256) {
        return finalizeUpstreamPreserved('UPSTREAM_UPDATED_BEFORE_RESTORE');
      }
      swappedOld = false;
    } else if (fs.existsSync(swapOldAsar)) {
      const swapId = getFileIdentity(swapOldAsar);
      if (swapId && swapId.sha256 !== sourceId.sha256) {
        // 万一 swapOldAsar 装的是外部更新文件而非旧原包，无条件保留回正式路径
        try {
          placeFileNoOverwrite(swapOldAsar, asarPath, swapId, fsOps);
          return finalizeUpstreamPreserved('RESTORED_UNEXPECTED_SWAP_FILE');
        } catch (rbUnexpectedErr) {
          if (rbUnexpectedErr && rbUnexpectedErr.code === 'EEXIST') {
            return finalizeUpstreamPreserved('UPSTREAM_EEXIST_ON_UNEXPECTED_RESTORE');
          }
          rollbackErrors.push({ step: 'restore_original', from: swapOldAsar, to: asarPath, error: rbUnexpectedErr });
        }
      } else if (swapId) {
        try {
          placeFileNoOverwrite(swapOldAsar, asarPath, sourceId, fsOps);
          swappedOld = false;
        } catch (rbErr2) {
          if (rbErr2 && rbErr2.code === 'EEXIST') {
            return finalizeUpstreamPreserved('UPSTREAM_UPDATED_ON_RESTORE');
          }
          rollbackErrors.push({ step: 'restore_original', from: swapOldAsar, to: asarPath, error: rbErr2 });
        }
      }
    }
  }

  const recovery = {
    asarExists: fs.existsSync(asarPath),
    swapOldExists: fs.existsSync(swapOldAsar),
    stagedExists: stagedAsar ? fs.existsSync(stagedAsar) : false,
    stagedMetaExists: stagedMetaPath ? fs.existsSync(stagedMetaPath) : false,
    tempNewExists: !stagedAsar && restoreTargetPath ? fs.existsSync(restoreTargetPath) : false,
    originalFileLocation: (!swappedOld && fs.existsSync(asarPath) && getFileIdentity(asarPath)?.sha256 === sourceId.sha256)
      ? asarPath
      : (fs.existsSync(swapOldAsar) ? swapOldAsar : null)
  };
  return { status: 'error', error: lastError, rollbackErrors, recovery };
}

function install(customPath, options = {}) {
  console.log('🔍 [1/5] 正在执行前置环境全维健康预检 (Pre-flight Checks)...');
  const preflight = runPreflightCheck(customPath);
  for (const c of preflight.checks) {
    const icon = c.passed ? '✅' : (c.critical ? '❌' : '⚠️');
    console.log(`   ${icon} ${c.name}: ${c.detail}`);
  }

  if (!preflight.allPassed) {
    console.error('\n❌ 前置条件检查未通过，安装中止。请根据上方提示排查环境。');
    process.exit(1);
  }

  const asarPath = preflight.asarPath;

  // 只有在未指定 customPath（即针对当前本机默认宿主安装）时，才检测并征求用户同意后安全退出客户端
  if (!customPath && isProcessRunning()) {
    if (isProtectedEnvironment()) {
      console.log('\n🛡️ [智能体会话无损预注入模式] 检测到当前运行于 Antigravity 会话内部，绝不强关宿主，将预构建汉化包并挂载退出自动生效守护...');
    } else {
      const shouldClose = confirmCloseClient('Antigravity');
      if (!shouldClose) {
        console.log('\nℹ️ 已安全取消安装。请在保存工作并退出 Antigravity 客户端后重新执行。');
        process.exit(0);
      }
      console.log('\n🔄 正在安全退出客户端以释放资源写入锁...');
      closeAntigravitySafely();
    }
  }

  const resourcesDir = path.dirname(asarPath);
  const backupPath = path.join(resourcesDir, 'app.asar.bak');
  const backupFpPath = path.join(resourcesDir, 'app.asar.bak.fingerprint');
  const tempExtractDir = path.join(resourcesDir, '__asar_temp_unpack__');
  const tempSnapshotDir = path.join(resourcesDir, '__asar_source_snapshot__');
  const tempSourceSnapshot = path.join(tempSnapshotDir, 'app.asar');
  const tempSnapshotUnpacked = tempSourceSnapshot + '.unpacked';

  const cleanupTempArtifacts = () => {
    for (const dir of [tempExtractDir]) {
      if (fs.existsSync(dir)) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
      }
    }
    if (fs.existsSync(tempSnapshotUnpacked)) {
      try {
        const st = fs.lstatSync(tempSnapshotUnpacked);
        if (st.isSymbolicLink()) fs.unlinkSync(tempSnapshotUnpacked);
        else fs.rmSync(tempSnapshotUnpacked, { recursive: true, force: true });
      } catch (_) {}
    }
    if (fs.existsSync(tempSnapshotDir)) {
      try { fs.rmSync(tempSnapshotDir, { recursive: true, force: true }); } catch (_) {}
    }
  };

  cleanupTempArtifacts();
  fs.mkdirSync(tempSnapshotDir, { recursive: true });
  fs.copyFileSync(asarPath, tempSourceSnapshot);
  const origUnpacked = asarPath + '.unpacked';
  if (fs.existsSync(origUnpacked)) {
    try {
      fs.symlinkSync(origUnpacked, tempSnapshotUnpacked, os.platform() === 'win32' ? 'junction' : 'dir');
    } catch (_) {
      copyTreeSync(origUnpacked, tempSnapshotUnpacked);
    }
  }

  // 1. Backup (严格判据：基于本次实际解包的原包快照校验与备份，并关联正式目录补丁元数据防止 >30MiB 大包误判覆盖 .bak)
  console.log('📦 [2/5] 检查安全备份...');
  const isPatched = isAsarPatched(tempSourceSnapshot, { metaDir: resourcesDir });
  const sourceId = getFileIdentity(tempSourceSnapshot);
  const currentFp = sourceId ? sourceId.fp : null;
  let prevFp = null;
  if (fs.existsSync(backupFpPath)) {
    try { prevFp = fs.readFileSync(backupFpPath, 'utf8').trim(); } catch (e) {}
  }

  if (!isPatched) {
    // 当前确认为官方原生未打补丁版本：指纹变动即代表官方发版更新，立即刷新纯净基准备份
    if (!fs.existsSync(backupPath) || currentFp !== prevFp) {
      if (fs.existsSync(backupPath)) fs.rmSync(backupPath, { force: true });
      fs.copyFileSync(tempSourceSnapshot, backupPath);
      fs.writeFileSync(backupFpPath, String(currentFp), 'utf8');
      console.log(`✅ 已创建当前官方纯净版本基准备份: ${backupPath} (fingerprint ${currentFp})`);
    } else {
      console.log(`ℹ️ 官方基准备份已是最新 (fingerprint ${currentFp})，跳过重复备份`);
    }
  } else {
    // 当前已打补丁：绝对禁止用已打补丁的文件覆盖/破坏纯净基准备份
    if (fs.existsSync(backupPath)) {
      console.log(`ℹ️ 检测到当前已处于汉化状态，安全保留既有官方纯净基准备份 (${backupPath})`);
    } else {
      console.log(`⚠️ 警告: 当前 ASAR 已包含补丁且无历史纯净备份，跳过基线覆盖以防二次污染`);
    }
  }

  // 2. Extract (严格解包同一份快照字节)
  console.log('⚙️ [3/5] 正在解构资源包 (ASAR)...');
  if (fs.existsSync(tempExtractDir)) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }

  try {
    const extractCmd = formatAsarExecCommand(`extract "${tempSourceSnapshot}" "${tempExtractDir}"`);
    execSync(extractCmd, { stdio: 'inherit' });
    if (typeof options.onAfterExtract === 'function') {
      options.onAfterExtract({ asarPath, tempExtractDir, sourceFingerprint: currentFp });
    }
  } catch (err) {
    cleanupTempArtifacts();
    console.error('❌ 解包 app.asar 失败:', err.message);
    if (options.throwOnConflict) throw err;
    process.exit(1);
  }

  // 3. Patch Preload & Menu
  console.log('💉 [4/5] 正在注入汉化引擎与词库...');
  const preloadPath = path.join(tempExtractDir, 'dist', 'preload.js');
  const menuPath = path.join(tempExtractDir, 'dist', 'menu.js');

  if (!fs.existsSync(preloadPath)) {
    console.error(`❌ 未找到 preload 脚本: ${preloadPath}`);
    process.exit(1);
  }

  const bundleScript = getBundleScript();
  let preloadContent = fs.readFileSync(preloadPath, 'utf-8');

  // Check if already patched
  if (preloadContent.includes('Antigravity Chinese Localization Injection')) {
    // Remove the two separators and final newline owned by getBundleScript(),
    // preserving any original trailing newline instead of accumulating blanks.
    const regex = /(?:\r?\n){0,2}\/\/ --- Antigravity Chinese Localization Injection Start ---[\s\S]*?\/\/ --- Antigravity Chinese Localization Injection End ---(?:\r?\n)?/g;
    preloadContent = preloadContent.replace(regex, '');
  }

  preloadContent += '\n' + bundleScript;
  fs.writeFileSync(preloadPath, preloadContent, 'utf-8');

  if (fs.existsSync(menuPath)) {
    patchMenuFile(menuPath);
  }

  const ipcPath = path.join(tempExtractDir, 'dist', 'ipcHandlers.js');
  if (fs.existsSync(ipcPath)) {
    patchIpcHandlersFile(ipcPath);
  }

  const wizardHtmlPath = path.join(tempExtractDir, 'dist', 'ideInstall', 'wizardHtml.js');
  if (fs.existsSync(wizardHtmlPath)) {
    patchIdeWizardFile(wizardHtmlPath);
  }

  const updaterPath = path.join(tempExtractDir, 'dist', 'updater.js');
  if (fs.existsSync(updaterPath)) {
    patchUpdaterFile(updaterPath);
  }

  const mainPath = path.join(tempExtractDir, 'dist', 'main.js');
  if (fs.existsSync(mainPath)) {
    patchMainFile(mainPath);
  }

  const trayPath = path.join(tempExtractDir, 'dist', 'tray.js');
  if (fs.existsSync(trayPath)) {
    patchTrayFile(trayPath);
  }

  const wslPath = path.join(tempExtractDir, 'dist', 'wsl.js');
  if (fs.existsSync(wslPath)) {
    patchWslFile(wslPath);
  }

  const splashPath = path.join(tempExtractDir, 'dist', 'provisionSplash.js');
  if (fs.existsSync(splashPath)) {
    patchProvisionSplashFile(splashPath);
  }

  // 4. Pack back
  console.log('🔄 [5/5] 正在重构并应用补丁...');
  const tempNewAsar = path.join(resourcesDir, 'app.asar.new');
  if (fs.existsSync(tempNewAsar)) fs.rmSync(tempNewAsar, { force: true });
  const tempUnpackedDir = tempNewAsar + '.unpacked';
  if (fs.existsSync(tempUnpackedDir)) {
    console.error('❌ 检测到上次重打包遗留的外置目录，请先检查并移走: ' + tempUnpackedDir);
    process.exit(1);
  }

  try {
    const unpackArgs = getUnpackArgs(tempSourceSnapshot).map(arg => `"${arg}"`).join(' ');
    const packCmd = formatAsarExecCommand(`pack "${tempExtractDir}" "${tempNewAsar}" ${unpackArgs}`);
    execSync(packCmd, { stdio: 'inherit' });
    const externalCount = verifyUnpackedOutput(tempSourceSnapshot, tempNewAsar);
    if (externalCount) console.log(`✅ 已验证 ${externalCount} 个外置文件的布局与原始内容保持一致`);
    if (fs.existsSync(tempUnpackedDir)) fs.rmSync(tempUnpackedDir, { recursive: true, force: true });

    // 将候选补丁锁定在私有工作区并冻结完整 sha256 + fingerprint，来源校验、置入、元数据与清理严格绑定同一候选身份
    const candidateWorkPath = path.join(tempSnapshotDir, 'app.asar.new');
    if (fs.existsSync(candidateWorkPath)) fs.rmSync(candidateWorkPath, { force: true });
    fs.renameSync(tempNewAsar, candidateWorkPath);
    const candidateId = getFileIdentity(candidateWorkPath);
    if (!sourceId || !candidateId) {
      throw new Error('CANDIDATE_IDENTITY_UNAVAILABLE');
    }

    const fsOps = options.fsOps || fs;
    const swapOldAsar = path.join(resourcesDir, 'app.asar.swap-old');
    const metaPath = path.join(resourcesDir, '.antigravity_chinese_meta.json');
    const stagedAsar = path.join(resourcesDir, 'app.asar.staged');
    const stagedMetaPath = path.join(resourcesDir, 'app.asar.staged.meta.json');
    if (fs.existsSync(swapOldAsar)) fs.rmSync(swapOldAsar, { force: true });

    const swapOutcome = commitCandidateSwap({
      asarPath,
      swapOldAsar,
      metaPath,
      candidateWorkPath,
      sourceId,
      candidateId,
      restoreTargetPath: tempNewAsar,
      stagedAsar,
      stagedMetaPath,
      upstreamConflictStatus: 'aborted_upstream_update',
      maxAttempts: typeof options.maxAttempts === 'number' ? options.maxAttempts : 5,
      retryDelayMs: typeof options.retryDelayMs === 'number' ? options.retryDelayMs : 400,
      fsOps,
      onBeforeSwapAttempt: options.onBeforeSwapAttempt,
      onBeforePlacePatched: options.onBeforePlacePatched,
      onBeforeWriteMeta: options.onBeforeWriteMeta
    });

    if (swapOutcome.status === 'aborted_upstream_update') {
      cleanupTempArtifacts();
      if (fs.existsSync(tempNewAsar)) try { fs.rmSync(tempNewAsar, { force: true }); } catch (_) {}
      console.warn('⚠️ 检测到解包/安装期间上游官方刚更新了 app.asar，已安全中止安装并完整保留新版客户端（未产生基于旧包的降级补丁）。');
      if (options.returnStatus) return { status: 'aborted_upstream_update', sourceFingerprint: sourceId.fp };
      if (options.throwOnConflict) throw new Error(swapOutcome.reasonCode || 'UPSTREAM_UPDATED_DURING_INSTALL');
      process.exit(1);
    }

    if (swapOutcome.status !== 'applied') {
      const lastError = swapOutcome.error;
      const rollbackErrors = swapOutcome.rollbackErrors || [];
      const currentDiskId = getFileIdentity(asarPath);
      const isLockedErr = lastError && (lastError.code === 'EBUSY' || lastError.code === 'EPERM');
      const allowStagedFallback = options.forceStagedFallback || (!customPath && isProtectedEnvironment());
      const usableCandidate = fs.existsSync(tempNewAsar)
        ? tempNewAsar
        : (fs.existsSync(candidateWorkPath) ? candidateWorkPath : null);

      if (rollbackErrors.length === 0 && allowStagedFallback && isLockedErr && usableCandidate &&
          currentDiskId && currentDiskId.sha256 === sourceId.sha256 &&
          getFileIdentity(usableCandidate)?.sha256 === candidateId.sha256) {
        if (fs.existsSync(stagedAsar)) fs.rmSync(stagedAsar, { force: true });
        if (fs.existsSync(stagedMetaPath)) fs.rmSync(stagedMetaPath, { force: true });
        fs.renameSync(usableCandidate, stagedAsar);
        writeJsonFileAtomic(stagedMetaPath, {
          sourceFingerprint: sourceId.fp,
          sourceSha256: sourceId.sha256,
          stagedFingerprint: candidateId.fp,
          stagedSha256: candidateId.sha256,
          timestamp: Date.now()
        });
        cleanupTempArtifacts();

        if (!options.skipSpawnApplyStaged) {
          try {
            const { spawn } = require('child_process');
            const child = spawn(process.execPath, [__filename, 'apply-staged', '--path', asarPath], {
              detached: true,
              stdio: 'ignore',
              windowsHide: true
            });
            child.unref();
          } catch (_) {}
        }

        console.log('\n✨ ==============================================');
        console.log('✨ [无损预注入就绪] 最新汉化包已预构建为: app.asar.staged');
        console.log('✨ 已挂载后台静默守候进程：当您稍后正常关闭 Antigravity 客户端时，');
        console.log('✨ 将在 0.5 秒内自动完成原子替换，下次打开即刻呈现中文界面！');
        console.log('✨ ==============================================\n');
        if (options.returnStatus) return { status: 'staged', sourceFingerprint: sourceId.fp, stagedFingerprint: candidateId.fp };
        return;
      }

      console.error('\n⚠️ [安全回滚触发] ASAR 或元数据提交失败，已执行按所有权核验的原子回滚。');
      if (rollbackErrors.length === 0) {
        if (fs.existsSync(tempNewAsar)) try { fs.rmSync(tempNewAsar, { force: true }); } catch (_) {}
      }
      cleanupTempArtifacts();
      console.error('\n❌ 文件被占用或提交失败:', lastError ? lastError.message : '未知错误');
      if (options.returnStatus) return { status: 'error', error: lastError, rollbackErrors, recovery: swapOutcome.recovery };
      if (options.throwOnConflict) throw lastError || new Error('ASAR_REPLACE_FAILED');
      process.exit(1);
    }

    cleanupTempArtifacts();

    // macOS codesign
    if (os.platform() === 'darwin') {
      console.log('🔏 [macOS] 正在重签应用签名 (Ad-hoc codesign)...');
      const appPath = asarPath.substring(0, asarPath.indexOf('.app') + 4);
      try {
        execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'ignore' });
        console.log('✅ macOS 签名完成');
      } catch (e) {
        console.warn('⚠️ codesign 自动重签遇到警告，若打开报错可在终端执行: codesign --force --deep --sign - ' + appPath);
      }
    }

    console.log('\n🎉 ==============================================');
    console.log('🎉 汉化补丁安装成功！');
    console.log('🎉 请完全退出并重新启动 Antigravity 客户端即可享受中文界面！');
    console.log('🎉 如需恢复官方英文状态，随时运行: node cli.js restore');
    console.log('🎉 ==============================================\n');
    if (options.returnStatus) return { status: 'applied', sourceFingerprint: sourceId.fp };
  } catch (err) {
    console.error('❌ 重构 app.asar 失败:', err.message);
    if (fs.existsSync(tempUnpackedDir)) fs.rmSync(tempUnpackedDir, { recursive: true, force: true });
    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
    if (fs.existsSync(tempNewAsar)) {
      fs.rmSync(tempNewAsar, { force: true });
    }
    cleanupTempArtifacts();
    if (options.throwOnConflict) throw err;
    process.exit(1);
  }
}

function restore(customPath) {
  console.log('🔍 正在定位 Antigravity 客户端路径...');
  const asarPath = findAsarPath(customPath);
  if (!asarPath) {
    console.error('❌ 未能找到 Antigravity 安装路径。');
    process.exit(1);
  }

  const resourcesDir = path.dirname(asarPath);
  const backupPath = path.join(resourcesDir, 'app.asar.bak');
  const metaPath = path.join(resourcesDir, '.antigravity_chinese_meta.json');
  const stagedPath = path.join(resourcesDir, 'app.asar.staged');
  const stagedMetaPath = path.join(resourcesDir, 'app.asar.staged.meta.json');

  if (!fs.existsSync(backupPath)) {
    console.error(`❌ 未找到安全备份文件: ${backupPath}，无法自动还原。`);
    process.exit(1);
  }

  const backupFpPath = path.join(resourcesDir, 'app.asar.bak.fingerprint');
  const isPatched = isAsarPatched(asarPath);
  const currentFp = getAsarFingerprint(asarPath);
  let prevFp = null;

  // 1. 优先从 fingerprint 文件读取
  if (fs.existsSync(backupFpPath)) {
    try { prevFp = fs.readFileSync(backupFpPath, 'utf8').trim(); } catch (e) {}
  }

  // 2. 历史无 fingerprint 文件自适应迁移策略 (Provenance & Migration Guard)
  if (!prevFp && fs.existsSync(backupPath)) {
    prevFp = getAsarFingerprint(backupPath);
    // 若备份经检验为官方未修改版本，安全补齐指纹凭据
    if (!isAsarPatched(backupPath) && prevFp) {
      try { fs.writeFileSync(backupFpPath, String(prevFp), 'utf8'); } catch (e) {}
    }
  }

  const isBakPatched = isAsarPatched(backupPath);

  // 核心安全原则 1：如果当前宿主已经是官方原生未打补丁版本，且与备份指纹不一致，严禁跨版本覆盖，自动保护新版！
  if (!isPatched && prevFp && currentFp !== prevFp) {
    console.log('ℹ️ 检测到当前客户端已由官方升级至全新纯净原生版本，无需还原。');
    console.log('🧹 正在安全清理陈旧出厂基准备份与元数据...');
    if (fs.existsSync(backupPath)) fs.rmSync(backupPath, { force: true });
    if (fs.existsSync(backupFpPath)) fs.rmSync(backupFpPath, { force: true });
    if (fs.existsSync(metaPath)) fs.rmSync(metaPath, { force: true });
    if (fs.existsSync(stagedPath)) fs.rmSync(stagedPath, { force: true });
    if (fs.existsSync(stagedMetaPath)) fs.rmSync(stagedMetaPath, { force: true });
    console.log('\n✅ 客户端版本安全保护完成，当前官方全新原生版本已完整保留！\n');
    return;
  }

  // 核心安全原则 2：若旧备份本身存在汉化污染标记（历史遗留损坏备份）且当前是原生版，禁止还原以防二次污染！
  if (!isPatched && isBakPatched) {
    console.warn('⚠️ [安全熔断] 检测到历史备份文件已包含汉化标记且当前客户端为官方原生版，禁止回退覆盖！');
    if (fs.existsSync(backupPath)) fs.rmSync(backupPath, { force: true });
    if (fs.existsSync(backupFpPath)) fs.rmSync(backupFpPath, { force: true });
    if (fs.existsSync(metaPath)) fs.rmSync(metaPath, { force: true });
    if (fs.existsSync(stagedPath)) fs.rmSync(stagedPath, { force: true });
    if (fs.existsSync(stagedMetaPath)) fs.rmSync(stagedMetaPath, { force: true });
    console.log('✅ 已清理污染的历史备份，完整保留当前官方原生客户端。\n');
    return;
  }

  // 1. 进程占用检测与文件锁释放 (仅在针对原生默认宿主路径时生效)
  if (!customPath && isProcessRunning()) {
    const shouldClose = confirmCloseClient('Antigravity');
    if (!shouldClose) {
      console.log('\nℹ️ 已安全取消还原。请在保存工作并退出 Antigravity 客户端后重新执行。');
      process.exit(0);
    }
    console.log('\n🔄 正在安全退出客户端以释放资源写入锁...');
    closeAntigravitySafely();
  }

  console.log(`📦 正在从备份还原原始文件: ${backupPath}`);
  // taskkill 后 Windows 文件锁可能延迟释放，对 EPERM/EBUSY 做跨平台重试
  try {
    let copyErr = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.copyFileSync(backupPath, asarPath);
        copyErr = null;
        break;
      } catch (e) {
        copyErr = e;
        if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e;
        if (attempt < 4) {
          try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400); } catch (_) {}
        }
      }
    }
    if (copyErr) throw copyErr;

    // 清除元数据与可能残留的预注入包
    if (fs.existsSync(metaPath)) fs.rmSync(metaPath, { force: true });
    if (fs.existsSync(stagedPath)) fs.rmSync(stagedPath, { force: true });
    if (fs.existsSync(stagedMetaPath)) fs.rmSync(stagedMetaPath, { force: true });

    console.log('\n✅ ==============================================');
    console.log('✅ 已成功还原为官方原生英文版本！');
    console.log('✅ 重启 Antigravity 客户端即可生效。');
    console.log('✅ ==============================================\n');
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EBUSY') {
      console.error('\n❌ 文件被占用 (EPERM): 请确保 Antigravity 客户端已完全退出后再执行还原。\n');
    } else {
      console.error('❌ 还原失败:', err.message);
    }
    process.exit(1);
  }
}

function status(customPath) {
  console.log('📊 正在检查 Antigravity 客户端及汉化状态...\n');
  const asarPath = findAsarPath(customPath);
  if (!asarPath) {
    console.log('❌ 状态: 未找到本地 Antigravity 客户端安装。');
    return;
  }

  const resourcesDir = path.dirname(asarPath);
  const backupPath = path.join(resourcesDir, 'app.asar.bak');
  const hasBackup = fs.existsSync(backupPath);
  const running = isProcessRunning();

  console.log(`• 平台系统:     ${os.platform()} (${os.arch()})`);
  console.log(`• 客户端运行:   ${running ? '🟢 正在运行中' : '⚪ 未运行'}`);
  console.log(`• 资源路径:     ${asarPath}`);
  console.log(`• 安全备份:     ${hasBackup ? '✅ 存在 (' + backupPath + ')' : '⚠️ 无备份'}`);
  
  const patched = isAsarPatched(asarPath);
  const stagedPath = path.join(resourcesDir, 'app.asar.staged');
  const hasStaged = !patched && fs.existsSync(stagedPath);
  const statusLabel = patched
    ? '🟢 已安装宿主汉化补丁'
    : (hasStaged ? '🟡 预注入已就绪 (app.asar.staged 已挂载，关闭客户端后自动秒级生效)' : '⚪ 原生未修改状态');
  console.log(`• 汉化状态:     ${statusLabel}`);

  const pluginDir = getGlobalPluginTargetDir();
  const hasPlugin = fs.existsSync(path.join(pluginDir, 'plugin.json'));
  console.log(`• 社区插件:     ${hasPlugin ? '🟢 已就绪 (Rules & Skills 激活)' : '⚪ 未安装'}`);

  const vsExtDir = findVsCodeExtensionDir(customPath);
  if (vsExtDir) {
    const vsPatched = isVsCodeExtensionPatched(vsExtDir);
    console.log(`• VS Code 扩展: ${vsPatched ? '🟢 已安装全景汉化 (含 Webview 代理)' : '⚪ 原生未修改状态'} (${vsExtDir})`);
  } else {
    console.log('• VS Code 扩展: ⚪ 未检测到本机扩展');
  }
  console.log('');
}

function isAsarPatched(asarPath, options = {}) {
  try {
    if (!asarPath || !fs.existsSync(asarPath)) return false;
    const metaDir = options.metaDir || path.dirname(asarPath);
    const metaPath = options.metaPath || path.join(metaDir, '.antigravity_chinese_meta.json');
    const currentFp = getAsarFingerprint(asarPath);

    // 1. 【权威判据】优先匹配正式目录的持久化 Hash/Manifest 清单（支持隔离快照绑定正式元数据）
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (meta && meta.patchedFingerprint && meta.patchedFingerprint === currentFp) {
          return true;
        }
      } catch (e) {}
    }

    const targetSig = Buffer.from('Antigravity Chinese Localization Injection');

    // 2. 【零依赖大包精准判据】直接按 ASAR 头部索引提取 dist/preload.js 核验，既不受 30MiB 物理偏移限制，也不依赖 @electron/asar
    const preloadBuf = extractFileFromAsar(asarPath, 'dist/preload.js');
    if (preloadBuf) {
      return preloadBuf.includes(targetSig);
    }

    // 3. 【兜底判据】流式滑动窗口签名检索（兼容无 ASAR 索引的合成文件，最大 512KB 缓冲区）
    const fd = fs.openSync(asarPath, 'r');
    const stat = fs.fstatSync(fd);
    const CHUNK_SIZE = 512 * 1024;
    const OVERLAP = targetSig.length;
    const maxScanSize = Math.min(stat.size, 30 * 1024 * 1024);
    let offset = 0;
    let found = false;
    const buf = Buffer.alloc(CHUNK_SIZE + OVERLAP);

    try {
      while (offset < maxScanSize) {
        const bytesToRead = Math.min(CHUNK_SIZE, maxScanSize - offset);
        const bytesRead = fs.readSync(fd, buf, 0, bytesToRead, offset);
        if (bytesRead <= 0) break;
        if (buf.subarray(0, bytesRead).includes(targetSig)) {
          found = true;
          break;
        }
        if (bytesRead < bytesToRead) break;
        offset += bytesToRead;
        // 如果不是最后一块，将末尾 OVERLAP 字节回退，防止签名被块边界切断
        if (offset < maxScanSize && offset >= OVERLAP) {
          offset -= OVERLAP;
        }
      }
    } finally {
      fs.closeSync(fd);
    }
    return found;
  } catch (e) {
    return false;
  }
}

function launch(customPath) {
  const asarPath = findAsarPath(customPath);
  if (!asarPath) {
    console.error('❌ 未能找到 Antigravity 安装路径。');
    process.exit(1);
  }

  console.log('🚀 [自愈启动器] 正在检查客户端汉化状态...');
  if (!isAsarPatched(asarPath)) {
    console.log('⚡ 检测到官方版本更新（补丁已被覆盖），正在自动静默重新注入汉化...');
    install(customPath);
    console.log('✅ 自动修复注入完成！');
  } else {
    console.log('🟢 汉化补丁完好有效。');
  }

  console.log('🚀 正在启动 Antigravity 客户端...');
  const { spawn } = require('child_process');

  if (process.platform === 'win32') {
    const appDir = path.dirname(path.dirname(asarPath));
    const exePath = path.join(appDir, 'Antigravity.exe');
    if (fs.existsSync(exePath)) {
      const child = spawn(exePath, [], { detached: true, stdio: 'ignore' });
      child.unref();
      console.log('✨ 客户端已启动。');
    }
  } else if (process.platform === 'darwin') {
    const appIndex = asarPath.indexOf('.app');
    const appPath = appIndex !== -1 ? asarPath.substring(0, appIndex + 4) : '/Applications/Antigravity.app';
    try {
      const child = spawn('open', ['-a', appPath], { detached: true, stdio: 'ignore' });
      child.on('error', () => {
        spawn('open', ['-a', 'Antigravity'], { detached: true, stdio: 'ignore' }).unref();
      });
      child.unref();
      console.log('✨ 客户端已启动。');
    } catch (e) {
      try { execSync(`open -a "${appPath}" || open -a "Antigravity" || true`, { stdio: 'ignore' }); } catch (_) {}
      console.log('✨ 客户端已启动。');
    }
  } else {
    try {
      const child = spawn('antigravity', [], { detached: true, stdio: 'ignore' });
      child.on('error', () => {
        spawn('google-antigravity', [], { detached: true, stdio: 'ignore' }).unref();
      });
      child.unref();
      console.log('✨ 客户端已启动。');
    } catch (e) {}
  }
}

function watch(customPath) {
  const asarPath = findAsarPath(customPath);
  if (!asarPath) {
    console.error('❌ 未能找到 Antigravity 安装路径。');
    process.exit(1);
  }

  console.log('👀 [自动守护进程] 已启动！正在持续监听 Antigravity 更新...');
  console.log(`📁 监控路径: ${asarPath}`);
  console.log('💡 当官方触发自动升级覆盖文件时，守护进程将自动秒级完成汉化重新注入。\n');

  const resourcesDir = path.dirname(asarPath);
  let debounceTimer = null;

  fs.watch(resourcesDir, (eventType, filename) => {
    if (filename && filename.toLowerCase().includes('app.asar')) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!isProcessRunning() && !isAsarPatched(asarPath)) {
          console.log('\n🔔 检测到 app.asar 变更且为未汉化状态（官方可能刚完成升级）！');
          console.log('⚡ 正在自动重新注入汉化...');
          try {
            install(customPath);
            console.log('🎉 自动更新注入成功！\n');
          } catch (e) {
            console.error('⚠️ 自动重新注入遇到冲突:', e.message);
          }
        }
      }, 2000);
    }
  });
}

function getGlobalPluginTargetDir() {
  if (process.env.AGY_PLUGIN_DIR) {
    return process.env.AGY_PLUGIN_DIR;
  }
  const homedir = os.homedir();
  return path.join(homedir, '.gemini', 'config', 'plugins', 'chinese-toolkit');
}

function installPlugin() {
  console.log('🔌 正在安装 Antigravity 社区中文智能体插件...');
  const srcPluginDir = path.join(PROJECT_ROOT, 'plugins', 'chinese-toolkit');
  const targetDir = getGlobalPluginTargetDir();
  
  if (!fs.existsSync(srcPluginDir)) {
    console.error('❌ 未找到插件源目录:', srcPluginDir);
    return;
  }
  
  const parentDir = path.dirname(targetDir);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
  
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  
  fs.cpSync(srcPluginDir, targetDir, { recursive: true });
  console.log(`✅ 插件已成功安装至全局目录: ${targetDir}`);
  console.log('🎉 智能体中文交互规则 (Rules) 与 本地化诊断技能 (Skills) 已就绪！\n');
}

function uninstallPlugin() {
  console.log('🔌 正在卸载 Antigravity 社区中文智能体插件...');
  const targetDir = getGlobalPluginTargetDir();
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    console.log(`✅ 已从全局目录移除插件: ${targetDir}\n`);
  } else {
    console.log('ℹ️ 全局插件目录中未发现该插件。\n');
  }
}

/**
 * 安全应用预构建的 app.asar.staged：
 * 1. 先核验来源指纹并冻结孤立候选工作副本；来源校验、安装、元数据与清理全链路绑定同一候选身份；
 * 2. 若官方已升级（stale）或并发暂存失配，绝不删除/覆盖官方新版，安全保留正确原包并清理对应陈旧暂存。
 */
function commitStagedSwap(asarPath, options = {}) {
  const fsOps = options.fsOps || fs;
  const resourcesDir = path.dirname(asarPath);
  const stagedAsar = path.join(resourcesDir, 'app.asar.staged');
  const stagedMetaPath = path.join(resourcesDir, 'app.asar.staged.meta.json');
  const swapOldAsar = path.join(resourcesDir, 'app.asar.swap-old');
  const metaPath = path.join(resourcesDir, '.antigravity_chinese_meta.json');

  if (!fs.existsSync(stagedAsar)) return { status: 'missing' };

  let stagedMeta = null;
  try {
    if (fs.existsSync(stagedMetaPath)) {
      stagedMeta = JSON.parse(fs.readFileSync(stagedMetaPath, 'utf8'));
    }
  } catch (_) {}

  const sourceId = getFileIdentity(asarPath);
  const candidateWorkPath = path.join(resourcesDir, `.__asar_staged_candidate_${process.pid}_${Date.now()}`);
  try {
    fs.copyFileSync(stagedAsar, candidateWorkPath);
  } catch (copyErr) {
    return { status: 'error', error: copyErr, rollbackErrors: [], recovery: { asarExists: fs.existsSync(asarPath) } };
  }

  const candidateId = getFileIdentity(candidateWorkPath);
  const validProvenance = !!(
    stagedMeta &&
    stagedMeta.sourceFingerprint &&
    stagedMeta.stagedFingerprint &&
    sourceId &&
    candidateId &&
    sourceId.fp === stagedMeta.sourceFingerprint &&
    candidateId.fp === stagedMeta.stagedFingerprint &&
    (!stagedMeta.sourceSha256 || sourceId.sha256 === stagedMeta.sourceSha256) &&
    (!stagedMeta.stagedSha256 || candidateId.sha256 === stagedMeta.stagedSha256)
  );

  const cleanupWorkAndInvalidStaged = () => {
    if (fs.existsSync(candidateWorkPath)) try { fs.rmSync(candidateWorkPath, { force: true }); } catch (_) {}
    let keepFreshStaged = false;
    try {
      if (fs.existsSync(stagedMetaPath) && fs.existsSync(stagedAsar) && sourceId) {
        const latestMeta = JSON.parse(fs.readFileSync(stagedMetaPath, 'utf8'));
        const latestStagedId = getFileIdentity(stagedAsar);
        keepFreshStaged = !!(
          latestMeta && latestStagedId &&
          latestMeta.sourceFingerprint === sourceId.fp &&
          latestMeta.stagedFingerprint === latestStagedId.fp
        );
      }
    } catch (_) {}
    if (!keepFreshStaged) {
      try { if (fs.existsSync(stagedAsar)) fs.rmSync(stagedAsar, { force: true }); } catch (_) {}
      try { if (fs.existsSync(stagedMetaPath)) fs.rmSync(stagedMetaPath, { force: true }); } catch (_) {}
    }
  };

  if (!validProvenance) {
    cleanupWorkAndInvalidStaged();
    return { status: 'stale' };
  }

  try {
    const outcome = commitCandidateSwap({
      asarPath,
      swapOldAsar,
      metaPath,
      candidateWorkPath,
      sourceId,
      candidateId,
      restoreTargetPath: stagedAsar,
      stagedAsar,
      stagedMetaPath,
      upstreamConflictStatus: 'stale',
      maxAttempts: typeof options.maxAttempts === 'number' ? options.maxAttempts : 10,
      retryDelayMs: typeof options.retryDelayMs === 'number' ? options.retryDelayMs : 150,
      fsOps,
      beforeSwapAttempt() {
        if (!fs.existsSync(stagedAsar) || getFileIdentity(stagedAsar)?.sha256 !== candidateId.sha256) {
          cleanupWorkAndInvalidStaged();
          return 'stale';
        }
        return null;
      },
      onBeforeSwapAttempt: options.onBeforeSwapAttempt,
      onBeforePlacePatched: options.onBeforePlacePatched,
      onBeforeWriteMeta: options.onBeforeWriteMeta
    });

    if (outcome.status === 'stale') return { status: 'stale' };
    if (outcome.status === 'applied') return { status: 'applied' };
    return outcome;
  } finally {
    if (fs.existsSync(candidateWorkPath)) {
      try { fs.rmSync(candidateWorkPath, { force: true }); } catch (_) {}
    }
  }
}

function applyStagedOnce(asarPath, options = {}) {
  const res = commitStagedSwap(asarPath, options);
  if (res.status === 'error') {
    const errMsg = res.error ? res.error.message : '未知错误';
    console.error(`❌ 应用 app.asar.staged 失败: ${errMsg}`);
    if (res.rollbackErrors && res.rollbackErrors.length > 0) {
      for (const rb of res.rollbackErrors) {
        console.error(`❌ 回滚步骤 [${rb.step}] (${rb.from} -> ${rb.to}) 失败: ${rb.error.message}`);
      }
      if (res.recovery?.originalFileLocation) {
        console.error(`ℹ️ 原始未修改包仍完整保留在: ${res.recovery.originalFileLocation}`);
      }
    }
    return { exitCode: 1, result: res };
  }
  if (res.status === 'stale') {
    console.warn('ℹ️ 检测到官方客户端已更新，已作废过期 app.asar.staged 并保留当前官方包。');
  }
  return { exitCode: 0, result: res };
}

function applyStagedWhenUnlocked(customPath) {
  const asarPath = findAsarPath(customPath);
  if (!asarPath) process.exit(0);
  const resourcesDir = path.dirname(asarPath);
  const stagedAsar = path.join(resourcesDir, 'app.asar.staged');

  let ticks = 0;
  const maxTicks = 144000; // 最多静默守候 12 小时 (300ms * 144000)
  const timer = setInterval(() => {
    ticks++;
    if (ticks > maxTicks || !fs.existsSync(stagedAsar)) {
      clearInterval(timer);
      process.exit(0);
    }
    if (!isProcessRunning()) {
      clearInterval(timer);
      const outcome = applyStagedOnce(asarPath);
      process.exit(outcome.exitCode);
    }
  }, 300);
}

// CLI Routing
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  let customPath = null;
  const pathArgIdx = args.indexOf('--path');
  if (pathArgIdx !== -1) {
    if (!args[pathArgIdx + 1] || args[pathArgIdx + 1].startsWith('-')) {
      console.error('❌ --path 后必须提供客户端或扩展路径。');
      process.exit(1);
    }
    customPath = args[pathArgIdx + 1];
  }

  switch (command) {
    case 'install':
    case 'patch': {
      const vsExtDir = findVsCodeExtensionDir(customPath);
      const asarPath = customPath && vsExtDir ? null : findAsarPath(customPath);
      if (asarPath) install(customPath);
      else console.log('ℹ️ 未检测到桌面客户端，跳过桌面补丁。');
      if (args.includes('--with-plugin')) {
        installPlugin();
      }
      // 弹性自适应联动：自动检测并为本机 VS Code 扩展注入全景汉化
      try {
        if (vsExtDir) {
          console.log('\n📦 [全家桶联动] 检测到本机 VS Code 扩展，正在同步注入全景中文本地化...');
          const vsRes = installVsCodePatch(vsExtDir);
          if (vsRes.success) {
            console.log(`✅ [全家桶联动] ${vsRes.message}`);
          } else {
            console.error(`❌ [全家桶联动] ${vsRes.message}`);
            process.exitCode = 1;
          }
        }
      } catch (vsErr) {
        console.error('❌ [全家桶联动] VS Code 扩展注入失败:', vsErr.message);
        process.exitCode = 1;
      }
      if (!asarPath && !vsExtDir && !args.includes('--with-plugin')) {
        console.error('❌ 未检测到可安装汉化补丁的客户端或 VS Code 扩展。');
        process.exitCode = 1;
      }
      break;
    }
    case 'apply-staged':
      applyStagedWhenUnlocked(customPath);
      break;
    case 'install-plugin':
    case 'plugin:install':
      installPlugin();
      break;
    case 'uninstall-plugin':
    case 'plugin:uninstall':
      uninstallPlugin();
      break;
    case 'restore':
    case 'uninstall': {
      const vsExtDir = findVsCodeExtensionDir(customPath);
      const asarPath = customPath && vsExtDir ? null : findAsarPath(customPath);
      if (asarPath) restore(customPath);
      if (!customPath) uninstallPlugin();
      // 弹性自适应联动：自动检测并恢复本机 VS Code 扩展至官方原生
      try {
        if (vsExtDir && isVsCodeExtensionPatched(vsExtDir)) {
          console.log('\n🔄 [全家桶联动] 检测到本机 VS Code 扩展处于汉化状态，正在同步还原官方英文原版...');
          const vsRes = restoreVsCodePatch(vsExtDir);
          if (vsRes.success) {
            console.log(`✅ [全家桶联动] ${vsRes.message}`);
          } else {
            console.error(`❌ [全家桶联动] ${vsRes.message}`);
            process.exitCode = 1;
          }
        }
      } catch (err) {
        console.error('❌ [全家桶联动] VS Code 扩展还原失败:', err.message);
        process.exitCode = 1;
      }
      break;
    }
    case 'install:vscode':
    case 'install-vscode':
    case 'vscode:install': {
      console.log('📦 正在为 VS Code 扩展 (Google Antigravity) 注入中文本地化...');
      const res = installVsCodePatch(customPath);
      if (res.success) {
        console.log(`✅ ${res.message}`);
      } else {
        console.error(`❌ ${res.message}`);
        process.exit(1);
      }
      break;
    }
    case 'restore:vscode':
    case 'restore-vscode':
    case 'vscode:restore': {
      console.log('🔄 正在还原 VS Code 扩展 (Google Antigravity) 至官方英文原版...');
      const res = restoreVsCodePatch(customPath);
      if (res.success) {
        console.log(`✅ ${res.message}`);
      } else {
        console.error(`❌ ${res.message}`);
        process.exit(1);
      }
      break;
    }
    case 'status:vscode':
    case 'vscode:status': {
      const extDir = findVsCodeExtensionDir(customPath);
      if (!extDir) {
        console.log('ℹ️ 未检测到 VS Code 的 Google Antigravity 扩展目录。');
      } else {
        const patched = isVsCodeExtensionPatched(extDir);
        console.log(`📁 扩展路径: ${extDir}`);
        console.log(`🌐 汉化状态: ${patched ? '✅ 已汉化 (Patched)' : '⚪ 原生未汉化 (Unpatched)'}`);
      }
      break;
    }
    case 'check':
    case 'preflight':
      console.log('=== 执行前置环境全维健康预检 (Pre-flight Health Check) ===\n');
      const preflightRes = runPreflightCheck(customPath);
      for (const c of preflightRes.checks) {
        const icon = c.passed ? '✅' : (c.critical ? '❌' : '⚠️');
        console.log(`  ${icon} [${c.name}]: ${c.detail}`);
      }
      if (preflightRes.allPassed) {
        console.log('\n🎉 所有核心前置条件 100% 就绪，可直接执行安装！');
      } else {
        console.log('\n❌ 部分核心前置条件未满足，请根据上方提示调整环境后再试。');
      }
      break;
    case 'status':
      status(customPath);
      break;
    case 'launch':
      launch(customPath);
      break;
    case 'watch':
    case 'daemon':
      watch(customPath);
      break;
    case 'help':
    default:
      console.log(`
Antigravity 社区中文本地化工具 (Antigravity Chinese Localization)

用法:
  node cli.js install              # 安装已检测到的桌面客户端及 VS Code 扩展汉化
  node cli.js restore              # 一键还原客户端（恢复官方英文原版）
  node cli.js status               # 检测当前客户端与汉化状态
  node cli.js install:vscode       # 一键安装 VS Code 扩展 (Google Antigravity) 中文汉化
  node cli.js restore:vscode       # 一键还原 VS Code 扩展（恢复官方英文原版）
  node cli.js status:vscode        # 检测当前 VS Code 扩展汉化状态
  node cli.js install-plugin       # 安装 Antigravity 社区中文智能体插件
  node cli.js uninstall-plugin     # 卸载社区中文智能体插件
  node cli.js check                # 前置环境全维健康预检 (Node 弹性版本、NPX、客户端路径与进程)
  node cli.js launch               # 自愈启动（自动检测版本覆盖并重打补丁后启动）
  node cli.js watch                # 守护模式（后台监听官方更新，发现覆盖自动重新汉化）
  node cli.js install --path <dir> # 指定自定义客户端或扩展目标

选项:
  --path <path>    指定 Antigravity 的安装目录、app.asar 或 VS Code 扩展路径
  --with-plugin    在执行 install 时同步安装社区插件
`);
      break;
  }
}

module.exports = {
  getCandidateAsarPaths,
  findAsarPath,
  tryRecoverSwappedAsar,
  isAsarPatched,
  getAsarFingerprint,
  install,
  commitStagedSwap,
  applyStagedOnce,
  runPreflightCheck,
  patchMenuFile,
  patchMainFile,
  patchTrayFile,
  patchWslFile,
  patchProvisionSplashFile,
  patchIpcHandlersFile,
  confirmCloseClient,
  closeAntigravitySafely,
  isProtectedEnvironment,
  findVsCodeExtensionDir,
  isVsCodeExtensionPatched,
  installVsCodePatch,
  restoreVsCodePatch
};
