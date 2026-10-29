import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'

const MAX_CANDIDATES = 5

/**
 * Turns whatever the user typed into candidate account emails.
 * Order: exact e-mail → exact username → e-mail local part (the bit before "@").
 * Several accounts can share a legacy username, so every match is a candidate
 * and the password decides which one is theirs.
 */
async function candidateEmails(identifier: string): Promise<string[]> {
  const value = identifier.normalize('NFC').trim()
  if (value.includes('@')) return [value.toLowerCase()]

  const byName = await pool.query<{ email: string }>(
    `SELECT email FROM "user" WHERE lower(trim(name)) = lower($1) ORDER BY "createdAt" ASC LIMIT ${MAX_CANDIDATES}`,
    [value],
  )
  if (byName.rows.length) return byName.rows.map((r) => r.email)

  const byLocalPart = await pool.query<{ email: string }>(
    `SELECT email FROM "user" WHERE lower(split_part(email, '@', 1)) = lower($1) ORDER BY "createdAt" ASC LIMIT ${MAX_CANDIDATES}`,
    [value],
  )
  return byLocalPart.rows.map((r) => r.email)
}

function signIn(req: Request, email: string, password: string) {
  const url = new URL('/api/auth/sign-in/email', req.url)
  const headers = new Headers(req.headers)
  headers.set('content-type', 'application/json')
  headers.delete('content-length')
  return auth.handler(new Request(url, { method: 'POST', headers, body: JSON.stringify({ email, password }) }))
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { identifier?: unknown; password?: unknown } | null
  const identifier = typeof body?.identifier === 'string' ? body.identifier.trim().slice(0, 200) : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!identifier || !password) {
    return Response.json({ code: 'INVALID', message: 'Kullanıcı adı/e-posta ve şifre gerekli.' }, { status: 400 })
  }

  const emails = await candidateEmails(identifier)
  if (!emails.length) {
    return Response.json({ code: 'INVALID_CREDENTIALS', message: 'Kullanıcı adı/e-posta veya şifre hatalı.' }, { status: 401 })
  }

  let last: Response | null = null
  for (const email of emails) {
    const res = await signIn(req, email, password)
    if (res.status === 403) {
      const err = (await res.clone().json().catch(() => null)) as { code?: string; message?: string } | null
      if (err?.code !== 'EMAIL_NOT_VERIFIED') {
        return Response.json(
          { code: 'ACCOUNT_SUSPENDED', message: err?.message || 'Hesabın dondurulmuş.' },
          { status: 423 },
        )
      }
      return Response.json({ code: 'EMAIL_NOT_VERIFIED', message: err.message }, { status: 403 })
    }
    // Success and rate limit are final answers; only a wrong password tries the next account.
    if (res.ok || res.status === 429) return res
    last = res
  }
  return last!
}
