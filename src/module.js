import { hasCapability } from "./configuration";

export function createMappingModule(config, components) {
  const { MappingMap, icon, menuText } = components;
  const module = {
    refs: [{ key: "mapping.MappingMap", ref: MappingMap },
      { key: "mapping.route.dashboard", ref: "mapping/dashboard" }],
  };
  // The assembly must supply registered capability IDs. Do not grant access by default.
  const rights = Array.isArray(config.viewRights) ? config.viewRights : [];
  if (!config.enabled || !rights.length) return module;
  module["core.Router"] = [{ path: "mapping/dashboard", component: MappingMap, rights }];
  const key = config.menuContributionKey || "openSearchReports.MainMenu";
  if (typeof key !== "string" || !key.endsWith(".MainMenu") || key === "core.MainMenu") {
    throw new Error("Mapping requires an existing host submenu contribution key");
  }
  module[key] = [{ id: "mapping.dashboard", text: menuText, icon, route: "/mapping/dashboard",
    filter: (userRights = []) => hasCapability(userRights, rights) }];
  return module;
}
