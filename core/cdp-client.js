/**
 * Lightweight Zero-Dependency RFC 6455 WebSocket & CDP Client
 * 零第三方依赖纯原生 Node.js (http + net + crypto) 实现的 Chrome DevTools Protocol 客户端
 */

const http = require('http');
const crypto = require('crypto');
const EventEmitter = require('events');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class SimpleWebSocketClient extends EventEmitter {
  constructor(wsUrl) {
    super();
    this.wsUrl = new URL(wsUrl);
    this.socket = null;
    this.connected = false;
    this.buffer = Buffer.alloc(0);
    this.msgId = 0;
    this.pendingCallbacks = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString('base64');
      const expectedAccept = crypto
        .createHash('sha1')
        .update(key + WS_GUID)
        .digest('base64');

      const req = http.request({
        hostname: this.wsUrl.hostname,
        port: this.wsUrl.port,
        path: this.wsUrl.pathname + this.wsUrl.search,
        headers: {
          'Connection': 'Upgrade',
          'Upgrade': 'websocket',
          'Sec-WebSocket-Key': key,
          'Sec-WebSocket-Version': '13',
          'Host': `${this.wsUrl.hostname}:${this.wsUrl.port}`
        }
      });

      req.on('upgrade', (res, socket, head) => {
        const accept = res.headers['sec-websocket-accept'];
        if (accept !== expectedAccept) {
          socket.destroy();
          return reject(new Error(`WebSocket 握手安全校验失败: ${accept} !== ${expectedAccept}`));
        }

        this.socket = socket;
        this.connected = true;

        if (head && head.length > 0) {
          this.handleData(head);
        }

        socket.on('data', chunk => this.handleData(chunk));
        socket.on('close', () => {
          this.connected = false;
          this.emit('close');
        });
        socket.on('error', err => this.emit('error', err));

        resolve(this);
      });

      req.on('error', reject);
      req.end();
    });
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const byte1 = this.buffer[0];
      const byte2 = this.buffer[1];
      const opcode = byte1 & 0x0f;
      const isMasked = (byte2 & 0x80) !== 0;
      let payloadLen = byte2 & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (this.buffer.length < offset + 2) return;
        payloadLen = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLen === 127) {
        if (this.buffer.length < offset + 8) return;
        // CDP 消息通常不会超过 2GB，读取低 32 位即可
        payloadLen = Number(this.buffer.readBigUInt64BE(offset));
        offset += 8;
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

      if (opcode === 0x1) {
        // 文本帧 (UTF-8)
        const text = payload.toString('utf8');
        try {
          const json = JSON.parse(text);
          if (json.id && this.pendingCallbacks.has(json.id)) {
            const cb = this.pendingCallbacks.get(json.id);
            this.pendingCallbacks.delete(json.id);
            if (json.error) {
              cb.reject(new Error(json.error.message || JSON.stringify(json.error)));
            } else {
              cb.resolve(json.result);
            }
          } else {
            this.emit('event', json);
          }
        } catch (e) {}
      } else if (opcode === 0x8) {
        // 关闭帧
        this.close();
      } else if (opcode === 0x9) {
        // Ping 帧 -> 响应 Pong
        this.sendFrame(0xa, payload);
      }
    }
  }

  sendFrame(opcode, payload) {
    if (!this.connected || !this.socket) return;
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
      const id = ++this.msgId;
      this.pendingCallbacks.set(id, { resolve, reject });
      const msg = JSON.stringify({ id, method, params });
      this.sendFrame(0x1, Buffer.from(msg, 'utf8'));
    });
  }

  close() {
    if (this.socket) {
      try {
        // 发送带掩码的 Close 帧
        this.sendFrame(0x8, Buffer.alloc(0));
        this.socket.end();
      } catch (e) {}
    }
    this.connected = false;
  }
}

module.exports = {
  SimpleWebSocketClient
};
