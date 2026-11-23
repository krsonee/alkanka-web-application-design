import { drizzle } from 'drizzle-orm/node-postgres'
import { sql, type SQL } from 'drizzle-orm'
import { Pool } from 'pg'

const globalForPool = globalThis as unknown as { alkankaPool?: Pool }

/** Longest a statement may wait for its answer before the caller is told it failed. */
export const QUERY_LIMIT_MS = 30_000

function createPool() {
  const made = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    // Without a limit a request waits for a free connection for as long as the function lives, so one slow
    // moment piles every later request up behind it and the whole site appears frozen. Give up and let the
    // page retry instead.
    connectionTimeoutMillis: 10_000,
    // A statement whose answer never arrives (the database waking from sleep, a connection that died while
    // the server was paused) was awaited until the platform killed the request five minutes later. Every
    // "set the tables up once" promise waiting on it stayed pending too, so each page that needed those
    // tables showed its loader for those five minutes on that server. Failing instead lets them retry.
    query_timeout: QUERY_LIMIT_MS,
    keepAlive: true,
  })
  // A connection whose statement went unanswered can never serve another one: the next statement would queue
  // behind it and wait out the limit again (a transaction's ROLLBACK did exactly that). Marking it unusable
  // makes later statements on it fail at once and makes the pool close it instead of lending it out again.
  // `_queryable` and `_activeQuery` are the fields pg and pg-pool themselves read for this.
  made.on('connect', (client) => {
    const state = client as unknown as { _queryable?: boolean; query: (...args: unknown[]) => unknown }
    const run = state.query.bind(client)
    state.query = (...args: unknown[]) => {
      const result = run(...args)
      if (result instanceof Promise) {
        result.then(undefined, (error: unknown) => {
          if ((error as Error | null)?.message === 'Query read timeout') state._queryable = false
        })
      }
      return result
    }
  })
  // Code that borrows a connection for a transaction hands it back without saying whether it failed.
  made.on('release', (_error, client) => {
    const state = client as unknown as { _activeQuery?: unknown; _queryable?: boolean }
    if (state._activeQuery) state._queryable = false
  })
  return made
}

export const pool = globalForPool.alkankaPool ?? createPool()
if (process.env.NODE_ENV !== 'production') globalForPool.alkankaPool = pool

export const db = drizzle(pool)

export async function rows<T = Record<string, unknown>>(query: SQL): Promise<T[]> {
  const res = await db.execute(query)
  return res.rows as T[]
}

export { sql }
