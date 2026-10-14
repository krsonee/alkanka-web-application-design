'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react'
import { logout } from '@/app/panel/actions'
import { panelLogin, type LoginState } from '@/app/panel/auth-actions'

const INPUT = 'rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-primary read-only:opacity-70'

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(panelLogin, {})
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const step = state.step ?? 'password'

  if (step === 'backup' && state.codes) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-primary/30 bg-card p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-6 text-primary" aria-hidden="true" />
          <h1 className="font-display text-xl font-bold uppercase text-foreground">Yedek kodlar</h1>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Telefonunu kaybedersen bu kodlarla girebilirsin. Her kod bir kez çalışır. Bir yere not al; bu ekran bir daha gösterilmez.
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-background p-3 font-mono text-sm text-foreground">
          {state.codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button onClick={() => router.refresh()} className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:opacity-90">
          Not aldım, panele geç
        </button>
      </div>
    )
  }

  const needsCode = step === 'totp' || step === 'enroll'

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-primary/30 bg-card p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col">
          <h1 className="font-display text-xl font-bold uppercase text-foreground">Yönetim paneli</h1>
          <p className="text-sm text-muted-foreground">
            {step === 'totp' ? 'Authenticator uygulamandaki kodu gir.' : step === 'enroll' ? 'Bu hesapta iki adımlı doğrulama zorunlu.' : 'Kullanıcı adı ve şifrenle gir.'}
          </p>
        </div>
      </div>
      {!configured && (
        <p className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm leading-relaxed text-foreground">
          {'ADMIN_PASSWORD ortam değişkeni ayarlı değil. Ayarlar > Vars bölümünden ekle.'}
        </p>
      )}
      <label className="flex flex-col gap-1.5 text-sm text-foreground">
        Kullanıcı adı
        <input name="username" value={username} onChange={(e) => setUsername(e.target.value)} readOnly={needsCode} required autoComplete="username" className={INPUT} />
        <span className="text-xs text-muted-foreground">Ana yönetici için: admin</span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-foreground">
        Şifre
        <input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} readOnly={needsCode} required autoComplete="current-password" className={INPUT} />
      </label>
      {step === 'enroll' && state.qr && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background p-3 text-center">
          <p className="text-sm leading-relaxed text-foreground">Google Authenticator ile bu kodu tara, sonra uygulamadaki 6 haneli kodu aşağıya yaz.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.qr} alt="İki adımlı doğrulama QR kodu" width={180} height={180} className="rounded-md bg-foreground p-1" />
          <p className="break-all font-mono text-xs text-muted-foreground">Elle giriş: {state.secret}</p>
        </div>
      )}
      {needsCode && (
        <label className="flex flex-col gap-1.5 text-sm text-foreground">
          <span className="flex items-center gap-1.5">
            <KeyRound className="size-4 text-primary" aria-hidden="true" />
            {step === 'totp' ? 'Doğrulama kodu veya yedek kod' : 'Doğrulama kodu'}
          </span>
          <input name="code" required autoFocus inputMode={step === 'enroll' ? 'numeric' : 'text'} autoComplete="one-time-code" maxLength={20} className={`${INPUT} font-mono tracking-widest`} />
        </label>
      )}
      {state.message && (
        <p role="alert" className="text-sm text-live">
          {state.message}
        </p>
      )}
      <button disabled={pending || !configured} className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
        {pending ? 'Kontrol ediliyor…' : needsCode ? 'Doğrula' : 'Giriş yap'}
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
