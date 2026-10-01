/**
 * Antigravity VS Code Extension 本地化补丁与生命周期管理器
 * Universal Localization Manager for Google Antigravity VS Code Extension
 * 
 * 核心功能：
 * 1. package.json 命令列表、配置项描述与自定义查看器全景汉化与备份还原
 * 2. Webview 内嵌 iframe 本地轻量反向代理 (Micro Reverse Proxy) 注入
 * 3. 动态生成 i18n-bundle.js（含完整词典与极速 DOM 监听引擎）与 agy-i18n-proxy.js
 * 4. extension.js 的 renderWebviewHtml 双向无损拦截与纯净原子回滚
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 高优先级精准精修词库映射
const VSCODE_TRANSLATION_MAP = {
  // 基本信息
  "Bring Google's agent-first development platform to Visual Studio Code.":
    "将 Google 以智能体为核心的开发平台引入 Visual Studio Code。",

  // 自定义编辑器 (Custom Editors)
  "Antigravity Artifact Viewer": "Antigravity 产物文档查看器",
  "Antigravity Settings Viewer": "Antigravity 设置查看器",

  // 命令列表 (Commands)
  "Show Third Party Notices": "显示第三方声明",
  "Reset Conversation State": "重置会话状态",
  "Add Selection to Chat": "将选中文本添加到对话",
  "Add Terminal Selection or Output to Chat": "将终端选中内容或输出添加到对话",
  "Focus Antigravity Panel": "聚焦 Antigravity 面板",
  "Accept All Changes": "接受所有更改",
  "Reject All Changes": "拒绝所有更改",
  "Toggle Inline Diff": "切换内联差异显示",
  "Open Antigravity Settings": "打开 Antigravity 设置",
  "Provide Feedback": "提供反馈",

  // 配置项描述 (Configuration Properties)
  "Port for the Antigravity background server (`agy --hub`). Leave at 0 to allocate an ephemeral port automatically.":
    "Antigravity 后台服务器（`agy --hub`）的端口号。保留为 0 将自动分配临时可用端口。",
  "Timeout in milliseconds to wait for the Antigravity backend language server to start up and pass health checks.":
    "等待 Antigravity 后台语言服务器启动并通过健康检查的超时时间（毫秒）。",
  "Enable sending client-side product telemetry and usage metrics to Google Cloudmill to help improve Antigravity.":
    "启用向 Google 发送客户端产品遥测与使用指标，以协助持续改进 Antigravity。",
  "Enable inline diff decorations and CodeLenses. When disabled, falls back to opening changes in a side-by-side diff tab.":
    "启用内联代码差异标记与 CodeLens。禁用后将回退为在并排对比标签页中显示更改。",
  "Auto-accept pending edits in background files when sending a new chat message.":
    "发送新对话消息时，自动接受后台文件中待处理的代码编辑。",
  "Automatically open files in the editor when the agent proposes edits.":
    "当智能体建议修改代码时，自动在编辑器中打开相应文件。",
  "Base URL for CLI downloads (used for testing and internal overrides).":
    "CLI 命令行工具下载的基础 URL（用于测试与内部环境重写）。",
  "Additional command line arguments passed to the language server.":
    "传递给语言服务器的额外命令行启动参数。",
  "The release channel for this extension build":
    "此扩展构建版本的发布频道",
  "Internal channel setting":
    "内部频道设置"
};

/**
 * 自动查找本机已安装的 Google Antigravity VS Code 扩展目录
 * @param {string} [customDir] 自定义扩展目录
 * @returns {string|null} 扩展根目录绝对路径，未找到时返回 null
 */
function findVsCodeExtensionDir(customDir) {
  if (customDir !== undefined && customDir !== null) {
    if (fs.existsSync(customDir)) {
      const pkg = path.join(customDir, 'package.json');
      if (fs.existsSync(pkg)) return customDir;
    }
    return null;
  }

  const home = os.homedir();
  const extBase = path.join(home, '.vscode', 'extensions');
  if (!fs.existsSync(extBase)) return null;

  try {
    const entries = fs.readdirSync(extBase);
    const matches = entries.filter((e) => e.startsWith('google.google-antigravity-'));
    if (matches.length === 0) return null;

    // 按版本号自然排序，选取最高版本
    matches.sort();
    return path.join(extBase, matches[matches.length - 1]);
  } catch (_) {
    return null;
  }
}

