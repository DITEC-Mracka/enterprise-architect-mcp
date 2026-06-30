import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Database } from "../database.js";
import type { SQLInputValue } from "node:sqlite";
import { z } from "zod";

export function configureConnectorTools(server: McpServer, db: Database): void {
  server.tool(
    "ea_get_connectors",
    "Get all relationships (connectors) for a given element. Shows what the element is connected to and how (Realisation, Dependency, Association, etc.).",
    {
      elementId: z.coerce.number().describe("The Object_ID of the element to get connectors for"),
      connectorType: z
        .string()
        .optional()
        .describe("Filter by connector type (e.g., Realisation, Dependency, Association, InformationFlow, Generalization)"),
      direction: z
        .enum(["both", "outgoing", "incoming"])
        .default("both")
        .describe("Filter direction: outgoing (element is source), incoming (element is target), or both"),
    },
    async ({ elementId, connectorType, direction }) => {
      try {
        let conditions: string[] = [];
        const params: SQLInputValue[] = [];

        if (direction === "outgoing") {
          conditions.push("c.Start_Object_ID = ?");
          params.push(elementId);
        } else if (direction === "incoming") {
          conditions.push("c.End_Object_ID = ?");
          params.push(elementId);
        } else {
          conditions.push("(c.Start_Object_ID = ? OR c.End_Object_ID = ?)");
          params.push(elementId, elementId);
        }

        if (connectorType) {
          conditions.push("c.Connector_Type = ?");
          params.push(connectorType);
        }

        const sql = `
          SELECT c.Connector_ID, c.Connector_Type, c.SubType, c.Name, c.Direction,
                 c.Stereotype, c.Notes, c.SourceCard, c.DestCard,
                 c.Start_Object_ID, c.End_Object_ID,
                 src.Name as SourceName, src.Object_Type as SourceType, src.Stereotype as SourceStereotype,
                 dst.Name as DestName, dst.Object_Type as DestType, dst.Stereotype as DestStereotype
          FROM t_connector c
          LEFT JOIN t_object src ON c.Start_Object_ID = src.Object_ID
          LEFT JOIN t_object dst ON c.End_Object_ID = dst.Object_ID
          WHERE ${conditions.join(" AND ")}
          ORDER BY c.Connector_Type, c.Name
        `;

        const rows = db.prepare(sql).all(...params);

        const connectors = (rows as any[]).map((r) => ({
          id: r.Connector_ID,
          type: r.Connector_Type,
          subType: r.SubType,
          name: r.Name,
          direction: r.Start_Object_ID === elementId ? "outgoing" : "incoming",
          stereotype: r.Stereotype,
          notes: r.Notes,
          sourceCard: r.SourceCard,
          destCard: r.DestCard,
          source: { id: r.Start_Object_ID, name: r.SourceName, type: r.SourceType, stereotype: r.SourceStereotype },
          dest: { id: r.End_Object_ID, name: r.DestName, type: r.DestType, stereotype: r.DestStereotype },
        }));

        if (connectors.length === 0) {
          return {
            content: [{ type: "text", text: `No connectors found for element ${elementId}${connectorType ? ` with type ${connectorType}` : ""}` }],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(connectors, null, 2) }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error retrieving connectors: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
