'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { useSWRConfig } from 'swr'
import { cn } from '@/lib/utils'
import { authClient } from '@/lib/auth-client'
import { TELEGRAM_URL } from './data'
import { Modal } from './modal'
import { useTexts } from './texts-context'

type Mode = 'giris' | 'kayit' | 'sifremi-unuttum'

function readHash(): Mode | null {
  const h = window.location.hash.slice(1)
  return h === 'giris' || h === 'kayit' || h === 'sifremi-unuttum' ? h : null
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        {...props}
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
    </label>
  )
}

export function AuthModal() {
  const [mode, setMode] = useState<Mode | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mutate } = useSWRConfig()
  const t = useTexts()
  const router = useRouter()
  const refresh = async () => {
    await mutate('/api/me')
    router.refresh()
  }

  useEffect(() => {
    const sync = () => {
      setMode(readHash())
      setSubmitted(false)
      setNotice(null)
      setError(null)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  function close() {
    setMode(null)
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  function switchTo(next: Mode) {
    setSubmitted(false)
    setNotice(null)
    setError(null)
    history.replaceState(null, '', `#${next}`)
    setMode(next)
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    const name = String(form.get('username') ?? '').trim()
    const phone = String(form.get('phone') ?? '').replace(/[^\d+]/g, '').slice(0, 16)
    setError(null)
    setNotice(null)
    setPending(true)
    try {
      if (mode === 'sifremi-unuttum') {
        await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/sifre-sifirla` })
        setNotice('Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı gönderdik. Gelen kutunu ve spam klasörünü kontrol et.')
        return
      }
      if (mode === 'giris') {
        const login = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ identifier: email, password }),
        })
        if (!login.ok) {
          const body = (await login.json().catch(() => null)) as { code?: string; message?: string } | null
          if (login.status === 429) setError('Çok fazla deneme yaptın. 1 dakika bekleyip tekrar dene.')
          else if (login.status === 423) setError(body?.message || 'Hesabın dondurulmuş.')
          else if (login.status === 403) setNotice('E-postan henüz onaylanmamış. Onay bağlantısını tekrar gönderdik, gelen kutunu kontrol et.')
          else if (login.status === 409 && body?.message) setError(body.message)
          else setError('Kullanıcı adı/e-posta veya şifre hatalı.')
          return
        }
        await refresh()
        close()
        return
      }
      const res = await authClient.signUp.email({ email, password, name, ...(phone ? { phone } : {}) })
      if (res.error) {
        if (res.error.status === 429) {
          setError('Çok fazla deneme yaptın. 1 dakika bekleyip tekrar dene.')
          return
        }
        const msg = res.error.message ?? ''
        setError(/kullanıcı adı/i.test(msg) ? msg : 'Kayıt tamamlanamadı. Bu e-posta kullanılıyor olabilir.')
        return
      }
      if (!res.data?.token) {
        setNotice(`Neredeyse tamam kanka. ${email} adresine onay bağlantısı gönderdik, tıklayınca hesabın açılacak.`)
        return
      }
      await refresh()
      close()
    } catch {
      setError('Bağlantı hatası, tekrar dene.')
    } finally {
      setPending(false)
    }
  }

  const isRegister = mode === 'kayit'
  const isForgot = mode === 'sifremi-unuttum'

  return (
    <Modal open={!!mode} onClose={close} title={isRegister ? 'Kayıt ol' : isForgot ? 'Şifremi unuttum' : 'Giriş yap'} className="max-w-3xl">
      <div className="grid md:grid-cols-2">
        <div className="relative hidden min-h-full flex-col justify-end overflow-hidden bg-background p-6 md:flex">
          <Image
            src={isRegister ? '/images/mascots/jako-merhaba.png' : '/images/mascots/jako.png'}
            alt="AL KANKA maskotu Jako"
            fill
            sizes="(min-width: 768px) 384px, 0px"
            className="object-cover object-[50%_35%]"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-background via-background/40 via-30% to-transparent to-60%" />
          <div className="relative flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">{t('auth.eyebrow')}</span>
            <p className="font-display text-xl font-bold text-balance">
              {isRegister ? t('auth.registerSpeech') : t('auth.loginSpeech')}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-6">
          <div role="tablist" aria-label="Hesap" className="grid grid-cols-2 gap-1 rounded-lg bg-background p-1">
            {(['giris', 'kayit'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m || (isForgot && m === 'giris')}
                onClick={() => switchTo(m)}
                className={cn(
                  'h-9 rounded-md text-xs font-bold uppercase tracking-wider transition-colors',
                  mode === m || (isForgot && m === 'giris') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'giris' ? 'Giriş' : 'Kayıt ol'}
              </button>
            ))}
          </div>

          {submitted ? (
            <div role="status" className="flex flex-col gap-4">
              <h2 className="font-display text-xl font-bold">Üyelik çok yakında açılıyor</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Hesap sistemi henüz aktif değil. Açıldığı an ilk Telegram kanalımızda duyuracağız, kayıt bonusu da açılışta tanımlanacak.
              </p>
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-accent text-xs font-bold uppercase tracking-wider text-accent-foreground"
              >
                <Send className="size-4" aria-hidden="true" />
                Telegram’dan haber al
              </a>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <h2 className="font-display text-xl font-bold">
                {isRegister ? 'AL KANKA’ya katıl' : isForgot ? 'Şifreni sıfırla' : 'Hesabına giriş yap'}
              </h2>
              {isForgot && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Kayıtlı e-posta adresini yaz, sana yeni şifre belirleme bağlantısı gönderelim.
                </p>
              )}
              {isRegister && <Field label="Kullanıcı adı" name="username" required minLength={3} autoComplete="username" placeholder="kanka123" />}
              {mode === 'giris' ? (
                <Field
                  label="Kullanıcı adı veya e-posta"
                  name="email"
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="kanka123 veya ornek@mail.com"
                />
              ) : (
                <Field label="E-posta" name="email" type="email" required autoComplete="email" autoCapitalize="none" placeholder="ornek@mail.com" />
              )}
              {!isForgot && (
                <Field
                  label="Şifre"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder="En az 8 karakter"
                />
              )}
              {mode === 'giris' && (
                <button
                  type="button"
                  onClick={() => switchTo('sifremi-unuttum')}
                  className="-mt-2 self-end text-xs font-semibold text-primary hover:underline"
                >
                  Şifremi unuttum
                </button>
              )}
              {isRegister && (
                <>
                  <Field label="Telefon (isteğe bağlı)" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="05XX XXX XX XX" maxLength={20} />
                  <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <input type="checkbox" required className="mt-0.5 accent-[var(--primary)]" />
                    <span>
                      18 yaşından büyüğüm.{' '}
                      <a href="/yasal/kullanim-kosullari" target="_blank" rel="noopener" className="font-semibold text-primary hover:underline">
                        Kullanım koşullarını
                      </a>{' '}
                      kabul ediyorum,{' '}
                      <a href="/yasal/kvkk" target="_blank" rel="noopener" className="font-semibold text-primary hover:underline">
                        KVKK aydınlatma metnini
                      </a>{' '}
                      okudum.
                    </span>
                  </label>
                </>
              )}
              {error && (
                <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold leading-relaxed text-foreground">
                  {notice}
                </p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="flex h-11 items-center justify-center rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {pending ? 'Bekle kanka…' : isForgot ? 'Bağlantı gönder' : isRegister ? t('auth.registerCta') : t('auth.loginCta')}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                {isRegister ? 'Zaten hesabın var mı? ' : isForgot ? 'Şifreni hatırladın mı? ' : 'Hesabın yok mu? '}
                <button type="button" onClick={() => switchTo(isRegister || isForgot ? 'giris' : 'kayit')} className="font-semibold text-primary hover:underline">
                  {isRegister || isForgot ? 'Giriş yap' : 'Kayıt ol'}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </Modal>
  )
}
