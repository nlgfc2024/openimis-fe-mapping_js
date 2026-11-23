export function hasCapability(rights, required) {
  return Array.isArray(required) && required.length > 0
    && required.every((right) => (rights || []).some((value) => String(value) === String(right)));
}

export function mappingConfiguration(manager) {
  return {
    enabled: manager.getConf("fe-mapping", "enabled", false) === true,
    viewRights: manager.getConf("fe-mapping", "viewRights", []),
    projectRights: manager.getConf("fe-mapping", "projectRights", []),
  };
}
