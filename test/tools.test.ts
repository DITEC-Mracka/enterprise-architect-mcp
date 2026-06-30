import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { DatabaseSync } from "node:sqlite";
import { configureAllTools } from "../src/tools";
import { createTestDb } from "./helpers/test-db";

let client: Client;
let db: DatabaseSync;

beforeAll(async () => {
  db = createTestDb();

  const server = new McpServer({
    name: "EA Test Server",
    version: "0.0.0",
  });
  configureAllTools(server, db);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
});

afterAll(() => {
  db.close();
});

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as any[])[0]?.text;
  return {
    isError: (result as any).isError,
    text,
    json: () => JSON.parse(text),
  };
}

// ─── ea_search ───

describe("ea_search", () => {
  it("finds elements by name", async () => {
    const res = await callTool("ea_search", { query: "väzňov" });
    const data = res.json();
    expect(data.length).toBeGreaterThan(0);
    expect(data.some((e: any) => e.Name === "Správa väzňov")).toBe(true);
  });

  it("finds elements by alias", async () => {
    const res = await callTool("ea_search", { query: "UC_001" });
    const data = res.json();
    expect(data.some((e: any) => e.Alias === "UC_001")).toBe(true);
  });

  it("finds elements by note content", async () => {
    const res = await callTool("ea_search", { query: "systéme ZVJS" });
    const data = res.json();
    expect(data.some((e: any) => e.Name === "Osoba")).toBe(true);
  });

  it("filters by objectType", async () => {
    const res = await callTool("ea_search", { query: "väz", objectType: "Class" });
    const data = res.json();
    expect(data.every((e: any) => e.Object_Type === "Class")).toBe(true);
  });

  it("filters by stereotype", async () => {
    const res = await callTool("ea_search", { query: "väz", stereotype: "Obrazovka" });
    const data = res.json();
    expect(data.length).toBe(1);
    expect(data[0].Stereotype).toBe("Obrazovka");
  });

  it("respects limit", async () => {
    const res = await callTool("ea_search", { query: "a", limit: 2 });
    const data = res.json();
    expect(data.length).toBeLessThanOrEqual(2);
  });

  it("returns message when no results found", async () => {
    const res = await callTool("ea_search", { query: "nonexistent_xyz_12345" });
    expect(res.text).toContain("No elements found");
  });

  it("includes PackageName in results", async () => {
    const res = await callTool("ea_search", { query: "Správa väzňov" });
    const data = res.json();
    const uc = data.find((e: any) => e.Name === "Správa väzňov");
    expect(uc.PackageName).toBe("Use Cases");
  });
});

// ─── ea_get_element ───

describe("ea_get_element", () => {
  it("returns full element with attributes and operations", async () => {
    const res = await callTool("ea_get_element", { elementId: 2 });
    const data = res.json();
    expect(data.Name).toBe("Väzeň");
    expect(data.Object_Type).toBe("Class");
    expect(data.PackageName).toBe("Use Cases");
    expect(data.attributes).toHaveLength(3);
    expect(data.attributes[0].name).toBe("meno");
    expect(data.attributes[1].name).toBe("priezvisko");
    expect(data.operations).toHaveLength(2);
    expect(data.operations[0].name).toBe("getFullName");
  });

  it("includes operation parameters", async () => {
    const res = await callTool("ea_get_element", { elementId: 2 });
    const data = res.json();
    const setMeno = data.operations.find((op: any) => op.name === "setMeno");
    expect(setMeno.parameters).toHaveLength(1);
    expect(setMeno.parameters[0]).toEqual({
      name: "meno",
      type: "String",
      kind: "in",
      notes: "Nové meno",
    });
  });

  it("formats attribute multiplicity", async () => {
    const res = await callTool("ea_get_element", { elementId: 2 });
    const data = res.json();
    const meno = data.attributes.find((a: any) => a.name === "meno");
    expect(meno.multiplicity).toBe("1..1");
  });

  it("returns empty arrays when element has no attributes/operations", async () => {
    const res = await callTool("ea_get_element", { elementId: 4 });
    const data = res.json();
    expect(data.Name).toBe("Spracovanie žiadosti");
    expect(data.attributes).toEqual([]);
    expect(data.operations).toEqual([]);
  });

  it("returns error for non-existent element", async () => {
    const res = await callTool("ea_get_element", { elementId: 9999 });
    expect(res.isError).toBe(true);
    expect(res.text).toContain("not found");
  });
});

// ─── ea_list_elements ───

describe("ea_list_elements", () => {
  it("lists elements in a package", async () => {
    const res = await callTool("ea_list_elements", { packageId: 3 });
    const data = res.json();
    expect(data.length).toBe(4); // UseCase, Class, Screen, Activity
  });

  it("filters by objectType", async () => {
    const res = await callTool("ea_list_elements", { packageId: 3, objectType: "Class" });
    const data = res.json();
    expect(data.every((e: any) => e.Object_Type === "Class")).toBe(true);
    expect(data).toHaveLength(1);
  });

  it("respects limit", async () => {
    const res = await callTool("ea_list_elements", { packageId: 3, limit: 2 });
    const data = res.json();
    expect(data.length).toBeLessThanOrEqual(2);
  });

  it("returns empty array for package with no elements", async () => {
    const res = await callTool("ea_list_elements", { packageId: 1 });
    const data = res.json();
    expect(data).toEqual([]);
  });
});

// ─── ea_get_connectors ───

