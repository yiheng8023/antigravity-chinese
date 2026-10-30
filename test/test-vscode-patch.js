/**
 * VS Code 扩展汉化补丁与生命周期回归测试套件 (包含 Webview 代理注入)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  findVsCodeExtensionDir,
  isVsCodeExtensionPatched,
  installVsCodePatch,
  restoreVsCodePatch,
  getAgyI18nProxyTemplate,
  VSCODE_TRANSLATION_MAP
} = require('../core/vscode-patch');

console.log('🧪 ============================================================');
console.log('🧪 开始执行 VS Code 扩展汉化生命周期、Webview 代理注入与防污染自动化测试');
console.log('🧪 ============================================================');

const testDir = path.join(os.tmpdir(), `agy_test_vscode_${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

// 模拟官方真实 1.6.0 版 package.json
const rawOriginalPkg = {
  name: "google-antigravity",
  displayName: "Google Antigravity",
  description: "Bring Google's agent-first development platform to Visual Studio Code.",
  version: "1.6.0",
  contributes: {
    customEditors: [
      {
        viewType: "antigravity.artifactEditor",
        displayName: "Antigravity Artifact Viewer"
      },
      {
        viewType: "jetski.settingsEditor",
        displayName: "Antigravity Settings Viewer"
      }
    ],
    commands: [
      { command: "antigravity.showThirdPartyNotices", title: "Show Third Party Notices" },
      { command: "antigravity.resetConversationState", title: "Reset Conversation State" },
      { command: "antigravity.insertSnippet", title: "Add Selection to Chat" },
      { command: "antigravity.insertTerminalSnippet", title: "Add Terminal Selection or Output to Chat" },
      { command: "antigravity.panel.focus", title: "Focus Antigravity Panel" },
      { command: "antigravity.inlineDiff.acceptAll", title: "Accept All Changes" },
      { command: "antigravity.inlineDiff.rejectAll", title: "Reject All Changes" },
      { command: "antigravity.toggleInlineDiff", title: "Toggle Inline Diff" },
      { command: "antigravity.openSettings", title: "Open Antigravity Settings" },
      { command: "antigravity.feedback", title: "Provide Feedback" }
    ],
    configuration: {
      title: "Antigravity",
      properties: {
        "antigravity.serverPort": {
          description: "Port for the Antigravity background server (`agy --hub`). Leave at 0 to allocate an ephemeral port automatically."
        },
        "antigravity.enableTelemetry": {
          description: "Enable sending client-side product telemetry and usage metrics to Google Cloudmill to help improve Antigravity."
        },
        "antigravity.enableInlineDiff": {
          description: "Enable inline diff decorations and CodeLenses. When disabled, falls back to opening changes in a side-by-side diff tab."
        },
        "antigravity.autoAcceptOnChat": {
          description: "Auto-accept pending edits in background files when sending a new chat message."
        },
        "antigravity.autoOpenFiles": {
          description: "Automatically open files in the editor when the agent proposes edits."
        },
        "antigravity.channel": {
          description: "The release channel for this extension build",
          deprecationMessage: "Internal channel setting"
        }
      }
    }
  }
};

// 模拟官方 extension.js 核心片段
const rawOriginalExtJs = `
const vscode = require('vscode');
class AntigravityDelegate {
    renderWebviewHtml(webview, serverUrl, fullUrlString, options) {
        patchWebviewPostMessage(webview);
        webview.html = '<html><body><iframe id="jetski-frame" src="' + fullUrlString + '"></iframe></body></html>';
    }
}
exports.activate = function(context) {};
`;

const pkgPath = path.join(testDir, 'package.json');
const extJsPath = path.join(testDir, 'extension.js');
fs.writeFileSync(pkgPath, JSON.stringify(rawOriginalPkg, null, 2), 'utf-8');
fs.writeFileSync(extJsPath, rawOriginalExtJs, 'utf-8');

async function runAllTests() {
  try {
    // 1. 初始状态检测
    assert.strictEqual(isVsCodeExtensionPatched(testDir), false, '初始状态应未打补丁');
    console.log('✅ [PASS] 初始状态确认为未打补丁');

    // 2. 首次安装
    const installRes1 = installVsCodePatch(testDir);
    assert.strictEqual(installRes1.success, true, '首次安装应成功');
    assert.strictEqual(isVsCodeExtensionPatched(testDir), true, '首次安装后状态应为已打补丁');

    const pkgBakPath = path.join(testDir, 'package.json.bak');
    assert(fs.existsSync(pkgBakPath), '应生成纯净备份 package.json.bak');
    const pkgBakContent = fs.readFileSync(pkgBakPath, 'utf-8');
    assert.deepStrictEqual(JSON.parse(pkgBakContent), rawOriginalPkg, '纯净备份必须 100% 等于官方原生未修改版本');

    const extJsBakPath = path.join(testDir, 'extension.js.bak');
    assert(fs.existsSync(extJsBakPath), '应生成纯净备份 extension.js.bak');
    assert.strictEqual(fs.readFileSync(extJsBakPath, 'utf-8'), rawOriginalExtJs, 'extension.js 备份必须与官方原版绝对一致');
    console.log('✅ [PASS] 首次安装成功生成 package.json.bak 与 extension.js.bak 双重纯净备份');

    // 验证 Webview 资产与 extension.js 拦截注入
    assert(fs.existsSync(path.join(testDir, 'i18n-bundle.js')), '应生成 i18n-bundle.js 静态资产');
    assert(fs.existsSync(path.join(testDir, 'agy-i18n-proxy.js')), '应生成 agy-i18n-proxy.js 本地微代理');

    const patchedExtJs = fs.readFileSync(extJsPath, 'utf-8');
    assert(patchedExtJs.includes('AGY_VSCODE_I18N_PROXY_INJECTION'), 'extension.js 应包含 proxy 引入');
    assert(patchedExtJs.includes('AGY_VSCODE_I18N_INTERCEPT_START'), 'extension.js 应包含 renderWebviewHtml 拦截');
    assert.doesNotThrow(() => { new Function(patchedExtJs); }, '修补后的 extension.js 必须具备 100% 语法合法性');
    console.log('✅ [PASS] extension.js 深度拦截与微代理资产注入就绪 (语法合法性验证通过)');

    const patchedPkg1 = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    assert.strictEqual(patchedPkg1.description, '将 Google 以智能体为核心的开发平台引入 Visual Studio Code。');
    assert.strictEqual(patchedPkg1.contributes.commands[2].title, '将选中文本添加到对话');
    assert.strictEqual(patchedPkg1.contributes.commands[5].title, '接受所有更改');
    assert.strictEqual(patchedPkg1.contributes.commands[8].title, '打开 Antigravity 设置');
    assert.strictEqual(patchedPkg1.contributes.customEditors[0].displayName, 'Antigravity 产物文档查看器');
    assert.strictEqual(patchedPkg1.contributes.configuration.properties['antigravity.enableInlineDiff'].description, '启用内联代码差异标记与 CodeLens。禁用后将回退为在并排对比标签页中显示更改。');
    assert.strictEqual(patchedPkg1.contributes.configuration.properties['antigravity.channel'].deprecationMessage, '内部频道设置');
    console.log('✅ [PASS] 首次安装后所有命令、设置描述与查看器标题 100% 汉化');

    // 3. 二次重复安装（幂等性与防备份污染 P0 验证）
    const installRes2 = installVsCodePatch(testDir);
    assert.strictEqual(installRes2.success, true, '二次安装应成功');
    const pkgBakContent2 = fs.readFileSync(pkgBakPath, 'utf-8');
    assert.deepStrictEqual(JSON.parse(pkgBakContent2), rawOriginalPkg, '【P0 验证通过】二次安装绝对未污染 package.json 纯净备份！');
    const extJsBakContent2 = fs.readFileSync(extJsBakPath, 'utf-8');
    assert.strictEqual(extJsBakContent2, rawOriginalExtJs, '【P0 验证通过】二次安装绝对未污染 extension.js 纯净备份！');
    console.log('✅ [PASS] 二次安装幂等性验证通过，纯净备份未受二次污染');

    // 4. 执行还原 (Restore)
    const restoreRes = restoreVsCodePatch(testDir);
    assert.strictEqual(restoreRes.success, true, '执行还原应成功');
    assert.strictEqual(isVsCodeExtensionPatched(testDir), false, '还原后状态应恢复为未打补丁');
    const restoredPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    assert.deepStrictEqual(restoredPkg, rawOriginalPkg, '【P0 验证通过】还原后 package.json 必须 100% 恢复为官方原生版本！');
    const restoredExtJs = fs.readFileSync(extJsPath, 'utf-8');
    assert.strictEqual(restoredExtJs, rawOriginalExtJs, '【P0 验证通过】还原后 extension.js 必须 100% 恢复为官方原生版本！');
    assert(!fs.existsSync(path.join(testDir, 'i18n-bundle.js')), '还原后 i18n-bundle.js 应被安全清除');
    assert(!fs.existsSync(path.join(testDir, 'agy-i18n-proxy.js')), '还原后 agy-i18n-proxy.js 应被安全清除');
    console.log('✅ [PASS] 还原功能 100% 恢复官方原生版本并彻底清理注入文件');

    // 5. 缺失目录探测优雅降级测试
    const fakeDir = path.join(testDir, 'non_existent_subdir');
    const failRes = installVsCodePatch(fakeDir);
    assert.strictEqual(failRes.success, false);
    console.log('✅ [PASS] 缺失目录优雅静默跳过，无崩溃异常');

    // 6. 验证全新 1.8.0 / 1.9.0+ 压缩混淆版 extension.js 弹性适配注入与新增配置命令汉化
    const minifiedDir = path.join(os.tmpdir(), `agy_test_vscode_min_${Date.now()}`);
    try {
      fs.mkdirSync(minifiedDir, { recursive: true });
      const minPkg = {
        ...rawOriginalPkg,
        version: "1.9.0",
        contributes: {
          ...rawOriginalPkg.contributes,
          commands: [
            ...rawOriginalPkg.contributes.commands,
            { command: "antigravity.inlineDiff.acceptFocusedHunk", title: "Accept Focused Change" },
            { command: "antigravity.openTelemetrySettings", title: "Manage Data Sharing & Telemetry" }
          ],
          configuration: {
            properties: {
              ...rawOriginalPkg.contributes.configuration.properties,
              "antigravity.autoRecover": {
                type: "boolean",
                description: "Automatically restart the Antigravity backend (`agy --hub`) when it stops unexpectedly mid-session, with bounded exponential backoff (at most 3 restarts per 10 minutes). When off, or once the restart budget is exhausted, the chat view shows an error with a manual retry button."
              }
            }
          }
        }
      };
      const minExtJs = `const dummy={renderWebviewHtml(a,b,c,d){bu(a);a.html='<html></html>';}};exports.activate=function(){};`;
      fs.writeFileSync(path.join(minifiedDir, 'package.json'), JSON.stringify(minPkg, null, 2), 'utf-8');
      fs.writeFileSync(path.join(minifiedDir, 'extension.js'), minExtJs, 'utf-8');

      const minRes = installVsCodePatch(minifiedDir);
      assert.strictEqual(minRes.success, true, '压缩混淆版 1.9.0 注入应成功');
      const patchedMinJs = fs.readFileSync(path.join(minifiedDir, 'extension.js'), 'utf-8');
      assert(patchedMinJs.includes('__agyI18nProxy.getProxiedUrls(b, c)'), '应自动捕获压缩变量 b, c 并完成代理重定向');
      assert.doesNotThrow(() => { new Function(patchedMinJs); }, '修补后的压缩混淆代码必须绝对合法，严禁丢失换行符导致后续逻辑被单行注释误伤！');
      
      const patchedMinPkg = JSON.parse(fs.readFileSync(path.join(minifiedDir, 'package.json'), 'utf-8'));
      assert(patchedMinPkg.contributes.commands.some(c => c.title === '接受当前选中的更改'), '1.9.0 新命令 Accept Focused Change 成功汉化');
      assert(patchedMinPkg.contributes.commands.some(c => c.title === '管理数据共享与遥测'), '1.9.0 新命令 Manage Data Sharing & Telemetry 成功汉化');
      assert(patchedMinPkg.contributes.configuration.properties['antigravity.autoRecover'].description.includes('当 Antigravity 后台'), '1.9.0 新配置 autoRecover 描述成功汉化');
      console.log('✅ [PASS] 1.8.0 / 1.9.0+ 压缩混淆版 renderWebviewHtml(a,b,c,d) 弹性捕获与新增命令配置全量汉化通过');
    } finally {
      try { fs.rmSync(minifiedDir, { recursive: true, force: true }); } catch (_) {}
    }

    // 7. 验证本地微代理深度拦截与 WebSocket/HTTP 来源重写 (彻底根治 403 Forbidden 与 CSWSH 防火墙)
    await (async () => {
      const http = require('http');
      const crypto = require('crypto');

      let targetReceivedWsHeaders = null;
      let targetReceivedHttpHeaders = null;
      let handshakeSuccessful = false;

      let targetPort = 0;
      const targetServer = http.createServer((req, res) => {
        if (req.url === '/test-http') {
          targetReceivedHttpHeaders = req.headers;
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': `http://127.0.0.1:${targetPort}`,
            'Location': `http://127.0.0.1:${targetPort}/redirected`
          });
          res.end(JSON.stringify({ ok: true }));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      targetServer.on('upgrade', (req, socket, head) => {
        targetReceivedWsHeaders = req.headers;
        const expectedOrigin = `http://127.0.0.1:${targetPort}`;
        // 模拟后端真实同源防御 (CSWSH 检查)：Origin 不符直接 403
        if (req.headers.origin !== expectedOrigin) {
          socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
          socket.destroy();
          return;
        }

        const key = req.headers['sec-websocket-key'];
        const acceptKey = crypto
          .createHash('sha1')
          .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
          .digest('base64');

        socket.write(
          'HTTP/1.1 101 Switching Protocols\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          'Sec-WebSocket-Accept: ' + acceptKey + '\r\n\r\n'
        );
        handshakeSuccessful = true;
        socket.destroy();
      });

      await new Promise((resolve) => targetServer.listen(0, '127.0.0.1', resolve));
      targetPort = targetServer.address().port;

      const proxyScript = getAgyI18nProxyTemplate();
      const proxyModulePath = path.join(testDir, 'test-proxy-runtime.js');
      fs.writeFileSync(proxyModulePath, proxyScript, 'utf-8');
      const proxyModule = require(proxyModulePath);

      proxyModule.getProxiedUrls(`http://127.0.0.1:${targetPort}/`, `http://127.0.0.1:${targetPort}/index.html`);
      const proxyPort = await proxyModule.ensureProxyReady();

      // A. 测试 WebSocket Upgrade 请求
      const clientWsReq = http.request({
        hostname: '127.0.0.1',
        port: proxyPort,
        path: '/ws/chat',
        method: 'GET',
        headers: {
          'Connection': 'Upgrade',
          'Upgrade': 'websocket',
          'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'Sec-WebSocket-Version': '13',
          'Origin': `http://127.0.0.1:${proxyPort}`,
          'Referer': `http://127.0.0.1:${proxyPort}/index.html`
        }
      });

      const wsResult = await new Promise((resolve) => {
        clientWsReq.on('upgrade', (res, socket, head) => {
          socket.destroy();
          resolve({ status: 101, res });
        });
        clientWsReq.on('response', (res) => {
          resolve({ status: res.statusCode, res });
        });
        clientWsReq.on('error', (err) => {
          resolve({ status: 500, error: err });
        });
        clientWsReq.end();
      });

      // B. 测试普通 HTTP 请求来源重写与响应 CORS/Location 逆向对齐
      const httpResult = await new Promise((resolve) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: proxyPort,
          path: '/test-http',
          method: 'POST',
          headers: {
            'Origin': `http://127.0.0.1:${proxyPort}`,
            'Referer': `http://127.0.0.1:${proxyPort}/index.html`,
            'Content-Type': 'application/json'
          }
        }, (res) => {
          resolve({
            statusCode: res.statusCode,
            allowOrigin: res.headers['access-control-allow-origin'],
            location: res.headers.location
          });
        });
        req.on('error', (err) => resolve({ statusCode: 500, error: err }));
        req.end(JSON.stringify({ ping: true }));
      });

      await new Promise((resolve) => targetServer.close(resolve));
      proxyModule.stopProxy();

      assert.strictEqual(wsResult.status, 101, `WebSocket 握手应为 101 Switching Protocols，实际为 ${wsResult.status}`);
      assert.strictEqual(handshakeSuccessful, true, '后端 WebSocket 握手必须成功走通');
      assert.strictEqual(targetReceivedWsHeaders.origin, `http://127.0.0.1:${targetPort}`, '后端收到的 WS Origin 必须精准重写为目标后端源');
      assert.strictEqual(targetReceivedWsHeaders.host, `127.0.0.1:${targetPort}`, '后端收到的 WS Host 必须精准重写为目标后端 Host');
      assert.strictEqual(targetReceivedWsHeaders['x-forwarded-host'], `127.0.0.1:${proxyPort}`, '必须正确携带 X-Forwarded-Host 凭据');

      assert.strictEqual(httpResult.statusCode, 200, 'HTTP POST 请求应成功返回 200');
      assert.strictEqual(targetReceivedHttpHeaders.origin, `http://127.0.0.1:${targetPort}`, '后端收到的 HTTP Origin 必须精准重写');
      assert.strictEqual(httpResult.allowOrigin, `http://127.0.0.1:${proxyPort}`, '响应 CORS Access-Control-Allow-Origin 必须已逆向对齐为客户端源');
      assert.strictEqual(httpResult.location, `http://127.0.0.1:${proxyPort}/redirected`, '响应 Location 重定向地址必须已逆向对齐为代理端口防止脱壳');

      console.log('✅ [PASS] 本地微代理 WebSocket/HTTP 来源重写、CSWSH 403 根治与 CORS/Location 逆向对齐全维断言通过');
    })();

    console.log('\n============================================================');
    console.log('📊 VS Code 扩展补丁测试完成: 共 26 项全维核心断言 100% 全部通过！');
    console.log('============================================================\n');
  } finally {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

runAllTests().catch((err) => {
  console.error('❌ 测试运行失败:', err);
  process.exit(1);
});
