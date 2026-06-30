import { z } from "zod";
const MAX_INLINE_ITEMS = 50;
export function configureElementTools(server, db) {
    server.tool("ea_get_element", "Get full details of an Enterprise Architect element by its ID, including its note/description, attributes, and operations.", {
        elementId: z.coerce.number().describe("The Object_ID of the element to retrieve"),
    }, async ({ elementId }) => {
        try {
            const element = db.prepare(`
          SELECT o.Object_ID, o.Object_Type, o.Name, o.Alias, o.Stereotype,
                 o.Package_ID, p.Name as PackageName, o.Note, o.Status,
                 o.Author, o.CreatedDate, o.ModifiedDate, o.Phase, o.Complexity
          FROM t_object o
          LEFT JOIN t_package p ON o.Package_ID = p.Package_ID
          WHERE o.Object_ID = ?
        `).get(elementId);
            if (!element) {
                return {
                    content: [{ type: "text", text: `Element with ID ${elementId} not found` }],
                    isError: true,
                };
            }
            // Get attributes
            const allAttributes = db.prepare(`
          SELECT ID, Name, Type, Scope, Stereotype, Notes, LowerBound, UpperBound, "Default"
          FROM t_attribute
          WHERE Object_ID = ?
          ORDER BY Pos
        `).all(elementId);
            const attributesTruncated = allAttributes.length > MAX_INLINE_ITEMS;
            const attributes = allAttributes.slice(0, MAX_INLINE_ITEMS).map((a) => ({
                id: a.ID,
                name: a.Name,
                type: a.Type,
                scope: a.Scope,
                stereotype: a.Stereotype,
                notes: a.Notes,
                multiplicity: a.LowerBound && a.UpperBound ? `${a.LowerBound}..${a.UpperBound}` : undefined,
                default: a.Default,
            }));
            // Get operations
            const allOperations = db.prepare(`
          SELECT OperationID, Name, Type, Scope, Stereotype, Notes
          FROM t_operation
          WHERE Object_ID = ?
          ORDER BY Pos
        `).all(elementId);
            const operationsTruncated = allOperations.length > MAX_INLINE_ITEMS;
            const operations = allOperations.slice(0, MAX_INLINE_ITEMS).map((op) => {
                const params = db.prepare(`
            SELECT Name, Type, Kind, Notes
            FROM t_operationparams
            WHERE OperationID = ?
            ORDER BY Pos
          `).all(op.OperationID);
                return {
                    id: op.OperationID,
                    name: op.Name,
                    returnType: op.Type,
                    scope: op.Scope,
                    stereotype: op.Stereotype,
                    notes: op.Notes,
                    parameters: params.map((p) => ({
                        name: p.Name,
                        type: p.Type,
                        kind: p.Kind,
                        notes: p.Notes,
                    })),
                };
            });
            const result = {
                ...element,
                attributes,
                attributesTruncated,
                attributesTotal: allAttributes.length,
                operations,
                operationsTruncated,
                operationsTotal: allOperations.length,
            };
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text", text: `Error retrieving element: ${msg}` }],
                isError: true,
            };
        }
    });
    server.tool("ea_list_elements", "List elements within a package, optionally filtered by object type. Returns a lightweight list (ID, type, name, alias, stereotype).", {
        packageId: z.coerce.number().describe("The Package_ID to list elements from"),
        objectType: z
            .string()
            .optional()
            .describe("Filter by object type (e.g., Class, UseCase, Activity, Screen)"),
        limit: z.coerce.number().default(50).describe("Maximum number of results (default 50)"),
    }, async ({ packageId, objectType, limit }) => {
        try {
            let sql = `
          SELECT Object_ID, Object_Type, Name, Alias, Stereotype
          FROM t_object
          WHERE Package_ID = ?
        `;
            const params = [packageId];
            if (objectType) {
                sql += " AND Object_Type = ?";
                params.push(objectType);
            }
            sql += " ORDER BY Object_Type, Name LIMIT ?";
            params.push(limit);
            const rows = db.prepare(sql).all(...params);
            return {
                content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text", text: `Error listing elements: ${msg}` }],
                isError: true,
            };
        }
    });
}
