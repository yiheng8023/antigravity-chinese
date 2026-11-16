'use strict';

const fs = require('fs');
const path = require('path');

const START = '// --- Antigravity Chinese Swarm Frame Start ---';
const END = '// --- Antigravity Chinese Swarm Frame End ---';

// Serialized into dist/main.js. Keep it independent of this repository at run time.
function installSwarmFrames(rendererScript) {
  const { app, webContents, webFrameMain } = require('electron');
  const seen = new WeakSet();
  function inject(frame) {
    try {
      const url = new URL(frame.url);
      if (url.protocol !== 'plugin:' || !/^swarm--swarm_board-\d+$/.test(url.hostname) ||
          url.port || url.username || url.password || url.pathname !== '/') return;
      // Never log a plugin URL: its query can contain an authentication token.
      Promise.resolve(frame.executeJavaScript(rendererScript)).catch(() => {});
    } catch (_) { /* Navigation or destruction can race frame completion. */ }
  }
  function watch(contents) {
    if (seen.has(contents)) return;
    seen.add(contents);
    contents.on('did-frame-finish-load', (_event, _main, processId, routingId) => {
      try {
        const frame = webFrameMain.fromId(processId, routingId);
        if (frame) inject(frame);
      } catch (_) { /* The frame may already have been destroyed. */ }
    });
  }
  app.on('web-contents-created', (_event, contents) => watch(contents));
  for (const contents of webContents.getAllWebContents()) watch(contents);
}

function patchSwarmFrames(source) {
  const runtime = fs.readFileSync(path.join(__dirname, 'swarm-i18n.js'), 'utf8');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/scoped/swarm.json'), 'utf8'));
  const renderer = '(' + runtime.trim().replace(/;$/, '') + ')(' + JSON.stringify(data) + ');';
  const block = START + '\n;(' + installSwarmFrames.toString() + ')(' + JSON.stringify(renderer) + ');\n' + END;
  const first = source.indexOf('\n\n' + START);
  if (first !== -1) {
    const last = source.indexOf(END, first);
    if (last === -1) throw new Error('Incomplete Swarm frame patch; restore the original before reinstalling');
    source = source.slice(0, first) + source.slice(last + END.length + 1);
  }
  return source + '\n\n' + block + '\n';
}

module.exports = { patchSwarmFrames, START, END };
