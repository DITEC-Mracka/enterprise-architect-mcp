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

| Tool group | Description |
|-----------|-------------|
| **Search** | Full-text search across element Name, Alias, and Note fields |
| **Elements** | Retrieve element details with inline attributes and operations |
| **Packages** | Navigate package hierarchy (tree, children, elements by type) |
| **Diagrams** | List elements on a specific diagram |
| **Scenarios** | Read use case scenarios (basic path, alternate/exception paths) |
| **Connectors** | Traverse relationships between elements (Realisation, Dependency, Association, etc.) |

## Example Prompts

Once connected, try prompts like:

- "Search for elements related to 'authentication'"
- "Show me the package structure under the root"
- "What are the use case scenarios for UC_Login?"
- "What elements are connected to this class?"
- "List all elements on the main architecture diagram"
