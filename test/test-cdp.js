/**
 * Zero-Dependency RFC 6455 CDP WebSocket Client Regression Suite
 * 验证纯原生手搓 WebSocket 客户端握手、掩码帧编解码、JSON-RPC 请求响应与双向通信
 */

const http = require('http');
const crypto = require('crypto');
const assert = require('assert');
const { SimpleWebSocketClient } = require('../core/cdp-client.js');

console.log('🧪 === 开始执行零依赖 CDP WebSocket 客户端协议与通信回归测试 ===\n');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// 搭建一个轻量级本地 mock CDP WebSocket 服务端
const server = http.createServer((req, res) => {
  if (req.url === '/json/version') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 'Browser': 'Chrome/120.0.0.0' }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.on('upgrade', (req, socket, head) => {
  const clientKey = req.headers['sec-websocket-key'];
  const acceptVal = crypto
    .createHash('sha1')
    .update(clientKey + WS_GUID)
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${acceptVal}\r\n\r\n`
  );

  socket.on('end', () => socket.end());

  socket.on('data', chunk => {
    // 解码客户端发来的掩码帧 (Client -> Server)
    if (chunk.length < 6) return;
    const isMasked = (chunk[1] & 0x80) !== 0;
    assert.strictEqual(isMasked, true, 'RFC 6455 规范要求：客户端发送的所有帧必须携带掩码');

    let payloadLen = chunk[1] & 0x7f;
    let offset = 2;
    if (payloadLen === 126) {
      payloadLen = chunk.readUInt16BE(offset);
      offset += 2;
    }

    const maskKey = chunk.slice(offset, offset + 4);
    offset += 4;
    const rawPayload = chunk.slice(offset, offset + payloadLen);
    const unmasked = Buffer.alloc(rawPayload.length);
    for (let i = 0; i < rawPayload.length; i++) {
      unmasked[i] = rawPayload[i] ^ maskKey[i % 4];
    }

    const text = unmasked.toString('utf8');
    if (!text) return;

    try {
      const msg = JSON.parse(text);
      if (msg.method === 'Page.enable') {
        // 服务端向客户端回传响应 (Server -> Client 不带掩码)
        sendServerText(socket, JSON.stringify({ id: msg.id, result: { enabled: true } }));
      } else if (msg.method === 'Page.addScriptToEvaluateOnNewDocument') {
        sendServerText(socket, JSON.stringify({ id: msg.id, result: { identifier: 'script-123' } }));
      } else if (msg.method === 'Runtime.evaluate') {
        sendServerText(socket, JSON.stringify({ id: msg.id, result: { result: { type: 'string', value: 'injected' } } }));
      }
    } catch (e) {}
  });
});

function sendServerText(socket, str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len <= 125) {
    header = Buffer.from([0x81, len]);
  } else if (len <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const wsUrl = `ws://127.0.0.1:${port}/devtools/page/test-target`;

  console.log(`Mock CDP Server 运行于 127.0.0.1:${port}`);

  try {
    const client = new SimpleWebSocketClient(wsUrl);
    await client.connect();
    assert.strictEqual(client.connected, true, '客户端握手成功连接状态应为 true');
    console.log('✅ [PASS] RFC 6455 握手认证与连接建立成功');

    // 1. 测试 Page.enable
    const res1 = await client.send('Page.enable');
    assert.strictEqual(res1.enabled, true);
    console.log('✅ [PASS] Page.enable JSON-RPC 往返通信响应成功');

    // 2. 测试 Page.addScriptToEvaluateOnNewDocument
    const res2 = await client.send('Page.addScriptToEvaluateOnNewDocument', { source: 'console.log("hello")' });
    assert.strictEqual(res2.identifier, 'script-123');
    console.log('✅ [PASS] Page.addScriptToEvaluateOnNewDocument 注册新文档脚本成功');

    // 3. 测试 Runtime.evaluate
    const res3 = await client.send('Runtime.evaluate', { expression: '1 + 1' });
    assert.strictEqual(res3.result.value, 'injected');
    console.log('✅ [PASS] Runtime.evaluate 运行时即时执行成功');

    client.close();
    assert.strictEqual(client.connected, false);
    console.log('✅ [PASS] 客户端安全优雅关闭连接');

    server.close(() => {
      console.log('\n🎉 [CDP 客户端协议测试] 100% 全部通过！纯原生手搓协议可靠无误！\n');
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ [CDP 客户端测试失败]', err);
    server.close();
    process.exit(1);
  }
});
