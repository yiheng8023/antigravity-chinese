#!/usr/bin/env node

/**
 * Antigravity Chinese Localization CLI
 * Cross-platform patcher and lifecycle manager (Windows / macOS / Linux)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PROJECT_ROOT = __dirname;
const DICT_PATH = path.join(PROJECT_ROOT, 'dict', 'zh-CN.json');
const RUNTIME_PATH = path.join(PROJECT_ROOT, 'core', 'i18n-runtime.js');

// Platform paths
function getCandidateAsarPaths() {
  const platform = os.platform();
  const homedir = os.homedir();

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
    return [
      '/opt/antigravity/resources/app.asar',
      '/usr/lib/antigravity/resources/app.asar',
      '/usr/share/antigravity/resources/app.asar',
      path.join(homedir, '.local', 'share', 'antigravity', 'resources', 'app.asar'),
    ];
  }
}

function findAsarPath(customPath) {
  if (customPath) {
    let resolved = path.resolve(customPath);
    if (fs.existsSync(resolved)) {
      if (fs.statSync(resolved).isDirectory()) {
        resolved = path.join(resolved, 'resources', 'app.asar');
      }
      if (fs.existsSync(resolved)) return resolved;
    }
    console.error(`❌ 指定路径未找到 app.asar: ${customPath}`);
    process.exit(1);
  }

  const candidates = getCandidateAsarPaths();
  for (const p of candidates) {
    if (fs.existsSync(p)) {
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

  return `
// --- Antigravity Chinese Localization Injection Start ---
(function() {
  try {
    window.__AGY_I18N_DATA__ = ${dictContent.trim()};
    ${runtimeContent}
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
    { from: '"Open workspaces"', to: '"打开多个工作区"' }
  ];
  for (const r of replacements) {
    content = content.split(r.from).join(r.to);
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

function install(customPath) {
  console.log('🚀 [1/5] 正在定位 Antigravity 客户端路径...');
  const asarPath = findAsarPath(customPath);
  if (!asarPath) {
    console.error('❌ 未能自动检测到 Antigravity 客户端路径，请使用 --path 指定。');
    process.exit(1);
  }
  console.log(`✅ 找到目标文件: ${asarPath}`);

  if (isProcessRunning()) {
    console.log('\n⚠️ =========================================================');
    console.log('⚠️ 检测到 Antigravity 客户端当前正在运行！');
    console.log('⚠️ Windows/系统会对正在运行的程序文件加锁。');
    console.log('⚠️ 建议在退出 Antigravity 客户端后运行本脚本以完成注入。');
    console.log('⚠️ =========================================================\n');
  }

  ensureAsarTool();

  const resourcesDir = path.dirname(asarPath);
  const backupPath = path.join(resourcesDir, 'app.asar.bak');
  const tempExtractDir = path.join(resourcesDir, '__asar_temp_unpack__');

  // 1. Backup
  console.log('📦 [2/5] 检查安全备份...');
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(asarPath, backupPath);
    console.log(`✅ 已创建原始备份: ${backupPath}`);
  } else {
    console.log(`ℹ️ 已存在安全备份: ${backupPath} (跳过重复备份)`);
  }

  // 2. Extract
  console.log('⚙️ [3/5] 正在解构资源包 (ASAR)...');
  if (fs.existsSync(tempExtractDir)) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }

  try {
    execSync(`npx -y @electron/asar extract "${asarPath}" "${tempExtractDir}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ 解包 app.asar 失败:', err.message);
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
    const regex = /\/\/ --- Antigravity Chinese Localization Injection Start ---[\s\S]*?\/\/ --- Antigravity Chinese Localization Injection End ---/g;
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

  // 4. Pack back
  console.log('🔄 [5/5] 正在重构并应用补丁...');
  const tempNewAsar = path.join(resourcesDir, 'app.asar.new');
  try {
    execSync(`npx -y @electron/asar pack "${tempExtractDir}" "${tempNewAsar}"`, { stdio: 'inherit' });
    
    // Replace old asar
    try {
      fs.rmSync(asarPath, { force: true });
      fs.renameSync(tempNewAsar, asarPath);
    } catch (permErr) {
      if (permErr.code === 'EPERM' || permErr.code === 'EBUSY') {
        console.error('\n❌ 文件被占用错误 (EPERM / EBUSY):');
        console.error('   Antigravity 客户端正在运行并锁定了 app.asar 文件。');
        console.error('👉 解决方法:');
        console.error('   1. 请在任务栏或托盘中完全退出 Antigravity 客户端；');
        console.error('   2. 重新运行本安装命令: node cli.js install (或双击 install.bat)。\n');
        process.exit(1);
      }
      throw permErr;
    }

    // Clean temp
    fs.rmSync(tempExtractDir, { recursive: true, force: true });

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
  } catch (err) {
    console.error('❌ 重构 app.asar 失败:', err.message);
    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
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

  if (!fs.existsSync(backupPath)) {
    console.error(`❌ 未找到安全备份文件: ${backupPath}，无法自动还原。`);
    process.exit(1);
  }

  console.log(`📦 正在从备份还原原始文件: ${backupPath}`);
  try {
    fs.copyFileSync(backupPath, asarPath);
    console.log('\n✅ ==============================================');
    console.log('✅ 已成功还原为官方原生英文版本！');
    console.log('✅ 重启 Antigravity 客户端即可生效。');
    console.log('✅ ==============================================\n');
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EBUSY') {
      console.error('\n❌ 文件被占用 (EPERM): 请先退出 Antigravity 客户端再执行还原操作。\n');
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
  
  // Test if patched
  try {
    execSync(`npx -y @electron/asar extract-file "${asarPath}" "dist/preload.js"`, { stdio: 'ignore' });
    const preloadCheck = path.join(process.cwd(), 'preload.js');
    if (fs.existsSync(preloadCheck)) {
      const content = fs.readFileSync(preloadCheck, 'utf-8');
      const isPatched = content.includes('Antigravity Chinese Localization Injection');
      fs.rmSync(preloadCheck, { force: true });
      console.log(`• 汉化状态:     ${isPatched ? '🟢 已安装汉化补丁' : '⚪ 原生未修改状态'}`);
    }
  } catch (e) {
    console.log('• 汉化状态:     ⚪ 待检测');
  }
  console.log('');
}

function isAsarPatched(asarPath) {
  try {
    const tempCheck = path.join(os.tmpdir(), `check_preload_${Date.now()}.js`);
    execSync(`npx -y @electron/asar extract-file "${asarPath}" "dist/preload.js" "${tempCheck}"`, { stdio: 'ignore' });
    if (fs.existsSync(tempCheck)) {
      const content = fs.readFileSync(tempCheck, 'utf-8');
      const isPatched = content.includes('Antigravity Chinese Localization Injection');
      fs.rmSync(tempCheck, { force: true });
      return isPatched;
    }
  } catch (e) {}
  return false;
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

  // 启动 Antigravity.exe
  const appDir = path.dirname(path.dirname(asarPath));
  const exePath = path.join(appDir, 'Antigravity.exe');
  if (fs.existsSync(exePath)) {
    console.log(`🚀 正在启动 Antigravity: ${exePath}`);
    const { spawn } = require('child_process');
    const child = spawn(exePath, [], { detached: true, stdio: 'ignore' });
    child.unref();
    console.log('✨ 客户端已启动。');
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
  const homedir = os.homedir();
  return path.join(homedir, '.gemini', 'config', 'plugins', 'chinese-toolkit');
}

function installPlugin() {
  console.log('🔌 正在安装 Antigravity 官方中文智能体插件...');
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
  console.log('🔌 正在卸载 Antigravity 官方中文智能体插件...');
  const targetDir = getGlobalPluginTargetDir();
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    console.log(`✅ 已从全局目录移除插件: ${targetDir}\n`);
  } else {
    console.log('ℹ️ 全局插件目录中未发现该插件。\n');
  }
}

// CLI Routing
const args = process.argv.slice(2);
const command = args[0] || 'help';

let customPath = null;
const pathArgIdx = args.indexOf('--path');
if (pathArgIdx !== -1 && args[pathArgIdx + 1]) {
  customPath = args[pathArgIdx + 1];
}

switch (command) {
  case 'install':
  case 'patch':
    install(customPath);
    if (args.includes('--with-plugin')) {
      installPlugin();
    }
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
  case 'uninstall':
    restore(customPath);
    break;
  case 'status':
  case 'check':
    status(customPath);
    break;
  case 'launch':
  case 'start':
    launch(customPath);
    break;
  case 'watch':
  case 'daemon':
    watch(customPath);
    break;
  case 'help':
  default:
    console.log(`
Antigravity 客户端中文汉化管理器 (Antigravity Chinese Toolkit)

用法:
  node cli.js install              # 一键安装客户端 UI 汉化（自动备份并注入）
  node cli.js install-plugin       # 一键安装 Antigravity 官方中文智能体插件
  node cli.js uninstall-plugin     # 卸载官方中文智能体插件
  node cli.js restore              # 一键还原客户端（恢复官方英文原版）
  node cli.js status               # 检测当前客户端与汉化状态
  node cli.js launch               # 自愈启动（自动检测版本覆盖并重打补丁后启动）
  node cli.js watch                # 守护模式（后台监听官方更新，发现覆盖自动重新汉化）
  node cli.js --path <dir>         # 指定自定义客户端路径

选项:
  --path <path>    指定 Antigravity 的安装目录或 app.asar 路径
  --with-plugin    在执行 install 时同步安装官方插件
`);
    break;
}
