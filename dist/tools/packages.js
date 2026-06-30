import { z } from "zod";
const MAX_PACKAGES = 200;
export function configurePackageTools(server, db) {
    server.tool("ea_get_package_tree", "Navigate the package hierarchy. Without parameters, returns top-level packages. With a packageId, returns that package's children up to the specified depth.", {
        packageId: z.coerce.number().optional().describe("Package ID to get children of. Omit for top-level packages."),
        depth: z.coerce.number().default(1).describe("How many levels deep to recurse (max 3, default 1)"),
    }, async ({ packageId, depth }) => {
        try {
            const effectiveDepth = Math.min(depth, 3);
            const parentId = packageId ?? 0;
            let totalCount = 0;
            function getChildren(pid, currentDepth) {
                if (currentDepth <= 0 || totalCount >= MAX_PACKAGES)
                    return [];
                const packages = db.prepare(`
            SELECT p.Package_ID, p.Name, p.Parent_ID
            FROM t_package p
            WHERE p.Parent_ID = ?
            ORDER BY p.TPos, p.Name
          `).all(pid);
                const result = [];
                for (const pkg of packages) {
                    if (totalCount >= MAX_PACKAGES)
                        break;
                    totalCount++;
                    const countRow = db.prepare("SELECT COUNT(*) as cnt FROM t_object WHERE Package_ID = ?").get(pkg.Package_ID);
                    const node = {
                        id: pkg.Package_ID,
                        name: pkg.Name,
                        parentId: pkg.Parent_ID,
                        elementCount: countRow.cnt,
                    };
                    if (currentDepth > 1) {
                        const children = getChildren(pkg.Package_ID, currentDepth - 1);
                        if (children.length > 0) {
                            node.children = children;
                        }
                    }
                    result.push(node);
                }
                return result;
            }
            const tree = getChildren(parentId, effectiveDepth);
            const response = { packages: tree };
            if (totalCount >= MAX_PACKAGES) {
                response.truncated = true;
                response.message = `Results truncated at ${MAX_PACKAGES} packages. Use a specific packageId to drill deeper.`;
            }
            return {
                content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text", text: `Error retrieving package tree: ${msg}` }],
                isError: true,
            };
        }
    });
}
