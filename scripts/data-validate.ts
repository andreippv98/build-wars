import path from "node:path";
import { loadCatalog } from "@/lib/catalog/load";
import type { CatalogIssue } from "@/lib/schemas";

async function main(): Promise<number> {
  const dataDir = path.join(process.cwd(), "data");
  const { catalog, issues } = await loadCatalog(dataDir);

  if (issues.length > 0) {
    const byFile = new Map<string, CatalogIssue[]>();
    for (const issue of issues) {
      const key = issue.file ?? "(cross-references)";
      byFile.set(key, [...(byFile.get(key) ?? []), issue]);
    }
    for (const [file, list] of byFile) {
      console.error(`\n${file}`);
      for (const issue of list) {
        console.error(`  ${issue.path ? `${issue.path}: ` : ""}${issue.message}`);
      }
    }
    console.error(`\n${issues.length} issue${issues.length === 1 ? "" : "s"} found.`);
  }

  if (catalog) {
    console.log(issues.length > 0 ? "\nCollections:" : "Collections:");
    for (const [name, records] of Object.entries(catalog)) {
      const unverified = records.filter((r: { verified: boolean }) => !r.verified).length;
      console.log(`  ${name}: ${records.length} records, ${unverified} unverified`);
    }
  }
  if (issues.length === 0) console.log("Catalog is valid.");
  return issues.length > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
