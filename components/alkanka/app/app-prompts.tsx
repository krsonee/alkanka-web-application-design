'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BellRing, CheckCircle2, Download, X } from 'lucide-react'
import useSWR from 'swr'
import { dismissReminder, getPushReminder } from '@/app/actions/app'
import { JakoAvatar } from '../jako'
import { usePoints } from '../points-context'
import { usePwa } from './pwa-provider'
import { TOUR_DONE_EVENT, TOUR_KEY } from './site-tour'

const BANNER_KEY = 'alk_app_banner_hidden_until'
const HIDE_FOR_MS = 3 * 24 * 60 * 60 * 1000

function InstallBanner() {
  const { ready, standalone, platform, canPrompt, promptInstall, installBonus, pushBonus } = usePwa()
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ready || standalone) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const evaluate = () => {
      const hiddenUntil = Number(localStorage.getItem(BANNER_KEY) ?? 0)
      if (hiddenUntil > Date.now() || !localStorage.getItem(TOUR_KEY)) return
      timer = setTimeout(() => setVisible(true), 15000)
    }
    evaluate()
    window.addEventListener(TOUR_DONE_EVENT, evaluate)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(TOUR_DONE_EVENT, evaluate)
    }
  }, [ready, standalone])

  if (!visible || standalone || pathname === '/uygulama') return null

  const dismiss = () => {
    localStorage.setItem(BANNER_KEY, String(Date.now() + HIDE_FOR_MS))
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Mobil uygulama"
      className="fixed inset-x-3 bottom-20 z-40 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 lg:right-[21.5rem] xl:right-[21.5rem]"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-card p-3 shadow-2xl sm:p-4">
        <span className="hidden sm:block">
          <JakoAvatar pose="duyuru" size="sm" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-bold text-foreground">Uygulamayı kur, +{installBonus + pushBonus} KC kap</p>
            <p className="hidden text-pretty text-xs leading-relaxed text-muted-foreground sm:block">
              Ana ekrana ekle +{installBonus} KC, bildirimleri aç +{pushBonus} KC. Turnuva ve promo kodları ilk sen duy.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canPrompt && platform !== 'ios' ? (
              <button
                type="button"
                onClick={async () => {
                  if (await promptInstall()) setVisible(false)
                }}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground"
              >
                <Download className="size-3.5" aria-hidden="true" />
                Hemen yükle
              </button>
            ) : (
              <Link
                href="/uygulama"
                onClick={() => setVisible(false)}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground"
              >
                <Download className="size-3.5" aria-hidden="true" />
                Nasıl indirilir?
              </Link>
            )}
            <button type="button" onClick={dismiss} className="h-8 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              Sonra
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Kapat" className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function StandaloneLoginNudge() {
  const { standalone, installBonus } = usePwa()
  const { member, loading, requireLogin } = usePoints()
  const [hidden, setHidden] = useState(false)
  if (!standalone || loading || member || hidden) return null
  return (
    <div className="fixed inset-x-3 bottom-20 z-40 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96">
      <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-card p-3 shadow-2xl">
        <JakoAvatar pose="kazandi" size="sm" />
        <p className="flex-1 text-xs leading-relaxed text-foreground">
          Uygulamadan giriş yap, <span className="font-bold text-primary">{installBonus} KC</span> uygulama bonusun hesabına yüklensin.
        </p>
        <button type="button" onClick={() => requireLogin()} className="h-8 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground">
          Giriş
        </button>
        <button type="button" onClick={() => setHidden(true)} aria-label="Kapat" className="text-muted-foreground hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

const PUSH_NUDGE_KEY = 'alk_push_nudge_hidden_until'

function StandalonePushNudge() {
  const { ready, standalone, pushState, enablePush, pushBonus, pushAwarded } = usePwa()
  const { member } = usePoints()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!ready || !standalone || !member || pushState !== 'default') return
    if (Number(localStorage.getItem(PUSH_NUDGE_KEY) ?? 0) > Date.now()) return
    const t = setTimeout(() => setVisible(true), 4000)
    return () => clearTimeout(t)
  }, [ready, standalone, member, pushState])

  if (!visible || pushState !== 'default' || pushAwarded) return null

  const snooze = () => {
    localStorage.setItem(PUSH_NUDGE_KEY, String(Date.now() + 24 * 60 * 60 * 1000))
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Bildirim daveti"
      className="fixed inset-x-3 bottom-20 z-40 animate-in fade-in slide-in-from-bottom-4 duration-500 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-accent/50 bg-card p-4 shadow-2xl">
        <JakoAvatar pose="duyuru" size="sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm font-bold text-foreground">Bildirimleri aç, +{pushBonus} KC hemen hesabında</p>
          <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
            Turnuva başlarken ve promo kodu düşünce Jako seni çağırsın.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await enablePush()
                setBusy(false)
                setVisible(false)
              }}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-bold text-accent-foreground disabled:opacity-60"
            >
              <BellRing className="size-3.5" aria-hidden="true" />
              {busy ? 'Açılıyor…' : 'Aç ve kap'}
            </button>
            <button type="button" onClick={snooze} className="h-8 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              Sonra
            </button>
          </div>
        </div>
        <button type="button" onClick={snooze} aria-label="Kapat" className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/** A week after a member switches notifications off, Jako asks once more (server tracks timing, at most weekly). */
