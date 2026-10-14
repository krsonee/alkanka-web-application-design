'use client'

import { useState, useTransition } from 'react'
import { ShieldCheck } from 'lucide-react'
import { changeOwnPassword, confirmTotpSetup, disableOwnTotp, regenerateBackupCodes, startTotpSetup } from '@/app/panel/auth-actions'
import { cn } from '@/lib/utils'

const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary'
const btn = 'h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60'

export function AccountSettings({
  username,
  isOwner,
  totpEnabled,
  totpRequired,
}: {
  username: string
  isOwner: boolean
  totpEnabled: boolean
  totpRequired: boolean
}) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [code, setCode] = useState('')
  const [pw, setPw] = useState({ current: '', next: '' })

  const show = (res: { ok: boolean; error?: string; message?: string }, okText = 'Kaydedildi.') =>
    setMsg(res.ok ? { ok: true, text: res.message ?? okText } : { ok: false, text: res.error ?? 'Olmadı.' })

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {msg && (
        <p className={cn('text-sm', msg.ok ? 'text-success' : 'text-destructive')} aria-live="polite">
          {msg.text}
        </p>
      )}

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className={cn('size-5', totpEnabled ? 'text-success' : 'text-muted-foreground')} aria-hidden="true" />
          <h2 className="font-semibold text-foreground">İki adımlı doğrulama (2FA)</h2>
          <span className={cn('ml-auto rounded-md px-2 py-1 text-xs font-semibold', totpEnabled ? 'bg-success/15 text-success' : 'bg-secondary text-muted-foreground')}>
            {totpEnabled ? 'Açık' : 'Kapalı'}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Telefonuna Google Authenticator kur. Açınca girişte şifreden sonra uygulamadaki 6 haneli kod sorulur. Telefonu kaybedersen yedek kodlarla girersin.
        </p>

        {codes && (
          <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
            <p className="text-sm font-semibold text-foreground">Yedek kodların (her biri bir kez kullanılır). Bunları güvenli bir yere yaz:</p>
            <ul className="grid grid-cols-2 gap-1 font-mono text-sm text-foreground sm:grid-cols-4">
              {codes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <button type="button" onClick={() => setCodes(null)} className="self-start text-xs font-semibold text-primary">
              Yazdım, gizle
            </button>
          </div>
        )}

        {!totpEnabled && !setup && (
          <button
            type="button"
            disabled={pending}
            className={cn(btn, 'self-start')}
            onClick={() =>
              start(async () => {
                const res = await startTotpSetup()
                if (res.ok) {
                  setSetup({ qr: res.qr, secret: res.secret })
                  setMsg(null)
                } else show(res)
              })
            }
          >
            Etkinleştir
          </button>
        )}

        {!totpEnabled && setup && (
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-start"
            onSubmit={(e) => {
              e.preventDefault()
              start(async () => {
                const res = await confirmTotpSetup(code)
                if (res.ok) {
                  setCodes(res.codes)
                  setSetup(null)
                  setCode('')
                  setMsg({ ok: true, text: 'İki adımlı doğrulama açıldı.' })
                } else show(res)
              })
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr || '/placeholder.svg'} alt="Google Authenticator ile okutulacak QR kod" width={180} height={180} className="rounded-lg bg-foreground p-2" />
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-sm text-foreground">1. Uygulamada + ile QR kodu okut.</p>
              <p className="text-xs text-muted-foreground">
                Okutamıyorsan elle gir: <span className="break-all font-mono text-foreground">{setup.secret}</span>
              </p>
              <label className="flex flex-col gap-1 text-sm text-foreground">
                2. Uygulamadaki 6 haneli kodu yaz
                <input
                  className={field}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                />
              </label>
              <button type="submit" disabled={pending || code.length !== 6} className={cn(btn, 'self-start')}>
                Doğrula ve aç
              </button>
            </div>
          </form>
        )}

        {totpEnabled && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-foreground">
              İşlem için güncel 6 haneli kod
              <input
                className={cn(field, 'max-w-48')}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || code.length !== 6}
                className="h-10 rounded-lg border border-border px-4 text-sm text-foreground hover:bg-secondary disabled:opacity-60"
                onClick={() =>
                  start(async () => {
                    const res = await regenerateBackupCodes(code)
                    if (res.ok) {
                      setCodes(res.codes)
                      setCode('')
                      setMsg({ ok: true, text: 'Yeni yedek kodlar oluşturuldu. Eskileri artık geçmez.' })
                    } else show(res)
                  })
                }
              >
                Yeni yedek kodlar
              </button>
              {!totpRequired && (
                <button
                  type="button"
                  disabled={pending || code.length !== 6}
                  className="h-10 rounded-lg border border-destructive/50 px-4 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
                  onClick={() =>
                    start(async () => {
                      show(await disableOwnTotp(code))
                      setCode('')
                    })
                  }
                >
                  2FA kapat
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold text-foreground">Şifre</h2>
        {isOwner ? (
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Ana yönetici (@{username}) şifresi Vercel ortam değişkeni ADMIN_PASSWORD&apos;dan gelir. Değiştirmek için v0 sağ üst menü, Vars bölümünden ADMIN_PASSWORD değerini güncelle.
          </p>
        ) : (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              start(async () => {
                const res = await changeOwnPassword(pw.current, pw.next)
                show(res)
                if (res.ok) setPw({ current: '', next: '' })
              })
            }}
          >
            <label className="flex flex-col gap-1 text-sm text-foreground">
              Mevcut şifre
              <input className={field} type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required />
            </label>
            <label className="flex flex-col gap-1 text-sm text-foreground">
              Yeni şifre (en az 10 karakter)
              <input
                className={field}
                type="password"
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
                autoComplete="new-password"
                minLength={10}
                required
              />
            </label>
            <button type="submit" disabled={pending} className={cn(btn, 'self-start')}>
              Şifreyi değiştir
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
