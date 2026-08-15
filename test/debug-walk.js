const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dictContent = fs.readFileSync(path.join(__dirname, '..', 'dict', 'zh-CN.json'), 'utf-8');
const dom = new JSDOM('<div><h2>Account</h2><p>Manage your plan, credentials, and general preferences.</p></div>');
const win = dom.window;

win.__AGY_I18N_DATA__ = JSON.parse(dictContent);

// Test step-by-step
const exactDict = win.__AGY_I18N_DATA__.exact;

function testWalk(node) {
  console.log('Node:', node.nodeName, 'type:', node.nodeType, 'value:', node.nodeValue);
  if (node.nodeType === 3) {
    const orig = node.nodeValue.trim();
    if (exactDict[orig]) {
      node.nodeValue = exactDict[orig];
      console.log('  -> Translated to:', node.nodeValue);
    }
  }
  let c = node.firstChild;
  while (c) {
    testWalk(c);
    c = c.nextSibling;
  }
}

testWalk(win.document.documentElement);
console.log('Final HTML:', win.document.body.innerHTML);
