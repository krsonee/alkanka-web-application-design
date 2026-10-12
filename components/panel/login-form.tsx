'use client'

import { useActionState } from 'react'
import { LockKeyhole, LogOut } from 'lucide-react'
import { login, logout } from '@/app/panel/actions'

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(login, {})
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-border bg-card p-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logos/fist.png" alt="" className="mx-auto h-20 w-auto" />
      <div className="flex flex-col items-center gap-1">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-2 text-xl font-black tracking-widest text-primary">AL KANKA PANEL</h1>
        <p className="text-xs text-muted-foreground">Yönetim paneline giriş yapın</p>
      </div>
      {!configured && (
        <p className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm leading-relaxed text-foreground">
          {'ADMIN_PASSWORD ortam değişkeni ayarlı değil. Ayarlar > Vars bölümünden ekle.'}
        </p>
      )}
      <label className="flex flex-col gap-1.5 text-left text-sm text-foreground">
        Şifre
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
        />
      </label>
      {state.message && (
        <p role="alert" className="text-sm text-live">
          {state.message}
        </p>
      )}
      <button
        disabled={pending || !configured}
        className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Kontrol ediliyor…' : 'Giriş yap'}
      </button>
    </form>
  )
}

export function LogoutButton() {
  return (
    <form action={logout}>
      <button className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary">
        <LogOut className="size-4" aria-hidden="true" />
        Çıkış
      </button>
    </form>
  )
}
