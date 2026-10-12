import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";

export async function rows<T = Record<string, unknown>>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return (result as { rows: T[] }).rows ?? [];
}

export { sql };
