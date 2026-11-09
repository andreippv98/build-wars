import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let cached: Db | undefined;

/** Lazy singleton, so importing this module never opens a connection (e.g. during `next build`). */
export function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
    cached = drizzle(postgres(url), { schema });
  }
  return cached;
}
