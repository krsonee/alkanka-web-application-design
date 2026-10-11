'use client'

import { useEffect, useState } from 'react'
import { BellRing, CheckCircle2, Download, MoreVertical, PlusSquare, Share, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_BONUS } from '@/lib/app-config'
import { usePoints } from '../points-context'
import { usePwa, type Platform } from './pwa-provider'

type Guide = 'android' | 'ios'

const STEPS: Record<Guide, { icon: typeof Share; title: string; body: string }[]> = {
  android: [
    { icon: Smartphone, title: 'Chrome ile siteyi aç', body: 'alkanka adresine Chrome tarayıcısından gir.' },
    { icon: MoreVertical, title: 'Sağ üstteki ⋮ menüsüne dokun', body: '“Uygulamayı yükle” ya da “Ana ekrana ekle” seçeneğine bas.' },
    { icon: Download, title: '“Yükle”ye bas', body: 'AL KANKA simgesi ana ekranına ve uygulama listene eklenir.' },
    { icon: CheckCircle2, title: 'Uygulamadan giriş yap', body: `Simgeye dokun, kullanıcı adınla giriş yap. ${APP_BONUS} KC bonus anında yüklenir.` },
  ],
  ios: [
    { icon: Smartphone, title: 'Safari ile siteyi aç', body: 'iPhone’da ana ekrana ekleme yalnızca Safari’den yapılır.' },
    { icon: Share, title: 'Alttaki Paylaş simgesine dokun', body: 'Ortadaki kare ve yukarı ok simgesi.' },
    { icon: PlusSquare, title: '“Ana Ekrana Ekle”yi seç', body: 'Listeyi aşağı kaydır, “Ana Ekrana Ekle” ve ardından sağ üstten “Ekle”.' },
    { icon: CheckCircle2, title: 'Ana ekrandan aç ve giriş yap', body: `Simgeden aç, kullanıcı adınla giriş yap. ${APP_BONUS} KC bonus anında yüklenir.` },
  ],
}

export function InstallGuide({ claimed }: { claimed: boolean }) {
  const { ready, standalone, platform, canPrompt, promptInstall, pushState, enablePush } = usePwa()
  const { member, requireLogin } = usePoints()
  const [guide, setGuide] = useState<Guide>('android')
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (ready && platform === 'ios') setGuide('ios')
  }, [ready, platform])

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section aria-labelledby="kurulum" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="kurulum" className="font-display text-xl font-bold text-foreground">
            Kurulum adımları
          </h2>
          <div role="tablist" aria-label="Telefon türü" className="flex gap-1 rounded-xl border border-border bg-background p-1">
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
                  'rounded-lg px-4 py-1.5 text-sm font-semibold',
                  guide === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {standalone ? (
          <p className="flex items-center gap-2 rounded-xl border border-live/40 bg-live/10 p-3 text-sm font-semibold text-foreground">
            <CheckCircle2 className="size-4 text-live" aria-hidden="true" />
            Şu an uygulamanın içindesin. Kurulum tamam.
          </p>
        ) : (
          guide === 'android' &&
          canPrompt && (
            <button
              type="button"
              onClick={() => promptInstall()}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
            >
              <Download className="size-4" aria-hidden="true" />
              Tek dokunuşla yükle
            </button>
          )
        )}

        <ol className="flex flex-col gap-3">
          {STEPS[guide].map((s, i) => {
            const Icon = s.icon
            return (
              <li key={s.title} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Icon className="size-4 text-primary" aria-hidden="true" />
                    {s.title}
                  </span>
                  <span className="text-pretty text-sm leading-relaxed text-muted-foreground">{s.body}</span>
                </div>
              </li>
            )
          })}
        </ol>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Play Store ya da App Store gerekmez, yer kaplamaz, güncellemeler otomatik gelir.
        </p>
      </section>

      <div className="flex flex-col gap-6">
        <section aria-labelledby="bonus" className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 sm:p-6">
          <h2 id="bonus" className="font-display text-xl font-bold text-foreground">
            +{APP_BONUS} KC uygulama bonusu
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Uygulamayı ekledikten sonra uygulamanın içinden kullanıcı adınla giriş yap. Bonus hesap başına bir kez, otomatik yüklenir.
          </p>
          {claimed ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-live">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Bonusunu aldın.
            </p>
          ) : !member ? (
            <button type="button" onClick={() => requireLogin()} className="h-10 rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              Önce kayıt ol / giriş yap
            </button>
          ) : (
            <p className="text-sm font-semibold text-foreground">
              {standalone ? 'Bonusun yükleniyor…' : 'Uygulamadan giriş yaptığında bonusun yüklenecek.'}
            </p>
          )}
        </section>

        <section aria-labelledby="bildirim" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 id="bildirim" className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
            <BellRing className="size-5 text-accent" aria-hidden="true" />
            Bildirimleri aç
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Promo kodlar, yeni turnuvalar ve çark hakkın yenilendiğinde telefonuna bildirim gelsin.
          </p>
          {pushState === 'granted' ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-live">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Bildirimler açık.
            </p>
          ) : (
            <button
              type="button"
              disabled={busy || pushState === 'denied'}
              onClick={async () => {
                setBusy(true)
                setPushMsg(await enablePush())
                setBusy(false)
              }}
              className="h-10 rounded-lg border border-accent/50 text-sm font-bold text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            >
              {pushState === 'denied' ? 'İzin reddedildi' : busy ? 'Açılıyor…' : 'Bildirimleri aç'}
            </button>
          )}
          {(pushMsg || pushState === 'needs-install' || pushState === 'denied') && (
            <p className="text-xs leading-relaxed text-muted-foreground" role="status">
              {pushMsg ??
                (pushState === 'needs-install'
                  ? 'iPhone’da bildirimler yalnızca ana ekrana eklenen uygulamada çalışır (iOS 16.4+).'
                  : 'Tarayıcı ayarlarından bu site için bildirim iznini aç.')}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

export type { Platform }
