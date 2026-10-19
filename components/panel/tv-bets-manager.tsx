'use client'

import { useActionState } from 'react'
import { Activity, Bot, Coins, Loader2, Lock, Radar, ScrollText, Send, ShieldCheck, Unlock, XCircle } from 'lucide-react'
import { marketAction, saveBetsAction, syncBetsAction, testBetsBotAction } from '@/app/panel/tv-bets-actions'
import type { ActionState } from '@/app/panel/actions'
import type { MirrorTarget } from '@/lib/telegram-mirror'
import { BET_KINDS, BET_KIND_LABELS, BETS_LIMITS, type AdminMarket, type BetsBotStatus, type BetsConfig, type BetsLog, type BetsStats } from '@/lib/tv-bets-shared'
import { cn } from '@/lib/utils'

const input = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const label = 'flex flex-col gap-1.5 text-sm font-medium text-foreground'
const hint = 'text-xs font-normal leading-relaxed text-muted-foreground'
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60'
const ghostBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-60'
const miniBtn = 'inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-60'

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

function NumberField({ name, title, value, range, suffix, step }: { name: string; title: string; value: number; range: readonly [number, number]; suffix: string; step?: number }) {
  return (
    <label className={label}>
      {title}
      <div className="flex items-center gap-2">
        <input type="number" name={name} defaultValue={value} min={range[0]} max={range[1]} step={step ?? 1} required className={input} />
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

const STATUS_TEXT: Record<AdminMarket['status'], string> = { open: 'Açık', locked: 'Kilitli', settled: 'Sonuçlandı', void: 'İptal' }

function MarketRow({ market }: { market: AdminMarket }) {
  const [state, action, pending] = useActionState(marketAction, {})
  const live = market.status === 'open' || market.status === 'locked'
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-foreground">
            {market.home} - {market.away}
          </span>
          <span className={hint}>
            {market.title} · {market.phase === 'live' ? 'Canlı' : 'Maç öncesi'} · {market.mode === 'pool' ? 'Havuz' : 'Sabit oran'} · {market.bets} bahis · {market.total.toLocaleString('tr-TR')} coin
          </span>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold',
            market.status === 'open' ? 'bg-primary/10 text-primary' : market.status === 'void' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground',
          )}
        >
          {STATUS_TEXT[market.status]}
          {market.result ? ` · ${market.options.find((o) => o.key === market.result)?.label ?? market.result}` : ''}
        </span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {market.options.map((o) => (
          <li key={o.key} className="rounded-lg bg-secondary px-2 py-1 text-xs text-foreground">
            {o.label}: {o.pool.toLocaleString('tr-TR')} coin ({o.count}){o.odd ? ` · ${o.odd.toFixed(2)}` : ''}
          </li>
        ))}
      </ul>
      {live ? (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="marketId" value={market.id} />
          {market.status === 'open' ? (
            <button type="submit" name="op" value="lock" disabled={pending} className={miniBtn}>
              <Lock className="size-3.5" aria-hidden /> Kilitle
            </button>
          ) : (
            <button type="submit" name="op" value="unlock" disabled={pending} className={miniBtn}>
              <Unlock className="size-3.5" aria-hidden /> Aç
            </button>
          )}
          <select name="result" defaultValue="" aria-label="Elle sonuç" className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground">
            <option value="">Sonuç seç</option>
            {market.options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="submit" name="op" value="settle" disabled={pending} className={miniBtn}>
            <ShieldCheck className="size-3.5" aria-hidden /> Sonuçlandır
          </button>
          <button type="submit" name="op" value="void" disabled={pending} className={cn(miniBtn, 'text-destructive')}>
            <XCircle className="size-3.5" aria-hidden /> İptal + iade
          </button>
          {market.mode === 'fixed' ? (
            <>
              <input
                name="odds"
                placeholder={market.options.map((o) => `${o.key}=${o.odd?.toFixed(2) ?? '1.80'}`).join(', ')}
                aria-label="Oranlar"
                className="min-w-40 flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground"
              />
              <button type="submit" name="op" value="odds" disabled={pending} className={miniBtn}>
                Oranı kaydet
              </button>
            </>
          ) : null}
          {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : null}
        </form>
      ) : null}
      <Status state={state} />
    </li>
  )
}

