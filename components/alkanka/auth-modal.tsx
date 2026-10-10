'use client'

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { Check, CircleDot, Eye, EyeOff, Gift, Info, Lock, Mail, Send, ShoppingBag, User, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrandLogo } from './logo-selector'

export type AuthMode = 'giris' | 'kayit'

type AuthModalValue = { openAuth: (mode: AuthMode) => void }

const AuthModalContext = createContext<AuthModalValue | null>(null)

export function useAuthModal() {
  const ctx = useContext(AuthModalContext)
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider')
  return ctx
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode | null>(null)
  const openAuth = useCallback((next: AuthMode) => setMode(next), [])

  useEffect(() => {
    function fromHash() {
      const hash = window.location.hash.slice(1)
      if (hash === 'giris' || hash === 'kayit') {
        setMode(hash)
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [])

  return (
    <AuthModalContext.Provider value={{ openAuth }}>
      {children}
      <AuthDialog mode={mode} setMode={setMode} />
    </AuthModalContext.Provider>
  )
}

const PERKS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Gift, title: '+100 AC hoş geldin', text: 'Kayıt olur olmaz bakiyende' },
  { icon: CircleDot, title: 'Her 6 saatte ücretsiz çark', text: 'VIP geçişe kadar ödüller' },
  { icon: ShoppingBag, title: 'Puan marketi', text: 'Rozet, ekstra hak, hediye kutusu' },
  { icon: Send, title: 'Telegram’a özel kodlar', text: 'Promo kodlar herkesten önce' },
]

function AuthDialog({ mode, setMode }: { mode: AuthMode | null; setMode: (m: AuthMode | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (mode && !dialog.open) dialog.showModal()
    if (!mode && dialog.open) dialog.close()
  }, [mode])

  const close = () => setMode(null)

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      className="m-auto w-[calc(100%-1.5rem)] max-w-3xl overflow-visible bg-transparent p-0 text-foreground backdrop:bg-background/80 backdrop:backdrop-blur-sm open:animate-in open:fade-in-0 open:zoom-in-95"
    >
      {mode && (
        <div className="panel-gold relative grid max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <button
            type="button"
            onClick={close}
            aria-label="Kapat"
            className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>

          <BrandPanel mode={mode} />

          <div className="flex flex-col gap-5 p-5 sm:p-7">
            <div className="md:hidden">
              <BrandLogo size="sm" />
            </div>
            <div className="flex flex-col gap-1 pr-10">
              <h2 id={titleId} className="font-display text-2xl font-bold text-foreground">
                {mode === 'giris' ? 'Tekrar hoş geldin kanka' : 'Aramıza katıl'}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {mode === 'giris'
                  ? 'Çark hakların, biletlerin ve AlkaCoin bakiyen seni bekliyor.'
                  : '30 saniyede hesabını aç, 100 AC hoş geldin bonusunu kap.'}
              </p>
            </div>

            <div role="tablist" aria-label="Hesap" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1">
              {(['giris', 'kayit'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'h-9 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors',
                    mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m === 'giris' ? 'Giriş yap' : 'Kayıt ol'}
                </button>
              ))}
            </div>

            {mode === 'giris' ? <LoginForm onSwitch={() => setMode('kayit')} /> : <RegisterForm onSwitch={() => setMode('giris')} />}
          </div>
        </div>
      )}
    </dialog>
  )
}

function BrandPanel({ mode }: { mode: AuthMode }) {
  return (
    <div className="relative hidden flex-col justify-between gap-8 overflow-hidden rounded-l-2xl border-r border-border p-7 md:flex">
      <Image src="/images/hero-chest.png" alt="" fill sizes="360px" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
      <div className="relative">
        <BrandLogo size="md" />
      </div>
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
            {mode === 'kayit' ? 'Üyelere özel' : 'Kaldığın yerden devam'}
          </span>
          <p className="font-display text-2xl font-bold leading-tight text-balance text-foreground">
            Çevir, topla, harca. <span className="text-primary">Kankalar kazanır.</span>
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {PERKS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">{title}</span>
                <span className="text-xs text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-live" aria-hidden="true" />
          Bugün <span className="font-semibold text-foreground">1.284</span> kanka katıldı
        </p>
      </div>
    </div>
  )
}

function Field({
  label,
  icon: Icon,
  error,
  hint,
  trailing,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  icon: LucideIcon
  error?: string
  hint?: string
  trailing?: ReactNode
}) {
  const id = useId()
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-foreground">
        {label}
      </label>
      <div
        className={cn(
          'flex h-11 items-center gap-2.5 rounded-xl border bg-background px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
          error ? 'border-destructive' : 'border-border',
        )}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          {...input}
        />
        {trailing}
      </div>
      {error ? (
        <p id={`${id}-err`} className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  error,
  autoComplete,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  autoComplete: string
  children?: ReactNode
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <Field
        label={label}
        icon={Lock}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder="••••••••"
        error={error}
        trailing={
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        }
      />
      {children}
    </div>
  )
}

function strength(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-ZÇĞİÖŞÜ]/.test(pw) && /[a-zçğıöşü]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü]/.test(pw)) score++
  return score
}

