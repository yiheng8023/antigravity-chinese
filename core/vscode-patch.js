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
const crypto = require('crypto');

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
  "Accept Focused Change": "接受当前选中的更改",
  "Reject Focused Change": "拒绝当前选中的更改",
  "Toggle Inline Diff": "切换内联差异显示",
  "Open Antigravity Settings": "打开 Antigravity 设置",
  "Manage Data Sharing & Telemetry": "管理数据共享与遥测",
  "Provide Feedback": "提供反馈",

  // 配置项描述 (Configuration Properties)
  "Port for the Antigravity background server (`agy --hub`). Leave at 0 to allocate an ephemeral port automatically.":
    "Antigravity 后台服务器（`agy --hub`）的端口号。保留为 0 将自动分配临时可用端口。",
  "Timeout in milliseconds to wait for the Antigravity backend language server to start up and pass health checks.":
    "等待 Antigravity 后台语言服务器启动并通过健康检查的超时时间（毫秒）。",
  "Automatically restart the Antigravity backend (`agy --hub`) when it stops unexpectedly mid-session, with bounded exponential backoff (at most 3 restarts per 10 minutes). When off, or once the restart budget is exhausted, the chat view shows an error with a manual retry button.":
    "当 Antigravity 后台（`agy --hub`）在会话中意外停止时自动重启，采用有界指数退避策略（10 分钟内最多重启 3 次）。关闭时，或重启配额耗尽后，对话视图将显示带有手动重试按钮的错误提示。",
  "Interval in milliseconds between post-startup `/healthz` liveness probes of the Antigravity backend while the window is focused (4x longer when unfocused). Three consecutive missed probes mark the backend as hung; with `antigravity.autoRecover` on it is then restarted. Set to 0 to disable the heartbeat.":
    "窗口获得焦点时，对 Antigravity 后台启动后进行 `/healthz` 活跃度探测的间隔时间（毫秒，失去焦点时延长为 4 倍）。连续 3 次探测失败将把后台标记为挂起；开启 `antigravity.autoRecover` 时将自动重启。设为 0 可禁用心跳探测。",
  "Telemetry is now controlled by the **Enable Telemetry** switch in Antigravity Settings → Account ([open](command:antigravity.openTelemetrySettings)). This setting no longer has any effect beyond keeping extension usage metrics off if set to `false`.":
    "遥测现已由 Antigravity 设置 → 账户中的“启用遥测”开关控制（[打开](command:antigravity.openTelemetrySettings)）。若设置为 `false`，此设置除保持扩展使用指标关闭外，不再具有任何效果。",
  "Enable sending client-side product telemetry and usage metrics to Google Cloudmill to help improve Antigravity.":
    "启用向 Google 发送客户端产品遥测与使用指标，以协助持续改进 Antigravity。",
  "Enable inline diff decorations and CodeLenses. When disabled, falls back to opening changes in a side-by-side diff tab.":
    "启用内联代码差异标记与 CodeLens。禁用后将回退为在并排对比标签页中显示更改。",
  "Auto-accept pending edits in background files when sending a new chat message.":
    "发送新对话消息时，自动接受后台文件中待处理的代码编辑。",
  "Auto-accept pending edits in background files when sending a new chat message. When off, nothing pending is accepted on your behalf: a review stays open across turns and later edits to the file add to it, and you are notified when reviews from earlier turns are still open.":
    "在发送新对话消息时，自动接受后台文件中待决的修改。关闭时，将不会代表您自动接受任何待决更改：审查将在多轮对话间保持打开，对该文件的后续修改会追加到其中，且当上一轮审查仍处于打开状态时会向您发送通知。",
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
  function readExtension(dir) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (pkg.name !== 'google-antigravity' || (pkg.publisher && pkg.publisher !== 'google')) return null;
      return { dir, version: String(pkg.version || '0.0.0') };
    } catch (_) { return null; }
  }
  if (customDir !== undefined && customDir !== null) {
    return readExtension(customDir) ? customDir : null;
  }

  const home = os.homedir();
  const extBase = path.join(home, '.vscode', 'extensions');
  if (!fs.existsSync(extBase)) return null;

  try {
    const entries = fs.readdirSync(extBase);
    const matches = entries.filter((e) => e.startsWith('google.google-antigravity-'))
      .map(e => readExtension(path.join(extBase, e))).filter(Boolean);
    if (matches.length === 0) return null;

    // 按版本号自然排序，选取最高版本
    matches.sort((a, b) => {
      const [aCore, aPre] = a.version.split(/-(.*)/);
      const [bCore, bPre] = b.version.split(/-(.*)/);
      return aCore.localeCompare(bCore, 'en', { numeric: true }) ||
        (aPre === bPre ? 0 : aPre === undefined ? 1 : bPre === undefined ? -1 : aPre.localeCompare(bPre, 'en', { numeric: true }));
    });
    return matches[matches.length - 1].dir;
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
let proxyReadyPromise = null;
let currentTargetUrl = '';
let cachedBundleContent = null;

// 先校验浏览器来源，再为合法的本地 Webview 重写后端来源。
function isAllowedOrigin(origin, targetOrigin) {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === 'vscode-webview:') return true;
    if (parsed.origin === targetOrigin) return true;
    return parsed.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) &&
      parsed.port === String(proxyPort);
  } catch (_) { return false; }
}

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
  if (proxyServer && proxyServer.listening && proxyServer.address()) {
    proxyPort = proxyServer.address().port;
    return proxyPort;
  }

  if (!proxyServer) {
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
    const proxyOrigin = 'http://127.0.0.1:' + proxyPort;
    const targetOrigin = targetParsed.origin;
    const targetPort = parseInt(targetParsed.port || (targetParsed.protocol === 'https:' ? '443' : '80'), 10);

    if (!isAllowedOrigin(req.headers.origin, targetOrigin)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('AGY Proxy: Origin not allowed');
      return;
    }

    const proxyHeaders = { ...req.headers };
    proxyHeaders.host = targetParsed.host;

    // 核心防御 1：强制目标服务器以未压缩明文返回，杜绝二进制乱码拼接与解压崩溃
    delete proxyHeaders['accept-encoding'];

    // 核心防御 2：重写 HTTP 请求来源与防跨域检查，彻底对齐目标后端
    if (proxyHeaders.origin) {
      proxyHeaders.origin = targetOrigin;
    }
    if (proxyHeaders.referer) {
      proxyHeaders.referer = proxyHeaders.referer.split(proxyOrigin).join(targetOrigin);
    }
    proxyHeaders['x-forwarded-host'] = req.headers.host || ('127.0.0.1:' + proxyPort);
    proxyHeaders['x-forwarded-proto'] = targetParsed.protocol ? targetParsed.protocol.replace(':', '') : 'http';
    proxyHeaders['x-forwarded-for'] = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '127.0.0.1';

    const options = {
      hostname: targetParsed.hostname,
      port: targetPort,
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

          // 核心防御 3：万一目标服务强制返回压缩格式，自动双向解压
          const encoding = (targetRes.headers['content-encoding'] || '').toLowerCase();
          try {
            if (encoding === 'gzip') buffer = zlib.gunzipSync(buffer);
            else if (encoding === 'deflate') buffer = zlib.inflateSync(buffer);
            else if (encoding === 'br') buffer = zlib.brotliDecompressSync(buffer);
            else if (encoding && encoding !== 'identity') throw new Error('Unsupported content encoding');
          } catch (_) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('AGY Proxy Error: Unable to decode HTML response');
            return;
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

          // 逆向对齐 CORS 与重定向 Location
          if (headers['access-control-allow-origin'] && headers['access-control-allow-origin'] !== '*') {
            headers['access-control-allow-origin'] = req.headers.origin || '*';
          }
          if (headers.location && headers.location.includes(targetOrigin)) {
            headers.location = headers.location.split(targetOrigin).join(proxyOrigin);
          }

          res.writeHead(targetRes.statusCode, headers);
          res.end(modified);
        });
      } else {
        const headers = { ...targetRes.headers };
        if (headers['access-control-allow-origin'] && headers['access-control-allow-origin'] !== '*') {
          headers['access-control-allow-origin'] = req.headers.origin || '*';
        }
        if (headers.location && headers.location.includes(targetOrigin)) {
          headers.location = headers.location.split(targetOrigin).join(proxyOrigin);
        }
        res.writeHead(targetRes.statusCode, headers);
        targetRes.pipe(res);
      }
    });

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
      }
      res.end('AGY Proxy Error: ' + err.message);
    });

    req.on('error', (err) => {
      proxyReq.destroy(err);
    });

    req.pipe(proxyReq);
  });

  proxyServer.on('upgrade', (req, clientSocket, head) => {
    if (!currentTargetUrl) {
      clientSocket.destroy();
      return;
    }
    let targetParsed;
    try {
      targetParsed = new URL(currentTargetUrl);
    } catch (_) {
      clientSocket.destroy();
      return;
    }

    const targetPort = parseInt(targetParsed.port || (targetParsed.protocol === 'https:' ? '443' : '80'), 10);
    const targetHost = targetParsed.hostname;

    // 核心防御 4：完全重写并归一化 WebSocket 握手来源信息，彻底根治后端 403 Forbidden
    const proxyOrigin = 'http://127.0.0.1:' + proxyPort;
    const targetOrigin = targetParsed.origin;

    if (!isAllowedOrigin(req.headers.origin, targetOrigin) ||
        !isAllowedOrigin(req.headers['sec-websocket-origin'], targetOrigin)) {
      clientSocket.end('HTTP/1.1 403 Forbidden\\r\\nConnection: close\\r\\nContent-Length: 0\\r\\n\\r\\n');
      return;
    }

    const targetHeaders = { ...req.headers };
    targetHeaders.host = targetParsed.host;

    // 1. 重写 Origin 为目标后端来源，防止 CSWSH (Cross-Site WebSocket Hijacking) 跨域拦截
    if (targetHeaders.origin) {
      targetHeaders.origin = targetOrigin;
    }
    if (targetHeaders['sec-websocket-origin']) {
      targetHeaders['sec-websocket-origin'] = targetOrigin;
    }

    // 2. 重写 Referer 来源为目标后端来源
    if (targetHeaders.referer) {
      targetHeaders.referer = targetHeaders.referer.split(proxyOrigin).join(targetOrigin);
    }

    // 3. 补充标准反向代理转发凭证
    targetHeaders['x-forwarded-host'] = req.headers.host || ('127.0.0.1:' + proxyPort);
    targetHeaders['x-forwarded-proto'] = targetParsed.protocol ? targetParsed.protocol.replace(':', '') : 'http';
    targetHeaders['x-forwarded-for'] = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '127.0.0.1';

    // 4. 健壮序列化 HTTP Upgrade 请求头报文（支持单值与数组形态）
    const headerLines = [];
    for (const [key, val] of Object.entries(targetHeaders)) {
      if (val === undefined || val === null) continue;
      if (Array.isArray(val)) {
        for (const item of val) {
          headerLines.push(key + ': ' + item);
        }
      } else {
        headerLines.push(key + ': ' + val);
      }
    }

    const targetSocket = net.connect(targetPort, targetHost, () => {
      targetSocket.write(
        req.method + ' ' + req.url + ' HTTP/' + req.httpVersion + '\\r\\n' +
        headerLines.join('\\r\\n') +
        '\\r\\n\\r\\n'
      );
      if (head && head.length > 0) targetSocket.write(head);
      targetSocket.pipe(clientSocket);
      clientSocket.pipe(targetSocket);
    });

    targetSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => targetSocket.destroy());
    targetSocket.on('close', () => clientSocket.destroy());
    clientSocket.on('close', () => targetSocket.destroy());
  });

    proxyReadyPromise = new Promise((resolve) => {
      proxyServer.listen(0, '127.0.0.1', () => {
        if (proxyServer && proxyServer.address()) {
          proxyPort = proxyServer.address().port;
        }
        resolve(proxyPort);
      });
    });
  }

  if (proxyServer && proxyServer.listening && proxyServer.address()) {
    proxyPort = proxyServer.address().port;
  }

  return proxyPort;
}

