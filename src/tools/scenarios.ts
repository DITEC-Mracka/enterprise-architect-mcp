import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Database } from "../database.js";
import { z } from "zod";
import { XMLParser } from "fast-xml-parser";

interface ScenarioStep {
  name: string;
  level: number;
  guid: string;
}

interface ParsedScenario {
  name: string;
  type: string;
  steps: ScenarioStep[];
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "step",
});

function parseScenarioXml(xml: string | null): ScenarioStep[] {
  if (!xml || xml.trim() === "") return [];

  try {
    const parsed = xmlParser.parse(xml);
    const steps = parsed?.path?.step;
    if (!steps) return [];

    return (Array.isArray(steps) ? steps : [steps]).map((s: any) => ({
      name: s["@_name"] || "",
      level: parseInt(s["@_level"] || "0", 10),
      guid: s["@_guid"] || "",
    }));
  } catch {
    return [];
  }
}

export function configureScenarioTools(server: McpServer, db: Database): void {
  server.tool(
    "ea_get_scenarios",
    "Get use case scenario flows for an element. Returns parsed step-by-step flows from the element's scenarios (Basic Path, Alternate Paths, Exception Paths).",
    {
      elementId: z.coerce.number().describe("The Object_ID of the element (typically a UseCase) to get scenarios for"),
    },
    async ({ elementId }) => {
      try {
        const rows = db.prepare(`
          SELECT Scenario, ScenarioType, XMLContent, Notes
          FROM t_objectscenarios
          WHERE Object_ID = ?
          ORDER BY ea_guid
        `).all(elementId) as any[];

        if (rows.length === 0) {
          return {
            content: [{ type: "text", text: `No scenarios found for element ${elementId}` }],
          };
        }

        const scenarios: ParsedScenario[] = rows.map((row) => ({
          name: row.Scenario,
          type: row.ScenarioType,
          steps: parseScenarioXml(row.XMLContent),
        }));

        return {
          content: [{ type: "text", text: JSON.stringify(scenarios, null, 2) }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error retrieving scenarios: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
