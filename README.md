# Enterprise Architect MCP Server

A read-only MCP server for Sparx Enterprise Architect `.qea` exports. Gives AI agents access to EA analysis models — search elements, navigate packages, read use case scenarios, and traverse connectors — without a running EA instance.

## Prerequisites

- **Node.js 22+** (uses the built-in `node:sqlite` module)
- A `.qea` file exported from Sparx Enterprise Architect

## Installation

Add to your project's `.vscode/mcp.json`:

```json
{
  "servers": {
    "enterprise-architect": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:DITEC-Mracka/enterprise-architect-mcp"],
      "env": {
        "EA_QEA_PATH": "<path-to-your-qea-file-or-directory>"
      }
    }
  }
}
```

Replace `<path-to-your-qea-file-or-directory>` with your actual `.qea` file path.

## Configuration

The server resolves the `.qea` path using a fallback chain (first match wins):

1. **CLI argument** — `mcp-server-ea C:\path\to\model.qea`
2. **Environment variable** — `EA_QEA_PATH` (set in `mcp.json` `env` block or system env)
3. **`.env` file** — `EA_QEA_PATH=...` in a `.env` file in the working directory

If the path points to a **directory**, the server automatically picks the newest `.qea` file by modification time.

### Setup with `.env` (recommended for teams)

```bash
# Copy the template
cp .env.example .env

# Edit .env with your local path
EA_QEA_PATH=D:\EAExporty\projekt\architektura.qea
```

The `.env` file is gitignored — each developer sets their own path without affecting the shared config.

## Available Tools

| Tool | Description |
|------|-------------|
| `ea_search` | Full-text search across elements, attributes, operations, and constraints. Case-insensitive across the Slovak alphabet, decodes entity-encoded text. |
| `ea_get_element` | Full element detail — attributes, operations, diagrams it appears on, constraints (pre/post/invariant/process). |
| `ea_list_elements` | List elements in a package, optionally filtered by type. Reports total count with pagination. |
| `ea_get_connectors` | Relationships for an element — includes feature-link resolution (which attribute/operation each end attaches to). |
| `ea_get_diagram_elements` | Elements and connectors on a diagram, including implied connectors and feature links. |
| `ea_get_scenarios` | Use case scenario steps with all attributes (trigger, uses, result, link, state) and scenario notes. |
| `ea_get_package_tree` | Navigate the package hierarchy with recursive depth. |
| `ea_list_diagrams` | Search diagrams by name and package. |
| `ea_resolve` | Resolve analyst references (braced GUID or plain name) to model candidates with full package path. |
| `ea_get_schema` | Introspect the model's database schema — tables, columns, indexes, rowid alias. |
| `ea_get_model_info` | Identity of the open export — file name, size, modification date, server version. |

### Response contract

Every tool returns structured JSON with:

- `_meta.sourceTables` — which database tables were consulted
- `totalMatched` / `returned` / `truncated` — completeness metadata on every collection
- `continuation` — exact call to retrieve the full set when truncated
- `isError: true` + `{ error: "not_found" }` for non-existent subjects (distinct from empty results)

## Example Prompts

Once connected, try prompts like:

- "Search for elements related to 'právnická osoba'"
- "Show me the package structure under the root"
- "What are the use case scenarios for UC_FEO_2027?"
- "What elements and connectors are on diagram 0103 Spracovanie eFORM?"
- "Resolve the reference {94291B11-C990-482e-BF3F-19EFF04FB37E}"
- "What columns does t_connector have?"
- "Which diagrams does element a7680 appear on?"
