const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dictContent = fs.readFileSync(path.join(__dirname, '..', 'dict', 'zh-CN.json'), 'utf-8');
const runtimeContent = fs.readFileSync(path.join(__dirname, '..', 'core', 'i18n-runtime.js'), 'utf-8');

const dom = new JSDOM('<div><h2>Account</h2><p>Manage your plan, credentials, and general preferences.</p></div>', {
  runScripts: 'dangerously'
});

const win = dom.window;
win.__AGY_I18N_DATA__ = JSON.parse(dictContent);

try {
  win.eval(runtimeContent);
  console.log('__AGY_I18N_INITIALIZED__:', win.__AGY_I18N_INITIALIZED__);
  console.log('__AGY_TRANSLATE_UNIT__ exists:', typeof win.__AGY_TRANSLATE_UNIT__);
  console.log('Test translate "Account":', win.__AGY_TRANSLATE_UNIT__('Account'));
  console.log('HTML after eval:', win.document.body.innerHTML);
} catch (e) {
  console.error('Eval error:', e);
}