/**
 * 检查指定 VS Code 扩展是否已被汉化
 * @param {string} extDir 扩展目录
 * @returns {boolean}
 */
function isVsCodeExtensionPatched(extDir) {
  if (!extDir) return false;
  const pkgPath = path.join(extDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    if (Boolean(pkg.__antigravity_chinese_patched)) return true;
  } catch (_) {}

  const extJsPath = path.join(extDir, 'extension.js');
  if (fs.existsSync(extJsPath)) {
    try {
      const extJs = fs.readFileSync(extJsPath, 'utf-8');
      if (extJs.includes('AGY_VSCODE_I18N_PROXY_INJECTION')) return true;
    } catch (_) {}
  }

  return false;
}

/**
 * 构建完整的扩展字典映射表（融合静态精修与动态词库）
 * @returns {Record<string, string>}
 */
function getVsCodeFullMap() {
  const map = { ...VSCODE_TRANSLATION_MAP };
  const bundlePath = path.join(__dirname, '..', 'dict', 'zh-CN.json');
  if (fs.existsSync(bundlePath)) {
    try {
      const d = JSON.parse(fs.readFileSync(bundlePath, 'utf-8'));
      if (d && d.exact) {
        for (const [k, v] of Object.entries(d.exact)) {
          if (k && !map[k] && typeof v === 'string') {
            map[k] = v;
          }
        }
      }
    } catch (_) {}
  }
  return map;
}

/**
 * 生成打包后的汉化 bundle 脚本（包含全局词典与极速 DOM 注入运行时）
 * @returns {string}
 */
function getI18nBundleScript() {
  const dictPath = path.join(__dirname, '..', 'dict', 'zh-CN.json');
  const runtimePath = path.join(__dirname, 'i18n-runtime.js');

  const dictContent = fs.existsSync(dictPath) ? fs.readFileSync(dictPath, 'utf-8') : '{}';
  const runtimeContent = fs.existsSync(runtimePath) ? fs.readFileSync(runtimePath, 'utf-8') : '';

  return `// --- Antigravity VS Code Webview i18n Bundle ---
(function() {
  try {
    window.__AGY_I18N_DATA__ = ${dictContent.trim()};
    ${runtimeContent}
  } catch(e) {
    console.error('[AGY-i18n] Runtime Injection Error:', e);
  }
})();
`;
}

/**
 * 生成本地微型反向代理 (Micro Reverse Proxy) 源码
 * @returns {string}
 */
