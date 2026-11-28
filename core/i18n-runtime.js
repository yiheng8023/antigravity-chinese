/**
 * Antigravity Chinese Localization Engine
 * 桌面 preload 与 VS Code Webview 共用的翻译、缓存和 DOM 保护实现。
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

  function createI18nEngine(dictData) {
    var data = dictData || {};
    var exactDict = data.exact || {};
    var allPatterns = (data.patterns || []).concat(data.rules || []);
    var patterns = allPatterns.map(function (p) {
      return {
        regex: new RegExp(p.regex),
        replacement: p.replacement
      };
    });

    var translatedValues = {};
    for (var k in exactDict) {
      if (exactDict.hasOwnProperty(k)) {
        translatedValues[exactDict[k]] = true;
      }
    }

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

    function normalizeWhitespace(str) {
      return str.replace(/\s+/g, ' ').trim();
    }

    var hasOwn = Object.prototype.hasOwnProperty;

    function translateSingleUnit(rawStr) {
      if (!rawStr || typeof rawStr !== 'string') return null;
      var normalized = normalizeWhitespace(rawStr);
      if (!normalized) return null;

      if (translationCache && translationCache.has(normalized)) {
        return translationCache.get(normalized);
      }

      if (hasOwn.call(exactDict, normalized)) {
        return cacheAndReturn(normalized, exactDict[normalized]);
      }

      if (!/[a-zA-Z]/.test(normalized)) {
        return cacheAndReturn(normalized, null);
      }

      if (hasOwn.call(translatedValues, normalized)) {
        return cacheAndReturn(normalized, null);
      }

      if (/[\u4e00-\u9fa5]/.test(normalized) && !/[a-zA-Z]{2,}/.test(normalized)) {
        return cacheAndReturn(normalized, null);
      }

      // Shortcut accessibility labels combine a configurable chord with a known UI action.
      // Translate only dictionary-backed actions and templates; preserve the key symbols.
      var shortcutLabel = normalized.match(/^(?:(Shortcut|Remove shortcut) (.+?) for|Add shortcut for) (.+)$/);
      if (shortcutLabel && hasOwn.call(exactDict, shortcutLabel[3])) {
        var shortcutTemplateKey = shortcutLabel[1]
          ? shortcutLabel[1] + ' {shortcut} for {action}'
          : 'Add shortcut for {action}';
        if (hasOwn.call(exactDict, shortcutTemplateKey)) {
          var shortcutText = exactDict[shortcutTemplateKey].replace(/\{(action|shortcut)\}/g, function (_, field) {
            return field === 'action' ? exactDict[shortcutLabel[3]] : shortcutLabel[2];
          });
          return cacheAndReturn(normalized, shortcutText);
        }
      }

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

      var punctuationMatch = normalized.match(/^([\w\s\-\/]+)([:：…\.？\?!！]+)$/);
      if (punctuationMatch) {
        var base = punctuationMatch[1].trim();
        var punc = punctuationMatch[2];
        if (hasOwn.call(exactDict, base)) {
          return cacheAndReturn(normalized, exactDict[base] + (punc === ':' ? '：' : punc));
        }
      }

      var hotkeyMatch = normalized.match(/^([\w\s\-\/]+?)\s*(\((?:Ctrl|Cmd|Alt|Shift)\+[^\s\)]+\)|\b(?:Ctrl|Cmd|Alt|Shift)\+[\w;:,\\/+\-]+)$/i);
      if (hotkeyMatch) {
        var cmdBase = hotkeyMatch[1].trim();
        var hotkey = hotkeyMatch[2].trim();
        if (hasOwn.call(exactDict, cmdBase)) {
          return cacheAndReturn(normalized, exactDict[cmdBase] + (hotkey.charAt(0) === '(' ? ' ' + hotkey : ' ' + hotkey));
        }
      }

      if (normalized.indexOf('. ') !== -1 || normalized.indexOf('! ') !== -1 || normalized.indexOf('? ') !== -1 || normalized.indexOf('。') !== -1) {
        var sentences = normalized.split(/([.!?]\s+|[。！？]\s*)/);
        var anyTranslated = false;
        var allTranslated = true;
        var translatedParts = [];
        for (var sIdx = 0; sIdx < sentences.length; sIdx++) {
          var part = sentences[sIdx];
          var trimmedPart = part.trim();
          if (!trimmedPart || /^[.!?。！？\s]+$/.test(part)) {
            translatedParts.push(part.replace(/\.\s*/g, '。 '));
            continue;
          }
          var transPart = (hasOwn.call(exactDict, trimmedPart) ? exactDict[trimmedPart] : null) ||
                          (hasOwn.call(exactDict, trimmedPart + '.') ? exactDict[trimmedPart + '.'] : null);
          if (!transPart) {
            for (var pIdx = 0; pIdx < patterns.length; pIdx++) {
              if (patterns[pIdx].regex.test(trimmedPart)) {
                transPart = trimmedPart.replace(patterns[pIdx].regex, patterns[pIdx].replacement);
                for (var pi2 = 0; pi2 < patterns.length; pi2++) {
                  if (patterns[pi2].regex.test(transPart)) {
                    transPart = transPart.replace(patterns[pi2].regex, patterns[pi2].replacement);
                  }
                }
                break;
              }
            }
          }
          if (!transPart) {
            var pMatch = trimmedPart.match(/^([\w\s\-\/]+)([:：…\.？\?!！]+)$/);
            if (pMatch && hasOwn.call(exactDict, pMatch[1].trim())) {
              transPart = exactDict[pMatch[1].trim()] + (pMatch[2] === ':' ? '：' : pMatch[2]);
            }
          }
          if (transPart) {
            anyTranslated = true;
            translatedParts.push(transPart);
          } else {
            allTranslated = false;
            translatedParts.push(part);
          }
        }
        if (anyTranslated && allTranslated) {
          return cacheAndReturn(normalized, translatedParts.join('').replace(/([。！？])[。！？.]*\s*/g, '$1 ').trim());
        }
      }

      return cacheAndReturn(normalized, null);
    }

    return {
      translate: translateSingleUnit,
      exactDict: exactDict,
      patterns: patterns,
      cache: translationCache,
      normalizeWhitespace: normalizeWhitespace
    };
  }

  // 若处于 Node.js 环境，优先准备导出
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      createI18nEngine: createI18nEngine
    };
  }

  if (root && root.__AGY_I18N_INITIALIZED__) return;
  if (root) root.__AGY_I18N_INITIALIZED__ = true;

  var doc = root ? (root.document || (typeof document !== 'undefined' ? document : null)) : null;

  var I18N_DATA = (root && root.__AGY_I18N_DATA__) || { exact: {}, patterns: [] };
  var officialPluginDescriptions = I18N_DATA.officialPluginDescriptions;
  var builtinSlashDescriptions = I18N_DATA.builtinSlashDescriptions;
  var defaultEngine = createI18nEngine(I18N_DATA);
  var exactDict = defaultEngine.exactDict;
  var patterns = defaultEngine.patterns;
  var translationCache = defaultEngine.cache;
  var normalizeWhitespace = defaultEngine.normalizeWhitespace;
  var translateSingleUnit = defaultEngine.translate;

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

  // These labels contain user-authored text or identifiers, even when their text
  // happens to be an exact dictionary entry such as "Settings".
  var CONTENT_TEST_IDS = {
    'user-input-step': 1,
    'user-message-content': 1,
    'planner-response-text': 1,
    'side-question-tab-header-name': 1,
    'breadcrumb-segment': 1,
    'live-user-turn': 1,
    'live-agent-turn': 1,
    'transcript-line-text': 1,
    'voice-transcript-summary-lead': 1,
    'voice-transcript-summary-point': 1,
    'image-strip-tile': 1,
    'image-strip-viewer-caption': 1,
    'image-strip-viewer-thumbnail': 1,
    'model-selector-orchestrator-model': 1,
    'webview-device-chooser-option': 1,
    'webview-download-filename': 1,
    'url-security-host': 1,
    'url-security-origin': 1,
    'plugin-detail-footer-author': 1,
    'plugin-detail-footer-version': 1,
    'plugin-hook-list': 1,
    'plugin-suggested-prompt-row': 1
  };
  var CONTENT_CLASSES = {
    'prose': 1,
    'markdown': 1,
    'markdown-body': 1,
    'markdown-content': 1
  };
  var INLINE_REQUEST_UI_TEST_IDS = {
    'inline-card-add-note': 1,
    'inline-card-expiry': 1,
    'inline-card-in-chat': 1,
    'inline-card-next': 1,
    'inline-card-retry': 1,
    'inline-card-skip': 1,
    'inline-card-submit': 1,
    'inline-permission-add-note': 1,
    'inline-permission-allow': 1,
    'inline-permission-badge': 1,
    'inline-permission-deny': 1,
    'inline-permission-deny-note': 1,
    'inline-permission-in-chat': 1,
    'inline-permission-unsandboxed-warning': 1,
    'permission-target-editor': 1
  };
  var MCP_APP_STATUS_LABELS = {
    'mcp-app-pane-loading': ['Loading', '正在加载'],
    'mcp-app-pane-error': ['Could not load', '无法加载'],
    'mcp-app-view-error': ['Could not load the app view:', '无法加载应用视图：']
  };

  function isModelSelectorBoundary(elem) {
    if (!elem || elem.nodeType !== 1) return false;
    var testId = elem.getAttribute ? elem.getAttribute('data-testid') : null;
    if (testId) {
      if (testId === 'model-selector-trigger' ||
          testId === 'model-selector-item' ||
          testId === 'model-selector-orchestrator' ||
          testId === 'model-selector-effort-option' ||
          testId === 'model-selector-effort-group' ||
          testId === 'orchestrator-picker-row' ||
          testId === 'model-selector-list') {
        return true;
      }
    }
    return elem.hasAttribute('data-effort') ||
      // The grouped row renders the effort label and model badge as siblings.
      (elem.classList.contains('agy-overlay-item') &&
        elem.firstElementChild?.firstElementChild?.getAttribute('data-testid') === 'model-selector-effort-group');
  }

  function isCustomizationContent(el) {
    // App 2.31.2 uses the same workspace view for project and unassigned settings.
    // These leaves carry author metadata; their neighboring actions and headings
    // are ordinary UI. Test classes before looking up their scoped container.
    if (el.matches('span.font-medium.truncate[data-tooltip-id], div.text-sm.text-muted-foreground.line-clamp-2.mt-1, span.text-purple-400, span.text-green-400') &&
        el.closest('[data-testid="workspace-customizations-view"]')) return true;
    if (el.matches('div.font-medium.text-foreground.truncate, div.text-sm.text-muted-foreground.truncate, img') &&
        el.closest('[data-testid="customization-card"][data-card-name]')) return true;
    if (el.matches('h3.font-semibold.truncate, p.text-muted-foreground.line-clamp-3[title]') &&
        el.closest('[data-testid="featured-carousel"] [role="tabpanel"]')) return true;
    if (el.tagName === 'IMG' && el.closest('[data-testid="featured-carousel-member-tile"]')) return true;
    if (el.matches('h1.text-xl.font-medium.truncate, p.text-muted-foreground.leading-relaxed:not([data-testid="third-party-tools-disclaimer"]), span.font-medium.flex-shrink-0, span.text-muted-foreground.truncate[title]')) {
      var detail = el.closest('[data-testid="plugin-detail"], [role="dialog"]');
      if (detail && (detail.getAttribute('data-testid') === 'plugin-detail' ||
          detail.querySelector('h1.text-xl.font-medium.truncate, [data-testid="doc-row-modal"]'))) return true;
    }
    if (el.matches('h1, h2, p.text-muted-foreground.leading-relaxed, div.font-mono.break-all > span')) {
      var dialog = el.closest('[role="dialog"]');
      if (dialog && dialog.querySelector('[data-testid="doc-row-modal"]')) return true;
    }
    return false;
  }

  function isMcpServerContent(el) {
    // App 2.32.1 renders identifiers and raw startup diagnostics beside controls.
    // Keep those source values intact without suppressing Restart/status labels.
    var content = el.matches('span.font-medium.shrink-0[title], div.text-sm.text-red-500.break-words, button[aria-pressed]') ||
      (el.tagName === 'SPAN' && el.classList.contains('rounded-full') &&
        el.classList.contains('shrink-0') && el.classList.contains('text-[11px]'));
    return content && !!el.closest('[data-testid="mcp-server-row"]');
  }

  function isPullRequestLink(el) {
    return el && el.tagName === 'A' &&
      /^https?:\/\/(?:github\.com|depot\.code\.corp\.goog)\/[\w.-]+\/[\w.-]+\/pull\/[1-9]\d*(?:[/?#]|$)/i.test(el.getAttribute('href') || '');
  }

  function hasPullRequestCardHeader(el) {
    var header = el && el.firstElementChild;
    return !!(header && header.classList.contains('text-compact') &&
      header.classList.contains('gap-1.5') && isPullRequestLink(header.querySelector('a[href]')));
  }

  function isRemoteMetadata(el, testId) {
    if (testId === 'ssh-config-file-name') return el.hasAttribute('tabindex');
    var classes = el.classList;
    if (el.tagName === 'SPAN' && classes.contains('truncate') && el.closest('[data-ssh-host]')) return true;
    if (classes.contains('whitespace-pre-line') && el.closest('[data-testid="ssh-connect-error"]')) return true;

    // The PR card shares this slot with repository-supplied titles and diagnostics.
    if (el.tagName === 'DIV' && classes.contains('text-compact') &&
        (classes.contains('-mt-1') || classes.contains('font-medium')) && hasPullRequestCardHeader(el.parentElement)) return true;
    if (classes.contains('line-clamp-4') && classes.contains('whitespace-pre-wrap') && hasPullRequestCardHeader(el.parentElement)) return true;
    if (el.tagName === 'SPAN' && classes.contains('break-words') && classes.contains('min-w-0') &&
        el.parentElement?.classList.contains('grid-cols-[auto_1fr]') && hasPullRequestCardHeader(el.parentElement.parentElement)) return true;
    return isPullRequestLink(el) && (el.closest('.text-compact.gap-1\\.5') || el.hasAttribute('data-item-id'));
  }

  function isProjectDeletionDetails(el) {
    return !!el?.classList.contains('flex-1') &&
      !!el.parentElement?.querySelector(':scope > .shrink-0 > [data-testid="delete-project-button"]');
  }

  function isProjectDeletionDescription(el) {
    var wrapper = el?.parentElement;
    return el?.tagName === 'SPAN' && wrapper?.classList.contains('whitespace-pre-wrap') &&
      isProjectDeletionDetails(wrapper.parentElement);
  }

  function isProtectedBoundary(el) {
    if (IGNORED_TAGS[el.tagName]) return true;
    if (el.isContentEditable || el.getAttribute('contenteditable') === '' ||
        el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === 'plaintext-only') return true;
    if (isModelSelectorBoundary(el)) return true;

    var testId = el.getAttribute('data-testid');
    if (testId === 'menu-option-label' && el.closest('[data-mention-menu]')) return true;
    if (testId === 'menu-option-description' &&
        (el.getAttribute('dir') === 'rtl' || el.closest('[data-mention-menu]'))) return true;
    if ((CONTENT_TEST_IDS[testId] === 1 && !isCustomizationBreadcrumb(el)) || el.hasAttribute('data-ag-localization-skip') ||
        el.hasAttribute('data-markdown-root')) return true;
    if (el.hasAttribute('data-uri') && el.hasAttribute('data-quotable-inline')) return true;
    if (el.classList.contains('opacity-90') && isFloatingComposerPreview(el)) return true;
    if (el.matches('[data-testid="step-plan-item"] > span.min-w-0.truncate[title]')) return true;
    if (testId === 'project-header' && el.hasAttribute('data-project-label')) return true;
    // The first emphasized value in the deletion notice is a project or automation name.
    if (el.tagName === 'STRONG' && !el.previousElementSibling && isProjectDeletionDescription(el.parentElement)) return true;
    if (el.tagName === 'DD' && el.parentElement &&
        el.parentElement.getAttribute('data-testid') === 'permission-download-details') return true;
    if (el.tagName === 'DD' && el.parentElement?.getAttribute('data-testid') === 'url-security-certificate') {
      var field = el.previousElementSibling?.firstChild;
      return readOriginalText(field) !== 'Valid until';
    }
    if (el.matches('span.text-secondary-foreground.break-all') && el.closest('[data-testid="url-security-popover"]')) return true;
    if (testId && testId.indexOf('gcp-project-combobox-option-') === 0 &&
        el.hasAttribute('data-project-id')) return true;
    if (el.tagName === 'NAV' && el.getAttribute('aria-label') === 'File path breadcrumbs') return true;

    var className = typeof el.className === 'string' ? el.className : '';
    if (className) {
      for (var i = 0; i < IGNORED_CLASSES.length; i++) {
        if (className.indexOf(IGNORED_CLASSES[i]) !== -1) return true;
      }
      var classes = className.split(/\s+/);
      for (var ci = 0; ci < classes.length; ci++) {
        if (CONTENT_CLASSES[classes[ci]] === 1) return true;
      }
    }
    return isRemoteMetadata(el, testId) || isCustomizationContent(el) || isMcpServerContent(el);
  }

  function isCustomizationBreadcrumb(el) {
    // The first segment on the dedicated customization route is navigation UI.
    // Plugin/project names, later segments and the same name on other routes stay protected.
    if (el.getAttribute('data-testid') !== 'breadcrumb-segment' ||
        !/^\/customizations(?:\/|$)/.test(doc.location.pathname) ||
        !/^(Customizations|自定义扩展)$/.test(el.textContent.trim())) return false;
    var group = el.parentElement && el.parentElement.parentElement;
    return !!group && group.querySelector('[data-testid="breadcrumb-segment"]') === el;
  }

  function getMixedContentKind(el) {
    var testId = el.getAttribute('data-testid');
    if (testId === 'agent-message' || testId === 'agent-response') return 'message';
    if (testId === 'conversation-row-sidebar') return 'conversation';
    if (testId === 'side-question-question' || testId === 'side-question-answer') return 'side-question';
    if ((testId === 'inline-card' && el.hasAttribute('data-inline-card-key')) ||
        (testId === 'inline-permission-card' && el.hasAttribute('data-permission-action'))) return 'inline-request';
    if (Array.isArray(MCP_APP_STATUS_LABELS[testId])) return 'mcp-app-status';
    var role = el.getAttribute('role');
    if (role === 'tree' || role === 'treeitem') return 'tree';
    return null;
  }

  function getMcpAppStatusLabel(el) {
    var label = MCP_APP_STATUS_LABELS[el?.getAttribute('data-testid')];
    if (Array.isArray(label)) return label;
    if (el?.classList?.contains('shimmer-text-content') && el.closest('[data-testid="mcp-app-pane-loading"]')) {
      return MCP_APP_STATUS_LABELS['mcp-app-pane-loading'];
    }
    return null;
  }

  function isInlineRequestUi(el, card) {
    var marker = el.closest('[data-testid]');
    if (marker && marker !== card && card.contains(marker) &&
        INLINE_REQUEST_UI_TEST_IDS[marker.getAttribute('data-testid')] === 1) return true;
    if (card.getAttribute('data-testid') === 'inline-permission-card') {
      return el.matches('[role="radiogroup"], [data-testid="permission-download-details"] > dt');
    }

    // The pending title, details, options and answered summary are supplied by
    // the agent or the user. Only the renderer's fixed controls and status text translate.
    var state = card.getAttribute('data-inline-card-state');
    if (state === 'superseded') return el.parentElement === card && el.tagName === 'SPAN';
    if (state === 'expired') return marker === card;
    if (state === 'answered') return el.parentElement === card && el.classList.contains('text-muted-foreground');
    if (el.tagName === 'BUTTON' && el.hasAttribute('aria-label') &&
        el.parentElement?.classList.contains('shrink-0') && el.parentElement.classList.contains('gap-0.5')) return true;
    return el.matches('div.text-xs.text-muted-foreground[class~="px-0.5"]') ||
      (el.tagName === 'SPAN' && el.classList.contains('rounded-full') &&
        el.classList.contains('text-primary') && !!el.closest('[role="radio"], [role="checkbox"]'));
  }

  function isMessageUiControl(el) {
    var role = el.getAttribute('role');
    return el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ||
      role === 'button' || role === 'status' || el.getAttribute('data-testid') === 'plan-command-fyi-alert' ||
      isSideQuestionUi(el) || isTimestampUi(el) || isChangedFilesCardUi(el);
  }

  function isChangedFilesCardUi(el) {
    return (el.getAttribute('data-testid') === 'changed-files-card-review' ||
      (el.tagName === 'SPAN' && el.classList.contains('truncate') &&
        el.parentElement?.parentElement?.getAttribute('data-testid') === 'changed-files-card-header')) &&
      !!el.closest('[data-testid="changed-files-card"]');
  }

  function isSideQuestionUi(el) {
    return el.getAttribute('data-testid') === 'side-question-insert-to-main' ||
      el.matches('[data-testid="side-question-question"] > span.shrink-0, [data-testid="side-question-answer"] > span.opacity-70.animate-pulse');
  }

  function getSideQuestionOrigin(el) {
    var button = el?.tagName === 'BUTTON' ? el : el?.parentElement;
    return button?.matches('button.agy-user-bubble-header[data-testid="side-question-origin"]') &&
      button.closest('[data-testid="side-question-tab-conversation"]') ? button : null;
  }

  var SIDE_QUESTION_ORIGIN_LABELS = {
    'Started during': '发起于',
    'Started from': '来源于',
    'the main conversation': '主会话',
    'the subagent conversation': '子智能体会话',
    'Show': '查看'
  };

  function isTimestampUi(el) {
    if (!el || el.nodeType !== 1 || el.tagName !== 'SPAN' || !el.hasAttribute('data-screenshot-volatile')) return false;
    return (el.hasAttribute('data-tooltip-id') && el.classList.contains('whitespace-nowrap')) ||
      (el.classList.contains('tabular-nums') && !!el.closest('[data-testid="conversation-row-sidebar"]'));
  }

  function isUserMessageClock(el) {
    return isTimestampUi(el) && el.getAttribute('data-tooltip-id')?.startsWith('timestamp-') &&
      el.parentElement?.matches('[data-testid="user-message-actions"][data-no-scroll-jump]') &&
      el.closest('[data-testid="user-input-step"], [data-testid="user-message-content"], [data-markdown-root], .prose')
        ?.getAttribute('data-testid') === 'user-input-step';
  }

  function translateRelativeClock(text) {
    var clock = text.match(/^(?:(about|over|almost|less than) )?(\d+)(mo|m|h|d|w|y)( ago)?$/);
    if (clock) return ({about: '约 ', over: '超过 ', almost: '将近 ', 'less than': '不到 '}[clock[1]] || '') +
      clock[2] + ({mo: '个月', m: '分钟', h: '小时', d: '天', w: '周', y: '年'}[clock[3]]) + (clock[4] ? '前' : '');
    return text === 'now' || text === 'just now' ? '刚刚' : null;
  }

  function isWorkSummaryUi(el) {
    var testId = el.getAttribute('data-testid');
    return testId === 'worked-for-collapsible' || testId === 'tool-group-collapsible' ||
      testId === 'progress-updates-collapsible';
  }

  var TOOL_SUMMARY_ACTIONS = { explored: '已浏览', ran: '已运行', edited: '已编辑' };
  var TOOL_SUMMARY_OBJECTS = { file: '文件', files: '文件', artifact: '产物', artifacts: '产物', command: '命令', commands: '命令' };

  function isToolSummary(text, el) {
    return /^(Explored|Ran|Edited)(?: |$)/.test(text) && !!el?.closest('button[data-testid="tool-group-collapsible"]');
  }

  function translateToolSummary(text) {
    var parts = text.split(', ');
    var translated = [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].match(/^(explored|edited)(?: (files?|artifacts?))?$|^(ran) (commands?)$/i);
      if (!part) return null;
      translated.push(TOOL_SUMMARY_ACTIONS[(part[1] || part[3]).toLowerCase()] +
        (TOOL_SUMMARY_OBJECTS[(part[2] || part[4] || '').toLowerCase()] || ''));
    }
    return translated.join('、');
  }

  var SITE_DATA_MESSAGES = [
    ['Clearing cookies and site data for ', ' may sign you out of this site.', '清除 ', ' 的 Cookie 和网站数据后，你可能需要重新登录该网站。'],
    ['Site data cleared for ', '.', '已清除 ', ' 的网站数据。'],
    ['Could not clear site data for ', '.', '无法清除 ', ' 的网站数据。']
  ];

  function isSiteDataMessage(el) {
    return el?.matches('span.leading-relaxed, span.text-error, [data-testid="url-security-site-data-cleared"]') &&
      !!el.closest('[data-testid="url-security-popover"]');
  }

  function translateSiteDataMessage(text, el) {
    if (!/^(Clearing cookies and site data|Site data cleared|Could not clear site data) for /.test(text) ||
        !isSiteDataMessage(el)) return null;
    for (var i = 0; i < SITE_DATA_MESSAGES.length; i++) {
      var [prefix, suffix, localizedPrefix, localizedSuffix] = SITE_DATA_MESSAGES[i];
      if (text.startsWith(prefix) && text.endsWith(suffix)) {
        var host = text.slice(prefix.length, -suffix.length);
        if (/^\S+$/.test(host)) return localizedPrefix + host + localizedSuffix;
      }
    }
    return null;
  }

  var DOWNLOAD_ACTION_LABELS = {
    'webview-download-open': ['Open ', '', '打开 '],
    'webview-download-show-in-folder': ['Show ', ' in folder', '在文件夹中显示 '],
    'webview-download-cancel': ['Cancel ', '', '取消下载 '],
    'webview-download-remove': ['Remove ', ' from list', '从列表中移除 ']
  };

  function translateDownloadAccessibility(value, el) {
    var testId = el.getAttribute('data-testid');
    var action = Object.hasOwn(DOWNLOAD_ACTION_LABELS, testId) && DOWNLOAD_ACTION_LABELS[testId];
    var progress = !action && el.getAttribute('role') === 'progressbar';
    if (!action && !progress) return null;
    var filename = el.closest('[data-testid="webview-download-item"]')
      ?.querySelector('[data-testid="webview-download-filename"]')?.textContent;
    if (!filename) return null;
    if (progress) return value === filename + ' download progress' ? filename + ' 的下载进度' : null;
    return value === action[0] + filename + action[1] ? action[2] + filename : null;
  }

  function translateMarketplaceCategory(text, el) {
    if (text === 'Science' && el && (el.closest('[data-testid="marketplace-category-option-science"], [data-testid="marketplace-category-chip"]') ||
        (el.matches('section[aria-label], section[aria-label] > div > h2') && el.closest('[data-testid="customizations-marketplace"]')))) {
      return '科研';
    }
    if (el?.tagName === 'BUTTON' && (text === 'See more in Science' || text === 'See less in Science') &&
        el.closest('[data-testid="customizations-marketplace"] section[aria-label]')) {
      return text === 'See more in Science' ? '在科研中查看更多' : '在科研中收起';
    }
    return null;
  }

  var permissionPresets = {
    Auto: { label: '自动审查', description: 'Automatically decide if commands run.' },
    Turbo: { label: '完全权限', description: 'Run all commands without restrictions.' }
  };
  var adminDisabledSuffix = ' (disabled by admin)';
  var permissionOptionSelector = '[data-select-popup] [role="option"].agy-overlay-item';

  function isPermissionSettingsSelect(control, valueId) {
    var ids = (control.getAttribute('aria-labelledby') || '').split(' ');
    if (!ids[0].startsWith('dropdown-label-') ||
        (valueId ? ids.length !== 2 || ids[1] !== valueId : ids.length !== 1)) return false;
    var descriptionId = ids[0].replace('dropdown-label-', 'dropdown-description-');
    if (control.getAttribute('aria-describedby') !== descriptionId) return false;
    var label = doc.getElementById(ids[0])?.textContent;
    var description = doc.getElementById(descriptionId)?.textContent;
    if (!label || !description) return false;
    var expected;
    if (label === 'Permission preset' || label === exactDict['Permission preset'] ||
        label === 'This computer' || label === exactDict['This computer']) expected = 'Controls the actions the agent can take.';
    else if (label === 'Remote' || label === exactDict.Remote) expected = 'Controls permissions for remote conversations.';
    return !!expected && (description.startsWith(expected) || (!!exactDict[expected] && description.startsWith(exactDict[expected])));
  }

  function isPermissionPresetLabel(el, preset) {
    if (!el?.matches) return false;
    if (el.matches('button[data-testid="permissions-selector-trigger"] > span')) return true;
    if (el.matches('span.truncate') && (el.closest('[data-testid="permissions-preset-option-' + preset.toLowerCase() + '"]') &&
        !el.closest('[data-testid="permissions-default-tag"]') ||
        el.matches('[data-testid="permissions-use-global-settings"] span.text-muted-foreground'))) return true;
    if (el.matches('button.agy-select-trigger > span.truncate[id^="dropdown-value-"]')) {
      return isPermissionSettingsSelect(el.parentElement, el.id);
    }
    if (el.matches('select[aria-labelledby] > option[value]') && el.value === preset) {
      return isPermissionSettingsSelect(el.parentElement);
    }
    // Settings popups live in a portal. The adjacent preset description identifies
    // the option even after the runtime has translated that sibling.
    if (el.classList.contains('truncate') && el.parentElement?.parentElement?.matches(permissionOptionSelector)) {
      var subtitle = el.nextElementSibling;
      var expected = permissionPresets[preset].description;
      return subtitle?.matches('span.text-muted-foreground') &&
        (subtitle.textContent === expected || subtitle.textContent === exactDict[expected]);
    }
    return false;
  }

  function translatePresetAccessibility(value, el) {
    if (!el.matches('button[data-testid="permissions-selector-trigger"]')) return null;
    var current = value.match(/^Agent permissions preset selector, current: (.+)$/);
    if (current && Object.hasOwn(permissionPresets, current[1])) {
      return '智能体权限预设选择器，当前：' + permissionPresets[current[1]].label;
    }
    var locked = value.match(/^Agent permissions preset: ([^,]+), ([\s\S]+)$/);
    if (locked) {
      var name = locked[1];
      var label = Object.hasOwn(permissionPresets, name) ? permissionPresets[name].label :
        (name === 'Default' || name === 'Request Review') ? exactDict[name] : null;
      if (label) return '智能体权限预设：' + label + '，' +
        (Object.hasOwn(exactDict, locked[2]) ? exactDict[locked[2]] : locked[2]);
    }
    return null;
  }

  function translateQueuedStatus(value, testId) {
    var prefix = 'Waiting on ';
    return testId === 'queued-messages-status' && value.startsWith(prefix) && value.length > prefix.length
      ? '正在等待 ' + value.slice(prefix.length) : null;
  }

  function translateFeaturedAttribute(value, attr, el) {
    var name = el.getAttribute('data-member-name');
    if (name && el.getAttribute('data-testid') === 'featured-carousel-member-tile') {
      if (attr === 'title') return value;
      if (attr === 'aria-label') {
        var status = value.startsWith(name + ', ') && translateSingleUnit(value.slice(name.length + 2));
        return status ? name + '，' + status : value;
      }
    }
    if (attr !== 'aria-label') return null;
    var action = value.match(/^(Details for|Adding|Add) (.+)$/);
    if (action && el.closest('[data-testid="featured-carousel"]')) {
      var labels = { 'Details for': '查看详情：', Adding: '正在添加 ', Add: '添加 ' };
      return labels[action[1]] + action[2];
    }
    return null;
  }

  function isSideQuestionDraftTitle(el) {
    return el?.getAttribute('data-testid') === 'side-question-tab-header-title' ||
      !!el?.closest('button[data-tab-id="side_question__draft"]');
  }

  function isFloatingComposerPreview(el) {
    return el?.tagName === 'SPAN' && !!el.id &&
      el.parentElement?.getAttribute('data-testid') === 'aux-pane-floating-composer-trigger' &&
      el.parentElement.firstElementChild === el;
  }

  function translateFloatingComposerStatus(text, kind) {
    if (kind === 'task' && /^\d+ tasks? running$/.test(text)) return translateSingleUnit(text);
    switch (text) {
      case 'Subagent needs approval':
      case 'Question waiting':
      case 'Action required':
      case 'Canceling':
      case 'Compacting':
      case 'Working':
      case 'Unread message':
        return translateSingleUnit(text);
      default:
        return text;
    }
  }

  function translateUiText(text, el) {
    var testId = el && el.getAttribute('data-testid');
    var floatingStatus = el?.closest('[data-testid="aux-pane-floating-composer-status"]');
    if (floatingStatus) return translateFloatingComposerStatus(text, floatingStatus.getAttribute('data-status-kind'));
    if (/^(?:\d+ ?)?(?:Comments?|Attached)$/.test(text) &&
        el?.closest('[data-testid="aux-pane-floating-composer-comment-badge"], [data-testid="aux-pane-floating-composer-attachment-badge"]')) {
      if (text === 'Comment' || text === 'Comments') return '条评论';
      if (text === 'Attached') return '个附件';
      return text;
    }
    if (text.startsWith('Connect an account for ') && el?.closest('[data-testid="remote-automation-oauth-consent-callout"]')) {
      var consent = text.match(/^Connect an account for (.+) so the agent can run automations\.$/);
      if (consent) return '请为 ' + consent[1] + ' 连接账号，以便智能体运行自动化任务。';
    }
    if (text === 'New Side Question' && isSideQuestionDraftTitle(el)) return '新建旁路提问';
    if (text === 'at' && el?.matches('span.text-muted-foreground.select-none') &&
        el.closest('[data-testid="automation-schedule-editor"]')) return '于';
    var queuedStatus = translateQueuedStatus(text, testId);
    if (queuedStatus) return queuedStatus;
    if (isToolSummary(text, el)) return translateToolSummary(text);
    if (testId === 'tool-group-elapsed' && el.closest('button[data-testid="tool-group-collapsible"]')) {
      var time = text.match(/^(?:(\d+)h )?(?:(\d+)m )?(\d+)s$/);
      if (time) return [time[1] && time[1] + ' 小时', time[2] && time[2] + ' 分钟', time[3] + ' 秒']
        .filter(Boolean).join(' ');
    }
    if (text.includes(' · ') && el?.closest('button[data-testid="progress-updates-collapsible"]')) {
      var progress = text.match(/^(Worked for .+) · (\d+) updates?$/);
      var elapsed = progress && translateSingleUnit(progress[1]);
      if (elapsed) return elapsed + ' · ' + progress[2] + ' 条更新';
    }
    var siteData = translateSiteDataMessage(text, el);
    if (siteData) return siteData;
    if (text.startsWith('The certificate was rejected (') && el?.matches('span.text-error') &&
        el.closest('[data-testid="url-security-popover"]')) {
      var certificateError = text.match(/^The certificate was rejected \(([^()]+)\)\.$/);
      if (certificateError) return '证书已被拒绝（' + certificateError[1] + '）。';
    }
    if ((text === 'Your plan' || text === 'Your plan:' || text.startsWith('Your plan: ')) &&
        el?.classList.contains('font-medium') && el.closest('.settings-modal-container')) {
      return text === 'Your plan' ? '当前方案' : '当前方案：' + text.slice('Your plan:'.length).trimStart();
    }
    if ((text.startsWith('Free users and ') || text.startsWith('You can upgrade to a higher Google AI Ultra ')) &&
        el?.matches('.settings-modal-container span.text-sm.text-muted-foreground.whitespace-pre-wrap, ' +
          '[data-testid="model-selector-panel"] .sticky .text-secondary-foreground > span')) {
      if (text === 'Free users and Google AI Plus users receive the minimum base limits on Antigravity. You can upgrade to Google AI Pro or above to receive higher rate limits.') {
        return '免费用户和 Google AI Plus 用户适用 Antigravity 的最低基础额度。升级至 Google AI Pro 或更高档位可提高请求速率上限。';
      }
      if (text === 'You can upgrade to a higher Google AI Ultra plan to receive the highest rate limits.') {
        return '你可以升级至更高档位的 Google AI Ultra 方案，获得最高的请求速率上限。';
      }
    }
    if (text.startsWith('Available AI credits: ') && el?.tagName === 'SPAN' &&
        el.closest('.settings-modal-container') &&
        el.parentElement?.parentElement?.parentElement?.querySelector(':scope > .shrink-0 a[href^="https://antigravity.google/g1-credits"]')) {
      var balance = text.match(/^Available AI credits: ([\d.,\s]+)$/);
      if (balance) return '可用 AI 积分：' + balance[1];
    }
    if (text.endsWith(' left') && el?.closest('[data-testid="inline-card-expiry"]')) {
      var remaining = text.match(/^(\d+)([ms]) left$/);
      if (remaining) return '剩余 ' + remaining[1] + (remaining[2] === 'm' ? ' 分钟' : ' 秒');
    }
    if (text === 'Welcome to Antigravity!' && el?.tagName === 'DIV' && el.classList.contains('entrance-title')) return '欢迎使用 Antigravity！';
    if (text === 'SSH Host' && el?.closest('[data-testid="project-selector-ssh-host-trigger"]')) return 'SSH 主机';
    if (text === 'Delete project' && el?.tagName === 'SPAN' && isProjectDeletionDetails(el.parentElement?.parentElement)) {
      return translateSingleUnit('Delete Project');
    }
    if (el?.tagName === 'STRONG' && el.previousElementSibling && text.includes(' and ')) {
      var counts = text.match(/^(\d+ active conversations?) and (\d+ archived conversations?)$/);
      if (counts && isProjectDeletionDescription(el.parentElement)) {
        var active = translateSingleUnit(counts[1]);
        var archived = translateSingleUnit(counts[2]);
        if (active && archived) return active + '和 ' + archived;
      }
    }
    if (text === 'commands.' && el?.firstElementChild?.tagName === 'CODE' &&
        el.firstElementChild.textContent === 'antigravity.' &&
        (textEdits.get(el.firstChild)?.source || el.firstChild.nodeValue)?.trim() ===
          'Inspect live bindings or record custom key chords filtered to') return '的命令。';
    if (el && el.classList.contains('text-muted-foreground') && el.closest('[data-testid="ssh-connect-dialog"]')) {
      if (text.trim() === 'No hosts in') return '尚无主机记录，配置文件：';
      if (text.trim() === 'yet. Type one above.') return '。可在上方手动输入。';
    }
    if (el && el.classList.contains('text-foreground') && el.closest('[data-testid="ssh-connect-error"]') &&
        text.trim() === "Couldn't connect to") return '无法连接到';
    if (el && el.tagName === 'SPAN' && el.classList.contains('whitespace-nowrap') &&
        el.closest('[data-testid="github-hover-auth-actions"]') && text.trim() === 'in a terminal') return '（在终端中）';
    if (el && el.tagName === 'SPAN' && el.classList.contains('text-muted-foreground') &&
        el.parentElement?.classList.contains('grid-cols-[auto_1fr]') &&
        hasPullRequestCardHeader(el.parentElement.parentElement) && text.trim() === 'Author') return '作者';
    if (testId === 'find-bar-match-count') {
      var matchCount = text.match(/^\s*(\d+) of (\d+\+?)\s*$/);
      if (matchCount) return '第 ' + matchCount[1] + ' 项，共 ' + matchCount[2] + ' 项';
    }
    if (testId === 'ssh-connect-hidden-hosts-toggle') {
      var hidden = text.match(/^\s*(\d+) hidden hosts?\s*$/);
      if (hidden) return hidden[1] + ' 台隐藏主机';
    }
    if (testId === 'ssh-connect-host-group-label') {
      var config = text.match(/^SSH Config \((.+)\)$/);
      if (config) return 'SSH 配置（' + config[1] + '）';
    }
    if (el && el.classList.contains('z-10') && el.parentElement?.classList.contains('text-compact') &&
        hasPullRequestCardHeader(el.parentElement.parentElement?.parentElement)) {
      var state = { Open: '开放', Closed: '已关闭', Merged: '已合并', Draft: '草稿' }[text.trim()];
      if (typeof state === 'string') return state;
    }
    // Compact relative times belong to UI clocks, never arbitrary message text.
    if (isTimestampUi(el)) {
      var clock = translateRelativeClock(text);
      if (clock) return clock;
    }
    return translateMarketplaceCategory(text, el) ?? translateSingleUnit(text);
  }

  // Cache DOM facts only during one synchronous scan slice. Never retain a
  // content verdict across renderer writes, reparenting, routes or later frames.
  var scanContext = null;
  function withScanContext(callback) {
    var previous = scanContext;
    scanContext = { facts: new WeakMap(), modes: new WeakMap() };
    try { return callback(); }
    finally { scanContext = previous; }
  }

  function getElementFacts(el) {
    var facts = scanContext && scanContext.facts.get(el);
    if (!facts) {
      facts = { protected: isProtectedBoundary(el), kind: getMixedContentKind(el) };
      if (scanContext) scanContext.facts.set(el, facts);
    }
    return facts;
  }

  // 0: protect the entire subtree; 1: traverse mixed content, preserving its own
  // text/attributes; 2: translate UI. Recompute ancestry for every entry point:
  // observer updates may start deep in a subtree, and React may reparent nodes.
  function getElementTranslationMode(el) {
    if (!el || el.nodeType !== 1) return 2;
    if (scanContext && scanContext.modes.has(el)) return scanContext.modes.get(el);
    var current = el;
    var control = null;
    var inToolbar = false;
    var inLink = false;
    var preserveContent = false;
    var explicitMessageUi = false;
    while (current) {
      var facts = getElementFacts(current);
      if (facts.protected || (scanContext && scanContext.modes.get(current) === 0)) {
        if (scanContext) scanContext.modes.set(el, 0);
        return 0;
      }
      var kind = facts.kind;
      if (kind === 'inline-request') {
        explicitMessageUi = isInlineRequestUi(el, current);
        if (!explicitMessageUi) preserveContent = true;
      } else if (kind === 'mcp-app-status') {
        explicitMessageUi = true;
      } else if (kind && (kind !== 'message' || !explicitMessageUi)) {
        // A sidebar navigation link carries the conversation name, even inside wrappers.
        if (kind === 'conversation' && inLink) return 0;
        if (!control) {
          preserveContent = true;
        } else if (kind === 'side-question' && !isSideQuestionUi(control)) {
          preserveContent = true;
        } else if (kind === 'message' && !inToolbar && control.parentElement !== current &&
            control.getAttribute('data-testid') !== 'plan-command-fyi-alert' && !isTimestampUi(control) &&
            !isChangedFilesCardUi(control) && !isWorkSummaryUi(control)) {
          // Unmarked legacy bodies can contain buttons. A nested button alone is not UI chrome.
          preserveContent = true;
        } else if (kind === 'tree' && (control.hasAttribute('data-uri') ||
            (control.tagName !== 'BUTTON' && !inToolbar))) {
          preserveContent = true;
        }
      } else if (!kind && !preserveContent) {
        if (!control) {
          if (facts.control === undefined) facts.control = isMessageUiControl(current);
          if (facts.control) control = current;
        }
        if (control && current.getAttribute('role') === 'toolbar') inToolbar = true;
        if (current.tagName === 'A') inLink = true;
      }
      current = current.parentElement;
    }
    var mode = preserveContent ? 1 : 2;
    if (scanContext) scanContext.modes.set(el, mode);
    return mode;
  }



  // 标记属性名，用于避免重复翻译
  var MARK_ATTR = '_agyDone';
  var textEdits = new WeakMap();
  var attributeEdits = new WeakMap();

  function translateOfficialPluginDescription(el) {
    if (!officialPluginDescriptions || !el?.classList) return false;
    var searchHighlight = 'span.font-semibold.text-foreground';
    if (el.tagName === 'SPAN' && el.classList.contains('font-semibold') && el.matches(searchHighlight)) el = el.parentElement;
    if (!el?.classList.contains('text-muted-foreground')) return false;
    var featured = el.matches('p.line-clamp-3[title]') && el.closest('[data-testid="featured-carousel"] [role="tabpanel"]');
    if (!featured && !el.matches('div.text-sm.line-clamp-2.mt-1, div.text-sm.truncate, p.leading-relaxed')) return false;

    // Search can split a card's description into text and matching spans.
    // Read the full source and keep the nodes React owns in place.
    var texts = [];
    var source = '';
    var primary = null;
    var hasTranslation = false;
    for (var child = el.firstChild; child; child = child.nextSibling) {
      var text = child.nodeType === 3 ? child : child.matches?.(searchHighlight) ? child.firstChild : null;
      if (!text || text.nodeType !== 3 || (text !== child && text.nextSibling)) return false;
      var edit = textEdits.get(text);
      source += edit?.localized === text.nodeValue ? edit.source : text.nodeValue;
      hasTranslation = hasTranslation || edit?.scope === 'official-plugin-description';
      if (!primary && text === child) primary = text;
      texts.push(text);
    }
    var entry = Object.hasOwn(officialPluginDescriptions, source) && officialPluginDescriptions[source];
    if (entry && getElementTranslationMode(el.parentElement) === 2 && !el.dispatchEvent(new root.CustomEvent(
      'agy-localization-check-official-plugin-description', {detail: source, cancelable: true}
    ))) {
      primary = primary || texts[0];
      for (var i = 0; i < texts.length; i++) {
        writeLocalizedText(texts[i], texts[i] === primary ? entry.translation : '', 'official-plugin-description');
      }
      var title = el.getAttribute('title');
      var edit = attributeEdits.get(el)?.title;
      if (featured && (title === source || (title === edit?.localized && edit.source === source))) {
        writeLocalizedAttribute(el, 'title', entry.translation, true);
      } else restoreLocalizedAttributes(el);
      return true;
    }
    if (hasTranslation) {
      for (var j = 0; j < texts.length; j++) restoreLocalizedText(texts[j]);
      restoreLocalizedAttributes(el);
    }
    return false;
  }

  // Retain the source of a DOM write while this runtime still owns the displayed value.
  function writeLocalizedText(node, value, scope) {
    if (node.nodeValue !== value) {
      var previous = textEdits.get(node);
      var source = previous && previous.localized === node.nodeValue ? previous.source : node.nodeValue;
      textEdits.set(node, { source: source, localized: value, scope: scope });
      node.nodeValue = value;
    }
    node._agyOriginal = value;
  }

  function restoreLocalizedText(node) {
    var edit = textEdits.get(node);
    if (!edit) return;
    textEdits.delete(node);
    if (node.nodeValue === edit.localized) node.nodeValue = edit.source;
    node._agyOriginal = undefined;
  }

  function readOriginalText(node) {
    if (!node || node.nodeType !== 3) return null;
    var edit = textEdits.get(node);
    return edit && edit.localized === node.nodeValue ? edit.source : node.nodeValue;
  }

  function translateSiteDataFragments(el) {
    if (el?.childNodes.length !== 3 || !isSiteDataMessage(el)) return false;
    var [prefix, host, suffix] = el.childNodes;
    var message = SITE_DATA_MESSAGES.find(function (parts) {
      return readOriginalText(prefix) === parts[0] && readOriginalText(suffix) === parts[1];
    });
    if (!message || !/^\S+$/.test(readOriginalText(host) || '')) return false;
    writeLocalizedText(prefix, message[2], 'site-data');
    restoreLocalizedText(host);
    writeLocalizedText(suffix, message[3], 'site-data');
    return true;
  }

  function translateUserMessageClock(node) {
    if (!isUserMessageClock(node.parentElement)) return false;
    var translated = translateRelativeClock(readOriginalText(node).trim());
    if (!translated) return false;
    writeLocalizedText(node, translated);
    return true;
  }

  // The origin button lives inside the protected user bubble. Translate its
  // fixed labels separately and preserve the original message it quotes.
  function translateSideQuestionOriginText(node) {
    var el = node.parentElement;
    if (el?.tagName !== 'SPAN' || !getSideQuestionOrigin(el)) return false;
    var label = readOriginalText(node);
    if (Object.hasOwn(SIDE_QUESTION_ORIGIN_LABELS, label)) writeLocalizedText(node, SIDE_QUESTION_ORIGIN_LABELS[label]);
    else restoreLocalizedText(node);
    return true;
  }

  function translateSideQuestionOriginAttributes(el) {
    if (getSideQuestionOrigin(el) !== el) return false;
    for (var attr of ['title', 'aria-label']) {
      var current = el.getAttribute(attr);
      var edit = attributeEdits.get(el)?.[attr];
      var label = edit?.localized === current ? edit.source : current;
      var parts = label?.match(/^(Started during|Started from) (“[\s\S]*”|the (?:main|subagent) conversation)(?:\. Show in (main conversation|subagent conversation))?$/);
      if (!parts) continue;
      var origin = SIDE_QUESTION_ORIGIN_LABELS[parts[2]] || parts[2];
      var action = parts[3] ? '。在' + SIDE_QUESTION_ORIGIN_LABELS['the ' + parts[3]] + '中查看' : '';
      writeLocalizedAttribute(el, attr, SIDE_QUESTION_ORIGIN_LABELS[parts[1]] + origin + action);
    }
    return true;
  }

  function restoreLocalizedAttributes(el) {
    var edits = attributeEdits.get(el);
    if (!edits) return;
    attributeEdits.delete(el);
    Object.keys(edits).forEach(function (attr) {
      var edit = edits[attr];
      if (el.getAttribute(attr) === edit.localized) el.setAttribute(attr, edit.source);
      el[MARK_ATTR + '_' + attr] = undefined;
    });
  }

  function writeLocalizedAttribute(el, attr, value, officialPluginDescription) {
    var current = el.getAttribute(attr);
    if (current === value) return;
    var edits = attributeEdits.get(el);
    if (!edits) {
      edits = Object.create(null);
      attributeEdits.set(el, edits);
    }
    var previous = edits[attr];
    edits[attr] = {
      source: previous?.localized === current ? previous.source : current,
      localized: value,
      officialPluginDescription: officialPluginDescription
    };
    el.setAttribute(attr, value);
    el[MARK_ATTR + '_' + attr] = value;
  }

  function restoreProtectedSubtree(el) {
    if (!translateSideQuestionOriginAttributes(el)) restoreLocalizedAttributes(el);
    var walker = doc.createTreeWalker(el, root.NodeFilter.SHOW_ELEMENT | root.NodeFilter.SHOW_TEXT);
    var node = walker.nextNode();
    while (node) {
      if (node.nodeType === 3) {
        if (!translateUserMessageClock(node) && !translateSideQuestionOriginText(node)) restoreLocalizedText(node);
      }
      else if (!translateSideQuestionOriginAttributes(node)) restoreLocalizedAttributes(node);
      node = walker.nextNode();
    }
  }

  function getLocalizedModelSelectorLabel(el) {
    if (el.getAttribute('data-testid') !== 'model-selector-trigger' ||
        getElementTranslationMode(el.parentElement) !== 2) return null;
    var model = el.getAttribute('data-model-label');
    if (!model) return null;
    var current = el.getAttribute('aria-label');
    var edit = attributeEdits.get(el)?.['aria-label'];
    var source = edit && edit.localized === current ? edit.source : current;
    var prefix = 'Select model, current: ' + model;
    var localized = '选择模型，当前：' + model;
    if (source === prefix) return localized;
    if (!source?.startsWith(prefix + '. ')) return null;
    var note = source.slice(prefix.length + 2);
    if (note !== 'Applies to /btw and messages sent after this turn' &&
        note !== 'Applies to messages sent after this turn') return null;
    var translatedNote = translateSingleUnit(note);
    return translatedNote ? localized + '。' + translatedNote : null;
  }

  // 扫描轮次 ID，同一轮全量扫描中元素只处理一次
  var currentScanId = 0;

  function isMentionMenuOptionRow(el) {
    return !!el && el.nodeType === 1 && el.getAttribute &&
      el.getAttribute('role') === 'option' && !!el.closest?.('[data-mention-menu]');
  }

  function isProtectedSlashDescendant(el, rootDesc) {
    for (var cur = el; cur && cur !== rootDesc; cur = cur.parentElement) {
      if (cur.tagName === 'INPUT' || cur.tagName === 'TEXTAREA' ||
          isProtectedBoundary(cur) || getMixedContentKind(cur)) {
        return true;
      }
    }
    return false;
  }

  function readAttributeSource(el, attr) {
    var current = el.getAttribute(attr);
    var edit = attributeEdits.get(el)?.[attr];
    return edit && edit.localized === current ? edit.source : current;
  }

  function applyMentionScopedAttributes(targetEl, entry) {
    if (!targetEl || !targetEl.hasAttribute) return false;
    var wroteTranslation = false;
    var sourceMatch = entry ? entry.source : null;
    var transText = entry ? entry.translation : null;
    var kept = Object.create(null);
    var edits = attributeEdits.get(targetEl);

    for (var ai = 0; ai < TRANSLATABLE_ATTRS.length; ai++) {
      var attr = TRANSLATABLE_ATTRS[ai];
      if (!targetEl.hasAttribute(attr)) continue;
      var raw = readAttributeSource(targetEl, attr);
      if (entry && raw && normalizeWhitespace(raw) === sourceMatch) {
        writeLocalizedAttribute(targetEl, attr, transText);
        kept[attr] = true;
        wroteTranslation = true;
      } else if (edits && edits[attr]) {
        var oldEdit = edits[attr];
        if (targetEl.getAttribute(attr) === oldEdit.localized) targetEl.setAttribute(attr, oldEdit.source);
        targetEl[MARK_ATTR + '_' + attr] = undefined;
        delete edits[attr];
      }
    }
    if (edits && !Object.keys(edits).length) attributeEdits.delete(targetEl);
    return wroteTranslation;
  }

  var activeBuiltinSlashDescs = typeof Set !== 'undefined' ? new Set() : null;

  function findBuiltinSlashDescriptionRoot(el) {
    if (!el || el.nodeType !== 1 || !el.getAttribute) return null;
    if (el.getAttribute('data-testid') === 'menu-option-description') return el;
    var cur = el.parentElement;
    for (var depth = 0; cur && depth < 6; depth++, cur = cur.parentElement) {
      if (cur.getAttribute && cur.getAttribute('data-testid') === 'menu-option-description') return cur;
    }
    return null;
  }

  function restoreBuiltinSlashDescription(descEl) {
    if (!descEl) return;
    var walker = doc.createTreeWalker(descEl, root.NodeFilter.SHOW_TEXT);
    for (var tn = walker.nextNode(); tn; tn = walker.nextNode()) {
      if (textEdits.get(tn)?.scope === 'builtin-slash-description') restoreLocalizedText(tn);
    }
  }

  function verifyBuiltinSlashEntry(descEl) {
    if (!builtinSlashDescriptions || !descEl) return { inMentionMenu: false, verified: false, entry: null, hasProtectedNode: false, menuTextNodes: [] };
    var inMentionMenu = !!descEl.closest?.('[data-mention-menu]');
    var row = descEl.closest('[role="option"]') || descEl.parentElement;
    if (descEl.getAttribute('dir') === 'rtl' || !inMentionMenu ||
        getElementTranslationMode(descEl.parentElement) !== 2) {
      return { inMentionMenu: inMentionMenu, verified: false, entry: null, hasProtectedNode: false, menuTextNodes: [], row: row };
    }
    var labelEl = row?.querySelector('[data-testid="menu-option-label"]');
    if (!labelEl) {
      return { inMentionMenu: inMentionMenu, verified: false, entry: null, hasProtectedNode: false, menuTextNodes: [], row: row };
    }
    var cmdName = '';
    var labelWalker = doc.createTreeWalker(labelEl, root.NodeFilter.SHOW_TEXT);
    for (var lt = labelWalker.nextNode(); lt; lt = labelWalker.nextNode()) {
      cmdName += readOriginalText(lt) || '';
    }
    cmdName = cmdName.trim().replace(/^\//, '');
    var entry = Object.hasOwn(builtinSlashDescriptions, cmdName) && builtinSlashDescriptions[cmdName];

    var menuTextNodes = [];
    var hasProtectedNode = false;
    var menuWalker = doc.createTreeWalker(descEl, root.NodeFilter.SHOW_TEXT);
    for (var mt = menuWalker.nextNode(); mt; mt = menuWalker.nextNode()) {
      menuTextNodes.push(mt);
      var mParent = mt.parentElement;
      if (!mParent || isProtectedSlashDescendant(mParent, descEl)) {
        hasProtectedNode = true;
      }
    }
    if (!menuTextNodes.length) {
      return { inMentionMenu: inMentionMenu, verified: false, entry: null, hasProtectedNode: false, menuTextNodes: [], row: row };
    }
    if (hasProtectedNode) {
      return { inMentionMenu: inMentionMenu, verified: false, entry: null, hasProtectedNode: true, menuTextNodes: menuTextNodes, row: row };
    }

    var menuSource = '';
    for (var i = 0; i < menuTextNodes.length; i++) {
      var mtn = menuTextNodes[i];
      var mEdit = textEdits.get(mtn);
      menuSource += mEdit && mEdit.localized === mtn.nodeValue ? mEdit.source : mtn.nodeValue;
    }
    var normalized = normalizeWhitespace(menuSource);
    var verified = !descEl.dispatchEvent(new root.CustomEvent('agy-localization-check-builtin-slash-description', {
      detail: { name: cmdName, source: normalized },
      cancelable: true
    })) && !!entry && normalized === entry.source;

    return { inMentionMenu: inMentionMenu, verified: verified, entry: entry, hasProtectedNode: false, menuTextNodes: menuTextNodes, row: row };
  }

  function translateBuiltinSlashDescription(el) {
    if (!builtinSlashDescriptions || !el) return false;
    var descEl = findBuiltinSlashDescriptionRoot(el);
    if (!descEl) return false;
    var check = verifyBuiltinSlashEntry(descEl);
    var row = check.row;
    if (!check.inMentionMenu) {
      restoreProtectedSubtree(descEl);
      if (isMentionMenuOptionRow(row)) restoreLocalizedAttributes(row);
      if (activeBuiltinSlashDescs) activeBuiltinSlashDescs.delete(descEl);
      return false;
    }

    if (!check.verified || check.hasProtectedNode) {
      restoreProtectedSubtree(descEl);
      if (isMentionMenuOptionRow(row)) restoreLocalizedAttributes(row);
      if (activeBuiltinSlashDescs) activeBuiltinSlashDescs.delete(descEl);
      return true;
    }

    var entry = check.entry;
    var menuTextNodes = check.menuTextNodes;
    var menuTrans = entry.translation;
    var activeTranslated = false;

    if (menuTextNodes.length > 1) {
      if (menuTextNodes.length === 3) {
        var midEdit = textEdits.get(menuTextNodes[1]);
        var midSrc = (midEdit && midEdit.localized === menuTextNodes[1].nodeValue
          ? midEdit.source
          : menuTextNodes[1].nodeValue) || '';
        var hitIdx = midSrc && midSrc.trim() ? menuTrans.indexOf(midSrc) : -1;
        if (hitIdx !== -1) {
          writeLocalizedText(menuTextNodes[0], menuTrans.slice(0, hitIdx), 'builtin-slash-description');
          writeLocalizedText(menuTextNodes[1], midSrc, 'builtin-slash-description');
          writeLocalizedText(menuTextNodes[2], menuTrans.slice(hitIdx + midSrc.length), 'builtin-slash-description');
          activeTranslated = true;
        } else {
          // 无法将搜索高亮片段可靠映射到译文时，保留带高亮的原文，清空搜索恢复单文本节点后再译回中文
          restoreBuiltinSlashDescription(descEl);
        }
      } else {
        restoreBuiltinSlashDescription(descEl);
      }
    } else {
      writeLocalizedText(menuTextNodes[0], menuTrans, 'builtin-slash-description');
      activeTranslated = true;
    }

    // 统一按条目来源处理 descEl 自身、其内部元素及所属选项行的无障碍/title 属性：
    // 只有原值严格等于内置说明源码的属性随内置条目译为中文，其余属性与后代属性一律保护还原。
    if (applyMentionScopedAttributes(descEl, entry)) activeTranslated = true;
    var attrWalker = doc.createTreeWalker(descEl, root.NodeFilter.SHOW_ELEMENT);
    for (var childEl = attrWalker.nextNode(); childEl; childEl = attrWalker.nextNode()) {
      restoreLocalizedAttributes(childEl);
    }
    if (isMentionMenuOptionRow(row)) {
      if (applyMentionScopedAttributes(row, entry)) activeTranslated = true;
    }

    if (activeBuiltinSlashDescs) {
      if (activeTranslated) {
        activeBuiltinSlashDescs.add(descEl);
      } else {
        activeBuiltinSlashDescs.delete(descEl);
      }
    }
    return true;
  }

  function translateTextNode(node, parentMode) {
    if (!node || node.nodeType !== 3) return;
    if (translateSideQuestionOriginText(node)) return;
    var parent = node.parentElement || node.parentNode;
    var slashDesc = builtinSlashDescriptions ? findBuiltinSlashDescriptionRoot(parent) : null;
    if (slashDesc) {
      translateBuiltinSlashDescription(slashDesc);
      return;
    }
    var mode = parentMode === undefined ? getElementTranslationMode(parent) : parentMode;
    if (parent && (mode !== 2 || parent.tagName === 'INPUT' || parent.tagName === 'TEXTAREA')) {
      if (mode !== 0 || (!translateUserMessageClock(node) && !translateOfficialPluginDescription(parent))) restoreLocalizedText(node);
      return;
    }
    if (translateSiteDataFragments(parent)) return;
    var edit = textEdits.get(node);
    if (edit?.scope === 'site-data') {
      restoreLocalizedText(node);
      edit = undefined;
    }
    if (edit?.scope === 'official-plugin-description') {
      restoreLocalizedText(node);
      return;
    }
    if (edit?.scope === 'builtin-slash-description') {
      restoreLocalizedText(node);
      return;
    }

    // React renders the fixed prefix, app name and diagnostic as separate
    // nodes. Translate the first node only, even on rescans and reparenting.
    var mcpStatus = getMcpAppStatusLabel(parent);
    if (mcpStatus && node !== parent.firstChild) {
      restoreLocalizedText(node);
      return;
    }

    // React emits the alias/path as a separate text node after the fixed SSH
    // prefix. Preserve it even when it matches a menu label such as "Open".
    var previous = node.previousSibling;
    if (previous && previous.nodeType === 3 && parent?.classList &&
        (parent.classList.contains('text-foreground') || parent.classList.contains('text-muted-foreground'))) {
      var prefix = (textEdits.get(previous)?.source || previous.nodeValue).trim();
      if ((prefix === "Couldn't connect to" && parent.closest('[data-testid="ssh-connect-error"]')) ||
          (prefix === 'No hosts in' && parent.closest('[data-testid="ssh-connect-dialog"]'))) {
        restoreLocalizedText(node);
        return;
      }
    }

    var original = node.nodeValue;
    if (!original) return;

    // These values can move between a permission picker and another select.
    // Re-evaluate the renderer's source even if the visible value is cached.
    var source = edit?.localized === original ? edit.source : original;
    var disabledPreset = source.endsWith(adminDisabledSuffix);
    var preset = disabledPreset ? source.slice(0, -adminDisabledSuffix.length) : source;
    if (!mcpStatus && Object.hasOwn(permissionPresets, preset) && isPermissionPresetLabel(parent, preset)) {
      writeLocalizedText(node, permissionPresets[preset].label + (disabledPreset ? '（管理员已禁用）' : ''), 'permission-preset');
      return;
    }
    if (edit?.scope === 'permission-preset') {
      restoreLocalizedText(node);
      original = node.nodeValue;
    }

    // 如果节点已标记原始文本且未变化，直接 O(1) 瞬时退出
    if (node._agyOriginal === original) return;

    var trimmed = original.trim();
    if (!trimmed) {
      // 对纯空白节点补充否定标记，二次扫描直接 O(1) 退出，避免重复调用 trim()
      node._agyOriginal = original;
      return;
    }

    if (trimmed === '.' && node.previousSibling && /[\u4e00-\u9fa5]/.test(node.previousSibling.textContent || '')) {
      writeLocalizedText(node, original.replace('.', '。'));
      return;
    }

    var translated = mcpStatus
      ? (trimmed === mcpStatus[0] ? mcpStatus[1] : null)
      : translateUiText(trimmed, parent);
    if (translated !== null && translated !== trimmed) {
      var leadingSpace = original.match(/^\s*/)[0];
      var trailingSpace = original.match(/\s*$/)[0];
      // 盘古之白排版优化：若前一个兄弟节点以英数结尾且当前译文以汉字开头，自动补齐规范空格
      if (!leadingSpace && node.previousSibling) {
        var prevText = (node.previousSibling.textContent || '').trim();
        if (/[a-zA-Z0-9]$/.test(prevText) && /^[\u4e00-\u9fa5]/.test(translated)) {
          leadingSpace = ' ';
        }
      }
      writeLocalizedText(node, leadingSpace + translated + trailingSpace);
    } else {
      // 关键性能优化：补充 DOM 否定标记，未命中时记录原始文本，二次扫描直接 O(1) 退出
      node._agyOriginal = original;
    }
  }

  // 深度穿透获取首个纯文本子节点（单例通用穿透辅助，避免在热路径循环中重复创建闭包分配）
  function getFirstDirectTextNode(n) {
    var cur = n;
    while (cur) {
      if (cur.nodeType === 3) return cur;
      if (cur.nodeType === 1 && cur.childNodes.length === 1) {
        cur = cur.firstChild;
      } else {
        break;
      }
    }
    return null;
  }



  function translateElement(el, scanId, work) {
    if (!el || el.nodeType !== 1) return;
    if (scanId && el._agyScanId === scanId) return;
    var translationMode = getElementTranslationMode(el);
    if (translationMode === 0) {
      if (translateOfficialPluginDescription(el)) return;
      if (builtinSlashDescriptions) {
        if (translateBuiltinSlashDescription(el)) {
          if (scanId) el._agyScanId = scanId;
          return;
        }
      } else {
        var protectedSlashDesc = findBuiltinSlashDescriptionRoot(el);
        if (protectedSlashDesc) restoreBuiltinSlashDescription(protectedSlashDesc);
      }
      var modelSelectorLabel = getLocalizedModelSelectorLabel(el);
      if (work) {
        if (!modelSelectorLabel && !translateSideQuestionOriginAttributes(el)) restoreLocalizedAttributes(el);
        appendChildren(el, work);
      } else restoreProtectedSubtree(el);
      if (modelSelectorLabel) writeLocalizedAttribute(el, 'aria-label', modelSelectorLabel);
      return;
    }
    var translateOwnContent = translationMode === 2;
    var sideQuestionOrigin = translateSideQuestionOriginAttributes(el);
    if ((!translateOwnContent && !sideQuestionOrigin) || attributeEdits.get(el)?.title?.officialPluginDescription) restoreLocalizedAttributes(el);

    // 同一轮扫描中，已处理的元素跳过
    if (scanId) el._agyScanId = scanId;

    // 复合组件自愈：处理特定 JSX 碎片化 Alert（如 plan-command-fyi-alert）
    if (translateOwnContent && el.getAttribute && el.getAttribute('data-testid') === 'plan-command-fyi-alert') {
      var alertSpan = el.querySelector ? el.querySelector('span') : null;
      if (alertSpan && getElementTranslationMode(alertSpan) === 2) {
        var alertChild = alertSpan.firstChild;
        while (alertChild) {
          if (alertChild.nodeType === 3 && alertChild.nodeValue && alertChild.nodeValue.trim() === 'Type') {
            writeLocalizedText(alertChild, alertChild.nodeValue.replace('Type', '输入'));
          }
          alertChild = alertChild.nextSibling;
        }
      }
    }

    // [data-mention-menu] [role="option"] 行自身的可翻译属性（如 aria-label）必须严格按条目来源裁决，
    // 禁止套用通用词库将用户技能名称/说明（如 "Settings"）译为中文。
    var skipGenericAttrs = isMentionMenuOptionRow(el);
    if (translateOwnContent && skipGenericAttrs) {
      var rowDescEl = el.querySelector && el.querySelector('[data-testid="menu-option-description"]');
      var rowCheck = rowDescEl ? verifyBuiltinSlashEntry(rowDescEl) : null;
      applyMentionScopedAttributes(el, rowCheck && rowCheck.verified && !rowCheck.hasProtectedNode ? rowCheck.entry : null);
    }

    // 翻译属性
    for (var i = 0; translateOwnContent && !skipGenericAttrs && i < TRANSLATABLE_ATTRS.length; i++) {
      var attr = TRANSLATABLE_ATTRS[i];
      if (el.hasAttribute && el.hasAttribute(attr)) {
        var val = el.getAttribute(attr);
        if (val) {
          // 检查是否已翻译过此属性
          var markKey = MARK_ATTR + '_' + attr;
          if (el[markKey] === val) continue;

          var trans = (attr === 'aria-label' && val.startsWith('Agent permissions preset') ? translatePresetAccessibility(val, el) : null) ??
            (attr === 'title' && val.startsWith('Waiting on ') ? translateQueuedStatus(val, el.getAttribute('data-testid')) : null) ??
            translateMarketplaceCategory(val, el) ?? translateFeaturedAttribute(val, attr, el) ?? translateSingleUnit(val);
          if (attr === 'title' && val === 'New Side Question' && isSideQuestionDraftTitle(el)) {
            trans = '新建旁路提问';
          } else if ((attr === 'title' || attr === 'aria-label') && isToolSummary(val, el)) {
            trans = translateToolSummary(val);
          } else if (attr === 'aria-label' && el.getAttribute('data-testid') === 'progress-updates-collapsible') {
            trans = translateUiText(val, el);
          } else if ((attr === 'title' || attr === 'aria-label') &&
              el.getAttribute('data-testid') === 'aux-pane-floating-composer-status') {
            var restoreSplit = ' — restore split view';
            var statusKind = el.getAttribute('data-status-kind');
            trans = attr === 'aria-label' && val.endsWith(restoreSplit)
              ? translateFloatingComposerStatus(val.slice(0, -restoreSplit.length), statusKind) + '，' + translateSingleUnit('Restore split view')
              : translateFloatingComposerStatus(val, statusKind);
          } else if (attr === 'title' && el.getAttribute('data-testid') === 'webview-download-open') {
            trans = val;
          } else if (attr === 'aria-label' && (/^webview-download-/.test(el.getAttribute('data-testid') || '') ||
              val.endsWith(' download progress'))) {
            trans = translateDownloadAccessibility(val, el) ?? trans;
          } else if (attr === 'aria-label' && val.endsWith('. View site information') &&
              el.getAttribute('data-testid') === 'url-security-indicator') {
            var siteInfoLabel = translateSingleUnit('View site information');
            var status = val.slice(0, -'. View site information'.length);
            if (siteInfoLabel) trans = (Object.hasOwn(exactDict, status) ? exactDict[status] : status) + '。' + siteInfoLabel;
          } else if (attr === 'aria-label' && val.startsWith('Reset ') && val.endsWith(' to default') &&
              el.closest('[data-testid^="shortcut-row-"]')) {
            var shortcutAction = translateSingleUnit(val.slice('Reset '.length, -' to default'.length));
            if (shortcutAction) trans = '将' + shortcutAction + '恢复为默认设置';
          } else if (attr === 'placeholder' && el.tagName === 'INPUT') {
            if (val === 'Search Hosts…' && el.parentElement?.getAttribute('data-testid') === 'project-selector-ssh-host-search') {
              trans = '搜索主机…';
            } else if (val === 'Search languages to add (e.g. English, Spanish, 中文, yue)...' &&
                el.getAttribute('data-testid') === 'dictation-languages-search-input') {
              trans = '搜索要添加的语言（例如 English、Spanish、中文、yue）…';
            }
          }
          if (trans !== null && trans !== val) {
            writeLocalizedAttribute(el, attr, trans);
          } else {
            // 关键性能优化：补充 DOM 否定标记，未命中时记录原属性值，二次扫描直接 O(1) 退出
            el[markKey] = val;
          }
        }
      }
    }

    // 遍历子节点
    if (translateOwnContent && translateBuiltinSlashDescription(el)) return;
    // 联合文本自愈：如果元素直接子节点全为纯文本节点且数量 > 1（常见于 React 碎片化模板拆分，如 "All ", e, "s run as Flash."）
    if (translateOwnContent && translateSiteDataFragments(el)) return;
    var first = el.firstChild;
    if (translateOwnContent && first && first.nextSibling) {
      var allText = true;
      var cur = first;
      while (cur) {
        if (cur.nodeType !== 3) {
          allText = false;
          break;
        }
        cur = cur.nextSibling;
      }
      if (allText) {
        var combinedText = el.textContent;
        if (combinedText) {
          var combinedTrans = translateUiText(combinedText, el);
          if (combinedTrans !== null && combinedTrans !== combinedText) {
            writeLocalizedText(first, combinedTrans);
            var other = first.nextSibling;
            while (other) {
              writeLocalizedText(other, '');
              other = other.nextSibling;
            }
            return;
          }
        }
      }
    }

    if (work) {
      appendChildren(el, work);
      return;
    }
    var child = el.firstChild;
    while (child) {
      if (child.nodeType === 3) {
        translateTextNode(child, translationMode);
      } else if (child.nodeType === 1) {
        translateElement(child, scanId);
      }
      child = child.nextSibling;
    }
  }

  function appendChildren(el, work) {
    for (var child = el.lastChild; child; child = child.previousSibling) work.push(child);
  }

  // ============ Observer 与扫描调度 ============

  var observer = null;
  var observing = false;

  function disconnectObserver() {
    if (observer && observing) {
      // Preserve renderer writes queued before a synchronous scan disconnects the observer.
      recordMutations(observer.takeRecords());
      observer.disconnect();
      observing = false;
    }
  }

  function reconnectObserver() {
    if (observer && !observing && doc && doc.documentElement) {
      observer.observe(doc.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: TRANSLATABLE_ATTRS.concat('data-model-label', 'class', 'dir', 'aria-selected')
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
      withScanContext(function () {
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          if (node.nodeType === 1) {
            translateElement(node);
          } else if (node.nodeType === 3) {
            translateTextNode(node);
          }
        }
      });
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
      withScanContext(function () { translateElement(doc.documentElement, currentScanId); });
    } catch (e) {}
    reconnectObserver();
  }

  // ---- 节流与去重：合并高频 mutation 到下一个 rAF ----
  var pendingNodes = [];
  var observedDocumentPath = doc && doc.location ? doc.location.pathname : '';
  var pendingNodeSet = typeof Set !== 'undefined' ? new Set() : null;
  var scanJobs = [];
  var pendingSettingsSidebar = null;
  var rafScheduled = false;

  function enqueueNode(node) {
    if (!node || (node.nodeType !== 1 && node.nodeType !== 3)) return;
    if (pendingNodeSet) {
      if (pendingNodeSet.has(node) || pendingNodeSet.has(doc.documentElement)) return;
    }
    if (pendingNodes.length >= 500) {
      // Coalesce an exceptional burst into a bounded, time-sliced document scan.
      // Never silently drop the tail and wait 15 seconds for translation.
      pendingNodes = [doc.documentElement];
      if (pendingNodeSet) { pendingNodeSet.clear(); pendingNodeSet.add(doc.documentElement); }
    } else {
      pendingNodes.push(node);
      if (pendingNodeSet) pendingNodeSet.add(node);
    }
  }

  function flushPendingNodes() {
    rafScheduled = false;
    if (!pendingNodes.length && !scanJobs.length) return;
    disconnectObserver();
    try {
      if (!scanJobs.length) {
        for (var i = pendingNodes.length - 1; i >= 0; i--) {
          var node = pendingNodes[i];
          if (!node.isConnected) continue;
          var ancestor = node.parentElement;
          while (ancestor && !(pendingNodeSet && pendingNodeSet.has(ancestor))) ancestor = ancestor.parentElement;
          if (!ancestor) scanJobs.push(node);
        }
        pendingNodes = [];
        if (pendingNodeSet) pendingNodeSet.clear();
      }
      // A new desktop settings sidebar should not wait for an older subtree.
      // It uses the same frame budget and content boundaries as other jobs.
      if (pendingSettingsSidebar) {
        if (pendingSettingsSidebar.isConnected) scanJobs.push(pendingSettingsSidebar);
        pendingSettingsSidebar = null;
      }
      withScanContext(function () {
        var clock = root.performance && root.performance.now ? function () { return root.performance.now(); } : Date.now;
        var deadline = clock() + 6;
        var processed = 0;
        // Count DOM nodes, not roots: a single remounted dialog can contain
        // thousands of descendants. Yield even when it is the only queue item.
        while (scanJobs.length && processed < 200 && (!processed || clock() < deadline)) {
          var next = scanJobs.pop();
          if (!next.isConnected) continue;
          try {
            if (next.nodeType === 1) translateElement(next, undefined, scanJobs);
            else if (next.nodeType === 3) translateTextNode(next);
          } catch (e) { /* A transient bad node must not discard the remaining queue. */ }
          processed++;
        }
      });
    } finally { reconnectObserver(); }
    if (pendingNodes.length || scanJobs.length) scheduleFlush();
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

  function enqueuePermissionPresetDependents(el) {
    if (el?.tagName !== 'SPAN' && el?.tagName !== 'DIV') return;
    var optionBody = el.tagName === 'SPAN' && el.classList.contains('text-muted-foreground') ? el.parentElement : el;
    var optionLabel = optionBody?.firstElementChild;
    var option = optionBody?.parentElement;
    if (optionLabel?.classList.contains('truncate') && option?.classList.contains('agy-overlay-item') &&
        option.matches(permissionOptionSelector)) {
      enqueueNode(optionLabel);
    }

    // Settings labels and descriptions share a column next to the select.
    var column;
    var field = el;
    for (var depth = 0; field && depth < 3; field = field.parentElement, depth++) {
      if (field.tagName !== 'SPAN') continue;
      if (field.id.startsWith('dropdown-label-')) {
        column = field.parentElement?.parentElement;
        break;
      }
      if (field.id.startsWith('dropdown-description-')) {
        column = field.parentElement;
        break;
      }
    }
    if (!column && el.classList.contains('flex-1')) {
      field = el.querySelector(':scope > div > span[id^="dropdown-label-"]');
      if (field) column = el;
    }
    if (column?.classList.contains('flex-1')) {
      var labelId = field.id.replace(/^dropdown-description-/, 'dropdown-label-');
      column.nextElementSibling?.querySelectorAll('button.agy-select-trigger[aria-labelledby], select[aria-labelledby]').forEach(function (select) {
        if (select.getAttribute('aria-labelledby').split(' ')[0] === labelId) enqueueNode(select);
      });
    }
  }

  function enqueueMenuOptionDependents(target) {
    var el = target && target.nodeType === 3 ? target.parentElement : target;
    if (!el || !el.closest) return;
    var menuDesc = findBuiltinSlashDescriptionRoot(el) || el.closest('[data-testid="menu-option-description"]');
    if (menuDesc) {
      menuDesc._agyScanId = 0;
      enqueueNode(menuDesc);
      return;
    }
    var optRow = el.closest('[data-mention-menu] [role="option"]');
    if (optRow) {
      var siblingDesc = optRow.querySelector('[data-testid="menu-option-description"]');
      if (siblingDesc) {
        siblingDesc._agyScanId = 0;
        enqueueNode(siblingDesc);
      }
      return;
    }
    var mentionMenu = el.closest('[data-mention-menu]');
    if (mentionMenu) {
      var menuDescs = mentionMenu.querySelectorAll('[data-testid="menu-option-description"]');
      for (var mi = 0; mi < menuDescs.length; mi++) {
        menuDescs[mi]._agyScanId = 0;
        enqueueNode(menuDescs[mi]);
      }
    }
  }

  function recordMutations(mutations) {
    // A SPA route can reuse an unchanged breadcrumb node with a different role.
    if (doc.location.pathname !== observedDocumentPath) {
      observedDocumentPath = doc.location.pathname;
      var breadcrumbs = doc.querySelectorAll('[data-testid="breadcrumb-segment"]');
      for (var bi = 0; bi < breadcrumbs.length; bi++) enqueueNode(breadcrumbs[bi]);
    }
    for (var i = 0; i < mutations.length; i++) {
      var mutation = mutations[i];
      if (mutation.type === 'childList') {
        enqueuePermissionPresetDependents(mutation.target);
        enqueueMenuOptionDependents(mutation.target);
        var added = mutation.addedNodes;
        for (var j = 0; j < added.length; j++) {
          var child = added[j];
          if (child.nodeType === 1 && child.classList.contains('settings-modal-backdrop')) {
            pendingSettingsSidebar = child.querySelector('[data-testid="settings-sidebar"]');
          }
          enqueueNode(child);
        }
      } else if (mutation.type === 'characterData') {
        enqueuePermissionPresetDependents(mutation.target.parentElement);
        // Writes made while observing belong to the renderer, even when the value is unchanged.
        textEdits.delete(mutation.target);
        mutation.target._agyOriginal = undefined;
        var parentEl = mutation.target.parentElement;
        if (parentEl && parentEl.closest &&
            (parentEl.closest('[data-testid="menu-option-description"]') ||
             parentEl.closest('[data-mention-menu] [data-testid="menu-option-label"]'))) {
          enqueueMenuOptionDependents(parentEl);
        } else {
          enqueueNode(mutation.target);
        }
      } else if (mutation.type === 'attributes') {
        if (mutation.attributeName === 'class' && !isFloatingComposerPreview(mutation.target)) continue;
        var edits = attributeEdits.get(mutation.target);
        if (edits) delete edits[mutation.attributeName];
        mutation.target[MARK_ATTR + '_' + mutation.attributeName] = undefined;
        enqueueNode(mutation.target);
        enqueueMenuOptionDependents(mutation.target);
      }
    }
    if (pendingNodes.length > 0) scheduleFlush();
  }

  function recheckMentionMenuEntries(fromPoll) {
    if (!builtinSlashDescriptions || !doc) return;
    var targets = [];
    if (activeBuiltinSlashDescs) {
      activeBuiltinSlashDescs.forEach(function (descEl) {
        if (!descEl.isConnected) activeBuiltinSlashDescs.delete(descEl);
        else targets.push(descEl);
      });
    }
    if (!fromPoll && doc.querySelectorAll) {
      var openDescs = doc.querySelectorAll('[data-mention-menu] [data-testid="menu-option-description"]');
      for (var i = 0; i < openDescs.length; i++) {
        if (targets.indexOf(openDescs[i]) === -1) targets.push(openDescs[i]);
      }
    }
    if (targets.length) safeTranslateNodes(targets);
  }

  function startObserver() {
    if (!doc || !doc.documentElement) return;

    // 监听主世界 React 提交信号：当 [data-mention-menu] 内条目仅在 React commit 中切换来源、DOM 未变化时，立即同步重验还原
    if (doc.addEventListener) {
      doc.addEventListener('agy-localization-slash-menu-recheck', function () {
        recheckMentionMenuEntries(false);
      });
    }

    // 首次全量扫描
    safeFullScan();

    var MutationObserverClass = root.MutationObserver || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
    if (MutationObserverClass) {
      observer = new MutationObserverClass(recordMutations);

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
          enqueueNode(doc.documentElement);
          scheduleFlush();
        }, { timeout: 5000 });
      } else {
        enqueueNode(doc.documentElement);
        scheduleFlush();
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
        if (el.matches('[role="tooltip"], [role="menu"], [role="dialog"], [data-floating-ui-portal], [data-radix-popper-content-wrapper], .popover, .tooltip, .context-view, .monaco-hover')) {
          return true;
        }
      } catch (e) {}
    }
    var role = el.getAttribute ? el.getAttribute('role') : '';
    if (role === 'tooltip' || role === 'menu' || role === 'dialog') return true;
    if (el.hasAttribute && (el.hasAttribute('data-floating-ui-portal') || el.hasAttribute('data-radix-popper-content-wrapper'))) return true;
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
        try {
          // 定向扫描顶层 Portal 容器、Tooltip、Popover 节点，门禁拦截非浮层元素，绝不遍历整棵 DOM 树
          var last = doc.body.lastElementChild;
          if (last && isFloatingElement(last)) {
            enqueueNode(last);
          }
          if (last && last.previousElementSibling && isFloatingElement(last.previousElementSibling)) {
            enqueueNode(last.previousElementSibling);
          }
          var tooltips = doc.querySelectorAll ? doc.querySelectorAll('[role="tooltip"], [role="menu"], [role="dialog"], [data-floating-ui-portal], [data-radix-popper-content-wrapper], .popover, .tooltip, .context-view, .monaco-hover') : null;
          if (tooltips && tooltips.length > 0) {
            for (var tIdx = 0; tIdx < tooltips.length; tIdx++) {
              enqueueNode(tooltips[tIdx]);
            }
          }
        } catch (e) {}
        scheduleFlush();
      }

      var onHoverAction = function (e) {
        // 120ms 节流阀：阻断高频事件风暴，杜绝掉帧卡顿
        var now = Date.now ? Date.now() : (+new Date());
        if (now - lastHoverTime < 120) return;
        lastHoverTime = now;

        var target = e.target;
        if (!target) return;
        try {
          if (target.nodeType === 1) {
            enqueueNode(target);
            // 严禁对 #workbench / body 根容器递归全树深搜，防止剧烈掉帧
            if (target.parentElement && !isWorkbenchOrRoot(target.parentElement)) {
              enqueueNode(target.parentElement);
            }
          }
        } catch (e) {}
        scheduleFlush();

        // 防抖延迟定向扫描浮动提示层（捕获动态延迟 50ms 挂载的气泡）
        if (hoverScanTimer) clearTimeout(hoverScanTimer);
        hoverScanTimer = setTimeout(function () {
          hoverScanTimer = null;
          scanFloatingContainers();
        }, 50);
      };

      doc.addEventListener('pointerenter', onHoverAction, { capture: true, passive: true });
      doc.addEventListener('contextmenu', onHoverAction, { capture: true, passive: true });
    } catch (e) {}
  }

  if (root) {
    root.__AGY_CREATE_ENGINE__ = createI18nEngine;
    root.__AGY_TRANSLATE_UNIT__ = translateSingleUnit;
    root.__AGY_TRANSLATE_EL__ = function (el) { safeTranslateNodes([el]); };
    root.__AGY_RUN_FULL_SCAN__ = safeFullScan;
    root.__AGY_CACHE__ = translationCache;
    root.__AGY_IS_FLOATING__ = isFloatingElement;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

