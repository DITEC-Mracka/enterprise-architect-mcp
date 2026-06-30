#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { openDatabase } from "./database.js";
import { resolveQeaPath } from "./resolve-qea-path.js";
import { configureAllTools } from "./tools.js";
import { packageVersion } from "./version.js";

const argv = yargs(hideBin(process.argv))
  .scriptName("mcp-server-ea")
  .usage("Usage: $0 [qea-path]")
  .version(packageVersion)
  .command(
    "$0 [qea-path]",
    "Enterprise Architect MCP Server",
    (yargs) => {
      yargs.positional("qea-path", {
        describe:
          "Path to .qea file or directory containing .qea files. " +
          "Falls back to EA_QEA_PATH env var or .env in CWD. " +
          "If a directory is given, the newest .qea file is used.",
        type: "string",
      });
    }
  )
  .help()
  .parseSync();

const qeaFile = resolveQeaPath(argv["qea-path"] as string | undefined);

const db = openDatabase(qeaFile);

const server = new McpServer(
  {
    name: "Enterprise Architect MCP Server",
    version: packageVersion,
  },
  {
    instructions: `This server provides read-only access to a Sparx Enterprise Architect analysis model (.qea export).
Use ea_* tools when the user asks about:
- Business analysis, use cases, requirements, screens, classes, or domain model elements
- Application architecture, components, interfaces, or their relationships
- Use case scenarios / flows (basic path, alternate paths, exception paths)
- How elements relate to each other (connectors: Realisation, Dependency, Association, Generalization, etc.)
- Package/module structure of the analysis model
- Diagram contents (what elements appear on a specific diagram)

Do NOT use ea_* tools for:
- Azure DevOps work items, bugs, tasks, PRs, or repositories (use ado server instead)
- Source code, builds, or deployments

Typical workflow: ea_search → ea_get_element → ea_get_connectors / ea_get_scenarios`,
  }
);

configureAllTools(server, db);

const transport = new StdioServerTransport();
await server.connect(transport);
