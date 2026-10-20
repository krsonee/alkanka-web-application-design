'use client'

import { useState, useTransition } from 'react'
import { saveBoostsAction } from '@/app/panel/boost-actions'
import { WEEKDAYS, type BoostConfig } from '@/lib/boosts-shared'

const label = 'flex flex-col gap-1 text-xs font-semibold text-muted-foreground'
const input = 'h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground'
const box = 'flex flex-col gap-3 rounded-2xl border border-border bg-card p-4'
const check = 'flex items-center gap-2 text-sm font-semibold text-foreground'

const toLocal = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 3 * 3_600_000).toISOString().slice(0, 16) : '')
const fromLocal = (v: string) => (v ? new Date(`${v}:00+03:00`).toISOString() : null)

export function BoostManager({ initial }: { initial: BoostConfig }) {
  const [cfg, setCfg] = useState(initial)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const set = <K extends keyof BoostConfig>(k: K, v: Partial<BoostConfig[K]>) =>
    setCfg((c) => ({ ...c, [k]: typeof c[k] === 'object' && !Array.isArray(c[k]) ? { ...(c[k] as object), ...v } : v }))

  const save = () =>
    start(async () => {
      const r = await saveBoostsAction(cfg)
      if (r.ok) {
        setCfg(r.cfg)
        setMsg('Kampanyalar kaydedildi.')
      } else setMsg(r.error)
    })

  return (
    <section aria-labelledby="boost-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="boost-title" className="font-display text-lg font-bold text-foreground">Kampanyalar ve çarpanlar</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">Aktif kampanyalar sitenin üstünde geri sayımlı şerit olarak görünür. Saatler İstanbul saatidir.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className={box}>
          <label className={check}><input type="checkbox" className="size-4 accent-primary" checked={cfg.happyHour.on} onChange={(e) => set('happyHour', { on: e.target.checked })} />Mutlu Saatler (her gün)</label>
          <div className="grid grid-cols-3 gap-2">
            <label className={label}>Başlangıç<input type="number" min={0} max={23} className={input} value={cfg.happyHour.start} onChange={(e) => set('happyHour', { start: Number(e.target.value) })} /></label>
            <label className={label}>Bitiş<input type="number" min={0} max={23} className={input} value={cfg.happyHour.end} onChange={(e) => set('happyHour', { end: Number(e.target.value) })} /></label>
            <label className={label}>Çarpan<input type="number" step={0.5} min={1} max={5} className={input} value={cfg.happyHour.mult} onChange={(e) => set('happyHour', { mult: Number(e.target.value) })} /></label>
          </div>
        </div>

        <div className={box}>
          <label className={check}><input type="checkbox" className="size-4 accent-primary" checked={cfg.weekend.on} onChange={(e) => set('weekend', { on: e.target.checked })} />Hafta Sonu Festivali (Cuma 18:00 - Pazar)</label>
          <label className={label}>Arena kâr çarpanı<input type="number" step={0.5} min={1} max={3} className={input} value={cfg.weekend.mult} onChange={(e) => set('weekend', { mult: Number(e.target.value) })} /></label>
        </div>

        <div className={box}>
          <span className="text-sm font-semibold text-foreground">Derbi Gecesi (tahmin + KankaTV)</span>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>Başlık<input className={input} value={cfg.derby.title} onChange={(e) => set('derby', { title: e.target.value })} /></label>
            <label className={label}>Çarpan<input type="number" step={0.5} min={1} max={5} className={input} value={cfg.derby.mult} onChange={(e) => set('derby', { mult: Number(e.target.value) })} /></label>
          </div>
          <label className={label}>Bitiş zamanı (boşsa kapalı)<input type="datetime-local" className={input} value={toLocal(cfg.derby.until)} onChange={(e) => set('derby', { until: fromLocal(e.target.value) })} /></label>
        </div>

        <div className={box}>
          <span className="text-sm font-semibold text-foreground">Market Flash İndirimi</span>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>İndirim %<input type="number" min={1} max={90} className={input} value={cfg.flash.pct} onChange={(e) => set('flash', { pct: Number(e.target.value) })} /></label>
            <label className={label}>Bitiş (boşsa kapalı)<input type="datetime-local" className={input} value={toLocal(cfg.flash.until)} onChange={(e) => set('flash', { until: fromLocal(e.target.value) })} /></label>
          </div>
        </div>

        <div className={box}>
          <span className="text-sm font-semibold text-foreground">Rozet Günü (rozet sahiplerine market indirimi)</span>
          <div className="grid grid-cols-3 gap-2">
            <label className={label}>Gün<input type="date" className={input} value={cfg.badgeDay.day ?? ''} onChange={(e) => set('badgeDay', { day: e.target.value || null })} /></label>
            <label className={label}>Rozet ID<input className={input} value={cfg.badgeDay.badgeId} onChange={(e) => set('badgeDay', { badgeId: e.target.value })} /></label>
            <label className={label}>İndirim %<input type="number" min={1} max={90} className={input} value={cfg.badgeDay.pct} onChange={(e) => set('badgeDay', { pct: Number(e.target.value) })} /></label>
          </div>
        </div>

        <div className={box}>
          <span className="text-sm font-semibold text-foreground">Sponsor Haftası</span>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>Site ID<input className={input} value={cfg.sponsorWeek.siteId} onChange={(e) => set('sponsorWeek', { siteId: e.target.value })} /></label>
            <label className={label}>Bitiş (boşsa kapalı)<input type="datetime-local" className={input} value={toLocal(cfg.sponsorWeek.until)} onChange={(e) => set('sponsorWeek', { until: fromLocal(e.target.value) })} /></label>
          </div>
          <label className={label}>Şerit metni<input className={input} value={cfg.sponsorWeek.text} onChange={(e) => set('sponsorWeek', { text: e.target.value })} /></label>
        </div>

        <div className={box}>
          <label className={check}><input type="checkbox" className="size-4 accent-primary" checked={cfg.comeback.on} onChange={(e) => set('comeback', { on: e.target.checked })} />Geri dönüş hediyesi</label>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>Kaç gün yoksa<input type="number" min={3} max={60} className={input} value={cfg.comeback.days} onChange={(e) => set('comeback', { days: Number(e.target.value) })} /></label>
            <label className={label}>Coin<input type="number" min={0} className={input} value={cfg.comeback.coin} onChange={(e) => set('comeback', { coin: Number(e.target.value) })} /></label>
          </div>
          <label className={check}><input type="checkbox" className="size-4 accent-primary" checked={cfg.birthday.on} onChange={(e) => set('birthday', { on: e.target.checked })} />Doğum günü hediyesi</label>
          <label className={label}>Doğum günü coin<input type="number" min={0} className={input} value={cfg.birthday.coin} onChange={(e) => set('birthday', { coin: Number(e.target.value) })} /></label>
        </div>

        <div className={box}>
          <span className="text-sm font-semibold text-foreground">Seri ve sadakat</span>
          <div className="grid grid-cols-3 gap-2">
            <label className={label}>14 gün seri KP<input type="number" min={0} className={input} value={cfg.streak14} onChange={(e) => setCfg((c) => ({ ...c, streak14: Number(e.target.value) }))} /></label>
            <label className={label}>Kalkan fiyatı KC<input type="number" min={1} className={input} value={cfg.shieldPrice} onChange={(e) => setCfg((c) => ({ ...c, shieldPrice: Number(e.target.value) }))} /></label>
            <label className={label}>Sadakat günü<input type="number" min={7} max={365} className={input} value={cfg.loyaltyDays} onChange={(e) => setCfg((c) => ({ ...c, loyaltyDays: Number(e.target.value) }))} /></label>
          </div>
        </div>

        <div className={box}>
          <label className={check}><input type="checkbox" className="size-4 accent-primary" checked={cfg.bestBonus.on} onChange={(e) => set('bestBonus', { on: e.target.checked })} />Haftanın en iyi bonusu vitrini</label>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>Site ID<input className={input} value={cfg.bestBonus.siteId} onChange={(e) => set('bestBonus', { siteId: e.target.value })} /></label>
            <label className={label}>Tıklama KP<input type="number" min={0} className={input} value={cfg.bestBonus.kp} onChange={(e) => set('bestBonus', { kp: Number(e.target.value) })} /></label>
          </div>
          <label className={label}>Başlık<input className={input} value={cfg.bestBonus.title} onChange={(e) => set('bestBonus', { title: e.target.value })} /></label>
          <label className={label}>Metin<input className={input} value={cfg.bestBonus.text} onChange={(e) => set('bestBonus', { text: e.target.value })} /></label>
        </div>

        <div className={box}>
          <span className="text-sm font-semibold text-foreground">Kayıp bonusu (cashback) günleri</span>
          {cfg.cashback.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_2fr_auto] items-end gap-2">
              <label className={label}>Site ID<input className={input} value={c.siteId} onChange={(e) => setCfg((s) => ({ ...s, cashback: s.cashback.map((x, j) => (j === i ? { ...x, siteId: e.target.value } : x)) }))} /></label>
              <label className={label}>Gün
                <select className={input} value={c.weekday} onChange={(e) => setCfg((s) => ({ ...s, cashback: s.cashback.map((x, j) => (j === i ? { ...x, weekday: Number(e.target.value) } : x)) }))}>
                  {WEEKDAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
                </select>
              </label>
              <label className={label}>Metin<input className={input} value={c.text} onChange={(e) => setCfg((s) => ({ ...s, cashback: s.cashback.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))} /></label>
              <button type="button" onClick={() => setCfg((s) => ({ ...s, cashback: s.cashback.filter((_, j) => j !== i) }))} className="h-10 rounded-lg border border-border px-3 text-sm text-foreground">Sil</button>
            </div>
          ))}
          <button type="button" onClick={() => setCfg((s) => ({ ...s, cashback: [...s.cashback, { siteId: '', weekday: 1, text: '' }] }))} className="h-10 self-start rounded-lg border border-border px-4 text-sm font-semibold text-foreground">Gün ekle</button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" disabled={pending} onClick={save} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">Kaydet</button>
        {msg && <span role="status" className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </section>
  )
}