export function TvBetsManager({
  config,
  status,
  stats,
  markets,
  log,
  targets,
}: {
  config: BetsConfig
  status: BetsBotStatus
  stats: BetsStats
  markets: AdminMarket[]
  log: BetsLog[]
  targets: MirrorTarget[]
}) {
  const [saveState, save, saving] = useActionState(saveBetsAction, {})
  const [syncState, sync, syncing] = useActionState(syncBetsAction, {})
  const [testState, test, testing] = useActionState(testBetsBotAction, {})
  const active = markets.filter((m) => m.status === 'open' || m.status === 'locked')
  const recent = markets.filter((m) => m.status === 'settled' || m.status === 'void').slice(0, 15)

  return (
    <div className="flex flex-col gap-5">
      <Card icon={<Activity className="size-5" aria-hidden />} id="bets-status" title="Durum ve bugün" desc="Sistem her dakika canlı skorları tarar, etkinlik açar ve sonuçlandırır.">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Bugün bahis', stats.betsToday],
            ['Yatırılan', stats.stakedToday],
            ['Dağıtılan', stats.paidToday],
            ['Yakılan (kesinti)', stats.burnedToday],
            ['Açık etkinlik', stats.openMarkets],
            ['Açık bahis tutarı', stats.openStake],
            ['Oyuncu', stats.players],
            ['Bot mesajı', status.sent],
          ].map(([k, v]) => (
            <div key={k as string} className="flex flex-col gap-1 rounded-xl bg-background p-3">
              <dt className={hint}>{k}</dt>
              <dd className="text-lg font-semibold text-foreground">{Number(v).toLocaleString('tr-TR')}</dd>
            </div>
          ))}
        </dl>
        <p className={hint}>
          Son tarama: {timeAgo(status.lastRunAt)} · açılan {status.opened} · sonuçlanan {status.settled} · iptal {status.voided}
        </p>
        {status.lastError ? <p className="text-sm text-destructive">Son hata: {status.lastError}</p> : null}
        <div className="flex flex-col gap-2 md:flex-row">
          <form action={sync} className="flex-1">
            <button type="submit" disabled={syncing} className={cn(ghostBtn, 'w-full')}>
              {syncing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Radar className="size-4" aria-hidden />}
              Şimdi tara ve sonuçlandır
            </button>
          </form>
          <form action={test} className="flex-1">
            <button type="submit" disabled={testing || !config.bot.targetIds.length} className={cn(ghostBtn, 'w-full')}>
              {testing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
              Bot test mesajı
            </button>
          </form>
        </div>
        <Status state={syncState} />
        <Status state={testState} />
      </Card>

      <form action={save} className="flex flex-col gap-5">
        <Card icon={<Coins className="size-5" aria-hidden />} id="bets-main" title="Etkinlik sistemi" desc="Maç öncesi tahmin maçları sabit oranla, canlı etkinlikler havuz sistemiyle çalışır.">
          <div className="grid gap-3 md:grid-cols-3">
            <Toggle name="enabled" defaultChecked={config.enabled} title="Sistem açık" desc="Kapalıyken yeni etkinlik açılmaz, açık olanlar yine sonuçlanır." />
            <Toggle name="pre" defaultChecked={config.pre} title="Maç öncesi etkinlikler" desc="Tahminler alanındaki maçlar için." />
            <Toggle name="live" defaultChecked={config.live} title="Canlı etkinlikler" desc="Maç başlayınca otomatik açılır." />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-foreground">Açılacak etkinlik türleri</legend>
            <div className="grid gap-2 md:grid-cols-3">
              {BET_KINDS.map((k) => (
                <Toggle key={k} name={`kind_${k}`} defaultChecked={config.kinds[k]} title={BET_KIND_LABELS[k]} />
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 md:grid-cols-3">
            <NumberField name="goalLine" title="Gol çizgisi" value={config.goalLine} range={[0.5, 30]} step={1} suffix="gol" />
            <NumberField name="cornerLine" title="Korner çizgisi" value={config.cornerLine} range={[0.5, 30]} step={1} suffix="korner" />
            <NumberField name="closeMinute" title="Canlı kapanış dakikası" value={config.closeMinute} range={BETS_LIMITS.closeMinute} suffix="dk" />
          </div>
        </Card>

        <Card icon={<ShieldCheck className="size-5" aria-hidden />} id="bets-rules" title="Ekonomi ve güvenlik" desc="Kesinti coin'i piyasadan çeker, limitler ve aktiflik şartı bot/çoklu hesap kötüye kullanımını engeller.">
          <div className="grid gap-3 md:grid-cols-3">
            <NumberField name="rake" title="Havuz kesintisi" value={config.rake} range={BETS_LIMITS.rake} suffix="%" />
            <NumberField name="minStake" title="En az bahis" value={config.minStake} range={BETS_LIMITS.stake} suffix="coin" />
            <NumberField name="maxStake" title="En çok bahis" value={config.maxStake} range={BETS_LIMITS.stake} suffix="coin" />
            <NumberField name="dailyCap" title="Günlük üst sınır (0 = sınırsız)" value={config.dailyCap} range={BETS_LIMITS.dailyCap} suffix="coin" />
            <NumberField name="minActive" title="Bahis için gereken izleme" value={config.minActive} range={BETS_LIMITS.minActive} suffix="dk/gün" />
            <NumberField name="fixedExposure" title="Sabit oran azami ödeme" value={config.fixedExposure} range={BETS_LIMITS.fixedExposure} suffix="coin" />
            <NumberField name="suspendSeconds" title="Gol sonrası askı" value={config.suspendSeconds} range={BETS_LIMITS.suspendSeconds} suffix="sn" />
            <NumberField name="lateWindow" title="Golden önceki bahisleri iade" value={config.lateWindow} range={BETS_LIMITS.lateWindow} suffix="sn" />
          </div>
          <p className={hint}>
            Gol olunca o maçın etkinlikleri askıya alınır; golden hemen önce (gecikmeli yayınla) alınan bahisler otomatik iade edilir. Maç ertelenir veya veri gelmezse tüm bahisler iade olur.
          </p>
        </Card>

        <Card icon={<Bot className="size-5" aria-hidden />} id="bets-bot" title="Etkinlik botu" desc="Açılan ve sonuçlanan etkinlikleri seçtiğin Telegram grup/kanallarına paylaşır.">
          <div className="grid gap-3 md:grid-cols-3">
            <Toggle name="botEnabled" defaultChecked={config.bot.enabled} title="Bot açık" />
            <Toggle name="announceOpen" defaultChecked={config.bot.announceOpen} title="Açılışları paylaş" />
            <Toggle name="announceSettle" defaultChecked={config.bot.announceSettle} title="Sonuçları paylaş" />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-foreground">Hedef grup/kanallar</legend>
            {targets.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {targets.map((t) => (
                  <label key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-sm text-foreground">
                    <input type="checkbox" name="betTargetIds" value={t.id} defaultChecked={config.bot.targetIds.includes(t.id)} className="size-4 accent-primary" />
                    <span className="flex-1 truncate">{t.title}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className={hint}>Önce &quot;Bağlantı &amp; Cron&quot; sekmesinden hedef ekle.</p>
            )}
          </fieldset>
          <label className={label}>
            Açılış mesajı
            <textarea name="openTemplate" defaultValue={config.bot.openTemplate} rows={5} className={input} />
            <span className={hint}>{'Değişkenler: {ev} {dep} {skor} {dakika} {lig} {etkinlikler} {link}'}</span>
          </label>
          <label className={label}>
            Sonuç mesajı
            <textarea name="settleTemplate" defaultValue={config.bot.settleTemplate} rows={4} className={input} />
            <span className={hint}>{'Değişkenler: {ev} {dep} {etkinlik} {sonuc} {kazanan} {dagitilan}'}</span>
          </label>
        </Card>

        <div className="flex flex-col gap-2">
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Ayarları kaydet
          </button>
          <Status state={saveState} />
        </div>
      </form>

      <Card icon={<Radar className="size-5" aria-hidden />} id="bets-markets" title={`Aktif etkinlikler (${active.length})`} desc="Kilitle, elle sonuçlandır, iptal et veya sabit oranları düzenle.">
        {active.length ? (
          <ul className="flex flex-col gap-3">
            {active.map((m) => (
              <MarketRow key={m.id} market={m} />
            ))}
          </ul>
        ) : (
          <p className={hint}>Şu an açık etkinlik yok.</p>
        )}
        {recent.length ? (
          <details className="rounded-xl border border-border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">Son sonuçlananlar ({recent.length})</summary>
            <ul className="mt-3 flex flex-col gap-3">
              {recent.map((m) => (
                <MarketRow key={m.id} market={m} />
              ))}
            </ul>
          </details>
        ) : null}
      </Card>

      <Card icon={<ScrollText className="size-5" aria-hidden />} id="bets-log" title="İşlem kaydı" desc="Sistem ve panelden yapılan tüm işlemler.">
        {log.length ? (
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {log.map((l) => (
              <li key={l.id} className="flex flex-col gap-0.5 rounded-lg bg-background p-2 text-xs">
                <span className="font-semibold text-foreground">
                  {l.action} · <span className="font-normal text-muted-foreground">{l.actor}</span>
                </span>
                <span className="text-muted-foreground">{l.detail}</span>
                <span className="text-muted-foreground">{timeAgo(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={hint}>Henüz kayıt yok.</p>
        )}
      </Card>
    </div>
  )
}
