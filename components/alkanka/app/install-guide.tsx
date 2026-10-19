'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { BellRing, Check, Download, Lock, MoreVertical, PlusSquare, Share, Smartphone, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePoints } from '../points-context'
import { usePwa, type Platform } from './pwa-provider'
import { NotificationPreview } from './notification-preview'

type Guide = 'android' | 'ios'

const STEPS: Record<Guide, { icon: typeof Share; title: string; body: string }[]> = {
  android: [
    { icon: Smartphone, title: 'Chrome ile siteyi aç', body: 'alkanka adresine Chrome’dan gir.' },
    { icon: MoreVertical, title: 'Sağ üstteki ⋮ menüsüne dokun', body: '“Uygulamayı yükle” ya da “Ana ekrana ekle”yi seç.' },
    { icon: Download, title: '“Yükle”ye bas', body: 'AL KANKA simgesi ana ekranına eklenir.' },
  ],
  ios: [
    { icon: Smartphone, title: 'Safari ile siteyi aç', body: 'iPhone’da ana ekrana ekleme yalnızca Safari’den yapılır.' },
    { icon: Share, title: 'Alttaki Paylaş simgesine dokun', body: 'Ortadaki kare ve yukarı ok simgesi.' },
    { icon: PlusSquare, title: '“Ana Ekrana Ekle”yi seç', body: 'Listeyi aşağı kaydır, ardından sağ üstten “Ekle”.' },
  ],
}

export function InstallGuide({ installClaimed, pushClaimed }: { installClaimed: boolean; pushClaimed: boolean }) {
  const { installBonus, pushBonus, installAwarded, pushAwarded } = usePwa()
  const installDone = installClaimed || installAwarded
  const pushDone = pushClaimed || pushAwarded
  const doneCount = Number(installDone) + Number(pushDone)
  const remaining = (installDone ? 0 : installBonus) + (pushDone ? 0 : pushBonus)

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="ilerleme"
        className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Adım {doneCount}/2 tamam
            </span>
            <h2 id="ilerleme" className="text-balance font-display text-2xl font-bold text-foreground">
              {remaining > 0 ? (
                <>
                  <span className="text-primary">{remaining.toLocaleString('tr-TR')} KC</span> seni bekliyor
                </>
              ) : (
                'Hazırsın kanka, tüm ödüller hesabında'
              )}
            </h2>
          </div>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Trophy className="size-6" aria-hidden="true" />
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2" aria-hidden="true">
          {[installDone, pushDone].map((done, i) => (
            <span key={i} className={cn('h-2 rounded-full', done ? 'bg-primary' : 'bg-primary/15')} />
          ))}
        </div>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Ana ekrana ekle <span className="font-semibold text-foreground">+{installBonus} KC</span>, bildirimleri aç{' '}
          <span className="font-semibold text-foreground">+{pushBonus} KC</span>. Her ödül hesap başına bir kez.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <InstallStep done={installDone} />
        <PushStep done={pushDone} />
      </div>
    </div>
  )
}

function StepCard({
  n,
  title,
  reward,
  done,
  children,
}: {
  n: number
  title: string
  reward: number
  done: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-label={`${n}. adım: ${title}`}
      className={cn('flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-6', done ? 'border-live/40' : 'border-border')}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold',
            done ? 'bg-live text-live-foreground' : 'bg-primary/10 text-primary',
          )}
        >
          {done ? <Check className="size-5" aria-label="Tamamlandı" /> : n}
        </span>
        <h3 className="min-w-0 flex-1 font-display text-lg font-bold text-foreground">{title}</h3>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold',
            done ? 'bg-live/15 text-live' : 'bg-primary text-primary-foreground',
          )}
        >
          {done ? 'Alındı' : `+${reward} KC`}
        </span>
      </div>
      {children}
    </section>
  )
}

