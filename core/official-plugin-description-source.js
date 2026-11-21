'use strict';

function installOfficialPluginDescriptionSourceCheck(descriptions) {
  if (window.location.protocol !== 'https:' || window.location.hostname !== '127.0.0.1') return;

  function hasCatalogOrigin(origin, entry) {
    const marketplace = entry.marketplace ?? 'antigravity-plugins-official';
    return origin?.marketplace === marketplace && origin.id === marketplace + '/plugin/' + entry.plugin;
  }

  function hasInstalledOrigin(plugin, entry) {
    if (plugin?.$typeName !== 'exa.language_server_pb.Plugin' || plugin.name !== entry.plugin ||
        plugin.isGlobal !== true) return false;
    return entry.builtin ? plugin.isBuiltin === true :
      plugin.isBuiltin === false && hasCatalogOrigin(plugin.installedFrom, entry);
  }

  function isSettingsDescription(fiber, source, entry) {
    const row = fiber.return?.return?.return;
    const owner = row?.return;
    const plugin = owner?.memoizedProps?.plugin;
    return fiber.memoizedProps?.children === source && owner?.key === entry.plugin &&
      row.memoizedProps?.deleteTitle === 'Delete plugin' && row.memoizedProps.description === source &&
      hasInstalledOrigin(plugin, entry) && row.memoizedProps.path === plugin.path && plugin.description === source;
  }

  function isCardDescription(fiber, card, source, entry) {
    if (fiber.memoizedProps?.children?.props?.text !== source) return false;
    let container = fiber.return;
    while (container && container.stateNode !== card) container = container.return;
    const owner = container?.return;
    const props = owner?.memoizedProps;
    if (props?.description !== source || props.name !== card.getAttribute('data-card-name')) return false;

    // The catalog renderer passes the shown entry's canonical ID to the card.
    if (card.closest('[data-testid="customizations-marketplace"]')) {
      return (props.to === '/customizations/marketplaces/$marketplace/plugins/$pluginId' ||
        props.to === '/customizations/plugins/$pluginId') && hasCatalogOrigin(props.search, entry);
    }
    if (!card.closest('[data-testid="customizations-installed"] [data-testid="customizations-installed-plugins"]')) return false;
    for (let list = owner.return; list; list = list.return) {
      const plugins = list.memoizedProps?.plugins;
      if (!Array.isArray(plugins)) continue;
      const matches = plugins.filter(plugin => (plugin?.path || plugin?.name) === owner.key);
      const plugin = matches[0];
      return matches.length === 1 && hasInstalledOrigin(plugin, entry) && plugin.description === source &&
        (plugin.displayName || plugin.name) === props.name;
    }
    return false;
  }

  function isDetailDescription(fiber, source, entry) {
    const header = fiber.return?.return;
    if (fiber.memoizedProps?.children !== source || header?.memoizedProps?.description !== source) return false;
    // The sibling footer receives the same records that selected the header copy.
    for (let footer = header.sibling; footer; footer = footer.sibling) {
      const fields = footer.memoizedProps;
      if (!fields || !Object.hasOwn(fields, 'installedPlugin') || !Object.hasOwn(fields, 'catalogEntry') ||
          !Object.hasOwn(fields, 'pluginPreview')) continue;
      const plugin = fields.installedPlugin;
      if (plugin && !hasInstalledOrigin(plugin, entry)) return false;
      if (plugin?.description) return plugin.description === source;
      const catalog = fields.catalogEntry;
      return catalog?.kind?.case === 'plugin' && catalog.description === source && hasCatalogOrigin(catalog, entry);
    }
    return false;
  }

  function isFeaturedDescription(fiber, source, entry) {
    const member = fiber.return?.return?.memoizedProps?.member;
    return fiber.memoizedProps?.children === source && fiber.memoizedProps.title === source &&
      member?.description === source && member.item?.kind?.case === 'plugin' &&
      member.item.description?.trim() === source && hasCatalogOrigin(member.item, entry);
  }

  function hasVerifiedPluginDescription(el, source, entry) {
    // Origins are absent from the DOM. Bind the displayed text to the committed renderer.
    const settings = el.matches('div.text-sm.text-muted-foreground.line-clamp-2.mt-1') &&
      el.closest('[data-testid="project-customizations-content"] [data-testid="workspace-customizations-view"]');
    const card = el.matches('div.text-sm.text-muted-foreground.truncate') &&
      el.closest('[data-testid="customization-card"][data-card-name]');
    const detail = el.matches('p.text-muted-foreground.leading-relaxed') && el.closest('[data-testid="plugin-detail"]');
    const featured = el.matches('p.text-muted-foreground.line-clamp-3[title]') &&
      el.closest('[data-testid="featured-carousel"] [role="tabpanel"]');
    if (!settings && !card && !detail && !featured) return false;
    const key = Object.keys(el).find(name => name.startsWith('__reactFiber$'));
    let fiber = key && el[key];
    let verified = false;
    for (let i = 0; fiber && i < 2; i++, fiber = fiber.alternate) {
      let top = fiber;
      while (top.return) top = top.return;
      if (top.tag !== 3 || top.stateNode?.current !== top) continue;
      if (fiber.stateNode !== el) return false;
      if (settings) verified = isSettingsDescription(fiber, source, entry);
      else if (card) verified = isCardDescription(fiber, card, source, entry);
      else if (featured) verified = isFeaturedDescription(fiber, source, entry);
      else verified = isDetailDescription(fiber, source, entry);
      // React can reuse part of the committed tree in both alternates.
      if (!verified) return false;
    }
    return verified;
  }

  document.addEventListener('agy-localization-check-official-plugin-description', event => {
    const el = event.target;
    const source = event.detail;
    if (typeof source !== 'string' || !Object.hasOwn(descriptions, source) || !el.matches) return;
    // Only the decision crosses Electron's context isolation.
    if (hasVerifiedPluginDescription(el, source, descriptions[source])) event.preventDefault();
  }, true);
}

module.exports = { installOfficialPluginDescriptionSourceCheck };
