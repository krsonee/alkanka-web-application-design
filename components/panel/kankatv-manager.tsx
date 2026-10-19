'use client'

import { useActionState } from 'react'
import { Bell, Bot, Eye, Loader2, Radar, Send, Target, Tv } from 'lucide-react'
import { runScanAction, saveTvAction, testGoalBotAction } from '@/app/panel/kankatv-actions'
import type { ActionState } from '@/app/panel/actions'
import type { MirrorTarget } from '@/lib/telegram-mirror'
import { TV_LIMITS, type TvBotStatus, type TvConfig, type TvStats } from '@/lib/kankatv-shared'
import { cn } from '@/lib/utils'

const input = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const label = 'flex flex-col gap-1.5 text-sm font-medium text-foreground'
const hint = 'text-xs font-normal leading-relaxed text-muted-foreground'
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60'
const ghostBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-60'

function Status({ state }: { state: ActionState }) {
  if (!state.message) return null
  return (
    <p role="status" className={cn('text-sm leading-relaxed', state.ok ? 'text-primary' : 'text-destructive')}>
      {state.message}
    </p>
  )
}

function Card({ icon, id, title, desc, children }: { icon: React.ReactNode; id: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <header className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <div className="flex flex-col gap-0.5">
          <h3 id={id} className="font-semibold text-foreground">
            {title}
          </h3>
          <p className={hint}>{desc}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

function Toggle({ name, defaultChecked, title, desc }: { name: string; defaultChecked: boolean; title: string; desc?: string }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-primary" />
      <span className="flex flex-col gap-0.5 text-sm font-medium text-foreground">
        {title}
        {desc ? <span className={hint}>{desc}</span> : null}
      </span>
    </label>
  )
}

function NumberField({ name, title, value, range, suffix }: { name: string; title: string; value: number; range: readonly [number, number]; suffix: string }) {
  return (
    <label className={label}>
      {title}
      <div className="flex items-center gap-2">
        <input type="number" name={name} defaultValue={value} min={range[0]} max={range[1]} required className={input} inputMode="numeric" />
        <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>
      </div>
    </label>
  )
}

const timeAgo = (iso: string | null) => {
  if (!iso) return 'hiç çalışmadı'
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s} sn önce`
  if (s < 3600) return `${Math.round(s / 60)} dk önce`
  return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
}

export function KankaTvManager({
  config,
  status,
  stats,
  targets,
  cronUrl,
}: {
  config: TvConfig
  status: TvBotStatus
  stats: TvStats
  targets: MirrorTarget[]
  cronUrl: string
}) {
  const [saveState, save, saving] = useActionState(saveTvAction, {})
  const [testState, test, testing] = useActionState(testGoalBotAction, {})
  const [scanState, scan, scanning] = useActionState(runScanAction, {})
  const stale = !status.lastRunAt || Date.now() - new Date(status.lastRunAt).getTime() > 10 * 60 * 1000
  const botLive = config.goalBot.enabled || config.goalBot.push

  const statItems = [
    { label: 'Bugün izleyen', value: stats.watchersToday },
    { label: 'İzlenen dakika', value: stats.minutesToday },
    { label: 'Dağıtılan coin', value: stats.coinsToday },
    { label: 'Bugünkü tahmin', value: stats.predictionsToday },
    { label: 'Açık tahmin', value: stats.openPredictions },
    { label: 'Takım takibi', value: stats.follows },
  ]

  return (
    <div className="flex flex-col gap-5">
      <Card icon={<Radar className="size-4" />} id="tv-health" title="Bot sağlığı" desc="Gol botunun son taraması, hata durumu ve bugünkü etkileşim.">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {statItems.map((s) => (
            <div key={s.label} className="flex flex-col gap-0.5 rounded-xl border border-border bg-background p-3">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="text-lg font-semibold tabular-nums text-foreground">{s.value.toLocaleString('tr-TR')}</dd>
            </div>
          ))}
        </dl>
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
            <span className="text-muted-foreground">Son tarama</span>
            <span className={cn('font-medium', botLive && stale ? 'text-destructive' : 'text-foreground')}>{timeAgo(status.lastRunAt)}</span>
          </li>
          <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
            <span className="text-muted-foreground">Takip edilen canlı maç</span>
            <span className="font-medium tabular-nums text-foreground">{status.tracked}</span>
          </li>
          <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
            <span className="text-muted-foreground">Toplam gönderilen gol mesajı</span>
            <span className="font-medium tabular-nums text-foreground">{status.sent}</span>
          </li>
        </ul>
        {status.lastError ? (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm leading-relaxed text-destructive">
            Son hata: {status.lastError}
          </p>
        ) : null}
        {botLive && stale ? (
          <p className={hint}>Son 10 dakikada tarama yok. Site trafiği azken de çalışması için aşağıdaki cron adresini her dakika çağır.</p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <form action={scan} className="flex-1">
            <button type="submit" disabled={scanning} className={cn(ghostBtn, 'w-full')}>
              {scanning ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Radar className="size-4" aria-hidden />}
              Şimdi tara
            </button>
          </form>
          <form action={test} className="flex-1">
            <button type="submit" disabled={testing || !config.goalBot.targetIds.length} className={cn(ghostBtn, 'w-full')}>
              {testing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
              Test mesajı gönder
            </button>
          </form>
        </div>
        <Status state={scanState} />
        <Status state={testState} />
        <label className={label}>
          Dakikalık cron adresi
          <input readOnly value={cronUrl} className={cn(input, 'font-mono text-xs')} onFocus={(e) => e.currentTarget.select()} />
          <span className={hint}>cron-job.org gibi bir servise ekleyip “her dakika” çalıştır. Gol uyarıları ve tahmin ödemeleri ziyaretçi olmasa da işler.</span>
        </label>
      </Card>

      <form action={save} className="flex flex-col gap-5">
        <Card icon={<Bot className="size-4" />} id="tv-goalbot" title="Gol botu" desc="Canlı maçta gol olunca seçtiğin Telegram grup/kanallarına otomatik mesaj atar.">
          <Toggle name="goalBotEnabled" defaultChecked={config.goalBot.enabled} title="Gol botu açık" desc="Kapalıyken Telegram’a hiç mesaj gitmez." />
          <Toggle name="topOnly" defaultChecked={config.goalBot.topOnly} title="Sadece büyük ligler" desc="Açıkken yalnızca öne çıkan liglerdeki goller paylaşılır; spam olmaz." />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium text-foreground">Hedef grup / kanallar</legend>
            {targets.length ? (
              targets.map((t) => (
                <label key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-sm text-foreground">
                  <input type="checkbox" name="targetIds" value={t.id} defaultChecked={config.goalBot.targetIds.includes(t.id)} className="size-4 accent-primary" />
                  <span className="flex-1 truncate">{t.title}</span>
                  {!t.active ? <span className="text-xs text-muted-foreground">pasif</span> : null}
                </label>
              ))
            ) : (
              <p className={hint}>Henüz hedef yok. “Bağlantı & Cron” sekmesinden bot ve grup ekle.</p>
            )}
          </fieldset>
          <label className={label}>
            Mesaj şablonu
            <textarea name="template" defaultValue={config.goalBot.template} rows={6} maxLength={1000} className={cn(input, 'font-mono text-xs leading-relaxed')} />
            <span className={hint}>Değişkenler: {'{takim} {ev} {dep} {skor} {lig} {dakika} {link}'}</span>
          </label>
        </Card>

        <Card icon={<Bell className="size-4" />} id="tv-push" title="Takım bildirimleri" desc="Üyeler takımını takip eder, gol olunca telefonuna bildirim gelir.">
          <Toggle name="push" defaultChecked={config.goalBot.push} title="Gol bildirimleri açık" desc="Kapalıyken takip butonu yine görünür ama bildirim gönderilmez." />
        </Card>

        <Card icon={<Eye className="size-4" />} id="tv-watch" title="İzle kazan" desc="Üye KankaTV’de yayın açık tuttukça coin kazanır.">
          <Toggle name="watchEnabled" defaultChecked={config.watch.enabled} title="İzle kazan açık" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumberField name="watchMinutes" title="Her" value={config.watch.minutes} range={TV_LIMITS.minutes} suffix="dakikada" />
            <NumberField name="watchCoin" title="Ödül" value={config.watch.coin} range={TV_LIMITS.coin} suffix="coin" />
            <NumberField name="watchCap" title="Günlük üst sınır" value={config.watch.dailyCap} range={TV_LIMITS.dailyCap} suffix="coin (0 = sınırsız)" />
          </div>
        </Card>

        <Card icon={<Target className="size-4" />} id="tv-predict" title="Sıradaki golü kim atar" desc="Canlı maçta tahmin; bilen üyeye coin yazılır.">
          <Toggle name="predictEnabled" defaultChecked={config.predict.enabled} title="Tahminler açık" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField name="predictCoin" title="Bilene ödül" value={config.predict.coin} range={TV_LIMITS.predictCoin} suffix="coin" />
            <NumberField name="predictLimit" title="Günlük hak" value={config.predict.dailyLimit} range={TV_LIMITS.dailyLimit} suffix="tahmin" />
          </div>
        </Card>

        <Card icon={<Tv className="size-4" />} id="tv-ui" title="Sayfa özellikleri" desc="KankaTV sayfasında hangi parçaların görüneceği.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Toggle name="reactions" defaultChecked={config.reactions} title="Canlı tepkiler" desc="GOL, ateş, alkış… herkes anlık görür." />
            <Toggle name="presence" defaultChecked={config.presence} title="Kaç kişi izliyor" />
            <Toggle name="oddsBridge" defaultChecked={config.oddsBridge} title="Maça özel oran" desc="Özel oran botundaki maçlar skor kartında görünür." />
            <Toggle name="miniPlayer" defaultChecked={config.miniPlayer} title="Mini oynatıcı" desc="Aşağı kaydırınca yayın köşede küçük kalır." />
          </div>
        </Card>

        <div className="sticky bottom-3 flex flex-col gap-2 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur">
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Kaydet
          </button>
          <Status state={saveState} />
        </div>
      </form>
    </div>
  )
}
