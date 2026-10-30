const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const { JSDOM } = require('jsdom');
const { SimpleWebSocketClient } = require('../core/cdp-client');
const { findVsCodeExtensionDir, installVsCodePatch, restoreVsCodePatch,
  getAgyI18nProxyTemplate } = require('../core/vscode-patch');

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-regression-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function extension(dir, version = '1.9.0', suffix = '') {
  fs.mkdirSync(dir, { recursive: true });
  const pkg = JSON.stringify({ name: 'google-antigravity', publisher: 'google', version,
    description: "Bring Google's agent-first development platform to Visual Studio Code." });
  const js = `"use strict"; class View { renderWebviewHtml(a,b,c,d) { a.html = c; } } // ${suffix}`;
  fs.writeFileSync(path.join(dir, 'package.json'), pkg);
  fs.writeFileSync(path.join(dir, 'extension.js'), js);
  return { pkg, js };
}

test('extension discovery selects the newest numeric version and validates identity', (t) => {
  const home = tempDir(t);
  const base = path.join(home, '.vscode', 'extensions');
  extension(path.join(base, 'google.google-antigravity-1.9.0'));
  const newest = path.join(base, 'google.google-antigravity-1.10.0');
  extension(newest, '1.10.0');
  const originalHome = os.homedir;
  os.homedir = () => home;
  try {
    assert.equal(findVsCodeExtensionDir(), newest);
    fs.mkdirSync(path.join(base, 'google.google-antigravity-99.0.0'));
    assert.equal(findVsCodeExtensionDir(), newest);
  }
  finally { os.homedir = originalHome; }
  const unrelated = path.join(home, 'other');
  fs.mkdirSync(unrelated);
  fs.writeFileSync(path.join(unrelated, 'package.json'), '{"name":"other"}');
  assert.equal(findVsCodeExtensionDir(unrelated), null);
});

test('reinstall after an upstream update preserves the new manifest and executable', (t) => {
  const dir = tempDir(t);
  extension(dir);
  assert.equal(installVsCodePatch(dir).success, true);
  const updated = extension(dir, '1.10.0', 'new upstream implementation');
  assert.equal(installVsCodePatch(dir).success, true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))).version, '1.10.0');
  assert.match(fs.readFileSync(path.join(dir, 'extension.js'), 'utf8'), /new upstream implementation/);
  assert.equal(restoreVsCodePatch(dir).success, true);
  assert.equal(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'), updated.pkg);
  assert.equal(fs.readFileSync(path.join(dir, 'extension.js'), 'utf8'), updated.js);
});

test('restore never replaces a clean upstream update with stale backups', (t) => {
  const dir = tempDir(t);
  extension(dir);
  installVsCodePatch(dir);
  const updated = extension(dir, '1.10.0', 'updated');
  assert.equal(restoreVsCodePatch(dir).success, true);
  assert.equal(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'), updated.pkg);
  assert.equal(fs.readFileSync(path.join(dir, 'extension.js'), 'utf8'), updated.js);
});

test('restore with a missing pristine backup fails without removing runtime assets', (t) => {
  const dir = tempDir(t);
  extension(dir);
  installVsCodePatch(dir);
  fs.unlinkSync(path.join(dir, 'extension.js.bak'));
  const before = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
  assert.equal(restoreVsCodePatch(dir).success, false);
  assert.equal(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'), before);
  assert.ok(fs.existsSync(path.join(dir, 'agy-i18n-proxy.js')));
});

test('unsupported extension signatures leave the original installation untouched', (t) => {
  const dir = tempDir(t);
  const original = extension(dir);
  fs.writeFileSync(path.join(dir, 'extension.js'), 'exports.activate = () => {};');
  assert.equal(installVsCodePatch(dir).success, false);
  assert.equal(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'), original.pkg);
  assert.ok(!fs.existsSync(path.join(dir, 'i18n-bundle.js')));
});

test('an installation write failure rolls back both manifests, executable and assets', (t) => {
  const dir = tempDir(t);
  const original = extension(dir);
  const originalRename = fs.renameSync;
  let failed = false;
  fs.renameSync = (from, to) => {
    if (!failed && to === path.join(dir, 'package.json')) {
      failed = true;
      throw new Error('simulated write failure');
    }
    return originalRename(from, to);
  };
  try { assert.equal(installVsCodePatch(dir).success, false); }
  finally { fs.renameSync = originalRename; }
  assert.equal(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'), original.pkg);
  assert.equal(fs.readFileSync(path.join(dir, 'extension.js'), 'utf8'), original.js);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['extension.js', 'package.json']);
});

test('the unified CLI installs and restores an explicitly selected VS Code extension', (t) => {
  const dir = tempDir(t);
  const original = extension(dir);
  for (const command of ['install', 'restore']) {
    const result = spawnSync(process.execPath, [path.join(__dirname, '../cli.js'), command, '--path', dir],
      { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
  assert.equal(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'), original.pkg);
  assert.equal(fs.readFileSync(path.join(dir, 'extension.js'), 'utf8'), original.js);
});

test('an incomplete --path argument fails before default installation discovery', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, '../cli.js'), 'status', '--path'],
    { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--path/);
});

test('custom desktop discovery accepts a resources directory', (t) => {
  const dir = tempDir(t);
  const resources = path.join(dir, 'resources');
  fs.mkdirSync(resources);
  const asarPath = path.join(resources, 'app.asar');
  fs.writeFileSync(asarPath, 'not patched');
  const result = spawnSync(process.execPath, ['-e',
    'console.log(require(process.argv[1]).findAsarPath(process.argv[2]))',
    path.join(__dirname, '../cli.js'), resources], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), asarPath);
});

test('the consistency audit rejects an incorrect suite count in either README', () => {
  for (const readme of ['README.md', 'README.en.md']) {
    const script = `
      const fs = require('fs');
      const original = fs.readFileSync;
      fs.readFileSync = function(file, ...args) {
        const content = original.call(this, file, ...args);
        if (require('path').basename(String(file)) !== process.argv[1]) return content;
        return String(content).replace(/聚合 \\d+ 大|aggregating \\d+ full-fidelity/,
          process.argv[1] === 'README.md' ? '聚合 999 大' : 'aggregating 999 full-fidelity');
      };
      require(process.argv[2]);
    `;
    const result = spawnSync(process.execPath, ['-e', script, readme,
      path.join(__dirname, '../tools/ultimate-consistency-audit.js')], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1, readme);
    assert.match(result.stdout, /测试套件数量.*FAIL|FAIL.*测试套件数量/);
  }
});

async function listen(t, server) {
  const sockets = new Set();
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    for (const socket of sockets) socket.destroy();
    return new Promise(resolve => server.close(resolve));
  });
  return server.address().port;
}

function bounded(promise) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('operation remained pending')), 800);
  })]).finally(() => clearTimeout(timer));
}

