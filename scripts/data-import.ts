import { config } from "dotenv";
import { getTableColumns, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PgColumn, PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core";
import postgres from "postgres";
import path from "node:path";
import * as schema from "@/db/schema";
import {
  chipsetRow,
  cpuRow,
  cpuSupportRows,
  gpuBoardRow,
  gpuChipRow,
  motherboardRow,
  psuRow,
  ramKitRow,
} from "@/lib/catalog/db-rows";
import { loadCatalog } from "@/lib/catalog/load";

config({ path: [".env.local", ".env"], quiet: true });

const CHUNK = 500;

type Tx = Parameters<Parameters<ReturnType<typeof drizzle<typeof schema>>["transaction"]>[0]>[0];

/** Insert rows; on id conflict update every non-id column. Returns the row count. */
async function upsert<T extends PgTable>(
  tx: Tx,
  table: T,
  rows: T["$inferInsert"][],
): Promise<number> {
  if (rows.length === 0) return 0;
  const columns = getTableColumns(table) as Record<string, PgColumn>;
  const set = Object.fromEntries(
    Object.entries(columns)
      .filter(([key]) => key !== "id")
      .map(([key, column]) => [key, sql`excluded.${sql.identifier(column.name)}`]),
  );
  for (let i = 0; i < rows.length; i += CHUNK) {
    await tx
      .insert(table)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoUpdate({ target: columns.id, set: set as PgUpdateSetSource<T> });
  }
  return rows.length;
}

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local.");
    return 1;
  }

  const { catalog, issues } = await loadCatalog(path.join(process.cwd(), "data"));
  if (!catalog || issues.length > 0) {
    for (const issue of issues) {
      console.error(`${issue.file ?? "(cross-references)"} ${issue.path}: ${issue.message}`);
    }
    console.error(`\n${issues.length} issue(s) found. Nothing was imported.`);
    return 1;
  }

  const client = postgres(url, { max: 1 });
  try {
    const db = drizzle(client, { schema });
    const tables = [
      { name: "cpus", table: schema.cpus, rows: catalog.cpus.map(cpuRow) },
      { name: "gpu_chips", table: schema.gpuChips, rows: catalog.gpu_chips.map(gpuChipRow) },
      { name: "gpu_boards", table: schema.gpuBoards, rows: catalog.gpu_boards.map(gpuBoardRow) },
      { name: "chipsets", table: schema.chipsets, rows: catalog.chipsets.map(chipsetRow) },
      {
        name: "motherboards",
        table: schema.motherboards,
        rows: catalog.motherboards.map(motherboardRow),
      },
      { name: "ram_kits", table: schema.ramKits, rows: catalog.ram_kits.map(ramKitRow) },
      { name: "psus", table: schema.psus, rows: catalog.psus.map(psuRow) },
    ];
    const supportRows = cpuSupportRows(catalog);

    await db.transaction(async (tx) => {
      for (const { name, table, rows } of tables) {
        const count = await upsert(tx, table, rows);
        console.log(`${name}: ${count} upserted`);
      }
      await tx.delete(schema.boardCpuSupport);
      for (let i = 0; i < supportRows.length; i += CHUNK) {
        await tx.insert(schema.boardCpuSupport).values(supportRows.slice(i, i + CHUNK));
      }
      console.log(`board_cpu_support: ${supportRows.length} rows`);
    });

    // Parts are never deleted (saved builds reference them); just point out leftovers.
    for (const { name, table, rows } of tables) {
      const inJson = new Set(rows.map((r) => r.id));
      const existing = await db
        .select({ id: (table as unknown as { id: PgColumn }).id })
        .from(table);
      const extra = existing.map((r) => String(r.id)).filter((id) => !inJson.has(id));
      if (extra.length > 0) {
        console.warn(`warning: ${name} in database but not in catalog: ${extra.join(", ")}`);
      }
    }
    return 0;
  } finally {
    await client.end();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
