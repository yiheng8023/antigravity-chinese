const fs = require('fs');
const path = require('path');

// ASAR 的两个 Chromium Pickle 依次记录头部长度与 JSON 字符串。
// 只读取头部，保持安装器在未安装开发依赖时也可工作。
function readEntries(archive) {
  const fd = fs.openSync(archive, 'r');
  try {
    const size = Buffer.alloc(8);
    if (fs.readSync(fd, size, 0, 8, 0) !== 8) throw new Error('ASAR 头部不完整');
    const length = size.readUInt32LE(4);
    if (length < 8 || length > 16 * 1024 * 1024 || length > fs.fstatSync(fd).size - 8) {
      throw new Error('ASAR 头部长度无效');
    }
    const header = Buffer.alloc(length);
    if (fs.readSync(fd, header, 0, length, 8) !== length) throw new Error('ASAR 头部不完整');
    const jsonLength = header.readUInt32LE(4);
    if (jsonLength > length - 8) throw new Error('ASAR JSON 长度无效');
    const root = JSON.parse(header.subarray(8, 8 + jsonLength).toString('utf8'));
    const entries = [];
    function walk(node, parent, inherited) {
      const unpacked = inherited || node.unpacked === true;
      if (node.files) {
        for (const [name, child] of Object.entries(node.files)) {
          if (!name || name === '.' || name === '..' || /[\\/\0]/.test(name)) throw new Error('ASAR 文件名无效');
          walk(child, parent ? parent + '/' + name : name, unpacked);
        }
      } else entries.push({ name: parent, unpacked });
    }
    walk(root, '', false);
    return entries;
  } finally { fs.closeSync(fd); }
}

function getUnpackArgs(archive) {
  const entries = readEntries(archive);
  const external = entries.filter(e => e.unpacked).map(e => e.name);
  const dirs = new Set();
  const files = [];
  for (const name of external) {
    const parts = name.split('/');
    let directory = '';
    for (let n = 1; n < parts.length; n++) {
      const candidate = parts.slice(0, n).join('/');
      if (entries.filter(e => e.name.startsWith(candidate + '/')).every(e => e.unpacked)) {
        directory = candidate;
        break;
      }
    }
    if (directory) dirs.add(directory);
    else files.push(name);
  }
  // 参数进入现有的跨平台 ASAR CLI；拒绝包含 shell/glob 元字符的原始路径。
  for (const name of [...dirs, ...files]) {
    if (!/^[\w@.+/-]+$/.test(name)) throw new Error('不支持的外置 ASAR 路径: ' + name);
  }
  const args = [];
  if (dirs.size) {
    const paths = [...dirs];
    args.push('--unpack-dir', paths.length === 1 ? path.normalize(paths[0]) : '{' + paths.join(',') + '}');
  }
  if (files.length) args.push('--unpack', files.length === 1 ? '**/' + files[0] : '**/{' + files.join(',') + '}');
  if (args.join(' ').length > 6000) throw new Error('外置 ASAR 路径参数过长，已中止以保护原始文件');
  return args;
}

function verifyUnpackedOutput(original, output) {
  const expected = readEntries(original).filter(e => e.unpacked).map(e => e.name).sort();
  const actual = readEntries(output).filter(e => e.unpacked).map(e => e.name).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('重打包改变了 ASAR 外置文件布局');
  for (const name of expected) {
    const source = fs.readFileSync(path.join(original + '.unpacked', name));
    const generated = fs.readFileSync(path.join(output + '.unpacked', name));
    if (!source.equals(generated)) throw new Error('重打包改变了外置文件: ' + name);
  }
  return expected.length;
}

module.exports = { readEntries, getUnpackArgs, verifyUnpackedOutput };
