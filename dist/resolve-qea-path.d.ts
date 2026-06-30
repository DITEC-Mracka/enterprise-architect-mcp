/**
 * Resolves the .qea file path using a fallback chain:
 *   CLI arg → EA_QEA_PATH env var → .env in CWD → error
 *
 * The resolved value can be a file or a directory.
 * If it's a directory, the newest .qea file in it is used.
 */
export declare function resolveQeaPath(cliArg?: string): string;
