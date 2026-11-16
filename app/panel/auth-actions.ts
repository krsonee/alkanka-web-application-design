'use server'

import { passwordProblem } from '@/lib/panel-password'

import QRCode from 'qrcode'
import { revalidatePath } from 'next/cache'
import { rows, sql } from '@/lib/db'
import {
  accountById,
  accountByUsername,
  clearFailedLogins,
  clearSessionCookie,
  clientIp,
  getPanelSession,
  hashPassword,
  loginBlocked,
  ownerPasswordMatches,
  recordFailedLogin,
  setPendingLogin,
  setSessionCookie,
  takePendingLogin,
  verifyPassword,
  type PanelAccountRow,
} from '@/lib/panel-auth'
import { decryptSecret, encryptSecret, hashBackupCode, newBackupCodes, newTotpSecret, otpauthUrl, verifyTotp } from '@/lib/totp'
import { cleanPermissions, PANEL_MODULES } from '@/lib/panel-modules'
import { LOGIN_ACTION, loggedRecently, logPanel } from '@/lib/panel-log'

const NOT_SIGNED_IN = 'Giriş yapılmadı'
const actorOf = (row: Pick<PanelAccountRow, 'username' | 'display_name'>) => `${row.display_name || row.username} (@${row.username})`
const moduleLabel = (id: string) => PANEL_MODULES.find((m) => m.id === id)?.label ?? id

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
  await logPanel('auth', LOGIN_ACTION, null, null, actorOf(row))
  revalidatePath('/panel')
}

export async function panelLogin(_: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get('username') ?? 'admin').trim().slice(0, 32) || 'admin'
  const password = String(form.get('password') ?? '')
  const code = String(form.get('code') ?? '').trim().slice(0, 20)
  // The typed name is only written to the log when it belongs to a real account: people sometimes
  // type their password into the username box, and that must not end up readable in the log.
  const fail = async (message: string, step: LoginState['step'] = 'password', account: string | null = null): Promise<LoginState> => {
    await recordFailedLogin(username).catch(() => {})
    await logPanel('auth', 'Hatalı giriş denemesi', account ? `@${account}` : 'Bilinmeyen kullanıcı adı', message, NOT_SIGNED_IN)
    return { step, message }
  }

  try {
    if (await loginBlocked(username)) {
      const address = `Adres ${await clientIp()}`
      if (!(await loggedRecently('auth', 'Giriş kilitlendi', address, 15))) {
        await logPanel('auth', 'Giriş kilitlendi', address, 'Çok fazla hatalı deneme; bu adresten 15 dakika giriş yapılamaz.', NOT_SIGNED_IN)
      }
      return { message: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar dene.' }
    }
    const row = await accountByUsername(username)
    if (!row || !row.active) return fail('Kullanıcı adı veya şifre yanlış.', 'password', row?.username ?? null)
    const passwordOk = row.is_owner ? ownerPasswordMatches(password) : verifyPassword(password, row.password_hash)
    if (!passwordOk) return fail('Kullanıcı adı veya şifre yanlış.', 'password', row.username)

    if (row.totp_enabled && row.totp_secret) {
      if (!code) return { step: 'totp' }
      const ok = verifyTotp(decryptSecret(row.totp_secret), code) || (await useBackupCode(row, code))
      if (!ok) return fail('Doğrulama kodu yanlış.', 'totp', row.username)
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
        await logPanel('auth', 'Hatalı giriş denemesi', `@${row.username}`, '2FA kurulum kodu yanlış.', NOT_SIGNED_IN)
        return { step: 'enroll', secret: pending, qr: await qrFor(pending, row.username), message: 'Kod yanlış. Uygulamadaki güncel 6 haneli kodu gir.' }
      }
      await rows(sql`UPDATE panel_accounts SET totp_secret = totp_pending, totp_pending = NULL, totp_enabled = true WHERE id = ${row.id}`)
      const codes = await issueBackupCodes(row.id)
      // The session starts in panelLoginFinish, once the codes have been seen.
      await clearFailedLogins(row.username)
      await setPendingLogin(row)
      await logPanel('account', 'İki adımlı doğrulama açıldı', null, 'İlk girişte kuruldu', actorOf(row))
      return { step: 'backup', codes }
    }

    await finishLogin(row)
    return {}
  } catch (error) {
    console.error('[panel-login]', error)
    return { message: 'Giriş yapılamadı. Biraz sonra tekrar dene.' }
  }
}

export async function panelLoginFinish(): Promise<{ error?: string }> {
  try {
    const row = await takePendingLogin()
    if (!row) return { error: 'Bekleme süresi doldu. Sayfayı yenile; kullanıcı adın, şifren ve uygulamadaki kodla gir.' }
    await finishLogin(row)
    return {}
  } catch (error) {
    console.error('[panel-login]', error)
    return { error: 'Giriş yapılamadı. Biraz sonra tekrar dene.' }
  }
}

