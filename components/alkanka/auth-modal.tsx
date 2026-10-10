'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TELEGRAM_URL } from './data'
import { Modal } from './modal'

type Mode = 'giris' | 'kayit'

function readHash(): Mode | null {
  const h = window.location.hash.slice(1)
  return h === 'giris' || h === 'kayit' ? h : null
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

  useEffect(() => {
    const sync = () => {
      setMode(readHash())
      setSubmitted(false)
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
    history.replaceState(null, '', `#${next}`)
    setMode(next)
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitted(true)
  }

  const isRegister = mode === 'kayit'

  return (
    <Modal open={!!mode} onClose={close} title={isRegister ? 'Kayıt ol' : 'Giriş yap'} className="max-w-3xl">
      <div className="grid md:grid-cols-2">
        <div className="relative hidden min-h-full flex-col justify-end overflow-hidden bg-background p-6 md:flex">
          <Image
            src={isRegister ? '/images/mascots/jako-merhaba.png' : '/images/mascots/jako.png'}
            alt="AL KANKA maskotu Jako"
            fill
            sizes="384px"
            className="object-cover"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          <div className="relative flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Jako diyor ki</span>
            <p className="font-display text-xl font-bold text-balance">
              {isRegister ? 'Hoş geldin kanka! İlk girişte 250 Kanka Coin benden.' : 'Tekrar hoş geldin kanka, seri seni bekliyor.'}
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
                aria-selected={mode === m}
                onClick={() => switchTo(m)}
                className={cn(
                  'h-9 rounded-md text-xs font-bold uppercase tracking-wider transition-colors',
                  mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
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
              <h2 className="font-display text-xl font-bold">{isRegister ? 'AL KANKA’ya katıl' : 'Hesabına giriş yap'}</h2>
              {isRegister && <Field label="Kullanıcı adı" name="username" required minLength={3} autoComplete="username" placeholder="kanka123" />}
              <Field label="E-posta" name="email" type="email" required autoComplete="email" placeholder="ornek@mail.com" />
              <Field
                label="Şifre"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder="En az 8 karakter"
              />
              {isRegister && (
                <>
                  <Field label="Referans kodu (isteğe bağlı)" name="ref" placeholder="KANKA-XXXX" />
                  <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <input type="checkbox" required className="mt-0.5 accent-[var(--primary)]" />
                    18 yaşından büyüğüm, kullanım şartlarını ve kuralları kabul ediyorum.
                  </label>
                </>
              )}
              <button
                type="submit"
                className="flex h-11 items-center justify-center rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
              >
                {isRegister ? 'Kayıt ol, 250 KC kap' : 'Giriş yap'}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                {isRegister ? 'Zaten hesabın var mı? ' : 'Hesabın yok mu? '}
                <button type="button" onClick={() => switchTo(isRegister ? 'giris' : 'kayit')} className="font-semibold text-primary hover:underline">
                  {isRegister ? 'Giriş yap' : 'Kayıt ol'}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </Modal>
  )
}
