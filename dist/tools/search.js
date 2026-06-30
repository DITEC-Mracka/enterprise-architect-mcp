import { z } from "zod";
export function configureSearchTools(server, db) {
    server.tool("ea_search", "Search Enterprise Architect model elements by name, alias, or notes content. Returns matching objects with their type, stereotype, package, and a note preview.", {
        query: z.string().describe("Search term to find in element names, aliases, and notes"),
        objectType: z
            .string()
            .optional()
            .describe("Filter by object type (e.g., Class, UseCase, Activity, Screen, Requirement, Interface, Component)"),
        stereotype: z.string().optional().describe("Filter by stereotype"),
        limit: z.coerce.number().default(25).describe("Maximum number of results to return (default 25)"),
    }, async ({ query, objectType, stereotype, limit }) => {
        try {
            const pattern = `%${query}%`;
            let sql = `
          SELECT o.Object_ID, o.Object_Type, o.Name, o.Alias, o.Stereotype,
                 o.Package_ID, p.Name as PackageName, substr(o.Note, 1, 200) as NotePreview
          FROM t_object o
          LEFT JOIN t_package p ON o.Package_ID = p.Package_ID
          WHERE (o.Name LIKE ? OR o.Alias LIKE ? OR o.Note LIKE ?)
        `;
            const params = [pattern, pattern, pattern];
            if (objectType) {
                sql += " AND o.Object_Type = ?";
                params.push(objectType);
            }
            if (stereotype) {
                sql += " AND o.Stereotype = ?";
                params.push(stereotype);
            }
            sql += " ORDER BY CASE WHEN o.Name LIKE ? THEN 0 WHEN o.Alias LIKE ? THEN 1 ELSE 2 END, o.Name";
            params.push(pattern, pattern);
            sql += " LIMIT ?";
            params.push(limit);
            const rows = db.prepare(sql).all(...params);
            if (rows.length === 0) {
                return {
                    content: [{ type: "text", text: `No elements found matching "${query}"${objectType ? ` with type ${objectType}` : ""}${stereotype ? ` with stereotype ${stereotype}` : ""}` }],
                };
            }
            return {
                content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text", text: `Error searching elements: ${msg}` }],
                isError: true,
            };
        }
    });
}