function getAgyI18nProxyTemplate() {
  return `/**
 * Antigravity VS Code Webview i18n Micro Reverse Proxy
 * Local reverse proxy to inject Chinese localization runtime into Language Server Webview iframe
 */
const http = require('http');
const net = require('net');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

let proxyServer = null;
let proxyPort = 0;
let currentTargetUrl = '';
let cachedBundleContent = null;

function getBundleScript() {
  if (cachedBundleContent) return cachedBundleContent;
  const bundlePath = path.join(__dirname, 'i18n-bundle.js');
  if (fs.existsSync(bundlePath)) {
    cachedBundleContent = fs.readFileSync(bundlePath, 'utf-8');
  } else {
    cachedBundleContent = '';
  }
  return cachedBundleContent;
}

function startProxy() {
  if (proxyServer && proxyPort > 0) return proxyPort;

  proxyServer = http.createServer((req, res) => {
    if (!currentTargetUrl) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('Antigravity target server not set');
      return;
    }

    let targetParsed;
    try {
      targetParsed = new URL(currentTargetUrl);
    } catch (_) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Invalid target server URL: ' + currentTargetUrl);
      return;
    }

    const reqUrl = new URL(req.url, 'http://127.0.0.1');
    const proxyHeaders = { ...req.headers };
    proxyHeaders.host = targetParsed.host;

    // 核心防御 1：强制目标服务器以未压缩明文返回，杜绝二进制乱码拼接与解压崩溃
    delete proxyHeaders['accept-encoding'];

    const options = {
      hostname: targetParsed.hostname,
      port: targetParsed.port,
      path: reqUrl.pathname + reqUrl.search,
      method: req.method,
      headers: proxyHeaders
    };

    const proxyReq = http.request(options, (targetRes) => {
      const isHtml = (targetRes.headers['content-type'] || '').includes('text/html');
      if (isHtml && req.method === 'GET') {
        const chunks = [];
        targetRes.on('data', (chunk) => { chunks.push(chunk); });
        targetRes.on('end', () => {
          let buffer = Buffer.concat(chunks);

          // 核心防御 2：万一目标服务强制返回压缩格式，自动双向解压
          const encoding = (targetRes.headers['content-encoding'] || '').toLowerCase();
          if (encoding === 'gzip') {
            try { buffer = zlib.gunzipSync(buffer); } catch (_) {}
          } else if (encoding === 'deflate') {
            try { buffer = zlib.inflateSync(buffer); } catch (_) {}
          }

          let body = buffer.toString('utf-8');
          const bundle = getBundleScript();
          const scriptTag = '\\n<script>\\n' + bundle + '\\n</script>\\n';
          const modified = body.includes('<head>')
            ? body.replace('<head>', '<head>' + scriptTag)
            : (scriptTag + body);

          const headers = { ...targetRes.headers };
          delete headers['content-length'];
          delete headers['content-encoding'];
          delete headers['transfer-encoding'];
          headers['content-length'] = Buffer.byteLength(modified, 'utf-8');
          res.writeHead(targetRes.statusCode, headers);
          res.end(modified);
        });
      } else {
        res.writeHead(targetRes.statusCode, targetRes.headers);
        targetRes.pipe(res);
      }
    });

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
      }
      res.end('AGY Proxy Error: ' + err.message);
    });

    req.pipe(proxyReq);
  });

  proxyServer.on('upgrade', (req, clientSocket, head) => {
    if (!currentTargetUrl) {
      clientSocket.destroy();
      return;
    }
    const targetParsed = new URL(currentTargetUrl);
    const targetSocket = net.connect(targetParsed.port, targetParsed.hostname, () => {
      targetSocket.write(
        req.method + ' ' + req.url + ' HTTP/' + req.httpVersion + '\\r\\n' +
        Object.entries(req.headers).map(([k, v]) => k + ': ' + v).join('\\r\\n') +
        '\\r\\n\\r\\n'
      );
      if (head && head.length > 0) targetSocket.write(head);
      targetSocket.pipe(clientSocket);
      clientSocket.pipe(targetSocket);
    });

    targetSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => targetSocket.destroy());
  });

  proxyServer.listen(0, '127.0.0.1', () => {
    if (proxyServer && proxyServer.address()) {
      proxyPort = proxyServer.address().port;
    }
  });

  return proxyPort;
}

function getProxiedUrls(serverUrl, fullUrlString) {
  if (!serverUrl) return { serverUrl, fullUrlString };
  currentTargetUrl = serverUrl;

  if (!proxyServer || !proxyPort) {
    startProxy();
  }

  if (!proxyPort) {
    return { serverUrl, fullUrlString };
  }

  // 核心防御 3：使用 WHATWG URL 规范重构，绝对规避双斜杠或末尾路径丢失
  try {
    const parsedTarget = new URL(serverUrl);
    const parsedFull = new URL(fullUrlString);
    const proxyBase = 'http://127.0.0.1:' + proxyPort + (parsedTarget.pathname.endsWith('/') ? parsedTarget.pathname : parsedTarget.pathname + '/');
    parsedFull.protocol = 'http:';
    parsedFull.hostname = '127.0.0.1';
    parsedFull.port = String(proxyPort);
    return {
      serverUrl: proxyBase,
      fullUrlString: parsedFull.toString()
    };
  } catch (_) {
    const proxyBase = 'http://127.0.0.1:' + proxyPort + '/';
    return {
      serverUrl: proxyBase,
      fullUrlString: fullUrlString.replace(serverUrl, proxyBase)
    };
  }
}

startProxy();

module.exports = {
  startProxy,
  getProxiedUrls
};
`;
}

