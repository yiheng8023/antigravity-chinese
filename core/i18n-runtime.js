/**
 * Antigravity Chinese Localization Engine (Runtime v3.0)
 * 修复死循环/性能雪崩，确保设置面板等重 DOM 场景可用
 *
 * 核心改进：
 * 1. Observer 回调中暂停观察，防止翻译写入 → 触发 mutation → 再翻译的死循环
 * 2. 用 requestIdleCallback / setTimeout 替代 150ms setInterval 全量扫描
 * 3. 已翻译节点打标记 (_agyDone)，跳过重复处理
 * 4. 批量处理 mutation，用 requestAnimationFrame 节流
 */
(function (root) {
  'use strict';

  if (!root) {
    root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
  }
  if (!root) return;

  if (root.__AGY_I18N_INITIALIZED__) return;
  root.__AGY_I18N_INITIALIZED__ = true;

  var doc = root.document || (typeof document !== 'undefined' ? document : null);

  var I18N_DATA = root.__AGY_I18N_DATA__ || { exact: {}, patterns: [] };
  var exactDict = I18N_DATA.exact || {};
  var patterns = (I18N_DATA.patterns || []).map(function (p) {
    return {
      regex: new RegExp(p.regex),
      replacement: p.replacement
    };
  });

  // 按长度降序排列的 key 列表（仅保留 length >= 4 的，避免过短匹配造成误伤）
  var sortedExactKeys = Object.keys(exactDict).sort(function (a, b) {
    return b.length - a.length;
  });

  // 构建一个反向映射：翻译结果 → true，用于快速判断文本是否已经被翻译过
  var translatedValues = {};
  for (var k in exactDict) {
    if (exactDict.hasOwnProperty(k)) {
      translatedValues[exactDict[k]] = true;
    }
  }

  var IGNORED_TAGS = {
    'SCRIPT': 1, 'STYLE': 1, 'CODE': 1, 'PRE': 1, 'NOSCRIPT': 1,
    'TEXTAREA': 1, 'INPUT': 1, 'SVG': 1, 'PATH': 1, 'CANVAS': 1,
    'IFRAME': 1, 'VIDEO': 1, 'AUDIO': 1
  };

  var IGNORED_CLASSES = [
    'monaco-editor',
    'view-lines',
    'view-line',
    'monaco-mouse-cursor-text',
    'xterm',
    'terminal',
    'token',
    'hljs',
    'code-block',
    'editor-instance'
  ];

  var TRANSLATABLE_ATTRS = ['title', 'placeholder', 'aria-label', 'data-tooltip', 'alt', 'aria-description'];

  function shouldIgnoreElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (IGNORED_TAGS[el.tagName]) return true;
    if (el.isContentEditable) return true;

    var className = typeof el.className === 'string' ? el.className : '';
    if (className) {
      for (var i = 0; i < IGNORED_CLASSES.length; i++) {
        if (className.indexOf(IGNORED_CLASSES[i]) !== -1) return true;
      }
    }

    // 向上检查最近3层祖先，防止子元素在被保护区域内
    var ancestor = el.parentElement;
    for (var depth = 0; ancestor && depth < 3; depth++) {
      if (IGNORED_TAGS[ancestor.tagName]) return true;
      var ancestorClass = typeof ancestor.className === 'string' ? ancestor.className : '';
      if (ancestorClass) {
        for (var ci = 0; ci < IGNORED_CLASSES.length; ci++) {
          if (ancestorClass.indexOf(IGNORED_CLASSES[ci]) !== -1) return true;
        }
      }
      ancestor = ancestor.parentElement;
    }
    return false;
  }

  function normalizeWhitespace(str) {
    return str.replace(/\s+/g, ' ').trim();
  }

  /**
   * 翻译单个文本片段
   * 返回 null 表示无需翻译
   */
  function translateSingleUnit(rawStr) {
    if (!rawStr || typeof rawStr !== 'string') return null;
    var normalized = normalizeWhitespace(rawStr);
    if (!normalized) return null;

    // 如果文本已经是翻译结果，直接跳过
    if (translatedValues[normalized]) return null;

    // 1. 直接精确匹配
    if (exactDict[normalized]) {
      return exactDict[normalized];
    }

    // 2. 正则模式匹配（支持嵌套级联替换，例如时间+单位）
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i];
      if (p.regex.test(normalized)) {
        var result = normalized.replace(p.regex, p.replacement);
        for (var pi = 0; pi < patterns.length; pi++) {
          if (patterns[pi].regex.test(result)) {
            result = result.replace(patterns[pi].regex, patterns[pi].replacement);
          }
        }
        p.regex.lastIndex = 0;
        return result;
      }
    }

    // 3. 末尾标点容差
    var punctuationMatch = normalized.match(/^([\w\s\-\/]+)([:：…\.？\?!！]+)$/);
    if (punctuationMatch) {
      var base = punctuationMatch[1].trim();
      var punc = punctuationMatch[2];
      if (exactDict[base]) {
        return exactDict[base] + (punc === ':' ? '：' : punc);
      }
    }

    // 4. 多句子拆分与复合段落翻译（按句号、感叹号、问号分隔）
    if (normalized.indexOf('. ') !== -1 || normalized.indexOf('! ') !== -1 || normalized.indexOf('? ') !== -1) {
      var sentences = normalized.split(/([.!?]\s+)/);
      var anyTranslated = false;
      var translatedParts = [];
      for (var sIdx = 0; sIdx < sentences.length; sIdx++) {
        var part = sentences[sIdx];
        var trimmedPart = part.trim();
        if (!trimmedPart) {
          translatedParts.push(part);
          continue;
        }
        var transPart = exactDict[trimmedPart];
        if (!transPart) {
          var pMatch = trimmedPart.match(/^([\w\s\-\/]+)([:：…\.？\?!！]+)$/);
          if (pMatch && exactDict[pMatch[1].trim()]) {
            transPart = exactDict[pMatch[1].trim()] + (pMatch[2] === ':' ? '：' : pMatch[2]);
          }
        }
        if (transPart) {
          anyTranslated = true;
          translatedParts.push(transPart);
        } else {
          translatedParts.push(part);
        }
      }
      if (anyTranslated) {
        return translatedParts.join(' ');
      }
    }

    // 5. 多词复合子短语全量替换（仅对包含空格的多词短语或超长固定短语生效，杜绝单个单词误伤用户自定义标题）
    var processed = normalized;
    var modified = false;
    for (var j = 0; j < sortedExactKeys.length; j++) {
      var key = sortedExactKeys[j];
      // 只有多词固定词组（含空格）或长度 >= 15 的复合句才允许子串替换，防止单个单词如 "Project" 误伤 "Localization Project Setup"
      if ((key.indexOf(' ') !== -1 || key.length >= 15) && processed.indexOf(key) !== -1) {
        processed = processed.split(key).join(exactDict[key]);
        modified = true;
      }
    }

    if (modified) return processed;

    return null;
  }

  // 标记属性名，用于避免重复翻译
  var MARK_ATTR = '_agyDone';

  // 扫描轮次 ID，同一轮全量扫描中元素只处理一次
  var currentScanId = 0;

  function translateTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    var parent = node.parentElement || node.parentNode;
    if (parent && shouldIgnoreElement(parent)) return;

    var original = node.nodeValue;
    if (!original || !original.trim()) return;

    // 如果节点已标记原始文本且未变化，跳过
    if (node._agyOriginal === original) return;

    var leadingSpace = original.match(/^\s*/)[0];
    var trailingSpace = original.match(/\s*$/)[0];
    var trimmed = original.trim();

    var translated = translateSingleUnit(trimmed);
    if (translated !== null && translated !== trimmed) {
      node.nodeValue = leadingSpace + translated + trailingSpace;
      node._agyOriginal = node.nodeValue; // 记录翻译后的值，防止重复处理
    } else {
      node._agyOriginal = original; // 记录已检查过
    }
  }

  function translateElement(el, scanId) {
    if (!el || el.nodeType !== 1) return;
    if (shouldIgnoreElement(el)) return;

    // 同一轮扫描中，已处理的元素跳过
    if (scanId && el._agyScanId === scanId) return;
    if (scanId) el._agyScanId = scanId;

    // 翻译属性
    for (var i = 0; i < TRANSLATABLE_ATTRS.length; i++) {
      var attr = TRANSLATABLE_ATTRS[i];
      if (el.hasAttribute && el.hasAttribute(attr)) {
        var val = el.getAttribute(attr);
        if (val) {
          // 检查是否已翻译过此属性
          var markKey = MARK_ATTR + '_' + attr;
          if (el[markKey] === val) continue;

          var trans = translateSingleUnit(val);
          if (trans !== null && trans !== val) {
            el.setAttribute(attr, trans);
            el[markKey] = trans; // 标记已翻译的值
          } else {
            el[markKey] = val; // 标记已检查
          }
        }
      }
    }

    // 遍历子节点
    var child = el.firstChild;
    while (child) {
      if (child.nodeType === 3) {
        translateTextNode(child);
      } else if (child.nodeType === 1) {
        translateElement(child, scanId);
      }
      child = child.nextSibling;
    }
  }

  // ============ Observer 与扫描调度 ============

  var observer = null;
  var observing = false;

  function disconnectObserver() {
    if (observer && observing) {
      observer.disconnect();
      observing = false;
    }
  }

  function reconnectObserver() {
    if (observer && !observing && doc && doc.documentElement) {
      observer.observe(doc.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
        // 不再监听 attributes！避免 setAttribute 触发死循环
      });
      observing = true;
    }
  }

  /**
   * 安全地翻译一组节点
   * 在翻译期间暂停 Observer，完成后重新连接
   */
  function safeTranslateNodes(nodes) {
    disconnectObserver();
    try {
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.nodeType === 1) {
          translateElement(node);
        } else if (node.nodeType === 3) {
          translateTextNode(node);
        }
      }
    } catch (e) {
      // 静默吞错，避免一个异常阻断整体
    }
    reconnectObserver();
  }

  /**
   * 安全地执行全量扫描
   */
  function safeFullScan() {
    if (!doc || !doc.documentElement) return;
    currentScanId++;
    disconnectObserver();
    try {
      translateElement(doc.documentElement, currentScanId);
    } catch (e) {}
    reconnectObserver();
  }

  // ---- 节流：合并高频 mutation 到下一个 rAF ----
  var pendingNodes = [];
  var rafScheduled = false;

  function flushPendingNodes() {
    rafScheduled = false;
    if (pendingNodes.length === 0) return;
    // 去重：最多处理 200 个节点，防止极端场景
    var batch = pendingNodes.splice(0, 200);
    safeTranslateNodes(batch);
    // 如果还有剩余，安排下一帧处理
    if (pendingNodes.length > 0) {
      scheduleFlush();
    }
  }

  function scheduleFlush() {
    if (!rafScheduled) {
      rafScheduled = true;
      if (root.requestAnimationFrame) {
        root.requestAnimationFrame(flushPendingNodes);
      } else {
        setTimeout(flushPendingNodes, 16);
      }
    }
  }

  function startObserver() {
    if (!doc || !doc.documentElement) return;

    // 首次全量扫描
    safeFullScan();

    var MutationObserverClass = root.MutationObserver || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
    if (MutationObserverClass) {
      observer = new MutationObserverClass(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var mutation = mutations[i];
          if (mutation.type === 'childList') {
            var added = mutation.addedNodes;
            for (var j = 0; j < added.length; j++) {
              if (pendingNodes.length < 500) {
                pendingNodes.push(added[j]);
              }
            }
          } else if (mutation.type === 'characterData') {
            // 文本内容变化，重置标记使其可以被重新翻译
            if (mutation.target) {
              mutation.target._agyOriginal = undefined;
              pendingNodes.push(mutation.target);
            }
          }
        }
        if (pendingNodes.length > 0) {
          scheduleFlush();
        }
      });

      reconnectObserver();
    }

    // 用 requestIdleCallback 做周期性增量扫描（替代 setInterval）
    // 仅在浏览器空闲时执行，绝不阻塞主线程交互
    var idleCallback = root.requestIdleCallback || function (cb) { setTimeout(cb, 2000); };
    function idleScan() {
      safeFullScan();
      idleCallback(idleScan, { timeout: 5000 });
    }
    // 首次延迟 1 秒再启动空闲扫描
    setTimeout(function () {
      idleCallback(idleScan, { timeout: 5000 });
    }, 1000);
  }

  if (doc) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', startObserver);
    } else {
      startObserver();
    }

    // Hook document.title
    try {
      var docProto = root.Document ? root.Document.prototype : Object.getPrototypeOf(doc);
      var originalTitleDescriptor = Object.getOwnPropertyDescriptor(docProto, 'title');
      if (originalTitleDescriptor && originalTitleDescriptor.set) {
        Object.defineProperty(doc, 'title', {
          set: function (newTitle) {
            var translated = translateSingleUnit(newTitle);
            originalTitleDescriptor.set.call(this, translated !== null ? translated : newTitle);
          },
          get: function () {
            return originalTitleDescriptor.get.call(this);
          },
          configurable: true
        });
      }
    } catch (e) {}
  }

  root.__AGY_TRANSLATE_UNIT__ = translateSingleUnit;
  root.__AGY_TRANSLATE_EL__ = translateElement;
  root.__AGY_RUN_FULL_SCAN__ = safeFullScan;
})(typeof window !== 'undefined' ? window : this);
