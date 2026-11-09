import type { Catalog, CatalogIssue } from "@/lib/schemas";

export type LoadResult = {
  /** Present only when every file parsed and passed its schema. */
  catalog?: Catalog;
  /** Schema issues (with `file` set) followed by cross-reference issues from `validateCatalog`. */
  issues: CatalogIssue[];
};

/**
 * Reads and validates the catalog from a data directory (Node only; uses `node:fs`).
 * Layout is documented on `CatalogSchema`. Missing files count as empty collections, except that
 * an unreadable or non-JSON file is an issue. GPU files are read in alphabetical order and their
 * chips / boards concatenated. Cross-reference checks run only if all schemas passed.
 */
export async function loadCatalog(dataDir: string): Promise<LoadResult> {
  void dataDir;
  throw new Error("not implemented");
}
