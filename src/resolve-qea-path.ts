import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Resolves the .qea file path using a fallback chain:
 *   CLI arg → EA_QEA_PATH env var → .env in CWD → error
 *
 * The resolved value can be a file or a directory.
 * If it's a directory, the newest .qea file in it is used.
 */
export function resolveQeaPath(cliArg?: string): string {
  const target = cliArg || process.env.EA_QEA_PATH || loadFromDotEnv();

  if (!target) {
    throw new Error(
      "No .qea path provided. Pass as CLI argument, set EA_QEA_PATH env var, or add EA_QEA_PATH to .env in the working directory."
    );
  }

  const resolved = resolve(target);

  if (!existsSync(resolved)) {
    throw new Error(`Path not found: ${resolved}`);
  }

  if (statSync(resolved).isDirectory()) {
    return findNewestQea(resolved);
  }

  return resolved;
}

function findNewestQea(dir: string): string {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".qea"))
    .map((f) => {
      const fullPath = join(dir, f);
      return { path: fullPath, mtime: statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    throw new Error(`No .qea files found in directory: ${dir}`);
  }

  return files[0].path;
}

function loadFromDotEnv(): string | undefined {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return undefined;

  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed) continue;
    const match = trimmed.match(/^EA_QEA_PATH\s*=\s*(.+)$/);
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return undefined;
}
