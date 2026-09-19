const fs = require('fs');
const list = require('./v2.15_new_strings.json');

// 严格过滤掉 Tailwind CSS 类名（特征：含空格且包含 text- / bg- / flex / p- / rounded 等样式词）
function isCss(s) {
  return /\b(flex|grid|text-|bg-|p-\d|px-|py-|rounded|border-|overflow-|gap-|shrink-|items-|justify-|min-w-|max-w-|w-|h-)\b/.test(s);
}

function isInternal(s) {
  if (s.includes('Plugin:') || s.includes('__') || s.startsWith('conv') || s.startsWith('aux-') || s.includes('newTab')) return true;
  if (/^[a-z]+[A-Z]/.test(s) && !s.includes(' ')) return true; // camelCase
  return false;
}

const cleanedUI = list.filter(s => !isCss(s) && !isInternal(s) && s.length >= 2);
console.log('Clean UI candidates count:', cleanedUI.length);
cleanedUI.forEach((s, idx) => console.log(`${idx + 1}. ${s}`));
