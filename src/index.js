import React from "react";
import { LocationOn } from "@material-ui/icons";
import { FormattedMessage } from "@openimis/fe-core";
import MappingMap from "./geo/MappingMap";
import { createMappingModule } from "./module";
import messages from "./translations/en";

export { MappingMap };
export function MappingModule(config = {}) {
  return { ...createMappingModule(config, { MappingMap, icon: <LocationOn />,
    menuText: <FormattedMessage module="mapping" id="menu.dashboard" /> }),
    translations: [{ key: "en", messages }] };
}
