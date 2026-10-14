'use server'

import QRCode from 'qrcode'
import { revalidatePath } from 'next/cache'
import { rows, sql } from '@/lib/db'
import {
  accountById,
  accountByUsername,
  clearFailedLogins,
  clearSessionCookie,
  getPanelSession,
  hashPassword,
  loginBlocked,
  ownerPasswordMatches,
  recordFailedLogin,
  setSessionCookie,
  verifyPassword,
  type PanelAccountRow,
} from '@/lib/panel-auth'
import { decryptSecret, encryptSecret, hashBackupCode, newBackupCodes, newTotpSecret, otpauthUrl, verifyTotp } from '@/lib/totp'
import { cleanPermissions } from '@/lib/panel-modules'

export type LoginState = {
  step?: 'password' | 'totp' | 'enroll' | 'backup'
  message?: string
  qr?: string
  secret?: string
  codes?: string[]
}

export type Result = { ok: true; message?: string } | { ok: false; error: string }

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/i

async function qrFor(secret: string, username: string) {
  return QRCode.toDataURL(otpauthUrl(secret, username), { margin: 1, width: 220 })
}

function storedBackupCodes(row: PanelAccountRow) {
  return Array.isArray(row.backup_codes) ? (row.backup_codes as unknown[]).map(String) : []
}

async function useBackupCode(row: PanelAccountRow, input: string) {
  const hash = hashBackupCode(input)
  const codes = storedBackupCodes(row)
  if (!codes.includes(hash)) return false
  const left = codes.filter((c) => c !== hash)
  await rows(sql`UPDATE panel_accounts SET backup_codes = ${JSON.stringify(left)}::jsonb WHERE id = ${row.id}`)
  return true
}

async function issueBackupCodes(id: number) {
  const codes = newBackupCodes()
  await rows(sql`UPDATE panel_accounts SET backup_codes = ${JSON.stringify(codes.map(hashBackupCode))}::jsonb WHERE id = ${id}`)
  return codes
}

async function finishLogin(row: PanelAccountRow) {
  await clearFailedLogins(row.username)
  await rows(sql`UPDATE panel_accounts SET last_login_at = now() WHERE id = ${row.id}`)
  await setSessionCookie(row)
  revalidatePath('/panel')
}

export async function panelLogin(_: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get('username') ?? 'admin').trim().slice(0, 32) || 'admin'
  const password = String(form.get('password') ?? '')
  const code = String(form.get('code') ?? '').trim().slice(0, 20)
  const fail = async (message: string, step: LoginState['step'] = 'password'): Promise<LoginState> => {
    await recordFailedLogin(username).catch(() => {})
    return { step, message }
  }

  try {
    if (await loginBlocked(username)) return { message: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar dene.' }
    const row = await accountByUsername(username)
    if (!row || !row.active) return fail('Kullanıcı adı veya şifre yanlış.')
    const passwordOk = row.is_owner ? ownerPasswordMatches(password) : verifyPassword(password, row.password_hash)
    if (!passwordOk) return fail('Kullanıcı adı veya şifre yanlış.')

    if (row.totp_enabled && row.totp_secret) {
      if (!code) return { step: 'totp' }
      const ok = verifyTotp(decryptSecret(row.totp_secret), code) || (await useBackupCode(row, code))
      if (!ok) return fail('Doğrulama kodu yanlış.', 'totp')
      await finishLogin(row)
      return {}
    }

    if (row.totp_required) {
      let pending = row.totp_pending ? decryptSecret(row.totp_pending) : null
      if (!pending || !code) {
        if (!pending) {
          pending = newTotpSecret()
          await rows(sql`UPDATE panel_accounts SET totp_pending = ${encryptSecret(pending)} WHERE id = ${row.id}`)
        }
        return { step: 'enroll', secret: pending, qr: await qrFor(pending, row.username) }
      }
      if (!verifyTotp(pending, code)) {
        await recordFailedLogin(username).catch(() => {})
        return { step: 'enroll', secret: pending, qr: await qrFor(pending, row.username), message: 'Kod yanlış. Uygulamadaki güncel 6 haneli kodu gir.' }
      }
      await rows(sql`UPDATE panel_accounts SET totp_secret = totp_pending, totp_pending = NULL, totp_enabled = true WHERE id = ${row.id}`)
      const codes = await issueBackupCodes(row.id)
      await finishLogin(row)
      return { step: 'backup', codes }
    }

    await finishLogin(row)
    return {}
  } catch (error) {
    console.error('[panel-login]', error)
    return { message: 'Giriş yapılamadı. Biraz sonra tekrar dene.' }
  }
}

