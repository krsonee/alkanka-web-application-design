'use client'

import { useState, type FormEvent } from 'react'
import { KeyRound, LogOut, Mail } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { usePoints } from '../points-context'
import { cn } from '@/lib/utils'

type Status = { ok: boolean; text: string } | null

const inputCls =
  'h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/20'

function Msg({ status }: { status: Status }) {
  if (!status) return null
  return (
    <p role="status" className={cn('text-xs', status.ok ? 'text-live' : 'text-destructive')}>
      {status.text}
    </p>
  )
}

export function AccountSettings({ email }: { email: string }) {
  const { refresh } = usePoints()
  const [mail, setMail] = useState(email)
  const [mailStatus, setMailStatus] = useState<Status>(null)
  const [pwStatus, setPwStatus] = useState<Status>(null)
  const [busy, setBusy] = useState<'mail' | 'pw' | null>(null)

  async function saveEmail(e: FormEvent) {
    e.preventDefault()
    if (!mail || mail === email) return
    setBusy('mail')
    const { error } = await authClient.changeEmail({ newEmail: mail.trim() })
    setBusy(null)
    setMailStatus(error ? { ok: false, text: error.message ?? 'E-posta güncellenemedi.' } : { ok: true, text: 'E-posta güncellendi.' })
  }

  async function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const currentPassword = String(data.get('current') ?? '')
    const newPassword = String(data.get('next') ?? '')
    if (newPassword.length < 8) {
      setPwStatus({ ok: false, text: 'Yeni şifre en az 8 karakter olmalı.' })
      return
    }
    setBusy('pw')
    const { error } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })
    setBusy(null)
    if (error) setPwStatus({ ok: false, text: error.message ?? 'Şifre değiştirilemedi.' })
    else {
      form.reset()
      setPwStatus({ ok: true, text: 'Şifren değiştirildi.' })
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <form onSubmit={saveEmail} className="flex flex-col gap-2">
        <label htmlFor="acc-mail" className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Mail className="size-3.5" aria-hidden /> E-posta
        </label>
        <div className="flex gap-2">
          <input id="acc-mail" type="email" value={mail} onChange={(e) => setMail(e.target.value)} placeholder="ornek@posta.com" className={inputCls} />
          <button type="submit" disabled={busy === 'mail' || !mail || mail === email} className="h-11 shrink-0 rounded-lg border border-border px-4 text-xs font-bold text-foreground transition-colors hover:border-gold/50 disabled:opacity-50">
            Kaydet
          </button>
        </div>
        <Msg status={mailStatus} />
      </form>

      <form onSubmit={savePassword} className="flex flex-col gap-2 border-t border-border pt-4">
        <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <KeyRound className="size-3.5" aria-hidden /> Şifre değiştir
        </span>
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="current" type="password" autoComplete="current-password" required placeholder="Mevcut şifre" aria-label="Mevcut şifre" className={inputCls} />
          <input name="next" type="password" autoComplete="new-password" required placeholder="Yeni şifre" aria-label="Yeni şifre" className={inputCls} />
        </div>
        <button type="submit" disabled={busy === 'pw'} className="h-10 self-start rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-60">
          Şifreyi değiştir
        </button>
        <Msg status={pwStatus} />
      </form>

      <button
        type="button"
        onClick={async () => {
          await authClient.signOut()
          refresh()
          window.location.href = '/'
        }}
        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-destructive/40 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10"
      >
        <LogOut className="size-3.5" aria-hidden /> Çıkış yap
      </button>
    </div>
  )
}
