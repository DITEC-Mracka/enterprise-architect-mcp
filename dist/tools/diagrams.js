import { z } from "zod";
export function configureDiagramTools(server, db) {
    server.tool("ea_get_diagram_elements", "Get all elements placed on a specific diagram, along with the diagram's metadata. Useful for understanding what a diagram shows without needing the visual.", {
        diagramId: z.coerce.number().describe("The Diagram_ID to get elements for"),
    }, async ({ diagramId }) => {
        try {
            const diagram = db.prepare(`
          SELECT d.Diagram_ID, d.Name, d.Diagram_Type, d.Package_ID, d.Notes,
                 p.Name as PackageName
          FROM t_diagram d
          LEFT JOIN t_package p ON d.Package_ID = p.Package_ID
          WHERE d.Diagram_ID = ?
        `).get(diagramId);
            if (!diagram) {
                return {
                    content: [{ type: "text", text: `Diagram with ID ${diagramId} not found` }],
                    isError: true,
                };
            }
            const elements = db.prepare(`
          SELECT o.Object_ID, o.Object_Type, o.Name, o.Alias, o.Stereotype
          FROM t_diagramobjects do_
          JOIN t_object o ON do_.Object_ID = o.Object_ID
          WHERE do_.Diagram_ID = ?
          ORDER BY do_.Sequence
        `).all(diagramId);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            diagram: {
                                id: diagram.Diagram_ID,
                                name: diagram.Name,
                                type: diagram.Diagram_Type,
                                packageId: diagram.Package_ID,
                                packageName: diagram.PackageName,
                                notes: diagram.Notes,
                            },
                            elements,
                        }, null, 2),
                    }],
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text", text: `Error retrieving diagram elements: ${msg}` }],
                isError: true,
            };
        }
    });
}
