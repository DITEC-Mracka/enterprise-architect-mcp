import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Database } from "../database.js";
import { z } from "zod";
import { statSync } from "node:fs";
import { packageVersion } from "../version.js";

export function configureSchemaTools(server: McpServer, db: Database): void {
  server.tool(
    "ea_get_schema",
    "List the model's database tables, or show columns and indexes for a specific table. Use this to discover what data the model holds beyond what the typed ea_* tools return. See ea_get_model_info for the export's identity.",
    {
      tableName: z
        .string()
        .optional()
        .describe("Table name to inspect. Omit to list all tables with row counts."),
    },
    async ({ tableName }) => {
      try {
        if (!tableName) {
          const tables = db
            .prepare(
              `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
            )
            .all() as { name: string }[];

          const result = tables.map((t) => {
            const row = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`).get() as { cnt: number };
            return { table: t.name, rowCount: row.cnt };
          });

          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              tables: result,
              totalMatched: result.length,
              returned: result.length,
              truncated: false,
              _meta: { sourceTables: ["sqlite_master"] },
            }, null, 2) }],
          };
        }

        // Verify table exists
        const exists = db
          .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
          .get(tableName) as { name: string } | undefined;
        if (!exists) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "not_found", message: `Table '${tableName}' not found`, tableName }, null, 2) }],
            isError: true,
          };
        }

        // Columns — tableName is validated against sqlite_master above
        const safeTableName = exists.name;
        const columns = db.prepare(`PRAGMA table_info("${safeTableName}")`).all() as {
          cid: number;
          name: string;
          type: string;
          notnull: number;
          dflt_value: string | null;
          pk: number;
        }[];

        // Rowid alias detection: exactly one column with pk > 0 and declared type INTEGER (case-insensitive)
        const pkColumns = columns.filter((c) => c.pk > 0);
        const rowidAlias =
          pkColumns.length === 1 && pkColumns[0].type.toUpperCase() === "INTEGER"
            ? pkColumns[0].name
            : null;

        // Indexes
        const indexList = db.prepare(`PRAGMA index_list("${safeTableName}")`).all() as {
          seq: number;
          name: string;
          unique: number;
          origin: string;
        }[];

        const indexes = indexList.map((idx) => {
          const indexCols = db.prepare(`PRAGMA index_info("${idx.name}")`).all() as {
            seqno: number;
            cid: number;
            name: string;
          }[];
          return {
            name: idx.name,
            unique: idx.unique === 1,
            columns: indexCols.map((c) => c.name),
          };
        });

        const result: Record<string, unknown> = {
          table: tableName,
          columns: columns.map((c) => ({
            name: c.name,
            type: c.type,
            notNull: c.notnull === 1,
            primaryKey: c.pk > 0,
            defaultValue: c.dflt_value,
          })),
          indexes,
          _meta: {
            sourceTables: ["sqlite_master"],
            columns: { totalMatched: columns.length, returned: columns.length, truncated: false },
            indexes: { totalMatched: indexes.length, returned: indexes.length, truncated: false },
          },
        };

        if (rowidAlias) {
          result.rowidAlias = rowidAlias;
          result.rowidNote =
            "This column is an INTEGER PRIMARY KEY that aliases SQLite's internal rowid. Lookups by this column are the fastest access path.";
        } else {
          result.rowidAlias = null;
          result.rowidNote = "This table has no single-column INTEGER PRIMARY KEY rowid alias.";
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error reading schema: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "ea_get_model_info",
    "Report which .qea export file the server has open — its file name (the citable identity), size, and modification time. The full resolved path is also available as local detail.",
    {},
    async () => {
      try {
        const location = (db as any).location() as string | null;
        if (!location) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Model info unavailable: database has no file location (in-memory database).",
              },
            ],
            isError: true,
          };
        }

        const stat = statSync(location);
        const fileName = location.replace(/\\/g, "/").split("/").pop() ?? location;

        const result = {
          fileName,
          fileSizeBytes: stat.size,
          lastModified: stat.mtime.toISOString(),
          serverVersion: packageVersion,
          resolvedPath: location,
          resolvedPathNote:
            "The resolved path is local detail — it may contain user-specific directories. Use fileName, size, and lastModified as the citable identity.",
          _meta: { sourceTables: [] as string[] },
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error reading model info: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
