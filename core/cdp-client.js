/**
 * Lightweight Zero-Dependency RFC 6455 WebSocket & CDP Client
 * 零第三方依赖纯原生 Node.js (http + net + crypto) 实现的 Chrome DevTools Protocol 客户端
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const EventEmitter = require('events');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class SimpleWebSocketClient extends EventEmitter {
  constructor(wsUrl, { connectTimeout = 10000, commandTimeout = 30000, maxPayload = 64 * 1024 * 1024 } = {}) {
    super();
    this.wsUrl = new URL(wsUrl);
    this.socket = null;
    this.connected = false;
    this.buffer = Buffer.alloc(0);
    this.msgId = 0;
    this.pendingCallbacks = new Map();
    this.connectTimeout = connectTimeout;
    this.commandTimeout = commandTimeout;
    this.maxPayload = maxPayload;
    this.request = null;
    this.fragments = [];
    this.fragmentLength = 0;
    this.fragmented = false;
  }

  connect() {
    if (this.connected || this.request) return Promise.reject(new Error('WebSocket 已连接或正在连接'));
    if (!['ws:', 'wss:'].includes(this.wsUrl.protocol)) {
      return Promise.reject(new Error('WebSocket URL 必须使用 ws: 或 wss:'));
    }
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString('base64');
      const expectedAccept = crypto
        .createHash('sha1')
        .update(key + WS_GUID)
        .digest('base64');

      const transport = this.wsUrl.protocol === 'wss:' ? https : http;
      const req = transport.request({
        hostname: this.wsUrl.hostname,
        port: this.wsUrl.port || (this.wsUrl.protocol === 'wss:' ? 443 : 80),
        path: this.wsUrl.pathname + this.wsUrl.search,
        headers: {
          'Connection': 'Upgrade',
          'Upgrade': 'websocket',
          'Sec-WebSocket-Key': key,
          'Sec-WebSocket-Version': '13',
          'Host': this.wsUrl.host
        }
      });
      this.request = req;
      let settled = false;
      const timer = setTimeout(() => req.destroy(new Error('WebSocket 连接超时')), this.connectTimeout);
      const finish = err => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.request = null;
        if (err) reject(err);
        else resolve(this);
      };

      req.on('upgrade', (res, socket, head) => {
        const accept = res.headers['sec-websocket-accept'];
        if (accept !== expectedAccept || String(res.headers.upgrade).toLowerCase() !== 'websocket') {
          socket.destroy();
          return finish(new Error('WebSocket 握手安全校验失败'));
        }

        this.socket = socket;
        this.connected = true;
        this.buffer = Buffer.alloc(0);
        this.fragments = [];
        this.fragmentLength = 0;
        this.fragmented = false;

        socket.on('data', chunk => { if (this.socket === socket && this.connected) this.handleData(chunk); });
        socket.on('close', () => {
          if (this.socket !== socket) return;
          this.connected = false;
          this.rejectPending(new Error('WebSocket 连接已关闭'));
          this.emit('close');
        });
        socket.on('end', () => socket.destroy());
        socket.on('error', err => {
          if (this.socket !== socket) return;
          this.connected = false;
          this.rejectPending(err);
          if (this.listenerCount('error')) this.emit('error', err);
        });
        finish();
        if (head && head.length > 0) this.handleData(head);
      });

      req.on('response', res => {
        res.resume();
        finish(new Error(`WebSocket 握手失败: HTTP ${res.statusCode}`));
        req.destroy();
      });
      req.on('error', finish);
      req.on('close', () => {
        if (!settled) finish(new Error('WebSocket 连接在握手完成前关闭'));
      });
      req.end();
    });
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const byte1 = this.buffer[0];
      const byte2 = this.buffer[1];
      const opcode = byte1 & 0x0f;
      const final = (byte1 & 0x80) !== 0;
      const isMasked = (byte2 & 0x80) !== 0;
      let payloadLen = byte2 & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (this.buffer.length < offset + 2) return;
        payloadLen = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLen === 127) {
        if (this.buffer.length < offset + 8) return;
        payloadLen = Number(this.buffer.readBigUInt64BE(offset));
        offset += 8;
      }

      if (!Number.isSafeInteger(payloadLen) || payloadLen > this.maxPayload ||
          (opcode >= 0x8 && (!final || payloadLen > 125)) || (byte1 & 0x70)) {
        return this.fail(new Error('WebSocket 帧无效或超过消息大小限制'));
      }

      let maskKey = null;
      if (isMasked) {
        if (this.buffer.length < offset + 4) return;
        maskKey = this.buffer.slice(offset, offset + 4);
        offset += 4;
      }

      if (this.buffer.length < offset + payloadLen) return;

      const payload = this.buffer.slice(offset, offset + payloadLen);
      this.buffer = this.buffer.slice(offset + payloadLen);

      if (isMasked) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskKey[i % 4];
        }
      }

      if (opcode === 0x1 || opcode === 0x0) {
        if ((opcode === 0x0 && !this.fragmented) || (opcode === 0x1 && this.fragmented)) {
          return this.fail(new Error('WebSocket 分片顺序无效'));
        }
        this.fragmentLength += payload.length;
        if (this.fragmentLength > this.maxPayload) return this.fail(new Error('WebSocket 消息超过大小限制'));
        this.fragments.push(payload);
        this.fragmented = !final;
        if (!final) continue;
        const text = Buffer.concat(this.fragments, this.fragmentLength).toString('utf8');
        this.fragments = [];
        this.fragmentLength = 0;
        let json;
        try {
          json = JSON.parse(text);
        } catch (_) { continue; }
        if (json && typeof json === 'object') {
          if (json.id && this.pendingCallbacks.has(json.id)) {
            const cb = this.pendingCallbacks.get(json.id);
            this.pendingCallbacks.delete(json.id);
            clearTimeout(cb.timer);
            if (json.error) {
              cb.reject(new Error(json.error.message || JSON.stringify(json.error)));
            } else {
              cb.resolve(json.result);
            }
          } else {
            this.emit('event', json);
          }
        }
      } else if (opcode === 0x8) {
        // 关闭帧
        this.close();
        return;
      } else if (opcode === 0x9) {
        // Ping 帧 -> 响应 Pong
        this.sendFrame(0xa, payload);
      } else if (opcode !== 0xa) {
        return this.fail(new Error('WebSocket 操作码不受支持'));
      }
    }
  }

  sendFrame(opcode, payload) {
    if (!this.connected || !this.socket || this.socket.destroyed) throw new Error('WebSocket 尚未连接或已关闭');
    const len = payload.length;
    let header;
    const maskKey = crypto.randomBytes(4);

    if (len <= 125) {
      header = Buffer.alloc(2 + 4);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | len;
      maskKey.copy(header, 2);
    } else if (len <= 65535) {
      header = Buffer.alloc(4 + 4);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(len, 2);
      maskKey.copy(header, 4);
    } else {
      header = Buffer.alloc(10 + 4);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(len), 2);
      maskKey.copy(header, 10);
    }

    const maskedPayload = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) {
      maskedPayload[i] = payload[i] ^ maskKey[i % 4];
    }

    this.socket.write(Buffer.concat([header, maskedPayload]));
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.connected) return reject(new Error('WebSocket 尚未连接或已关闭'));
      const id = ++this.msgId;
      // 在登记回调前序列化，避免不可序列化的参数泄漏挂起请求。
      const msg = JSON.stringify({ id, method, params });
      const timer = setTimeout(() => {
        this.pendingCallbacks.delete(id);
        reject(new Error(`CDP 命令超时: ${method}`));
      }, this.commandTimeout);
      this.pendingCallbacks.set(id, { resolve, reject, timer });
      try { this.sendFrame(0x1, Buffer.from(msg, 'utf8')); }
      catch (err) {
        clearTimeout(timer);
        this.pendingCallbacks.delete(id);
        reject(err);
      }
    });
  }

  rejectPending(err) {
    for (const cb of this.pendingCallbacks.values()) {
      clearTimeout(cb.timer);
      cb.reject(err);
    }
    this.pendingCallbacks.clear();
  }

  fail(err) {
    this.rejectPending(err);
    this.connected = false;
    if (this.socket) this.socket.destroy();
    if (this.listenerCount('error')) this.emit('error', err);
  }

  close() {
    if (this.request) this.request.destroy(new Error('WebSocket 连接已关闭'));
    if (this.socket) {
      try {
        // 发送带掩码的 Close 帧
        if (this.connected) this.sendFrame(0x8, Buffer.alloc(0));
      } catch (e) {}
      this.socket.end();
      this.socket.destroySoon();
    }
    this.connected = false;
    this.rejectPending(new Error('WebSocket 连接已关闭'));
  }
}

module.exports = {
  SimpleWebSocketClient
};
