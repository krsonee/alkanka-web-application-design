import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'

async function resolveEmail(identifier: string) {
  if (identifier.includes('@')) return { email: identifier.toLowerCase() }
  const { rows } = await pool.query<{ email: string }>(
    'SELECT email FROM "user" WHERE lower(name) = lower($1) LIMIT 2',
    [identifier],
  )
  if (rows.length === 1) return { email: rows[0].email }
  if (rows.length > 1) return { ambiguous: true as const }
  return { missing: true as const }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { identifier?: unknown; password?: unknown } | null
  const identifier = typeof body?.identifier === 'string' ? body.identifier.trim().slice(0, 200) : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!identifier || !password) {
    return Response.json({ code: 'INVALID', message: 'Kullanıcı adı/e-posta ve şifre gerekli.' }, { status: 400 })
  }

  const resolved = await resolveEmail(identifier)
  if ('ambiguous' in resolved) {
    return Response.json(
      { code: 'AMBIGUOUS', message: 'Bu kullanıcı adı birden fazla hesapta var, lütfen e-posta adresinle giriş yap.' },
      { status: 409 },
    )
  }
  if ('missing' in resolved) {
    return Response.json({ code: 'INVALID_CREDENTIALS', message: 'Kullanıcı adı/e-posta veya şifre hatalı.' }, { status: 401 })
  }

  const url = new URL('/api/auth/sign-in/email', req.url)
  const headers = new Headers(req.headers)
  headers.set('content-type', 'application/json')
  headers.delete('content-length')
  return auth.handler(
    new Request(url, { method: 'POST', headers, body: JSON.stringify({ email: resolved.email, password }) }),
  )
}
