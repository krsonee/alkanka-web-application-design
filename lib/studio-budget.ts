import 'server-only'
import { deleteContent, setContent } from '@/lib/content'
import { pool, rows, sql } from '@/lib/db'
import { ensureTables as ensureStudio } from '@/lib/studio'
import { usd } from '@/lib/studio-types'

export const STUDIO_BUDGET_KEY = 'studio:budget'

/** A job that never reports back (the function was cut off) stops counting after this long. Jobs run five minutes at most. */
const HOLD_MINUTES = 10
const BUDGET_LOCK = 8_153_041

const capOf = (value: { monthlyCap?: unknown } | null | undefined) => {
  const cap = Number(value?.monthlyCap)
  return Number.isFinite(cap) && cap > 0 ? cap : null
}

/** Read straight from the table: a failed read has to stop a paid job, not look like "no cap". */
export async function getStudioCap(): Promise<number | null> {
  const r = await rows<{ value: { monthlyCap?: unknown } | null }>(sql`SELECT value FROM site_content WHERE key = ${STUDIO_BUDGET_KEY}`)
  return capOf(r[0]?.value)
}

export async function saveStudioCap(cap: number | null) {
  if (cap == null) await deleteContent(STUDIO_BUDGET_KEY)
  else await setContent(STUDIO_BUDGET_KEY, { monthlyCap: cap })
}

/** `billed` is switched on by the job the moment the paid model call has answered. */
export type BudgetHold = { id: number | null; billed: boolean }

/**
 * Sets the job's cost aside before it starts. Jobs asking at the same moment are answered one at a time
 * and each sees what the others set aside, so together they cannot pass the cap. A free job holds nothing.
 */
export async function holdBudget(cost: number): Promise<{ hold: BudgetHold; error: null } | { hold: null; error: string }> {
  if (!(cost > 0)) return { hold: { id: null, billed: false }, error: null }
  try {
    await ensureStudio()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock($1)', [BUDGET_LOCK])
      const cap = capOf((await client.query(`SELECT value FROM site_content WHERE key = $1`, [STUDIO_BUDGET_KEY])).rows[0]?.value)
      const used = await client.query<{ spent: string }>(
        `SELECT (SELECT COALESCE(SUM(cost), 0) FROM studio_jobs WHERE created_at > date_trunc('month', now()))
           + (SELECT COALESCE(SUM(cost), 0) FROM studio_holds WHERE created_at > date_trunc('month', now())
                AND (kept OR created_at > now() - make_interval(mins => $1::int))) AS spent`,
        [HOLD_MINUTES],
      )
      const spent = Number(used.rows[0].spent)
      if (cap != null && spent + cost > cap + 1e-9) {
        await client.query('ROLLBACK')
        return {
          hold: null,
          error: `Bu üretim (~${usd(cost)}) Stüdyo'nun aylık tavanını aşıyor: bu ay ${usd(spent)} harcandı ya da şu an üretiliyor, tavan ${usd(cap)}. Tavanı ana yönetici Stüdyo ekranından değiştirebilir.`,
        }
      }
      const made = await client.query<{ id: string }>(`INSERT INTO studio_holds (cost) VALUES ($1) RETURNING id`, [cost])
      await client.query('COMMIT')
      return { hold: { id: Number(made.rows[0].id), billed: false }, error: null }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[studio:budget]', error)
    return { hold: null, error: 'Aylık harcama tavanı okunamadı, üretim başlatılmadı. Biraz sonra tekrar dene.' }
  }
}

/**
 * Ends a hold. `recorded`: the finished job carries the cost now. `failed`: the amount is given back, unless
 * the model had already been paid; then it stays in this month's spend with a note on what was lost.
 * Never throws: a hold that could not be closed simply stops counting after a few minutes.
 */
export async function closeHold(hold: BudgetHold, outcome: 'recorded' | 'failed', note = '') {
  const id = hold.id
  if (id == null) return
  hold.id = null
  try {
    if (outcome === 'failed' && hold.billed) {
      await rows(sql`UPDATE studio_holds SET kept = true, note = ${note.slice(0, 200)} WHERE id = ${id}`)
    } else {
      await rows(sql`DELETE FROM studio_holds WHERE id = ${id}`)
    }
  } catch (error) {
    console.error('[studio:budget] ayrılan tutar kapatılamadı', id, error)
  }
}