/**
 * 修补 extension.js，注入本地反向代理对 renderWebviewHtml 的拦截
 * @param {string} extDir 扩展根目录
 * @returns {{ success: boolean, message?: string }}
 */
function patchExtensionJs(extDir) {
  const extJsPath = path.join(extDir, 'extension.js');
  const extJsBakPath = path.join(extDir, 'extension.js.bak');
  if (!fs.existsSync(extJsPath)) return { success: true };

  // 1. 建立纯净备份
  if (!fs.existsSync(extJsBakPath)) {
    fs.copyFileSync(extJsPath, extJsBakPath);
  }

  let content = fs.readFileSync(extJsBakPath, 'utf-8');

  // 2. 检查并注入 renderWebviewHtml 拦截
  const targetSignature = 'renderWebviewHtml(webview, serverUrl, fullUrlString, options) {';
  if (!content.includes(targetSignature)) {
    return { success: false, message: '未在 extension.js 中匹配到 renderWebviewHtml 签名' };
  }

  const proxyRequireHeader = `// --- AGY_VSCODE_I18N_PROXY_INJECTION_START ---
let __agyI18nProxy = null;
try {
  __agyI18nProxy = require('./agy-i18n-proxy.js');
} catch (_) {}
// --- AGY_VSCODE_I18N_PROXY_INJECTION_END ---
`;

  const interceptionCode = `${targetSignature}
        // --- AGY_VSCODE_I18N_INTERCEPT_START ---
        try {
          if (!__agyI18nProxy) {
            __agyI18nProxy = require('./agy-i18n-proxy.js');
          }
          if (__agyI18nProxy && typeof __agyI18nProxy.getProxiedUrls === 'function') {
            const __proxied = __agyI18nProxy.getProxiedUrls(serverUrl, fullUrlString);
            serverUrl = __proxied.serverUrl;
            fullUrlString = __proxied.fullUrlString;
          }
        } catch (_) {}
        // --- AGY_VSCODE_I18N_INTERCEPT_END ---`;

  content = proxyRequireHeader + content.replace(targetSignature, interceptionCode);

  fs.writeFileSync(extJsPath, content, 'utf-8');
  return { success: true };
}

/**
 * 一键安装 VS Code 扩展汉化补丁
 * @param {string} [customDir] 自定义扩展目录
 * @returns {{ success: boolean, message: string, extDir?: string }}
 */
