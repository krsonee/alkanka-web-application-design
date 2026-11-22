import { drizzle } from 'drizzle-orm/node-postgres'
import { sql, type SQL } from 'drizzle-orm'
import { Pool } from 'pg'

const globalForPool = globalThis as unknown as { alkankaPool?: Pool }

export const pool =
  globalForPool.alkankaPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    // Without a limit a request waits for a free connection for as long as the function lives, so one slow
    // moment piles every later request up behind it and the whole site appears frozen. Give up and let the
    // page retry instead.
    connectionTimeoutMillis: 10_000,
  })
if (process.env.NODE_ENV !== 'production') globalForPool.alkankaPool = pool

export const db = drizzle(pool)

export async function rows<T = Record<string, unknown>>(query: SQL): Promise<T[]> {
  const res = await db.execute(query)
  return res.rows as T[]
}

export { sql }
