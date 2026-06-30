import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Database } from "./database.js";

import { configureSearchTools } from "./tools/search.js";
import { configureElementTools } from "./tools/elements.js";
import { configureConnectorTools } from "./tools/connectors.js";
import { configurePackageTools } from "./tools/packages.js";
import { configureDiagramTools } from "./tools/diagrams.js";
import { configureScenarioTools } from "./tools/scenarios.js";

export function configureAllTools(server: McpServer, db: Database): void {
  configureSearchTools(server, db);
  configureElementTools(server, db);
  configureConnectorTools(server, db);
  configurePackageTools(server, db);
  configureDiagramTools(server, db);
  configureScenarioTools(server, db);
}
