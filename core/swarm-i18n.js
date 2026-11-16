// This function is embedded in the desktop main process patch and evaluated only
// in the built-in Swarm sidecar document. It is NOT the global UI dictionary.
function localizeSwarm(data) {
  'use strict';
  const doc = document;
  if (window.__AGY_SWARM_I18N__ ||
      !doc.querySelector('[data-testid="swarm-empty-state"]') ||
      !doc.querySelector('[data-testid="swarm-tabs"]')) return;
  window.__AGY_SWARM_I18N__ = true;
  const exact = data.exact;
  const attrs = ['title', 'aria-label', 'placeholder'];
  const selectors = data.selectors.join(',');
  const attributeSelectors = data.attributeSelectors.join(',');
  const allSelectors = selectors + ',' + attributeSelectors;
  const protectedRoots = '#ov-frame, #raw, #swarm-title, .msg-body, .o2-card, .o2-runmain, .o2-donem, .o2-ask, .o2-mnow, .o2-mrole, .o2-mauth';
  const textEdits = new Map();
  const attrEdits = new Map();
  const options = { subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: attrs.concat(['id', 'class', 'value', 'data-testid']) };

  function eligible(el, attribute = false) {
    if (!el || !el.matches(attribute ? allSelectors : selectors) || el.closest(protectedRoots)) return false;
    if (el.closest('.msg') && !el.matches('#feed > article.msg > button.msg-more[data-testid="swarm-message-more"], #feed > article.msg > .msg-head .msg-note' +
        (attribute ? ', #feed > article.msg > .msg-head .msg-author' : ''))) return false;
    // The narrator may supply its own labels. Even a label identical to a default
    // remains authored copy when explicitly supplied through view.json.
    if (el.closest('.o2')) {
      const custom = window.SwarmHive && window.SwarmHive.viewCopy;
      if (custom && custom.ui && Object.values(custom.ui).some(v => v === el.textContent.trim())) return false;
    }
    return true;
  }

  function translate(value) {
    const key = value.replace(/\s+/g, ' ').trim();
    if (!Object.prototype.hasOwnProperty.call(exact, key)) return value;
    return value.match(/^\s*/)[0] + exact[key] + value.match(/\s*$/)[0];
  }

  function scan() {
    observer.disconnect();
    try {
      for (const [node, edit] of textEdits) {
        if (!node.isConnected) textEdits.delete(node);
        else if (!eligible(node.parentElement) || node.nodeValue !== edit.localized) {
          if (node.nodeValue === edit.localized) node.nodeValue = edit.source;
          textEdits.delete(node);
        }
      }
      for (const [el, edits] of attrEdits) {
        if (!el.isConnected) { attrEdits.delete(el); continue; }
        for (const [name, edit] of edits) {
          if (!eligible(el, true) || el.getAttribute(name) !== edit.localized) {
            if (el.getAttribute(name) === edit.localized) el.setAttribute(name, edit.source);
            edits.delete(name);
          }
        }
        if (!edits.size) attrEdits.delete(el);
      }
      for (const el of doc.querySelectorAll(allSelectors)) {
        if (!eligible(el, true)) continue;
        // Direct text only: nested names, code, file identifiers and counters
        // are never inherited into a parent's translatable scope.
        for (const node of el.childNodes) {
          if (node.nodeType !== 3 || textEdits.has(node) || !eligible(el)) continue;
          const source = node.nodeValue;
          const localized = translate(source);
          if (localized !== source) {
            textEdits.set(node, { source, localized });
            node.nodeValue = localized;
          }
        }
        for (const name of attrs) {
          const source = el.getAttribute(name);
          if (!source || (attrEdits.get(el) || new Map()).has(name)) continue;
          const localized = translate(source);
          if (localized !== source) {
            if (!attrEdits.has(el)) attrEdits.set(el, new Map());
            attrEdits.get(el).set(name, { source, localized });
            el.setAttribute(name, localized);
          }
        }
      }
    } finally { observer.observe(doc.body, options); }
  }
  const observer = new MutationObserver(scan);
  scan();
}
