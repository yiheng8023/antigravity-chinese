'use strict';

function installBuiltinSlashDescriptionSourceCheck(descriptions) {
  if (window.location.protocol !== 'https:' || window.location.hostname !== '127.0.0.1') return;

  const observedProps = typeof WeakMap === 'function' ? new WeakMap() : null;
  const observedDevtoolsHooks = typeof WeakSet === 'function' ? new WeakSet() : null;
  let dispatchingRecheck = false;

  function notifyReactCommit() {
    if (dispatchingRecheck) return;
    if (!document.querySelector || !document.querySelector('[data-mention-menu]')) return;
    dispatchingRecheck = true;
    try {
      document.dispatchEvent(new window.CustomEvent('agy-localization-slash-menu-recheck'));
    } catch (_) {
    } finally {
      dispatchingRecheck = false;
    }
  }

  function observeObjectProperty(target, prop) {
    if (!target || (typeof target !== 'object' && typeof target !== 'function')) return;
    let seen = observedProps?.get(target);
    if (seen?.has(prop)) return;
    try {
      const desc = Object.getOwnPropertyDescriptor(target, prop);
      if (!desc || !desc.configurable || !('value' in desc)) return;
      let currentValue = desc.value;
      Object.defineProperty(target, prop, {
        configurable: true,
        enumerable: desc.enumerable,
        get() { return currentValue; },
        set(nextValue) {
          const prev = currentValue;
          currentValue = nextValue;
          if (nextValue !== prev) notifyReactCommit();
        }
      });
      if (observedProps) {
        if (!seen) {
          seen = new Set();
          observedProps.set(target, seen);
        }
        seen.add(prop);
      }
    } catch (_) {}
  }

  function observeDevtoolsHook() {
    try {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!hook || typeof hook.onCommitFiberRoot !== 'function') return;
      if (observedDevtoolsHooks && observedDevtoolsHooks.has(hook)) return;
      const origOnCommit = hook.onCommitFiberRoot;
      hook.onCommitFiberRoot = function (...args) {
        try { return origOnCommit.apply(this, args); }
        finally { notifyReactCommit(); }
      };
      if (observedDevtoolsHooks) observedDevtoolsHooks.add(hook);
    } catch (_) {}
  }

  function observeReactCommitChains(el, fiberKey, rootFiber) {
    observeDevtoolsHook();
    if (el && fiberKey) observeObjectProperty(el, fiberKey);
    for (let i = 0, cur = rootFiber; cur && i < 2; i++, cur = cur.alternate) {
      observeObjectProperty(cur, 'return');
      let row = cur.return;
      for (let depth = 0; row && depth < 12; row = row.return, depth++) {
        observeObjectProperty(row, 'return');
        if (row.memoizedProps && Object.hasOwn(row.memoizedProps, 'item')) {
          observeObjectProperty(row, 'memoizedProps');
          observeObjectProperty(row.memoizedProps, 'item');
          const wrapper = row.memoizedProps.item;
          if (wrapper && typeof wrapper === 'object') {
            observeObjectProperty(wrapper, 'item');
            const scopeItem = wrapper.item?.scopeItem;
            if (wrapper.item && typeof wrapper.item === 'object') observeObjectProperty(wrapper.item, 'scopeItem');
            if (scopeItem && typeof scopeItem === 'object') {
              observeObjectProperty(scopeItem, 'case');
              observeObjectProperty(scopeItem, 'value');
              const info = scopeItem.value?.info;
              if (scopeItem.value && typeof scopeItem.value === 'object') observeObjectProperty(scopeItem.value, 'info');
              if (info && typeof info === 'object') {
                observeObjectProperty(info, 'type');
                observeObjectProperty(info, 'plugin');
                observeObjectProperty(info, 'name');
              }
            }
          }
        }
      }
      let top = cur;
      while (top.return) top = top.return;
      if (top.tag === 3 && top.stateNode && typeof top.stateNode === 'object') {
        observeObjectProperty(top.stateNode, 'current');
      }
    }
  }

  function isBuiltinSystemSlashOption(fiber, name, source) {
    let row = fiber.return;
    for (let depth = 0; row && depth < 12; row = row.return, depth++) {
      const item = row.memoizedProps?.item;
      if (!item) continue;
      const scopeItem = item?.item?.scopeItem;
      if (scopeItem?.case !== 'slashCommand') return false;
      const info = scopeItem.value?.info;
      // Only localize official SYSTEM commands (type === 1) without third-party plugin attribution.
      if (!info || info.type !== 1 || info.plugin || info.name !== name) return false;
      const renderInfo = typeof item.getRenderInfo === 'function' ? item.getRenderInfo() : null;
      const renderedText = renderInfo?.description?.text ?? item.customDescription;
      return renderedText === source;
    }
    return false;
  }

  function hasVerifiedBuiltinSlashDescription(el, name, source, entry) {
    if (!el.matches('[data-testid="menu-option-description"]') || !el.closest('[data-mention-menu]')) return false;
    const key = Object.keys(el).find(prop => prop.startsWith('__reactFiber$'));
    let fiber = key && el[key];
    if (fiber) observeReactCommitChains(el, key, fiber);
    if (!entry || entry.source !== source || el.getAttribute('dir') === 'rtl') return false;
    let verified = false;
    for (let i = 0; fiber && i < 2; i++, fiber = fiber.alternate) {
      let top = fiber;
      while (top.return) top = top.return;
      if (top.tag !== 3 || top.stateNode?.current !== top) continue;
      if (fiber.stateNode !== el) return false;
      verified = isBuiltinSystemSlashOption(fiber, name, source);
      if (!verified) return false;
    }
    return verified;
  }

  document.addEventListener('agy-localization-check-builtin-slash-description', event => {
    const el = event.target;
    const detail = event.detail;
    if (!detail || typeof detail.name !== 'string' || typeof detail.source !== 'string' || !el.matches) return;
    if (hasVerifiedBuiltinSlashDescription(el, detail.name, detail.source,
        Object.hasOwn(descriptions, detail.name) ? descriptions[detail.name] : null)) {
      event.preventDefault();
    }
  }, true);
}

module.exports = { installBuiltinSlashDescriptionSourceCheck };