function InstallStep({ done }: { done: boolean }) {
  const { ready, standalone, platform, canPrompt, promptInstall, installBonus } = usePwa()
  const { member, requireLogin } = usePoints()
  const [guide, setGuide] = useState<Guide>('android')

  useEffect(() => {
    if (ready && platform === 'ios') setGuide('ios')
  }, [ready, platform])

  if (done) {
    return (
      <StepCard n={1} title="Ana ekrana ekle" reward={installBonus} done>
        <p className="text-sm leading-relaxed text-muted-foreground">Uygulama kurulu, bonusun hesabına yüklendi.</p>
      </StepCard>
    )
  }

  if (standalone) {
    return (
      <StepCard n={1} title="Ana ekrana ekle" reward={installBonus} done={false}>
        {member ? (
          <p className="text-sm font-semibold text-foreground" role="status">Uygulamadasın, bonusun yükleniyor…</p>
        ) : (
          <button type="button" onClick={() => requireLogin()} className="h-12 rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            Giriş yap, {installBonus} KC al
          </button>
        )}
      </StepCard>
    )
  }

  return (
    <StepCard n={1} title="Ana ekrana ekle" reward={installBonus} done={false}>
      {guide === 'android' && canPrompt && (
        <button
          type="button"
          onClick={() => promptInstall()}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
        >
          <Download className="size-4" aria-hidden="true" />
          Tek dokunuşla yükle
        </button>
      )}

      <div role="tablist" aria-label="Telefon türü" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1">
        {(
          [
            ['android', 'Android'],
            ['ios', 'iPhone'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={guide === key}
            onClick={() => setGuide(key)}
            className={cn(
              'h-9 rounded-lg text-sm font-semibold',
              guide === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <ol className="flex flex-col">
        {STEPS[guide].map((s, i) => {
          const Icon = s.icon
          return (
            <li key={s.title} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-background text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {i < STEPS[guide].length - 1 && <span aria-hidden="true" className="w-px flex-1 bg-border" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col pb-4">
                <span className="text-sm font-semibold text-foreground">{s.title}</span>
                <span className="text-pretty text-sm leading-relaxed text-muted-foreground">{s.body}</span>
              </div>
            </li>
          )
        })}
      </ol>
      <p className="rounded-xl bg-secondary p-3 text-sm leading-relaxed text-foreground">
        Son adım: simgeden aç ve kullanıcı adınla giriş yap, <span className="font-bold text-primary">{installBonus} KC</span>{' '}
        anında yüklenir. Mağaza gerekmez, yer kaplamaz.
      </p>
    </StepCard>
  )
}

function PushStep({ done }: { done: boolean }) {
  const { pushState, enablePush, pushBonus } = usePwa()
  const { member, requireLogin } = usePoints()
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const action = (() => {
    if (done) return <p className="text-sm leading-relaxed text-muted-foreground">Bildirimler açık, bonusun hesabına yüklendi.</p>
    if (pushState === 'granted') {
      return member ? (
        <p className="text-sm font-semibold text-foreground" role="status">Bildirimler açık, bonusun yükleniyor…</p>
      ) : (
        <button type="button" onClick={() => requireLogin()} className="h-12 rounded-xl bg-accent text-sm font-bold text-accent-foreground">
          Giriş yap, {pushBonus} KC al
        </button>
      )
    }
    if (pushState === 'needs-install') {
      return (
        <p className="flex items-start gap-2 rounded-xl bg-secondary p-3 text-sm leading-relaxed text-foreground">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          iPhone’da bildirim yalnızca ana ekrana eklenen uygulamada çalışır. Önce 1. adımı tamamla, sonra uygulamanın içinden aç.
        </p>
      )
    }
    if (pushState === 'unsupported') {
      return <p className="text-sm leading-relaxed text-muted-foreground">Bu tarayıcı bildirimleri desteklemiyor. Chrome ya da Safari ile dene.</p>
    }
    if (pushState === 'denied') {
      return (
        <p className="rounded-xl bg-secondary p-3 text-sm leading-relaxed text-foreground">
          Bildirim izni kapalı. Adres çubuğundaki kilit simgesine dokun, <span className="font-semibold">Bildirimler</span> iznini aç ve sayfayı yenile.
        </p>
      )
    }
    return (
      <>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setMsg(await enablePush())
            setBusy(false)
          }}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-bold text-accent-foreground disabled:opacity-60"
        >
          <BellRing className="size-4" aria-hidden="true" />
          {busy ? 'Açılıyor…' : `Bildirimleri aç, +${pushBonus} KC kap`}
        </button>
        {!member && <p className="text-xs leading-relaxed text-muted-foreground">Bonus için giriş yapmış olman gerekir.</p>}
      </>
    )
  })()

  return (
    <StepCard n={2} title="Bildirimleri aç" reward={pushBonus} done={done}>
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
        Turnuva başlarken, promo kodu düşünce ve çark hakkın yenilendiğinde ilk sen duy. Günde en fazla birkaç bildirim, spam yok.
      </p>
      <NotificationPreview />
      {action}
      {msg && (
        <p className="text-xs leading-relaxed text-muted-foreground" role="status">
          {msg}
        </p>
      )}
    </StepCard>
  )
}

export type { Platform }