function PushComebackReminder() {
  const { ready, pushState, enablePush } = usePwa()
  const { member } = usePoints()
  const { data: due, mutate } = useSWR(ready && member && pushState !== 'unsupported' ? ['push-reminder', member.id] : null, () => getPushReminder())
  const [busy, setBusy] = useState(false)
  if (!due) return null

  const close = async () => {
    mutate(false, { revalidate: false })
    await dismissReminder()
  }
  const denied = pushState === 'denied'

  return (
    <div role="region" aria-label="Bildirim hatırlatması" className="fixed inset-x-3 bottom-20 z-40 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96">
      <div className="flex items-start gap-3 rounded-2xl border border-accent/50 bg-card p-4 shadow-2xl">
        <JakoAvatar pose="duyuru" size="sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm font-bold text-foreground">Bir haftadır sessizsin kanka</p>
          <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
            {denied
              ? 'Bildirimler tarayıcı ayarlarından kapalı. Site ayarlarından izin verirsen maçları ve flaş fırsatları kaçırmazsın.'
              : 'Hepsini açmak zorunda değilsin. Sadece istediğin konuları seçebilirsin.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!denied && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  await enablePush()
                  setBusy(false)
                  await close()
                }}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-bold text-accent-foreground disabled:opacity-60"
              >
                <BellRing className="size-3.5" aria-hidden="true" />
                {busy ? 'Açılıyor…' : 'Tekrar aç'}
              </button>
            )}
            <Link href="/profil#bildirimler" onClick={close} className="flex h-8 items-center rounded-lg px-2 text-xs font-semibold text-primary hover:underline">
              Konuları seç
            </Link>
          </div>
        </div>
        <button type="button" onClick={close} aria-label="Kapat" className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function NoticeToast() {
  const { notice, clearNotice } = usePwa()
  if (!notice) return null
  return (
    <div role="status" className="fixed inset-x-3 top-20 z-[60] flex justify-center">
      <button
        type="button"
        onClick={clearNotice}
        className="flex items-center gap-2 rounded-xl border border-live/40 bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-2xl"
      >
        {notice.startsWith('Bildirim') ? (
          <BellRing className="size-4 text-live" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="size-4 text-live" aria-hidden="true" />
        )}
        {notice}
      </button>
    </div>
  )
}

export function AppPrompts() {
  return (
    <>
      <InstallBanner />
      <StandaloneLoginNudge />
      <StandalonePushNudge />
      <PushComebackReminder />
      <NoticeToast />
    </>
  )
}
