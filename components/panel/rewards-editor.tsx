'use client'


import { askConfirm } from '@/components/panel/confirm-dialog'
import { useState, useTransition } from 'react'
import { Dices, Gift, Loader2, RotateCcw, Save, Target } from 'lucide-react'
import { resetCatalog, saveRewards } from '@/app/panel/catalog-actions'
import { WHEEL_TONES, type RewardConfig } from '@/lib/rewards-shared'
import { cn } from '@/lib/utils'
import { HideButton } from '@/components/panel/hide-button'
import { WheelPreview } from '@/components/panel/wheel-preview'

const input = 'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none'
const label = 'flex flex-col gap-1.5 text-xs font-medium text-muted-foreground'

function Card({ icon: Icon, title, hint, game, hidden, children }: { icon: typeof Gift; title: string; hint: string; game: string; hidden: boolean; children: React.ReactNode }) {
  return (
    <section className={cn('flex flex-col gap-4 rounded-2xl border border-border bg-card p-5', hidden && 'border-dashed')}>
      <header className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">
            {title}
            {hidden && <span className="ml-2 text-[10px] font-bold uppercase text-muted-foreground">Siteden gizli</span>}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
        </div>
        <HideButton key={`${game}-${hidden}`} kind="mini" id={game} hidden={hidden} label={title} />
      </header>
      {children}
    </section>
  )
}

function Num({ text, value, onChange, min = 0, max = 100000 }: { text: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <label className={label}>
      {text}
      <input type="number" inputMode="numeric" min={min} max={max} className={input} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export function RewardsEditor({ initial, hidden = [], winRate = 40 }: { initial: RewardConfig; hidden?: string[]; winRate?: number }) {
  const [cfg, setCfg] = useState(initial)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const patch = <K extends keyof RewardConfig>(key: K, value: Partial<RewardConfig[K]>) =>
    setCfg((c) => ({ ...c, [key]: { ...c[key], ...value } }))

  const save = () =>
    start(async () => {
      const r = await saveRewards(cfg)
      setStatus(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
    })

  const reset = () => {
    void askConfirm('Tüm ödüller varsayılana dönsün mü?').then((ok) => {
      if (!ok) return
    start(async () => {
      const r = await resetCatalog('rewards')
      setStatus(r.ok ? { ok: true, text: `${r.message} Sayfayı yenile.` } : { ok: false, text: r.error })
    })
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <Card icon={Target} game="cark" hidden={hidden.includes('cark')} title="Şans çarkı" hint="8 dilim. Kısa yazı çarkın üstünde görünür, puan üyenin hesabına geçer.">
        <WheelPreview segments={cfg.wheel.segments} winRate={winRate} />
        <Num text="Kaç saatte bir çevirebilir" value={cfg.wheel.cooldownHours} min={1} max={168} onChange={(n) => patch('wheel', { cooldownHours: n })} />
        <div className="flex flex-col gap-2">
          {cfg.wheel.segments.map((s, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3 md:grid-cols-[80px_1fr_110px_120px]">
              <label className={label}>
                Kısa
                <input className={input} maxLength={6} value={s.short} onChange={(e) => patch('wheel', { segments: cfg.wheel.segments.map((x, j) => (j === i ? { ...x, short: e.target.value } : x)) })} />
              </label>
              <label className={cn(label, 'col-span-2 md:col-span-1')}>
                Ödül adı
                <input className={input} maxLength={40} value={s.label} onChange={(e) => patch('wheel', { segments: cfg.wheel.segments.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              </label>
              <Num text="Puan" value={s.points} max={100000} onChange={(n) => patch('wheel', { segments: cfg.wheel.segments.map((x, j) => (j === i ? { ...x, points: n } : x)) })} />
              <label className={label}>
                Renk
                <select className={input} value={s.tone} onChange={(e) => patch('wheel', { segments: cfg.wheel.segments.map((x, j) => (j === i ? { ...x, tone: e.target.value as typeof s.tone } : x)) })}>
                  {WHEEL_TONES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>
      </Card>

      <Card icon={Gift} game="sandik" hidden={hidden.includes('sandik')} title="Gizemli sandık" hint="Her sandıktan ödüllerden biri rastgele çıkar. Ödülleri virgülle yaz (ör. 40, 60, 90).">
        <Num text="Günlük hak" value={cfg.chest.dailyPlays} min={1} max={20} onChange={(n) => patch('chest', { dailyPlays: n })} />
        <div className="grid gap-3 md:grid-cols-3">
          {cfg.chest.chests.map((c, i) => {
            const set = (v: Partial<typeof c>) => patch('chest', { chests: cfg.chest.chests.map((x, j) => (j === i ? { ...x, ...v } : x)) })
            return (
              <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                <label className={label}>
                  Adı
                  <input className={input} maxLength={30} value={c.name} onChange={(e) => set({ name: e.target.value })} />
                </label>
                <label className={label}>
                  Şans etiketi
                  <input className={input} maxLength={12} value={c.odds} onChange={(e) => set({ odds: e.target.value })} />
                </label>
                <label className={label}>
                  Ödüller (puan)
                  <input
                    className={input}
                    defaultValue={c.rewards.join(', ')}
                    onBlur={(e) => set({ rewards: e.target.value.split(',').map((v) => Number(v.trim())).filter((n) => Number.isFinite(n) && n >= 0) })}
                  />
                </label>
              </div>
            )
          })}
        </div>
      </Card>

      <Card icon={Dices} game="zar" hidden={hidden.includes('zar')} title="Zar at" hint="İki zar atılır. Önce jackpot (6-6), sonra çift, sonra toplam eşiği kontrol edilir; puan = zar toplamı × çarpan.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Num text="Günlük hak" value={cfg.dice.dailyPlays} min={1} max={20} onChange={(n) => patch('dice', { dailyPlays: n })} />
          <Num text="Jackpot (6-6) puanı" value={cfg.dice.jackpot} onChange={(n) => patch('dice', { jackpot: n })} />
          <Num text="Çift zar çarpanı" value={cfg.dice.doubleX} max={1000} onChange={(n) => patch('dice', { doubleX: n })} />
          <Num text="Yüksek toplam eşiği" value={cfg.dice.highMin} min={2} max={12} onChange={(n) => patch('dice', { highMin: n })} />
          <Num text="Yüksek toplam çarpanı" value={cfg.dice.highX} max={1000} onChange={(n) => patch('dice', { highX: n })} />
          <Num text="Düşük toplam çarpanı" value={cfg.dice.lowX} max={1000} onChange={(n) => patch('dice', { lowX: n })} />
        </div>
      </Card>

      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur">
        <button type="button" onClick={save} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          Kaydet
        </button>
        <button type="button" onClick={reset} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-foreground hover:bg-secondary disabled:opacity-60">
          <RotateCcw className="size-4" aria-hidden />
          Varsayılana dön
        </button>
        {status && (
          <p role="status" className={cn('text-sm', status.ok ? 'text-primary' : 'text-destructive')}>
            {status.text}
          </p>
        )}
      </div>
    </div>
  )
}