const STRENGTH_LABEL = ['Çok zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü']

function StrengthMeter({ password }: { password: string }) {
  const score = strength(password)
  if (!password) return null
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="grid flex-1 grid-cols-4 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 rounded-full transition-colors',
              i < score ? (score <= 1 ? 'bg-destructive' : score === 2 ? 'bg-primary/60' : 'bg-primary') : 'bg-border',
            )}
          />
        ))}
      </div>
      <span className="w-16 text-right text-[11px] font-semibold text-muted-foreground">{STRENGTH_LABEL[score]}</span>
    </div>
  )
}

function Checkbox({ checked, onChange, children, error }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          'mt-px flex size-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40',
          checked ? 'border-primary bg-primary text-primary-foreground' : error ? 'border-destructive' : 'border-border bg-background',
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span>{children}</span>
    </label>
  )
}

function SubmitNotice() {
  return (
    <p role="status" className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs leading-relaxed text-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
      Form doğrulandı. Üyelik altyapısı (veritabanı + oturum) bağlandığında hesap burada açılacak.
    </p>
  )
}

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<{ user?: string; password?: string }>({})
  const [submitted, setSubmitted] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (user.trim().length < 3) next.user = 'Kullanıcı adı veya e-posta gir'
    if (password.length < 6) next.password = 'Şifre en az 6 karakter olmalı'
    setErrors(next)
    setSubmitted(Object.keys(next).length === 0)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field
        label="Kullanıcı adı veya e-posta"
        icon={User}
        value={user}
        onChange={(e) => setUser(e.target.value)}
        autoComplete="username"
        placeholder="kanka34"
        error={errors.user}
      />
      <PasswordField label="Şifre" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" />
      <div className="flex items-center justify-between gap-3">
        <Checkbox checked={remember} onChange={setRemember}>
          Beni hatırla
        </Checkbox>
        <button type="button" className="text-xs font-semibold text-primary hover:underline">
          Şifremi unuttum
        </button>
      </div>
      <button
        type="submit"
        className="h-12 rounded-xl bg-primary text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] transition-opacity hover:opacity-90"
      >
        Giriş yap
      </button>
      {submitted && <SubmitNotice />}
      <p className="text-center text-xs text-muted-foreground">
        Hesabın yok mu?{' '}
        <button type="button" onClick={onSwitch} className="font-semibold text-primary hover:underline">
          Kayıt ol, 100 AC kazan
        </button>
      </p>
    </form>
  )
}

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', invite: '' })
  const [adult, setAdult] = useState(false)
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(form.username)) next.username = '3–16 karakter; harf, rakam ve _'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Geçerli bir e-posta gir'
    if (strength(form.password) < 2) next.password = 'En az 8 karakter, büyük-küçük harf ve rakam kullan'
    if (!adult) next.adult = '1'
    if (!terms) next.terms = '1'
    setErrors(next)
    setSubmitted(Object.keys(next).length === 0)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Kullanıcı adı"
          icon={User}
          value={form.username}
          onChange={set('username')}
          autoComplete="username"
          placeholder="kanka34"
          error={errors.username}
        />
        <Field
          label="E-posta"
          icon={Mail}
          type="email"
          value={form.email}
          onChange={set('email')}
          autoComplete="email"
          placeholder="ornek@mail.com"
          error={errors.email}
        />
      </div>
      <PasswordField
        label="Şifre"
        value={form.password}
        onChange={(v) => setForm((f) => ({ ...f, password: v }))}
        error={errors.password}
        autoComplete="new-password"
      >
        <StrengthMeter password={form.password} />
      </PasswordField>
      <Field
        label="Davet kodu (opsiyonel)"
        icon={Gift}
        value={form.invite}
        onChange={set('invite')}
        placeholder="KANKA-4821"
        hint="Davet koduyla gelene +100 AC ekstra"
      />
      <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-background/50 p-3">
        <Checkbox checked={adult} onChange={setAdult} error={!!errors.adult}>
          18 yaşından büyüğüm.
        </Checkbox>
        <Checkbox checked={terms} onChange={setTerms} error={!!errors.terms}>
          <span className="text-foreground">Kullanım koşullarını</span> ve{' '}
          <span className="text-foreground">gizlilik politikasını</span> okudum, kabul ediyorum.
        </Checkbox>
      </div>
      <button
        type="submit"
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] transition-opacity hover:opacity-90"
      >
        Hesabımı aç
        <span className="rounded bg-primary-foreground/15 px-1.5 py-0.5 text-[10px]">+100 AC</span>
      </button>
      {submitted && <SubmitNotice />}
      <p className="text-center text-xs text-muted-foreground">
        Zaten hesabın var mı?{' '}
        <button type="button" onClick={onSwitch} className="font-semibold text-primary hover:underline">
          Giriş yap
        </button>
      </p>
    </form>
  )
}
