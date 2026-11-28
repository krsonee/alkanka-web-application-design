import 'server-only'
import { randomBytes } from 'node:crypto'
import { auth } from '@/lib/auth'
import { rows, sql } from '@/lib/db'
import { logPanel } from '@/lib/panel-log'

export const RESET_LINK_MINUTES = 15
const MIN_PASSWORD = 8
const MAX_PASSWORD = 128
const MAX_NAME = 40

/** Members reset their password on the public site, never on the panel's own address. */
function siteBase() {
  if (process.env.NODE_ENV === 'production') return 'https://alkanka.com'
  return process.env.BETTER_AUTH_URL ?? process.env.V0_RUNTIME_URL ?? 'http://localhost:3000'
}

async function labelOf(userId: string) {
  const [u] = await rows<{ name: string | null; email: string }>(sql`SELECT name, email FROM public."user" WHERE id = ${userId}`)
  if (!u) throw new Error('Üye bulunamadı.')
  return `${u.name ?? 'Adsız'} (${u.email})`
}

const dropResetLinks = (userId: string) =>
  rows(sql`DELETE FROM verification WHERE identifier LIKE 'reset-password:%' AND value = ${userId}`).catch(() => null)

/**
 * A single-use address where the member picks a new password. Asking again cancels the earlier one,
 * so only the newest link ever works. `by` names who asked for it in the panel log.
 */
export async function createResetLink(userId: string, by?: string) {
  const label = await labelOf(userId)
  const ctx = await auth.$context
  const token = randomBytes(24).toString('base64url')
  await dropResetLinks(userId)
  await ctx.internalAdapter.createVerificationValue({
    value: userId,
    identifier: `reset-password:${token}`,
    expiresAt: new Date(Date.now() + RESET_LINK_MINUTES * 60_000),
  })
  await logPanel('users', 'Şifre yenileme bağlantısı üretildi', label, `${RESET_LINK_MINUTES} dakika geçerli, tek kullanımlık`, by)
  return `${siteBase()}/sifre-sifirla?token=${token}`
}

/** Sets the password staff typed, signs the member out everywhere and cancels any reset link still open. */
export async function setMemberPassword(userId: string, password: string) {
  const clean = String(password ?? '')
  if (clean.length < MIN_PASSWORD) throw new Error(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`)
  if (clean.length > MAX_PASSWORD) throw new Error(`Şifre en fazla ${MAX_PASSWORD} karakter olabilir.`)
  const label = await labelOf(userId)
  const ctx = await auth.$context
  const hash = await ctx.password.hash(clean)
  const accounts = await ctx.internalAdapter.findAccounts(userId)
  if (accounts.some((a) => a.providerId === 'credential')) await ctx.internalAdapter.updatePassword(userId, hash)
  else await ctx.internalAdapter.createAccount({ userId, providerId: 'credential', accountId: userId, password: hash })
  await rows(sql`DELETE FROM session WHERE "userId" = ${userId}`)
  await dropResetLinks(userId)
  await logPanel('users', 'Üyenin şifresi değiştirildi', label, 'Tüm oturumları kapatıldı')
}

export type MemberInfoInput = { name: string; email: string; phone: string }

/** Changes the member's user name, e-mail and phone; returns the lines that changed. */
export async function updateMemberInfo(userId: string, input: MemberInfoInput) {
  const [current] = await rows<{ name: string | null; email: string; phone: string | null }>(
    sql`SELECT name, email, phone FROM public."user" WHERE id = ${userId}`,
  )
  if (!current) throw new Error('Üye bulunamadı.')

  const name = String(input.name ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
  if (name.length < 3 || name.includes('@')) throw new Error('Kullanıcı adı en az 3 karakter olmalı ve @ içermemeli.')
  if (name.length > MAX_NAME) throw new Error(`Kullanıcı adı en fazla ${MAX_NAME} karakter olabilir.`)
  const email = String(input.email ?? '').trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Geçerli bir e-posta adresi yaz.')
  const phone = String(input.phone ?? '').replace(/[^\d+]/g, '').slice(0, 16) || null

  const changed: string[] = []
  if (name !== (current.name ?? '')) changed.push(`Kullanıcı adı: ${current.name ?? '—'} → ${name}`)
  if (email !== current.email.toLowerCase()) changed.push(`E-posta: ${current.email} → ${email}`)
  if (phone !== (current.phone || null)) changed.push(`Telefon: ${current.phone || '—'} → ${phone ?? '—'}`)
  if (!changed.length) return changed

  const taken = await rows<{ name_taken: boolean; email_taken: boolean }>(sql`SELECT
    EXISTS (SELECT 1 FROM public."user" WHERE lower(trim(name)) = lower(${name}) AND id <> ${userId}) AS name_taken,
    EXISTS (SELECT 1 FROM public."user" WHERE lower(email) = ${email} AND id <> ${userId}) AS email_taken`)
  if (taken[0]?.name_taken) throw new Error('Bu kullanıcı adı başka bir üyede.')
  if (taken[0]?.email_taken) throw new Error('Bu e-posta başka bir üyede kayıtlı.')

  await rows(sql`UPDATE public."user" SET name = ${name}, email = ${email}, phone = ${phone}, "updatedAt" = now() WHERE id = ${userId}`)
  await logPanel('users', 'Üyelik bilgileri değiştirildi', `${name} (${email})`, changed.join(' · '))
  return changed
}
