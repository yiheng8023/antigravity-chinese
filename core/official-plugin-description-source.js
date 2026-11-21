'use strict';

function installOfficialPluginDescriptionSourceCheck(descriptions) {
  if (window.location.protocol !== 'https:' || window.location.hostname !== '127.0.0.1') return;

  function hasVerifiedPluginDescription(el, source, entry) {
    // Antigravity 2.34 settings pass the service's Plugin to a shared row.
    // The DOM omits its origin, so read only the committed row's props.
    const key = Object.keys(el).find(name => name.startsWith('__reactFiber$'));
    let fiber = key && el[key];
    let verified = false;
    for (let i = 0; fiber && i < 2; i++, fiber = fiber.alternate) {
      let top = fiber;
      while (top.return) top = top.return;
      if (top.tag !== 3 || top.stateNode?.current !== top) continue;
      if (fiber.stateNode !== el || fiber.memoizedProps?.children !== source) return false;
      const row = fiber.return?.return?.return;
      const owner = row?.return;
      const plugin = owner?.memoizedProps?.plugin;
      if (plugin?.$typeName !== 'exa.language_server_pb.Plugin' || owner.key !== entry.plugin ||
          plugin.name !== entry.plugin || plugin.isGlobal !== true || plugin.description !== source ||
          row.memoizedProps?.deleteTitle !== 'Delete plugin' || row.memoizedProps.description !== source ||
          row.memoizedProps.path !== plugin.path) return false;
      const marketplace = 'antigravity-plugins-official';
      const origin = plugin.installedFrom;
      verified = entry.builtin ? plugin.isBuiltin === true :
        plugin.isBuiltin === false && origin?.marketplace === marketplace &&
          origin.id === marketplace + '/plugin/' + entry.plugin;
      // React can reuse part of the committed tree in both alternates.
      if (!verified) return false;
    }
    return verified;
  }

  document.addEventListener('agy-localization-check-official-plugin-description', event => {
    const el = event.target;
    const source = event.detail;
    if (typeof source !== 'string' || !Object.hasOwn(descriptions, source) ||
        !el.matches?.('div.text-sm.text-muted-foreground.line-clamp-2.mt-1') ||
        !el.closest('[data-testid="project-customizations-content"] [data-testid="workspace-customizations-view"]')) return;
    // Only the decision crosses Electron's context isolation.
    if (hasVerifiedPluginDescription(el, source, descriptions[source])) event.preventDefault();
  }, true);
}

module.exports = { installOfficialPluginDescriptionSourceCheck };
