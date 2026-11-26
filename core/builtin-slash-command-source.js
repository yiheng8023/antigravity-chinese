'use strict';

function installBuiltinSlashDescriptionSourceCheck(descriptions) {
  if (window.location.protocol !== 'https:' || window.location.hostname !== '127.0.0.1') return;

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
    if (!entry || entry.source !== source) return false;
    if (!el.matches('[data-testid="menu-option-description"]:not([dir="rtl"])') ||
        !el.closest('[data-mention-menu]')) return false;
    const key = Object.keys(el).find(prop => prop.startsWith('__reactFiber$'));
    let fiber = key && el[key];
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
    if (!Object.hasOwn(descriptions, detail.name)) return;
    if (hasVerifiedBuiltinSlashDescription(el, detail.name, detail.source, descriptions[detail.name])) {
      event.preventDefault();
    }
  }, true);
}

module.exports = { installBuiltinSlashDescriptionSourceCheck };
