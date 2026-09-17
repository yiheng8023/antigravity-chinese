/**
 * Antigravity Chinese Localization Engine (Runtime v3.2.35)
 * 修复自旋死循环/悬浮树暴搜/DOM否定标记缺失，极致性能闭环
 *
 * 核心改进：
 * 1. 彻底阻断 requestIdleCallback 自旋死循环，改为 15 秒低频保底扫描
 * 2. 增加 DOM 否定标记，未命中节点二次扫描 O(1) 瞬时退出
 * 3. 增加悬浮 Portal/Tooltip 门禁过滤与 100ms 节流阀，根绝 mouseover 树暴搜
 * 4. 算法与死代码优化：英文字母快速短路、移除 Step 5 patterns 死代码、空格/长度门禁、双向 Map 缓存
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
  var allPatterns = (I18N_DATA.patterns || []).concat(I18N_DATA.rules || []);
  var patterns = allPatterns.map(function (p) {
    return {
      regex: new RegExp(p.regex),
      replacement: p.replacement
    };
  });

  // 按长度降序排列的 key 列表（仅保留 length >= 4 的，避免过短匹配造成误伤）
  var sortedExactKeys = Object.keys(exactDict).sort(function (a, b) {
    return b.length - a.length;
  });
  // 预过滤多词复合子短语 key（含空格或长度 >= 12），消除 Step 5 每轮 1700+ 次冗余属性与长度判断
  var phraseKeys = sortedExactKeys.filter(function (k) {
    return k.indexOf(' ') !== -1 || k.length >= 12;
  });

  // 构建一个反向映射：翻译结果 → true，用于快速判断文本是否已经被翻译过
  var translatedValues = {};
  for (var k in exactDict) {
    if (exactDict.hasOwnProperty(k)) {
      translatedValues[exactDict[k]] = true;
    }
  }

  // 正负记忆化双向 Map 缓存（正向为翻译结果，负向为 null），带容量上限保护
  var translationCache = typeof Map !== 'undefined' ? new Map() : null;
  var MAX_CACHE_SIZE = 10000;

  function cacheAndReturn(key, value) {
    if (translationCache) {
      if (translationCache.size >= MAX_CACHE_SIZE) {
        var iter = translationCache.keys();
        for (var ci = 0; ci < 1000; ci++) {
          var oldK = iter.next().value;
          if (oldK !== undefined) {
            translationCache.delete(oldK);
          } else {
            break;
          }
        }
      }
      translationCache.set(key, value);
    }
    return value;
  }

  var IGNORED_TAGS = {
    'SCRIPT': 1, 'STYLE': 1, 'CODE': 1, 'PRE': 1, 'NOSCRIPT': 1,
    'SVG': 1, 'PATH': 1, 'CANVAS': 1,
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

    // 算法优化 1：极速短路，纯数字与符号瞬间退出（无英文字母）
    if (!/[a-zA-Z]/.test(normalized)) return null;

    // 算法优化 2：正负记忆化双向 Map 缓存极速 O(1) 命中
    if (translationCache && translationCache.has(normalized)) {
      return translationCache.get(normalized);
    }

    // 如果文本已经是翻译结果，直接跳过并存入负向缓存
    if (translatedValues[normalized]) {
      return cacheAndReturn(normalized, null);
    }

    // 官方原生已汉化文本探测与优雅让位：仅当文本纯属中文无连续英文字母时才跳过；若含英文字母且词库有规则，绝不跳过！
    var cjkChars = normalized.match(/[\u4e00-\u9fa5]/g);
    if (cjkChars && cjkChars.length >= 1 && !/[a-zA-Z]{2,}/.test(normalized)) {
      return cacheAndReturn(normalized, null);
    }

    // 1. 直接精确匹配
    if (exactDict[normalized]) {
      return cacheAndReturn(normalized, exactDict[normalized]);
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
        return cacheAndReturn(normalized, result);
      }
    }

    // 3. 末尾标点与快捷键后缀容差 (例如 "Cancel (Ctrl+D)", "Select Project Ctrl+;", "Record Audio:")
    var punctuationMatch = normalized.match(/^([\w\s\-\/]+)([:：…\.？\?!！]+)$/);
    if (punctuationMatch) {
      var base = punctuationMatch[1].trim();
      var punc = punctuationMatch[2];
      if (exactDict[base]) {
        return cacheAndReturn(normalized, exactDict[base] + (punc === ':' ? '：' : punc));
      }
    }

    var hotkeyMatch = normalized.match(/^([\w\s\-\/]+?)\s*(\((?:Ctrl|Cmd|Alt|Shift)\+[^\)]+\)|\b(?:Ctrl|Cmd|Alt|Shift)\+[\w;:,\\/+\-]+)$/i);
    if (hotkeyMatch) {
      var cmdBase = hotkeyMatch[1].trim();
      var hotkey = hotkeyMatch[2].trim();
      if (exactDict[cmdBase]) {
        return cacheAndReturn(normalized, exactDict[cmdBase] + (hotkey.charAt(0) === '(' ? ' ' + hotkey : ' ' + hotkey));
      }
    }

    // 4. 多句子拆分与复合段落翻译（按中英文句号、感叹号、问号分隔）
    if (normalized.indexOf('. ') !== -1 || normalized.indexOf('! ') !== -1 || normalized.indexOf('? ') !== -1 || normalized.indexOf('。') !== -1) {
      var sentences = normalized.split(/([.!?]\s+|[。！？]\s*)/);
      var anyTranslated = false;
      var translatedParts = [];
      for (var sIdx = 0; sIdx < sentences.length; sIdx++) {
        var part = sentences[sIdx];
        var trimmedPart = part.trim();
        if (!trimmedPart || /^[.!?。！？\s]+$/.test(part)) {
          translatedParts.push(part.replace(/\.\s*/g, '。 '));
          continue;
        }
        var transPart = exactDict[trimmedPart];
        if (!transPart) {
          for (var pIdx = 0; pIdx < patterns.length; pIdx++) {
            if (patterns[pIdx].regex.test(trimmedPart)) {
              transPart = trimmedPart.replace(patterns[pIdx].regex, patterns[pIdx].replacement);
              break;
            }
          }
        }
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
        return cacheAndReturn(normalized, translatedParts.join('').replace(/([。！？])\s*/g, '$1 '));
      }
    }

    // 5. 多词复合子短语替换（杜绝单个孤立单词误伤，精准捕获中英混排长句）
    var processed = normalized;

    // 算法优化 3：长度与空格门禁，无空格且短于 12 字符的文本直接快速返回 null
    if (processed.indexOf(' ') === -1 && processed.length < 12) {
      return cacheAndReturn(normalized, null);
    }

    // 算法优化 4：已删除重复执行必定未命中的 patterns 动态正则死代码，直接遍历预筛选 phraseKeys
    var modified = false;
    for (var j = 0; j < phraseKeys.length; j++) {
      var key = phraseKeys[j];
      if (processed.indexOf(key) !== -1) {
        processed = processed.split(key).join(exactDict[key]);
        modified = true;
      }
    }

    if (modified) return cacheAndReturn(normalized, processed);

    return cacheAndReturn(normalized, null);
  }

  // 标记属性名，用于避免重复翻译
  var MARK_ATTR = '_agyDone';

  // 扫描轮次 ID，同一轮全量扫描中元素只处理一次
  var currentScanId = 0;

  function translateTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    var parent = node.parentElement || node.parentNode;
    if (parent && (shouldIgnoreElement(parent) || parent.tagName === 'INPUT' || parent.tagName === 'TEXTAREA')) return;

    var original = node.nodeValue;
    if (!original) return;

    // 如果节点已标记原始文本且未变化，直接 O(1) 瞬时退出
    if (node._agyOriginal === original) return;

    var trimmed = original.trim();
    if (!trimmed) {
      // 对纯空白节点补充否定标记，二次扫描直接 O(1) 退出，避免重复调用 trim()
      node._agyOriginal = original;
      return;
    }

    var translated = translateSingleUnit(trimmed);
    if (translated !== null && translated !== trimmed) {
      var leadingSpace = original.match(/^\s*/)[0];
      var trailingSpace = original.match(/\s*$/)[0];
      node.nodeValue = leadingSpace + translated + trailingSpace;
      node._agyOriginal = node.nodeValue; // 记录翻译后的值，防止重复处理
    } else {
      // 关键性能优化：补充 DOM 否定标记，未命中时记录原始文本，二次扫描直接 O(1) 退出
      node._agyOriginal = original;
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
            // 关键性能优化：补充 DOM 否定标记，未命中时记录原属性值，二次扫描直接 O(1) 退出
            el[markKey] = val;
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

  // ---- 节流与去重：合并高频 mutation 到下一个 rAF ----
  var pendingNodes = [];
  var pendingNodeSet = typeof Set !== 'undefined' ? new Set() : null;
  var rafScheduled = false;

  function enqueueNode(node) {
    if (!node) return;
    if (pendingNodeSet) {
      if (pendingNodeSet.has(node)) return;
      if (pendingNodes.length < 500) {
        pendingNodes.push(node);
        pendingNodeSet.add(node);
      }
    } else {
      if (pendingNodes.length < 500) {
        pendingNodes.push(node);
      }
    }
  }

  function flushPendingNodes() {
    rafScheduled = false;
    if (pendingNodes.length === 0) return;
    var batch = pendingNodes.splice(0, 200);
    if (pendingNodeSet) {
      for (var bIdx = 0; bIdx < batch.length; bIdx++) {
        pendingNodeSet.delete(batch[bIdx]);
      }
    }
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
              enqueueNode(added[j]);
            }
          } else if (mutation.type === 'characterData') {
            // 文本内容变化，重置标记使其可以被重新翻译
            if (mutation.target) {
              mutation.target._agyOriginal = undefined;
              enqueueNode(mutation.target);
            }
          }
        }
        if (pendingNodes.length > 0) {
          scheduleFlush();
        }
      });

      reconnectObserver();
    }

    // 低频保底扫描：彻底阻断 50~60Hz 无限自旋死循环，改为每 15 秒配合 requestIdleCallback 执行一次低频保底扫描
    var idleScanScheduled = false;
    function scheduleIdleScan() {
      if (idleScanScheduled) return;
      if (root.requestIdleCallback) {
        idleScanScheduled = true;
        root.requestIdleCallback(function () {
          idleScanScheduled = false;
          safeFullScan();
        }, { timeout: 5000 });
      } else {
        safeFullScan();
      }
    }
    setInterval(scheduleIdleScan, 15000);
  }

  function isFloatingElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (doc && (el === doc.body || el === doc.documentElement)) return false;
    if (el.id === 'workbench') return false;
    var cls = typeof el.className === 'string' ? el.className : '';
    if (cls && cls.indexOf('monaco-workbench') !== -1) return false;

    if (el.matches) {
      try {
        return el.matches('[role="tooltip"], [data-floating-ui-portal], .popover, .tooltip, .context-view, .monaco-hover');
      } catch (e) {}
    }
    var role = el.getAttribute ? el.getAttribute('role') : '';
    if (role === 'tooltip') return true;
    if (el.hasAttribute && el.hasAttribute('data-floating-ui-portal')) return true;
    if (cls) {
      if (cls.indexOf('popover') !== -1 || cls.indexOf('tooltip') !== -1 || cls.indexOf('context-view') !== -1 || cls.indexOf('monaco-hover') !== -1) {
        return true;
      }
    }
    return false;
  }

  function isWorkbenchOrRoot(el) {
    if (!el || el.nodeType !== 1) return true;
    if (doc && (el === doc.body || el === doc.documentElement)) return true;
    if (el.id === 'workbench') return true;
    var cls = typeof el.className === 'string' ? el.className : '';
    if (cls && cls.indexOf('monaco-workbench') !== -1) return true;
    return false;
  }

  if (doc) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', startObserver);
    } else {
      startObserver();
    }

    // 全局悬浮气泡 (Hover Tooltips / Popovers) 快速反应拦截器
    // 专门防御光标移入时才动态挂载或改变属性的临时注释节点
    try {
      var lastHoverTime = 0;
      var hoverScanTimer = null;

      function scanFloatingContainers() {
        if (!doc || !doc.body) return;
        disconnectObserver();
        try {
          // 定向扫描顶层 Portal 容器、Tooltip、Popover 节点，门禁拦截非浮层元素，绝不遍历整棵 DOM 树
          var last = doc.body.lastElementChild;
          if (last && isFloatingElement(last)) {
            translateElement(last);
          }
          if (last && last.previousElementSibling && isFloatingElement(last.previousElementSibling)) {
            translateElement(last.previousElementSibling);
          }
          var tooltips = doc.querySelectorAll ? doc.querySelectorAll('[role="tooltip"], [data-floating-ui-portal], .popover, .tooltip, .context-view, .monaco-hover') : null;
          if (tooltips && tooltips.length > 0) {
            for (var tIdx = 0; tIdx < tooltips.length; tIdx++) {
              translateElement(tooltips[tIdx]);
            }
          }
        } catch (e) {}
        reconnectObserver();
      }

      var onHoverAction = function (e) {
        // 100ms 节流阀：阻断高频 mouseover 事件风暴与全树深搜，杜绝剧烈掉帧
        var now = Date.now ? Date.now() : (+new Date());
        if (now - lastHoverTime < 100) return;
        lastHoverTime = now;

        var target = e.target;
        if (!target) return;
        disconnectObserver();
        try {
          if (target.nodeType === 1) {
            translateElement(target);
            // 严禁对 #workbench / body 根容器递归全树深搜，防止 13ms+ 剧烈掉帧
            if (target.parentElement && !isWorkbenchOrRoot(target.parentElement)) {
              translateElement(target.parentElement);
            }
          }
        } catch (e) {}
        reconnectObserver();

        // 即时定向扫描浮动提示层
        scanFloatingContainers();

        // 异步微延迟再次定向扫描（捕获动态延迟 40ms 挂载的气泡），杜绝全局 safeFullScan() 引起的掉帧
        if (!hoverScanTimer) {
          hoverScanTimer = setTimeout(function () {
            hoverScanTimer = null;
            scanFloatingContainers();
          }, 40);
        }
      };

      doc.addEventListener('pointerenter', onHoverAction, { capture: true, passive: true });
      doc.addEventListener('mouseover', onHoverAction, { capture: true, passive: true });
    } catch (e) {}
  }

  root.__AGY_TRANSLATE_UNIT__ = translateSingleUnit;
  root.__AGY_TRANSLATE_EL__ = translateElement;
  root.__AGY_RUN_FULL_SCAN__ = safeFullScan;
  root.__AGY_CACHE__ = translationCache;
  root.__AGY_IS_FLOATING__ = isFloatingElement;
})(typeof window !== 'undefined' ? window : this);