test('CDP rejects a refused HTTP upgrade promptly', async (t) => {
  const port = await listen(t, http.createServer((req, res) => { res.writeHead(403); res.end(); }));
  const client = new SimpleWebSocketClient(`ws://127.0.0.1:${port}/`);
  t.after(() => client.close());
  await assert.rejects(bounded(client.connect()), /403/);
});

test('CDP refuses sends before connection instead of leaving pending callbacks', async () => {
  const client = new SimpleWebSocketClient('ws://127.0.0.1:1/');
  await assert.rejects(bounded(client.send('Page.enable')), /connect|连接/i);
  assert.equal(client.pendingCallbacks.size, 0);
});

test('CDP times out a stalled handshake', async (t) => {
  const port = await listen(t, http.createServer(() => {}));
  const client = new SimpleWebSocketClient(`ws://127.0.0.1:${port}/`, { connectTimeout: 50 });
  t.after(() => client.close());
  await assert.rejects(bounded(client.connect()), /超时/);
});

function wsServer(onData) {
  const server = http.createServer();
  server.on('upgrade', (req, socket) => {
    const accept = crypto.createHash('sha1')
      .update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.on('data', chunk => onData(socket, chunk));
    socket.on('error', () => {});
  });
  return server;
}

test('CDP rejects in-flight commands on disconnect and clears callbacks', async (t) => {
  const port = await listen(t, wsServer(socket => socket.destroy()));
  const client = new SimpleWebSocketClient(`ws://127.0.0.1:${port}/`);
  t.after(() => client.close());
  await client.connect();
  await assert.rejects(bounded(client.send('Page.enable')), /clos|disconnect|连接|关闭/i);
  assert.equal(client.pendingCallbacks.size, 0);
});

test('CDP times out unanswered commands and clears callbacks', async (t) => {
  const port = await listen(t, wsServer(() => {}));
  const client = new SimpleWebSocketClient(`ws://127.0.0.1:${port}/`, { commandTimeout: 50 });
  t.after(() => client.close());
  await client.connect();
  await assert.rejects(bounded(client.send('Page.enable')), /超时/);
  assert.equal(client.pendingCallbacks.size, 0);
});

test('CDP rejects oversized frames before buffering their payload', async (t) => {
  let sent = false;
  const port = await listen(t, wsServer(socket => {
    if (sent) return;
    sent = true;
    const frame = Buffer.alloc(10);
    frame[0] = 0x81;
    frame[1] = 127;
    frame.writeBigUInt64BE(2n ** 60n, 2);
    socket.write(frame);
  }));
  const client = new SimpleWebSocketClient(`ws://127.0.0.1:${port}/`);
  t.after(() => client.close());
  await client.connect();
  await assert.rejects(bounded(client.send('Page.enable')), /大小限制/);
  assert.equal(client.pendingCallbacks.size, 0);
});

