import 'server-only'
import { cache } from 'react'
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { rows, sql } from '@/lib/db'
import { cleanPermissions, PANEL_MODULES, type PanelModule } from '@/lib/panel-modules'

export const PANEL_COOKIE = 'alk_panel'
const SESSION_HOURS = 12
const MAX_FAILS = 8
const FAIL_WINDOW_MIN = 15

export type PanelAccountRow = {
  id: number
  username: string
  display_name: string
  password_hash: string | null
  is_owner: boolean
  permissions: unknown
  totp_secret: string | null
  totp_pending: string | null
  totp_enabled: boolean
  totp_required: boolean
  backup_codes: unknown
  active: boolean
  session_version: number
  created_at: string
  last_login_at: string | null
}

export type PanelSession = {
  id: number
  username: string
  displayName: string
  isOwner: boolean
  permissions: PanelModule[]
  totpEnabled: boolean
  totpRequired: boolean
}

function signingKey() {
  const a = process.env.ADMIN_PASSWORD ?? ''
  const b = process.env.BETTER_AUTH_SECRET ?? ''
  if (!a && !b) return null
  return createHash('sha256').update(`${a}|${b}|alkanka-panel-session`).digest()
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function hashPassword(password: string) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

export function verifyPassword(password: string, stored: string | null) {
  if (!stored?.startsWith('scrypt$')) return false
  const [, salt, hash] = stored.split('$')
  const expected = Buffer.from(hash, 'base64url')
  const actual = scryptSync(password, Buffer.from(salt, 'base64url'), expected.length)
  return timingSafeEqual(expected, actual)
}

export function ownerPasswordMatches(input: string) {
  const secret = process.env.ADMIN_PASSWORD
  return Boolean(secret) && safeEqual(input, secret!)
}

export function sessionValue(account: Pick<PanelAccountRow, 'id' | 'session_version'>) {
  const key = signingKey()
  if (!key) return null
  const exp = Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600
  const body = `${account.id}.${account.session_version}.${exp}`
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`
}

export async function setSessionCookie(account: Pick<PanelAccountRow, 'id' | 'session_version'>) {
  const value = sessionValue(account)
  if (!value) throw new Error('Panel anahtarı ayarlı değil (ADMIN_PASSWORD).')
  ;(await cookies()).set(PANEL_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.delete(PANEL_COOKIE)
  jar.delete('alk_admin')
}

export function toSession(row: PanelAccountRow): PanelSession {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    isOwner: row.is_owner,
    permissions: row.is_owner ? PANEL_MODULES.map((m) => m.id) : cleanPermissions(row.permissions),
    totpEnabled: row.totp_enabled,
    totpRequired: row.totp_required,
  }
}

export async function accountById(id: number) {
  const [row] = await rows<PanelAccountRow>(sql`SELECT * FROM panel_accounts WHERE id = ${id}`)
  return row ?? null
}

export async function accountByUsername(username: string) {
  const [row] = await rows<PanelAccountRow>(sql`SELECT * FROM panel_accounts WHERE lower(username) = lower(${username})`)
  return row ?? null
}

export const getPanelSession = cache(async (): Promise<PanelSession | null> => {
  const key = signingKey()
  if (!key) return null
  const value = (await cookies()).get(PANEL_COOKIE)?.value
  if (!value) return null
  const parts = value.split('.')
  if (parts.length !== 4) return null
  const [id, ver, exp, sig] = parts
  const expected = createHmac('sha256', key).update(`${id}.${ver}.${exp}`).digest('base64url')
  if (!safeEqual(sig, expected)) return null
  if (Number(exp) * 1000 < Date.now()) return null
  try {
    const row = await accountById(Number(id))
    if (!row || !row.active || row.session_version !== Number(ver)) return null
    if (row.is_owner && !process.env.ADMIN_PASSWORD) return null
    return toSession(row)
  } catch (error) {
    console.error('[panel-session]', error)
    return null
  }
})

export async function canPanel(module: PanelModule) {
  const session = await getPanelSession()
  return Boolean(session && (session.isOwner || session.permissions.includes(module)))
}

export async function canPanelAny(modules: PanelModule[]) {
  const session = await getPanelSession()
  return Boolean(session && (session.isOwner || modules.some((m) => session.permissions.includes(m))))
}

export async function isPanelOwner() {
  return Boolean((await getPanelSession())?.isOwner)
}

async function clientIp() {
  const h = await headers()
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim().slice(0, 64)
}

export async function loginBlocked(username: string) {
  const ip = await clientIp()
  const [row] = await rows<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM panel_login_attempts
    WHERE key IN (${`u:${username.toLowerCase()}`}, ${`ip:${ip}`}) AND at > now() - make_interval(mins => ${FAIL_WINDOW_MIN})
  `)
  return (row?.n ?? 0) >= MAX_FAILS
}

export async function recordFailedLogin(username: string) {
  const ip = await clientIp()
  await rows(sql`INSERT INTO panel_login_attempts (key) VALUES (${`u:${username.toLowerCase()}`}), (${`ip:${ip}`})`)
  await rows(sql`DELETE FROM panel_login_attempts WHERE at < now() - interval '1 day'`)
}

export async function clearFailedLogins(username: string) {
  await rows(sql`DELETE FROM panel_login_attempts WHERE key = ${`u:${username.toLowerCase()}`}`)
}