describe("ea_get_connectors", () => {
  it("returns all connectors for an element (both directions)", async () => {
    const res = await callTool("ea_get_connectors", { elementId: 1 });
    const data = res.json();
    // OBJ 1 has: incoming Realisation from 3, outgoing Association to 2
    expect(data).toHaveLength(2);
  });

  it("filters outgoing connectors", async () => {
    const res = await callTool("ea_get_connectors", { elementId: 1, direction: "outgoing" });
    const data = res.json();
    expect(data.every((c: any) => c.source.id === 1)).toBe(true);
    expect(data).toHaveLength(1); // Association to Väzeň
  });

  it("filters incoming connectors", async () => {
    const res = await callTool("ea_get_connectors", { elementId: 1, direction: "incoming" });
    const data = res.json();
    expect(data.every((c: any) => c.dest.id === 1)).toBe(true);
    expect(data).toHaveLength(1); // Realisation from Screen
  });

  it("filters by connector type", async () => {
    const res = await callTool("ea_get_connectors", { elementId: 2, connectorType: "Association" });
    const data = res.json();
    expect(data.every((c: any) => c.type === "Association")).toBe(true);
  });

  it("includes source and dest element details", async () => {
    const res = await callTool("ea_get_connectors", { elementId: 3, direction: "outgoing" });
    const data = res.json();
    const real = data.find((c: any) => c.type === "Realisation");
    expect(real.source.name).toBe("Zoznam väzňov");
    expect(real.dest.name).toBe("Správa väzňov");
  });

  it("returns message when no connectors found", async () => {
    const res = await callTool("ea_get_connectors", { elementId: 4 });
    expect(res.text).toContain("No connectors found");
  });
});

// ─── ea_get_package_tree ───

describe("ea_get_package_tree", () => {
  it("returns top-level packages when no packageId given", async () => {
    const res = await callTool("ea_get_package_tree", {});
    const data = res.json();
    expect(data.packages).toHaveLength(1);
    expect(data.packages[0].name).toBe("Model");
  });

  it("returns children of a package", async () => {
    const res = await callTool("ea_get_package_tree", { packageId: 1 });
    const data = res.json();
    expect(data.packages).toHaveLength(2);
    expect(data.packages.map((p: any) => p.name)).toContain("Analýza");
    expect(data.packages.map((p: any) => p.name)).toContain("Architektúra");
  });

  it("includes elementCount per package", async () => {
    const res = await callTool("ea_get_package_tree", { packageId: 2 });
    const data = res.json();
    const useCases = data.packages.find((p: any) => p.name === "Use Cases");
    expect(useCases.elementCount).toBe(4); // 4 objects in PKG 3
  });

  it("recurses to specified depth", async () => {
    const res = await callTool("ea_get_package_tree", { packageId: 1, depth: 2 });
    const data = res.json();
    const analyza = data.packages.find((p: any) => p.name === "Analýza");
    expect(analyza.children).toBeDefined();
    expect(analyza.children).toHaveLength(1);
    expect(analyza.children[0].name).toBe("Use Cases");
  });

  it("caps depth at 3", async () => {
    const res = await callTool("ea_get_package_tree", { packageId: 0, depth: 10 });
    // Should not throw, just cap at 3
    const data = res.json();
    expect(data.packages).toBeDefined();
  });

  it("returns empty when package has no children", async () => {
    const res = await callTool("ea_get_package_tree", { packageId: 4 });
    const data = res.json();
    expect(data.packages).toEqual([]);
  });
});

// ─── ea_get_diagram_elements ───

describe("ea_get_diagram_elements", () => {
  it("returns diagram metadata and elements", async () => {
    const res = await callTool("ea_get_diagram_elements", { diagramId: 1 });
    const data = res.json();
    expect(data.diagram.name).toBe("UC Správa väzňov");
    expect(data.diagram.type).toBe("Use Case");
    expect(data.diagram.packageName).toBe("Use Cases");
    expect(data.elements).toHaveLength(3);
  });

  it("preserves element ordering by Sequence", async () => {
    const res = await callTool("ea_get_diagram_elements", { diagramId: 1 });
    const data = res.json();
    expect(data.elements[0].Object_ID).toBe(1);
    expect(data.elements[1].Object_ID).toBe(2);
    expect(data.elements[2].Object_ID).toBe(3);
  });

  it("returns error for non-existent diagram", async () => {
    const res = await callTool("ea_get_diagram_elements", { diagramId: 9999 });
    expect(res.isError).toBe(true);
    expect(res.text).toContain("not found");
  });
});

// ─── ea_get_scenarios ───

describe("ea_get_scenarios", () => {
  it("returns parsed scenario steps", async () => {
    const res = await callTool("ea_get_scenarios", { elementId: 1 });
    const data = res.json();
    expect(data).toHaveLength(2);

    const basic = data.find((s: any) => s.type === "Basic Path");
    expect(basic.name).toBe("Basic Path");
    expect(basic.steps).toHaveLength(2);
    expect(basic.steps[0].name).toBe("Používateľ otvorí zoznam");
    expect(basic.steps[1].name).toBe("Systém zobrazí údaje");
  });

  it("parses alternate scenarios", async () => {
    const res = await callTool("ea_get_scenarios", { elementId: 1 });
    const data = res.json();
    const alt = data.find((s: any) => s.type === "Alternate");
    expect(alt.steps).toHaveLength(1);
    expect(alt.steps[0].name).toBe("Väzeň neexistuje");
  });

  it("includes guid and level in steps", async () => {
    const res = await callTool("ea_get_scenarios", { elementId: 1 });
    const data = res.json();
    const step = data[0].steps[0];
    expect(step.guid).toBeDefined();
    expect(typeof step.level).toBe("number");
  });

  it("returns message when no scenarios exist", async () => {
    const res = await callTool("ea_get_scenarios", { elementId: 2 });
    expect(res.text).toContain("No scenarios found");
  });
});
