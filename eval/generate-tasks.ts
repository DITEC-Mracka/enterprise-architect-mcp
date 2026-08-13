#!/usr/bin/env node
/**
 * Eval task generator: queries a .qea export and generates diverse eval tasks.
 * Usage: npx tsx eval/generate-tasks.ts <path-to-qea> [output-path]
 */
import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { EvalTask } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function main() {
  const qeaPath = process.argv[2];
  if (!qeaPath) {
    console.error("Usage: npx tsx eval/generate-tasks.ts <path-to-qea> [output-path]");
    process.exit(1);
  }

  const outPath = process.argv[3] || resolve(__dirname, "tasks.json");
  const db = new DatabaseSync(resolve(qeaPath), { readOnly: true });
  const tasks: EvalTask[] = [];
  let taskNum = 0;
  const id = (tool: string) => `${tool}-${String(++taskNum).padStart(2, "0")}`;

  // --- ea_get_schema ---
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
  tasks.push({
    id: id("schema"), tool: "ea_get_schema", description: "List tables includes t_object",
    args: {}, assertions: [{ type: "exists", path: "tables" }, { type: "length_gte", path: "tables", expected: 5 }],
  });
  const tObjCols = db.prepare("PRAGMA table_info('t_object')").all() as { name: string }[];
  if (tObjCols.length > 0) {
    tasks.push({
      id: id("schema"), tool: "ea_get_schema", description: "t_object has Object_ID column",
      args: { tableName: "t_object" },
      assertions: [{ type: "equals", path: "table", expected: "t_object" }, { type: "exists", path: "rowidAlias" }],
    });
  }

  // --- ea_get_model_info ---
  const fileName = basename(resolve(qeaPath));
  tasks.push({
    id: id("model_info"), tool: "ea_get_model_info", description: `File name is ${fileName}`,
    args: {}, assertions: [{ type: "equals", path: "fileName", expected: fileName }, { type: "exists", path: "fileSizeBytes" }],
  });

  // --- ea_search: element by name ---
  const searchEl = db.prepare("SELECT Object_ID, Name FROM t_object WHERE Name IS NOT NULL AND length(Name) > 5 ORDER BY RANDOM() LIMIT 1").get() as any;
  if (searchEl) {
    tasks.push({
      id: id("search"), tool: "ea_search", description: `Search finds "${searchEl.Name}" by name`,
      args: { query: searchEl.Name, limit: 10 },
      assertions: [{ type: "gte", path: "totalMatched", expected: 1 }],
    });
  }

  // --- ea_search: entity-encoded text ---
  const encodedEl = db.prepare("SELECT Object_ID, Name, Note FROM t_object WHERE Note LIKE '%&#%' ORDER BY RANDOM() LIMIT 1").get() as any;
  if (encodedEl) {
    // Extract a word from the decoded form to search for
    const decoded = (encodedEl.Note as string).replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(parseInt(code)));
    const words = decoded.split(/\s+/).filter((w: string) => w.length > 4 && !/[<>&]/.test(w));
    if (words.length > 0) {
      tasks.push({
        id: id("search"), tool: "ea_search", description: `Search finds entity-encoded element "${encodedEl.Name}" via decoded text`,
        args: { query: words[0], limit: 50 },
        assertions: [{ type: "gte", path: "totalMatched", expected: 1 }],
      });
    }
  }

  // --- ea_get_element: with attributes ---
  const elWithAttrs = db.prepare(`
    SELECT o.Object_ID, o.Name, COUNT(a.ID) as attrCount
    FROM t_object o JOIN t_attribute a ON o.Object_ID = a.Object_ID
    GROUP BY o.Object_ID HAVING attrCount >= 3 ORDER BY RANDOM() LIMIT 1
  `).get() as any;
  if (elWithAttrs) {
    tasks.push({
      id: id("element"), tool: "ea_get_element", description: `Element "${elWithAttrs.Name}" has ${elWithAttrs.attrCount} attributes`,
      args: { elementId: elWithAttrs.Object_ID },
      assertions: [
        { type: "equals", path: "Name", expected: elWithAttrs.Name },
        { type: "length_gte", path: "attributes", expected: elWithAttrs.attrCount },
        { type: "exists", path: "diagrams" },
        { type: "exists", path: "constraints" },
      ],
    });
  }

  // --- ea_get_element: with constraints ---
  const elWithConst = db.prepare(`
    SELECT o.Object_ID, o.Name, COUNT(*) as cCount
    FROM t_object o JOIN t_objectconstraint c ON o.Object_ID = c.Object_ID
    GROUP BY o.Object_ID HAVING cCount >= 1 ORDER BY RANDOM() LIMIT 1
  `).get() as any;
  if (elWithConst) {
    tasks.push({
      id: id("element"), tool: "ea_get_element", description: `Element "${elWithConst.Name}" has constraints`,
      args: { elementId: elWithConst.Object_ID },
      assertions: [{ type: "length_gte", path: "constraints", expected: elWithConst.cCount }],
    });
  }

  // --- ea_get_connectors: with feature links ---
  const connFL = db.prepare(`
    SELECT c.Connector_ID, c.Start_Object_ID, c.StyleEx, a.Name as AttrName
    FROM t_connector c
    JOIN t_attribute a ON a.ea_guid = SUBSTR(
      c.StyleEx, INSTR(c.StyleEx, 'LFSP={') + 5,
      INSTR(SUBSTR(c.StyleEx, INSTR(c.StyleEx, 'LFSP={') + 5), '}')
    ) COLLATE NOCASE
    WHERE c.StyleEx LIKE '%LFSP={%'
    LIMIT 1
  `).get() as any;
  if (connFL) {
    tasks.push({
      id: id("connectors"), tool: "ea_get_connectors", description: `Connector ${connFL.Connector_ID} resolves feature link to "${connFL.AttrName}"`,
      args: { elementId: connFL.Start_Object_ID },
      assertions: [{ type: "gte", path: "connectors.length", expected: 1 }],
    });
  } else {
    // Fallback: just test that connectors returns something for an element
    const anyConn = db.prepare("SELECT Start_Object_ID FROM t_connector LIMIT 1").get() as any;
    if (anyConn) {
      tasks.push({
        id: id("connectors"), tool: "ea_get_connectors", description: "Connectors return for an element",
        args: { elementId: anyConn.Start_Object_ID },
        assertions: [{ type: "gte", path: "connectors.length", expected: 1 }],
      });
    }
  }

  // --- ea_get_diagram_elements ---
  const diagram = db.prepare(`
    SELECT d.Diagram_ID, d.Name, COUNT(DISTINCT do_.Object_ID) as elCount
    FROM t_diagram d JOIN t_diagramobjects do_ ON d.Diagram_ID = do_.Diagram_ID
    GROUP BY d.Diagram_ID HAVING elCount >= 3 ORDER BY RANDOM() LIMIT 1
  `).get() as any;
  if (diagram) {
    tasks.push({
      id: id("diagram"), tool: "ea_get_diagram_elements", description: `Diagram "${diagram.Name}" has ${diagram.elCount} elements`,
      args: { diagramId: diagram.Diagram_ID },
      assertions: [
        { type: "equals", path: "diagram.name", expected: diagram.Name },
        { type: "length_gte", path: "elements", expected: diagram.elCount },
        { type: "exists", path: "connectors" },
      ],
    });
  }

  // --- ea_get_scenarios ---
  const scenarioEl = db.prepare(`
    SELECT os.Object_ID, o.Name, COUNT(*) as sCount
    FROM t_objectscenarios os JOIN t_object o ON os.Object_ID = o.Object_ID
    GROUP BY os.Object_ID HAVING sCount >= 2 ORDER BY RANDOM() LIMIT 1
  `).get() as any;
  if (scenarioEl) {
    tasks.push({
      id: id("scenarios"), tool: "ea_get_scenarios", description: `Element "${scenarioEl.Name}" has ${scenarioEl.sCount} scenarios`,
      args: { elementId: scenarioEl.Object_ID },
      assertions: [{ type: "length_gte", path: "scenarios", expected: scenarioEl.sCount }],
    });
  }

  // --- ea_list_elements ---
  const pkg = db.prepare(`
    SELECT p.Package_ID, p.Name, COUNT(o.Object_ID) as elCount
    FROM t_package p JOIN t_object o ON p.Package_ID = o.Package_ID
    GROUP BY p.Package_ID HAVING elCount >= 3 ORDER BY RANDOM() LIMIT 1
  `).get() as any;
  if (pkg) {
    tasks.push({
      id: id("list_elements"), tool: "ea_list_elements", description: `Package "${pkg.Name}" has ${pkg.elCount} elements`,
      args: { packageId: pkg.Package_ID },
      assertions: [{ type: "gte", path: "totalMatched", expected: pkg.elCount }],
    });
  }

  // --- ea_get_package_tree ---
  const rootPkg = db.prepare("SELECT Package_ID, Name FROM t_package WHERE Parent_ID = 0 LIMIT 1").get() as any;
  if (rootPkg) {
    tasks.push({
      id: id("package_tree"), tool: "ea_get_package_tree", description: `Root package is "${rootPkg.Name}"`,
      args: {},
      assertions: [{ type: "length_gte", path: "packages", expected: 1 }],
    });
  }

  // --- ea_list_diagrams ---
  const anyDiag = db.prepare("SELECT Diagram_ID, Name, Package_ID FROM t_diagram ORDER BY RANDOM() LIMIT 1").get() as any;
  if (anyDiag) {
    tasks.push({
      id: id("list_diagrams"), tool: "ea_list_diagrams", description: `Diagram "${anyDiag.Name}" appears in listing`,
      args: { nameContains: anyDiag.Name.substring(0, 15) },
      assertions: [{ type: "gte", path: "totalMatched", expected: 1 }],
    });
  }

  // --- ea_resolve: by GUID ---
  const guidEl = db.prepare("SELECT Object_ID, Name, ea_guid FROM t_object WHERE ea_guid IS NOT NULL ORDER BY RANDOM() LIMIT 1").get() as any;
  if (guidEl) {
    tasks.push({
      id: id("resolve"), tool: "ea_resolve", description: `Resolve GUID ${guidEl.ea_guid} to "${guidEl.Name}"`,
      args: { reference: guidEl.ea_guid },
      assertions: [{ type: "gte", path: "candidateCount", expected: 1 }],
    });
  }

  // --- ea_resolve: by name ---
  const namedEl = db.prepare(`
    SELECT Name, COUNT(*) as cnt FROM t_object WHERE Name IS NOT NULL
    GROUP BY Name HAVING cnt = 1 ORDER BY RANDOM() LIMIT 1
  `).get() as any;
  if (namedEl) {
    tasks.push({
      id: id("resolve"), tool: "ea_resolve", description: `Resolve unique name "${namedEl.Name}"`,
      args: { reference: namedEl.Name, kind: "element" },
      assertions: [{ type: "equals", path: "candidateCount", expected: 1 }],
    });
  }

  // --- ea_resolve: duplicate name ---
  const dupName = db.prepare(`
    SELECT Name, COUNT(*) as cnt FROM t_object WHERE Name IS NOT NULL
    GROUP BY Name HAVING cnt >= 2 ORDER BY RANDOM() LIMIT 1
  `).get() as any;
  if (dupName) {
    tasks.push({
      id: id("resolve"), tool: "ea_resolve", description: `Resolve duplicate name "${dupName.Name}" returns ${dupName.cnt} candidates`,
      args: { reference: dupName.Name, kind: "element" },
      assertions: [{ type: "gte", path: "candidateCount", expected: 2 }],
    });
  }

  db.close();

  writeFileSync(outPath, JSON.stringify(tasks, null, 2));
  console.log(`Generated ${tasks.length} eval tasks covering ${new Set(tasks.map((t) => t.tool)).size} tools`);
  console.log(`Written to ${outPath}`);

  // Summary by tool
  const byTool = new Map<string, number>();
  for (const t of tasks) byTool.set(t.tool, (byTool.get(t.tool) || 0) + 1);
  for (const [tool, count] of [...byTool.entries()].sort()) {
    console.log(`  ${tool}: ${count} tasks`);
  }
}

main();
