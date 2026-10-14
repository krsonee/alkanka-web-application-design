'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

export function ResetPasswordForm({ token, invalid }: { token: string | null; invalid: boolean }) {
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (!token || invalid) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <h1 className="font-display text-2xl font-bold">Bağlantı geçersiz</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Şifre sıfırlama bağlantısının süresi dolmuş ya da daha önce kullanılmış. Giriş ekranından yeni bağlantı iste.
        </p>
        <Link href="/#sifremi-unuttum" className="flex h-11 items-center justify-center rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground">
          Yeni bağlantı iste
        </Link>
      </div>
    )
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const password = String(form.get('password') ?? '')
    if (password !== String(form.get('confirm') ?? '')) {
      setError('Şifreler aynı değil.')
      return
    }
    setError(null)
    setState('pending')
    const res = await authClient.resetPassword({ newPassword: password, token: token! })
    if (res.error) {
      setError('Şifre değiştirilemedi. Bağlantının süresi dolmuş olabilir.')
      setState('idle')
      return
    }
    setState('done')
  }

  if (state === 'done') {
    return (
      <div role="status" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <h1 className="font-display text-2xl font-bold">Şifren değişti kanka</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">Yeni şifrenle giriş yapabilirsin.</p>
        <Link href="/#giris" className="flex h-11 items-center justify-center rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground">
          Giriş yap
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <h1 className="font-display text-2xl font-bold">Yeni şifre belirle</h1>
      {(['password', 'confirm'] as const).map((n) => (
        <label key={n} className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">{n === 'password' ? 'Yeni şifre' : 'Yeni şifre (tekrar)'}</span>
          <input
            name={n}
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </label>
      ))}
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === 'pending'}
        className="flex h-11 items-center justify-center rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-60"
      >
        {state === 'pending' ? 'Bekle kanka…' : 'Şifremi değiştir'}
      </button>
    </form>
  )
}