function ensureProxyReady() {
  startProxy();
  if (proxyPort > 0) return Promise.resolve(proxyPort);
  return proxyReadyPromise || Promise.resolve(proxyPort);
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

function stopProxy() {
  if (proxyServer) {
    try { proxyServer.close(); } catch (_) {}
    proxyServer = null;
    proxyPort = 0;
    proxyReadyPromise = null;
  }
}

startProxy();

module.exports = {
  startProxy,
  stopProxy,
  ensureProxyReady,
  getProxiedUrls
};
`;
}

/**
 * 在内存中生成补丁，匹配或语法验证失败时不写入扩展。
 */
function buildPatchedExtensionJs(content) {
  // 2. 检查并注入 renderWebviewHtml 拦截（弹性兼容未压缩版与 1.8.0+ 压缩混淆版）
  const sigRegex = /renderWebviewHtml\s*\(\s*([a-zA-Z0-9_$]+)\s*,\s*([a-zA-Z0-9_$]+)\s*,\s*([a-zA-Z0-9_$]+)\s*,\s*([a-zA-Z0-9_$]+)\s*\)\s*\{/;
  const sigMatch = content.match(sigRegex);
  if (!sigMatch) {
    throw new Error('未在 extension.js 中匹配到 renderWebviewHtml 签名');
  }

  const [matchedSignature, , paramServerUrl, paramFullUrl] = sigMatch;

  const proxyRequireHeader = `// --- AGY_VSCODE_I18N_PROXY_INJECTION_START ---
let __agyI18nProxy = null;
try {
  __agyI18nProxy = require('./agy-i18n-proxy.js');
} catch (_) {}
// --- AGY_VSCODE_I18N_PROXY_INJECTION_END ---
`;

  const interceptionCode = `${matchedSignature}\n` +
`        // --- AGY_VSCODE_I18N_INTERCEPT_START ---
        try {
          if (!__agyI18nProxy) {
            __agyI18nProxy = require('./agy-i18n-proxy.js');
          }
          if (__agyI18nProxy && typeof __agyI18nProxy.getProxiedUrls === 'function') {
            const __proxied = __agyI18nProxy.getProxiedUrls(${paramServerUrl}, ${paramFullUrl});
            ${paramServerUrl} = __proxied.serverUrl;
            ${paramFullUrl} = __proxied.fullUrlString;
          }
        } catch (_) {}
        // --- AGY_VSCODE_I18N_INTERCEPT_END ---
`;

  content = proxyRequireHeader + content.replace(matchedSignature, interceptionCode);

  // 保留原模块的 strict 指令语义。
  if (/^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*(['"])use strict\1\s*;/.test(content.slice(proxyRequireHeader.length))) {
    content = '"use strict";\n' + content;
  }
  new Function(content);
  return content;
}

function isInjectedJs(content) {
  return content.includes('AGY_VSCODE_I18N_PROXY_INJECTION');
}

// 每个文件通过同目录 rename 替换；任一步失败时恢复本次写入前的内容。
function commitFiles(files) {
  const originals = new Map([...files.keys()].map(file =>
    [file, fs.existsSync(file) ? fs.readFileSync(file) : null]));
  const changed = [];
  function replace(file, content) {
    if (content === null) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      return;
    }
    const temporary = file + '.tmp-' + crypto.randomBytes(8).toString('hex');
    try {
      fs.writeFileSync(temporary, content);
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  try {
    for (const [file, content] of files) {
      replace(file, content);
      changed.push(file);
    }
  } catch (err) {
    const failures = [];
    for (const file of changed.reverse()) {
      try { replace(file, originals.get(file)); }
      catch (_) { failures.push(path.basename(file)); }
    }
    if (failures.length) err.message += '; 回滚失败，请保留备份并检查: ' + failures.join(', ');
    throw err;
  }
}

function getPristineJs(extDir) {
  const current = fs.readFileSync(path.join(extDir, 'extension.js'), 'utf8');
  if (!isInjectedJs(current)) return current;
  const backup = fs.readFileSync(path.join(extDir, 'extension.js.bak'), 'utf8');
  if (isInjectedJs(backup)) throw new Error('extension.js 纯净备份已被补丁污染，无法安全操作');
  const currentPkg = JSON.parse(fs.readFileSync(path.join(extDir, 'package.json'), 'utf8'));
  const backupPkg = JSON.parse(fs.readFileSync(path.join(extDir, 'package.json.bak'), 'utf8'));
  if (currentPkg.version !== backupPkg.version) throw new Error('扩展版本与备份不一致，拒绝使用旧版 extension.js');
  return backup;
}

function patchExtensionJs(extDir) {
  try {
    const source = getPristineJs(extDir);
    const patched = buildPatchedExtensionJs(source);
    const files = new Map([
      [path.join(extDir, 'extension.js.bak'), source],
      [path.join(extDir, 'extension.js'), patched]
    ]);
    const pkgRaw = fs.readFileSync(path.join(extDir, 'package.json'), 'utf8');
    if (!JSON.parse(pkgRaw).__antigravity_chinese_patched) {
      files.set(path.join(extDir, 'package.json.bak'), pkgRaw);
    }
    commitFiles(files);
    return { success: true };
  } catch (err) { return { success: false, message: err.message }; }
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

  try {
    // 未打补丁的当前文件代表新上游基线，不能被遗留备份覆盖。
    const currentRaw = fs.readFileSync(pkgPath, 'utf8');
    const currentPkg = JSON.parse(currentRaw);
    const sourceRaw = currentPkg.__antigravity_chinese_patched
      ? fs.readFileSync(bakPath, 'utf8') : currentRaw;
    const pkg = JSON.parse(sourceRaw);
    if (pkg.__antigravity_chinese_patched || pkg.version !== currentPkg.version) {
      throw new Error('package.json 纯净备份污染或版本不一致，拒绝覆盖当前扩展');
    }
    const sourceJs = getPristineJs(extDir);
    const patchedJs = buildPatchedExtensionJs(sourceJs);

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
    commitFiles(new Map([
      [bakPath, sourceRaw],
      [path.join(extDir, 'extension.js.bak'), sourceJs],
      [path.join(extDir, 'i18n-bundle.js'), getI18nBundleScript()],
      [path.join(extDir, 'agy-i18n-proxy.js'), getAgyI18nProxyTemplate()],
      [path.join(extDir, 'extension.js'), patchedJs],
      [pkgPath, JSON.stringify(pkg, null, '\t') + '\n'],
      [metaPath, JSON.stringify({ patched: true, timestamp: Date.now(), extDir }, null, 2)]
    ]));

    return {
      success: true,
      message: `成功为 VS Code 扩展注入全景中文本地化 (package.json + Webview i18n Proxy): ${extDir}`,
      extDir
    };
  } catch (err) {
    return { success: false, message: `无法安全安装扩展补丁: ${err.message}`, extDir };
  }
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
  const metaPath = path.join(extDir, '.antigravity_vscode_meta.json');
  const bundlePath = path.join(extDir, 'i18n-bundle.js');
  const proxyPath = path.join(extDir, 'agy-i18n-proxy.js');

  try {
    const files = new Map();
    const currentPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (currentPkg.__antigravity_chinese_patched) {
      const backup = fs.readFileSync(bakPath, 'utf8');
      const backupPkg = JSON.parse(backup);
      if (backupPkg.name !== currentPkg.name || backupPkg.__antigravity_chinese_patched || backupPkg.version !== currentPkg.version) {
        throw new Error('package.json 纯净备份污染或版本不一致');
      }
      files.set(pkgPath, backup);
    }
    if (fs.existsSync(extJsPath) && isInjectedJs(fs.readFileSync(extJsPath, 'utf8'))) {
      files.set(extJsPath, getPristineJs(extDir));
    }
    // 全部备份验证通过后才写入或清理；干净的上游新文件原样保留。
    for (const file of [bundlePath, proxyPath, metaPath]) files.set(file, null);
    commitFiles(files);
    return { success: true, message: `已安全恢复或保留 VS Code 扩展官方原生状态: ${extDir}` };
  } catch (err) {
    return { success: false, message: `无法安全还原扩展: ${err.message}` };
  }
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