export async function panelLogout() {
  await clearSessionCookie()
  revalidatePath('/panel')
}

async function me() {
  const session = await getPanelSession()
  if (!session) throw new Error('Oturum süresi doldu, tekrar giriş yap.')
  return session
}

async function owner() {
  const session = await me()
  if (!session.isOwner) throw new Error('Bu işlemi sadece ana yönetici yapabilir.')
  return session
}

async function run(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const message = await fn()
    revalidatePath('/panel')
    return { ok: true, message: message || 'Kaydedildi.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem yapılamadı.' }
  }
}

export async function startTotpSetup(): Promise<{ ok: true; qr: string; secret: string } | { ok: false; error: string }> {
  try {
    const session = await me()
    const secret = newTotpSecret()
    await rows(sql`UPDATE panel_accounts SET totp_pending = ${encryptSecret(secret)} WHERE id = ${session.id}`)
    return { ok: true, secret, qr: await qrFor(secret, session.username) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Başlatılamadı.' }
  }
}

export async function confirmTotpSetup(code: string): Promise<{ ok: true; codes: string[] } | { ok: false; error: string }> {
  try {
    const session = await me()
    const row = await accountById(session.id)
    if (!row?.totp_pending) return { ok: false, error: 'Önce kurulumu başlat.' }
    if (!verifyTotp(decryptSecret(row.totp_pending), code)) return { ok: false, error: 'Kod yanlış. Uygulamadaki güncel kodu gir.' }
    await rows(sql`UPDATE panel_accounts SET totp_secret = totp_pending, totp_pending = NULL, totp_enabled = true WHERE id = ${row.id}`)
    const codes = await issueBackupCodes(row.id)
    revalidatePath('/panel')
    return { ok: true, codes }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Doğrulanamadı.' }
  }
}

export async function disableOwnTotp(code: string): Promise<Result> {
  return run(async () => {
    const session = await me()
    const row = await accountById(session.id)
    if (!row?.totp_enabled || !row.totp_secret) throw new Error('İki adımlı doğrulama zaten kapalı.')
    if (row.totp_required) throw new Error('Bu hesapta iki adımlı doğrulama zorunlu. Kapatmak için ana yöneticiye yaz.')
    if (!verifyTotp(decryptSecret(row.totp_secret), code)) throw new Error('Kod yanlış.')
    await rows(sql`UPDATE panel_accounts SET totp_enabled = false, totp_secret = NULL, backup_codes = '[]'::jsonb WHERE id = ${row.id}`)
    return 'İki adımlı doğrulama kapatıldı.'
  })
}

export async function regenerateBackupCodes(code: string): Promise<{ ok: true; codes: string[] } | { ok: false; error: string }> {
  try {
    const session = await me()
    const row = await accountById(session.id)
    if (!row?.totp_enabled || !row.totp_secret) return { ok: false, error: 'Önce iki adımlı doğrulamayı aç.' }
    if (!verifyTotp(decryptSecret(row.totp_secret), code)) return { ok: false, error: 'Kod yanlış.' }
    return { ok: true, codes: await issueBackupCodes(row.id) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Oluşturulamadı.' }
  }
}

export async function changeOwnPassword(current: string, next: string): Promise<Result> {
  return run(async () => {
    const session = await me()
    if (session.isOwner) throw new Error('Ana yönetici şifresi ADMIN_PASSWORD ortam değişkeninden gelir. Vercel > Settings > Environment Variables bölümünden değiştir.')
    const row = await accountById(session.id)
    if (!row || !verifyPassword(current, row.password_hash)) throw new Error('Mevcut şifre yanlış.')
    if (next.length < 10) throw new Error('Yeni şifre en az 10 karakter olmalı.')
    const [updated] = await rows<PanelAccountRow>(sql`
      UPDATE panel_accounts SET password_hash = ${hashPassword(next)}, session_version = session_version + 1 WHERE id = ${row.id} RETURNING *
    `)
    await setSessionCookie(updated)
    return 'Şifre değişti.'
  })
}

export type StaffInput = {
  id?: number
  username: string
  displayName: string
  password?: string
  permissions: string[]
  totpRequired: boolean
  active: boolean
}

export async function saveStaffAccount(input: StaffInput): Promise<Result> {
  return run(async () => {
    await owner()
    const username = String(input.username ?? '').trim().toLowerCase()
    const displayName = String(input.displayName ?? '').trim().slice(0, 40)
    const permissions = JSON.stringify(cleanPermissions(input.permissions))
    const password = String(input.password ?? '')
    if (input.id) {
      const row = await accountById(Number(input.id))
      if (!row) throw new Error('Hesap bulunamadı.')
      if (row.is_owner) throw new Error('Ana yönetici hesabı buradan düzenlenmez.')
      if (password && password.length < 10) throw new Error('Şifre en az 10 karakter olmalı.')
      const deactivated = row.active && !input.active
      await rows(sql`
        UPDATE panel_accounts SET
          display_name = ${displayName},
          permissions = ${permissions}::jsonb,
          totp_required = ${Boolean(input.totpRequired)},
          active = ${Boolean(input.active)},
          password_hash = COALESCE(${password ? hashPassword(password) : null}, password_hash),
          session_version = session_version + ${password || deactivated ? 1 : 0}
        WHERE id = ${row.id}
      `)
      return 'Hesap güncellendi.'
    }
    if (!USERNAME_RE.test(username)) throw new Error('Kullanıcı adı 3-32 karakter olmalı; harf, rakam, nokta, alt çizgi veya tire.')
    if (username === 'admin') throw new Error('"admin" ana yöneticiye ayrılmış.')
    if (password.length < 10) throw new Error('Şifre en az 10 karakter olmalı.')
    if (await accountByUsername(username)) throw new Error('Bu kullanıcı adı zaten var.')
    await rows(sql`
      INSERT INTO panel_accounts (username, display_name, password_hash, permissions, totp_required, active)
      VALUES (${username}, ${displayName}, ${hashPassword(password)}, ${permissions}::jsonb, ${Boolean(input.totpRequired)}, ${Boolean(input.active)})
    `)
    return 'Personel hesabı oluşturuldu.'
  })
}

export async function setAccountTotpRequired(id: number, required: boolean): Promise<Result> {
  return run(async () => {
    await owner()
    await rows(sql`UPDATE panel_accounts SET totp_required = ${required} WHERE id = ${id}`)
    return required ? 'Bu hesapta 2FA zorunlu yapıldı. Bir sonraki girişte kurulum istenecek.' : '2FA zorunluluğu kaldırıldı.'
  })
}

export async function resetAccountTotp(id: number): Promise<Result> {
  return run(async () => {
    const session = await owner()
    if (id === session.id) throw new Error('Kendi 2FA ayarını "Hesabım" bölümünden yönet.')
    await rows(sql`
      UPDATE panel_accounts SET totp_enabled = false, totp_secret = NULL, totp_pending = NULL, backup_codes = '[]'::jsonb, session_version = session_version + 1
      WHERE id = ${id}
    `)
    return '2FA sıfırlandı. Hesap bir sonraki girişte yeniden kurar.'
  })
}

export async function deleteStaffAccount(id: number): Promise<Result> {
  return run(async () => {
    await owner()
    const row = await accountById(id)
    if (!row) throw new Error('Hesap bulunamadı.')
    if (row.is_owner) throw new Error('Ana yönetici silinemez.')
    await rows(sql`DELETE FROM panel_accounts WHERE id = ${id}`)
    return 'Hesap silindi.'
  })
}
