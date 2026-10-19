'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { claimAppBonus, getPushKey, subscribePush } from '@/app/actions/app'
import { APP_DEFAULTS, type AppSettings } from '@/lib/app-config'
import { usePoints } from '../points-context'

export type Platform = 'android' | 'ios' | 'desktop'
export type PushState = 'unsupported' | 'needs-install' | 'default' | 'granted' | 'denied'

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

type PwaValue = {
  ready: boolean
  standalone: boolean
  platform: Platform
  canPrompt: boolean
  promptInstall: () => Promise<boolean>
  pushState: PushState
  enablePush: () => Promise<string | null>
  notice: string | null
  clearNotice: () => void
  installBonus: number
  pushBonus: number
  installAwarded: boolean
  pushAwarded: boolean
}

const PwaContext = createContext<PwaValue | null>(null)

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'desktop'
}

function detectStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function readPushState(platform: Platform, standalone: boolean): PushState {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return platform === 'ios' && !standalone ? 'needs-install' : 'unsupported'
  }
  return Notification.permission as PushState
}

function base64ToBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export function PwaProvider({ children, settings = APP_DEFAULTS }: { children: ReactNode; settings?: AppSettings }) {
  const { member, setBalance } = usePoints()
  const [ready, setReady] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [pushState, setPushState] = useState<PushState>('unsupported')
  const [notice, setNotice] = useState<string | null>(null)
  const promptRef = useRef<InstallPromptEvent | null>(null)
  const [canPrompt, setCanPrompt] = useState(false)
  const claimedFor = useRef<string | null>(null)
  const [installAwarded, setInstallAwarded] = useState(false)
  const [pushAwarded, setPushAwarded] = useState(false)

  useEffect(() => {
    const p = detectPlatform()
    const s = detectStandalone()
    setPlatform(p)
    setStandalone(s)
    setPushState(readPushState(p, s))
    setReady(true)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => console.error('[pwa] sw kaydı başarısız', error))
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      promptRef.current = e as InstallPromptEvent
      setCanPrompt(true)
    }
    const onInstalled = () => {
      promptRef.current = null
      setCanPrompt(false)
    }
    const media = window.matchMedia('(display-mode: standalone)')
    const onMode = () => setStandalone(detectStandalone())
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    media.addEventListener('change', onMode)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      media.removeEventListener('change', onMode)
    }
  }, [])

  useEffect(() => {
    if (!standalone || !member || claimedFor.current === member.id) return
    claimedFor.current = member.id
    claimAppBonus(platform)
      .then((res) => {
        if (!res.ok) return
        setBalance(res.balance)
        if (res.awarded) {
          setInstallAwarded(true)
          setNotice(`Uygulama bonusu hesabına yüklendi: +${res.amount} KC`)
        }
      })
      .catch((error) => console.error('[pwa] bonus alınamadı', error))
  }, [standalone, member, platform, setBalance])

  const promptInstall = useCallback(async () => {
    const evt = promptRef.current
    if (!evt) return false
    await evt.prompt()
    const choice = await evt.userChoice
    promptRef.current = null
    setCanPrompt(false)
    return choice.outcome === 'accepted'
  }, [])

  const enablePush = useCallback(async () => {
    if (pushState === 'needs-install') return 'iPhone’da bildirimler için önce uygulamayı ana ekrana ekle.'
    if (pushState === 'unsupported') return 'Bu tarayıcı bildirimleri desteklemiyor.'
    try {
      const permission = await Notification.requestPermission()
      setPushState(permission as PushState)
      if (permission !== 'granted') return 'Bildirim izni verilmedi. Tarayıcı ayarlarından açabilirsin.'
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub =
        existing ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(await getPushKey()) }))
      const res = await subscribePush(JSON.parse(JSON.stringify(sub)))
      if (!res.ok) return res.error
      if (res.awarded) {
        if (res.balance !== undefined) setBalance(res.balance)
        setPushAwarded(true)
        setNotice(`Bildirimler açıldı: +${res.amount} KC hesabında`)
      } else {
        setNotice('Bildirimler açıldı. Turnuva ve promo kodlar ilk sana düşecek.')
      }
      return null
    } catch (error) {
      console.error('[pwa] bildirim aboneliği başarısız', error)
      return 'Bildirimler açılamadı, tekrar dene.'
    }
  }, [pushState, setBalance])

  useEffect(() => {
    if (pushState !== 'granted' || !member) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => sub && subscribePush(JSON.parse(JSON.stringify(sub))))
      .then((res) => {
        if (!res || !res.ok || !res.awarded) return
        if (res.balance !== undefined) setBalance(res.balance)
        setPushAwarded(true)
        setNotice(`Bildirim bonusu hesabına yüklendi: +${res.amount} KC`)
      })
      .catch(() => {})
  }, [pushState, member, setBalance])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }, [notice])

  const value = useMemo(
    () => ({
      ready,
      standalone,
      platform,
      canPrompt,
      promptInstall,
      pushState,
      enablePush,
      notice,
      clearNotice: () => setNotice(null),
      installBonus: settings.installBonus,
      pushBonus: settings.pushBonus,
      installAwarded,
      pushAwarded,
    }),
    [ready, standalone, platform, canPrompt, promptInstall, pushState, enablePush, notice, settings, installAwarded, pushAwarded],
  )

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>
}

export function usePwa() {
  const ctx = useContext(PwaContext)
  if (!ctx) throw new Error('usePwa must be used inside PwaProvider')
  return ctx
}
