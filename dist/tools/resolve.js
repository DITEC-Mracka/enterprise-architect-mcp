import { z } from "zod";
import { buildPackagePath } from "../package-path.js";
import { foldText } from "../text.js";
function isBracedGuid(ref) {
    return /^\{[^}]+\}$/.test(ref.trim());
}
function resolveByGuid(db, guid, kind) {
    const candidates = [];
    if (!kind || kind === "element") {
        const rows = db.prepare("SELECT Object_ID, Object_Type, Name, Package_ID, ea_guid FROM t_object WHERE ea_guid = ? COLLATE NOCASE").all(guid);
        for (const r of rows) {
            candidates.push({
                type: "element", id: r.Object_ID, name: r.Name,
                fullPackagePath: buildPackagePath(db, r.Package_ID),
                eaGuid: r.ea_guid, objectType: r.Object_Type,
            });
        }
    }
    if (!kind || kind === "diagram") {
        const rows = db.prepare("SELECT Diagram_ID, Name, Package_ID, ea_guid FROM t_diagram WHERE ea_guid = ? COLLATE NOCASE").all(guid);
        for (const r of rows) {
            candidates.push({
                type: "diagram", id: r.Diagram_ID, name: r.Name,
                fullPackagePath: buildPackagePath(db, r.Package_ID),
                eaGuid: r.ea_guid,
            });
        }
    }
    if (!kind || kind === "package") {
        const rows = db.prepare("SELECT Package_ID, Name, Parent_ID, ea_guid FROM t_package WHERE ea_guid = ? COLLATE NOCASE").all(guid);
        for (const r of rows) {
            candidates.push({
                type: "package", id: r.Package_ID, name: r.Name,
                fullPackagePath: buildPackagePath(db, r.Package_ID),
                eaGuid: r.ea_guid,
            });
        }
    }
    return candidates;
}
function resolveByName(db, name, kind) {
    const candidates = [];
    const folded = foldText(name);
    if (!kind || kind === "element") {
        const rows = db.prepare("SELECT Object_ID, Object_Type, Name, Package_ID, ea_guid FROM t_object").all();
        for (const r of rows) {
            if (foldText(r.Name || "") === folded) {
                candidates.push({
                    type: "element", id: r.Object_ID, name: r.Name,
                    fullPackagePath: buildPackagePath(db, r.Package_ID),
                    eaGuid: r.ea_guid, objectType: r.Object_Type,
                });
            }
        }
    }
    if (!kind || kind === "diagram") {
        const rows = db.prepare("SELECT Diagram_ID, Name, Package_ID, ea_guid FROM t_diagram").all();
        for (const r of rows) {
            if (foldText(r.Name || "") === folded) {
                candidates.push({
                    type: "diagram", id: r.Diagram_ID, name: r.Name,
                    fullPackagePath: buildPackagePath(db, r.Package_ID),
                    eaGuid: r.ea_guid,
                });
            }
        }
    }
    if (!kind || kind === "package") {
        const rows = db.prepare("SELECT Package_ID, Name, Parent_ID, ea_guid FROM t_package").all();
        for (const r of rows) {
            if (foldText(r.Name || "") === folded) {
                candidates.push({
                    type: "package", id: r.Package_ID, name: r.Name,
                    fullPackagePath: buildPackagePath(db, r.Package_ID),
                    eaGuid: r.ea_guid,
                });
            }
        }
    }
    return candidates;
}
export function configureResolveTools(server, db) {
    server.tool("ea_resolve", "Resolve an analyst reference (braced GUID or plain name) to model candidates. Each candidate reports what it is (element, diagram, package), its ID, name, and full package path. Use the optional kind filter to narrow results.", {
        reference: z.string().describe("The reference to resolve: a braced GUID like {ABC-123} or a plain name"),
        kind: z
            .enum(["element", "diagram", "package"])
            .optional()
            .describe("Filter candidates to a specific kind"),
    }, async ({ reference, kind }) => {
        try {
            let candidates;
            if (isBracedGuid(reference)) {
                candidates = resolveByGuid(db, reference.trim(), kind);
            }
            else {
                candidates = resolveByName(db, reference.trim(), kind);
            }
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            reference,
                            candidates,
                            totalMatched: candidates.length,
                            returned: candidates.length,
                            truncated: false,
                            _meta: { sourceTables: ["t_object", "t_diagram", "t_package"] },
                        }, null, 2),
                    }],
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text", text: `Error resolving reference: ${msg}` }],
                isError: true,
            };
        }
    });
}