export async function panelLogout() {
  if (await getPanelSession()) await logPanel('auth', 'Panelden çıkış yapıldı')
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
    await logPanel('account', 'İki adımlı doğrulama açıldı')
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
    await logPanel('account', 'İki adımlı doğrulama kapatıldı')
    return 'İki adımlı doğrulama kapatıldı.'
  })
}

export async function regenerateBackupCodes(code: string): Promise<{ ok: true; codes: string[] } | { ok: false; error: string }> {
  try {
    const session = await me()
    const row = await accountById(session.id)
    if (!row?.totp_enabled || !row.totp_secret) return { ok: false, error: 'Önce iki adımlı doğrulamayı aç.' }
    if (!verifyTotp(decryptSecret(row.totp_secret), code)) return { ok: false, error: 'Kod yanlış.' }
    const codes = await issueBackupCodes(row.id)
    await logPanel('account', 'Yedek kodlar yenilendi')
    return { ok: true, codes }
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
    const weak = passwordProblem(next, row.username)
    if (weak) throw new Error(weak)
    if (next === current) throw new Error('Yeni şifre eskisiyle aynı olamaz.')
    const [updated] = await rows<PanelAccountRow>(sql`
      UPDATE panel_accounts SET password_hash = ${hashPassword(next)}, session_version = session_version + 1 WHERE id = ${row.id} RETURNING *
    `)
    await setSessionCookie(updated)
    await logPanel('account', 'Şifre değiştirildi', null, 'Diğer cihazlardaki oturumlar kapatıldı')
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
    const granted = cleanPermissions(input.permissions)
    if (granted.length === 0 && input.active !== false) throw new Error('En az bir bölüm seç. Hiçbir bölüme giremeyen hesap panelde boş ekran görür.')
    const permissions = JSON.stringify(granted)
    const password = String(input.password ?? '')
    if (input.id) {
      const row = await accountById(Number(input.id))
      if (!row) throw new Error('Hesap bulunamadı.')
      if (row.is_owner) throw new Error('Ana yönetici hesabı buradan düzenlenmez.')
      const weak = password ? passwordProblem(password, username) : null
      if (weak) throw new Error(weak)
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
      const had = cleanPermissions(row.permissions)
      const has = cleanPermissions(input.permissions)
      const changes = [
        displayName !== row.display_name ? `ad: ${displayName || '(boş)'}` : '',
        ...has.filter((p) => !had.includes(p)).map((p) => `+${moduleLabel(p)}`),
        ...had.filter((p) => !has.includes(p)).map((p) => `-${moduleLabel(p)}`),
        password ? 'şifre değişti' : '',
        row.active !== Boolean(input.active) ? (input.active ? 'aktif yapıldı' : 'pasif yapıldı') : '',
        row.totp_required !== Boolean(input.totpRequired) ? (input.totpRequired ? '2FA zorunlu yapıldı' : '2FA zorunluluğu kaldırıldı') : '',
      ].filter(Boolean)
      await logPanel('staff', 'Personel hesabı güncellendi', `@${row.username}`, changes.join(' · ') || 'Değişiklik yok')
      return 'Hesap güncellendi.'
    }
    if (!USERNAME_RE.test(username)) throw new Error('Kullanıcı adı 3-32 karakter olmalı; harf, rakam, nokta, alt çizgi veya tire.')
    if (username === 'admin') throw new Error('"admin" ana yöneticiye ayrılmış.')
    const weak = passwordProblem(password, username)
    if (weak) throw new Error(weak)
    if (await accountByUsername(username)) throw new Error('Bu kullanıcı adı zaten var.')
    await rows(sql`
      INSERT INTO panel_accounts (username, display_name, password_hash, permissions, totp_required, active)
      VALUES (${username}, ${displayName}, ${hashPassword(password)}, ${permissions}::jsonb, ${Boolean(input.totpRequired)}, ${Boolean(input.active)})
    `)
    await logPanel('staff', 'Personel hesabı açıldı', `@${username}`, `${granted.length} bölüm${granted.length ? `: ${granted.map(moduleLabel).join(', ')}` : ''}${input.totpRequired ? ' · 2FA zorunlu' : ''}`)
    return 'Personel hesabı oluşturuldu.'
  })
}

export async function setAccountTotpRequired(id: number, required: boolean): Promise<Result> {
  return run(async () => {
    await owner()
    await rows(sql`UPDATE panel_accounts SET totp_required = ${required} WHERE id = ${id}`)
    const row = await accountById(id)
    await logPanel('staff', required ? '2FA zorunlu yapıldı' : '2FA zorunluluğu kaldırıldı', row ? `@${row.username}` : `Hesap #${id}`)
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
    const row = await accountById(id)
    await logPanel('staff', 'Personelin 2FA ayarı sıfırlandı', row ? `@${row.username}` : `Hesap #${id}`, 'Açık oturumları kapatıldı')
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
    await logPanel('staff', 'Personel hesabı silindi', `@${row.username}`, row.display_name || null)
    return 'Hesap silindi.'
  })
}