test('CDP handles fragmented UTF-8 responses with interleaved ping frames', async (t) => {
  let sent = false;
  const port = await listen(t, wsServer(socket => {
    if (sent) return;
    sent = true;
    const payload = Buffer.from(JSON.stringify({ id: 1, result: { text: '中文' } }));
    const split = payload.indexOf(Buffer.from('中文')) + 1;
    const first = payload.subarray(0, split);
    const last = payload.subarray(split);
    socket.write(Buffer.concat([Buffer.from([0x01, first.length]), first,
      Buffer.from([0x89, 0]), Buffer.from([0x80, last.length]), last]));
  }));
  const client = new SimpleWebSocketClient(`ws://127.0.0.1:${port}/`);
  t.after(() => client.close());
  await client.connect();
  assert.deepEqual(await bounded(client.send('Runtime.evaluate')), { text: '中文' });
});

test('the webview proxy decodes Brotli HTML before injecting the runtime', async (t) => {
  const dir = tempDir(t);
  const html = '<html><head></head><body>Settings</body></html>';
  const port = await listen(t, http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'br' });
    res.end(zlib.brotliCompressSync(Buffer.from(html)));
  }));
  const proxyPath = path.join(dir, 'proxy.js');
  fs.writeFileSync(proxyPath, getAgyI18nProxyTemplate());
  fs.writeFileSync(path.join(dir, 'i18n-bundle.js'), 'window.injected = true;');
  const proxy = require(proxyPath);
  t.after(() => proxy.stopProxy());
  proxy.getProxiedUrls(`http://127.0.0.1:${port}/`, `http://127.0.0.1:${port}/index.html`);
  const proxyPort = await proxy.ensureProxyReady();
  const result = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${proxyPort}/index.html`, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    }).on('error', reject);
  });
  assert.match(result.body, /<body>Settings<\/body>/);
  assert.match(result.body, /window.injected = true/);
  assert.equal(result.headers['content-encoding'], undefined);
});

test('the proxy rejects unrelated browser origins before forwarding HTTP or WebSocket requests', async (t) => {
  const dir = tempDir(t);
  let forwarded = 0;
  const server = http.createServer((req, res) => { forwarded++; res.end('private backend'); });
  server.on('upgrade', (req, socket) => { forwarded++; socket.destroy(); });
  const port = await listen(t, server);
  const proxyPath = path.join(dir, 'proxy.js');
  fs.writeFileSync(proxyPath, getAgyI18nProxyTemplate());
  const proxy = require(proxyPath);
  t.after(() => proxy.stopProxy());
  proxy.getProxiedUrls(`http://127.0.0.1:${port}/`, `http://127.0.0.1:${port}/`);
  const proxyPort = await proxy.ensureProxyReady();
  for (const upgrade of [false, true]) {
    const status = await new Promise((resolve, reject) => {
      const headers = { Origin: 'https://unrelated.example' };
      if (upgrade) Object.assign(headers, { Connection: 'Upgrade', Upgrade: 'websocket',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version': '13' });
      const req = http.get({ hostname: '127.0.0.1', port: proxyPort, headers }, res => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', reject);
    });
    assert.equal(status, 403);
  }
  assert.equal(forwarded, 0);
});

test('deep mutations in code, terminals and model selectors remain untouched', async (t) => {
  const dom = new JSDOM('<body><button>Settings</button></body>',
    { runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.__AGY_I18N_DATA__ = { exact: { Settings: '设置' } };
  window.eval(fs.readFileSync(path.join(__dirname, '../core/i18n-runtime.js'), 'utf8'));
  await new Promise(resolve => window.setTimeout(resolve, 40));
  assert.equal(window.document.querySelector('button').textContent, '设置');
  for (const selector of ['pre', 'div.xterm', 'div[data-testid="model-selector-item"]',
    'div[contenteditable="true"]']) {
    const tag = selector.startsWith('pre') ? 'pre' : 'div';
    const parent = window.document.createElement(tag);
    if (selector.includes('.xterm')) parent.className = 'xterm';
    if (selector.includes('data-testid')) parent.setAttribute('data-testid', 'model-selector-item');
    if (selector.includes('contenteditable')) parent.setAttribute('contenteditable', 'true');
    parent.innerHTML = '<div><div><div><div><span></span></div></div></div></div>';
    window.document.body.appendChild(parent);
    await new Promise(resolve => window.setTimeout(resolve, 40));
    const text = window.document.createTextNode('Settings');
    parent.querySelector('span').appendChild(text);
    await new Promise(resolve => window.setTimeout(resolve, 40));
    assert.equal(text.nodeValue, 'Settings', selector);
  }
});