function installVsCodePatch(customDir) {
  const extDir = findVsCodeExtensionDir(customDir);
  if (!extDir) {
    return {
      success: false,
      message: '未检测到 VS Code 的 Google Antigravity 扩展目录 (~/.vscode/extensions/google.google-antigravity-*)。'
    };
  }

  const pkgPath = path.join(extDir, 'package.json');
  const bakPath = path.join(extDir, 'package.json.bak');
  const metaPath = path.join(extDir, '.antigravity_vscode_meta.json');

  if (!fs.existsSync(pkgPath)) {
    return { success: false, message: `扩展 package.json 不存在: ${pkgPath}` };
  }

  // 1. 若纯净备份不存在，立即创建官方原版备份
  if (!fs.existsSync(bakPath)) {
    fs.copyFileSync(pkgPath, bakPath);
  }

  // 2. 始终从备份或当前内容中解析原始结构
  let sourceRaw = fs.readFileSync(bakPath, 'utf-8');
  let pkg;
  try {
    pkg = JSON.parse(sourceRaw);
  } catch (err) {
    return { success: false, message: `解析 package.json 失败: ${err.message}` };
  }

  const map = getVsCodeFullMap();

  // 3. 递归汉化 contributes 核心字段
  if (pkg.description && map[pkg.description]) {
    pkg.description = map[pkg.description];
  }

  if (pkg.contributes) {
    // 自定义编辑器
    if (Array.isArray(pkg.contributes.customEditors)) {
      for (const ed of pkg.contributes.customEditors) {
        if (ed.displayName && map[ed.displayName]) {
          ed.displayName = map[ed.displayName];
        }
      }
    }

    // 命令列表
    if (Array.isArray(pkg.contributes.commands)) {
      for (const cmd of pkg.contributes.commands) {
        if (cmd.title && map[cmd.title]) {
          cmd.title = map[cmd.title];
        }
      }
    }

    // 设置项
    if (pkg.contributes.configuration && pkg.contributes.configuration.properties) {
      const props = pkg.contributes.configuration.properties;
      for (const prop of Object.values(props)) {
        if (prop.description && map[prop.description]) {
          prop.description = map[prop.description];
        }
        if (prop.deprecationMessage && map[prop.deprecationMessage]) {
          prop.deprecationMessage = map[prop.deprecationMessage];
        }
      }
    }
  }

  // 4. 注入标记并写回 package.json
  pkg.__antigravity_chinese_patched = true;
  pkg.__antigravity_chinese_version = require('../package.json').version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n', 'utf-8');

  // 5. 生成并写入 Webview 注入资产 (i18n-bundle.js & agy-i18n-proxy.js)
  const bundleScript = getI18nBundleScript();
  fs.writeFileSync(path.join(extDir, 'i18n-bundle.js'), bundleScript, 'utf-8');

  const proxyScript = getAgyI18nProxyTemplate();
  fs.writeFileSync(path.join(extDir, 'agy-i18n-proxy.js'), proxyScript, 'utf-8');

  // 6. 修补 extension.js 中的 Webview iframe 代理重定向
  const extJsResult = patchExtensionJs(extDir);
  if (!extJsResult.success) {
    console.warn(`⚠️ [VS Code 扩展警告] extension.js 深度拦截注入遇到提示: ${extJsResult.message}`);
  }

  fs.writeFileSync(
    metaPath,
    JSON.stringify({ patched: true, timestamp: Date.now(), extDir }, null, 2),
    'utf-8'
  );

  return {
    success: true,
    message: `成功为 VS Code 扩展注入全景中文本地化 (package.json + Webview i18n Proxy): ${extDir}`,
    extDir
  };
}

/**
 * 一键还原 VS Code 扩展（恢复官方原版）
 * @param {string} [customDir] 自定义扩展目录
 * @returns {{ success: boolean, message: string }}
 */
function restoreVsCodePatch(customDir) {
  const extDir = findVsCodeExtensionDir(customDir);
  if (!extDir) {
    return {
      success: false,
      message: '未检测到 VS Code 的 Google Antigravity 扩展目录。'
    };
  }

  const pkgPath = path.join(extDir, 'package.json');
  const bakPath = path.join(extDir, 'package.json.bak');
  const extJsPath = path.join(extDir, 'extension.js');
  const extJsBakPath = path.join(extDir, 'extension.js.bak');
  const metaPath = path.join(extDir, '.antigravity_vscode_meta.json');
  const bundlePath = path.join(extDir, 'i18n-bundle.js');
  const proxyPath = path.join(extDir, 'agy-i18n-proxy.js');

  let restoredAny = false;

  // 1. 还原 package.json
  if (fs.existsSync(bakPath)) {
    fs.copyFileSync(bakPath, pkgPath);
    restoredAny = true;
  }

  // 2. 还原 extension.js
  if (fs.existsSync(extJsBakPath)) {
    fs.copyFileSync(extJsBakPath, extJsPath);
    restoredAny = true;
  }

  // 3. 安全清理注入资产
  try { if (fs.existsSync(bundlePath)) fs.unlinkSync(bundlePath); } catch (_) {}
  try { if (fs.existsSync(proxyPath)) fs.unlinkSync(proxyPath); } catch (_) {}
  try { if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath); } catch (_) {}

  if (!restoredAny && !isVsCodeExtensionPatched(extDir)) {
    return { success: true, message: '扩展当前为官方原生状态，无需还原。' };
  }

  return {
    success: true,
    message: `成功恢复 VS Code 扩展至官方原生纯净状态: ${extDir}`
  };
}

module.exports = {
  findVsCodeExtensionDir,
  isVsCodeExtensionPatched,
  installVsCodePatch,
  restoreVsCodePatch,
  patchExtensionJs,
  getAgyI18nProxyTemplate,
  getI18nBundleScript,
  VSCODE_TRANSLATION_MAP
};
