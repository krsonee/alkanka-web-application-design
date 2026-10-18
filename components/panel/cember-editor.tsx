'use client'

import { useState, useTransition } from 'react'
import { Play, Plus, Save, Trash2 } from 'lucide-react'
import { saveCember, startTestRound } from '@/app/panel/cember-actions'
import { CemberDemo } from './cember-demo'
import {
  CONDITION_KINDS,
  MAX_PLAYERS,
  WINDOW_LABEL,
  conditionText,
  prizeText,
  type CemberCondition,
  type CemberConfig,
  type CemberPrize,
  type ConditionKind,
  type ConditionWindow,
  type PrizeType,
  EVERY_OPTIONS,
  slotMinutes,
} from '@/lib/cember-shared'
import { cn } from '@/lib/utils'

type Option = { id: string; name: string }
type RecentRound = { slot: string; players: number; winner: string | null; prize: string; paid: boolean }

const PRIZE_TYPES: Record<PrizeType, string> = { coin: 'Kanka Coin (KC)', kp: 'Kanka Puan (KP)', badge: 'Rozet', market: 'Market ödülü' }

const input = 'h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground'
const uid = () => Math.random().toString(36).slice(2, 9)

export function CemberEditor({
  initial,
  tasks,
  games,
  badges,
  items,
  recent,
}: {
  initial: CemberConfig
  tasks: Option[]
  games: Option[]
  badges: Option[]
  items: Option[]
  recent: RecentRound[]
}) {
  const [cfg, setCfg] = useState(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const set = (patch: Partial<CemberConfig>) => setCfg((c) => ({ ...c, ...patch }))

  const names: Record<string, string> = {}
  badges.forEach((b) => (names[`b:${b.id}`] = b.name))
  items.forEach((m) => (names[`m:${m.id}`] = m.name))

  const updCond = (id: string, patch: Partial<CemberCondition>) =>
    set({ conditions: cfg.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  const updPrize = (id: string, patch: Partial<CemberPrize>) => set({ prizes: cfg.prizes.map((p) => (p.id === id ? { ...p, ...patch } : p)) })

  const toggleHour = (h: number) =>
    set({ hours: cfg.hours.includes(h) ? cfg.hours.filter((x) => x !== h) : [...cfg.hours, h].sort((a, b) => a - b) })

  const save = () =>
    start(async () => {
      const r = await saveCember(cfg)
      setMsg({ ok: r.ok, text: r.message })
    })

  const test = () =>
    start(async () => {
      const saved = await saveCember(cfg)
      if (!saved.ok) return setMsg({ ok: false, text: saved.message })
      const r = await startTestRound(60)
      setMsg({ ok: r.ok, text: r.message })
    })

  return (
    <div className="flex flex-col gap-6">
      <CemberDemo title={cfg.title} prize={prizeText(cfg.prizes, names)} />
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-bold uppercase text-foreground">Jako Çemberi</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
              Şartları tamamlayan üyeler (en fazla {MAX_PLAYERS}) seçtiğin saatlerde çembere girer. Sitede olan herkese pencere açılır, tek tur oynanır,
              kazanana ödül otomatik verilir ve sohbete duyuru düşer.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={cfg.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="size-4 accent-primary" />
            Etkinlik açık
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Etkinlik adı</span>
            <input className={input} value={cfg.title} maxLength={40} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Sıklık</span>
            <select className={input} value={cfg.every} onChange={(e) => set({ every: Number(e.target.value) })}>
              {EVERY_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'Saatte bir' : `Her ${n} dakikada bir`}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">Seçili saatlerin içinde tekrarlanır</span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{cfg.every ? 'Başlangıç dakikası' : 'Dakika'}</span>
            <input
              type="number"
              className={input}
              min={0}
              max={59}
              value={cfg.minute}
              onChange={(e) => set({ minute: Math.min(59, Math.max(0, Number(e.target.value) || 0)) })}
            />
            <span className="text-xs text-muted-foreground">
              {cfg.every ? `Turlar: ${slotMinutes(cfg).map((m) => `:${String(m).padStart(2, '0')}`).join(' ')}` : '0 = saat başı, 30 = buçuk'}
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">En fazla katılımcı</span>
            <input
              type="number"
              className={input}
              min={2}
              max={MAX_PLAYERS}
              value={cfg.maxPlayers}
              onChange={(e) => set({ maxPlayers: Math.min(MAX_PLAYERS, Math.max(2, Number(e.target.value) || 2)) })}
            />
            <span className="text-xs text-muted-foreground">Fazlası olursa aralarından rastgele seçilir</span>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">Saatler (Türkiye saati)</span>
            <div className="flex gap-2 text-xs">
              <button type="button" className="text-primary underline" onClick={() => set({ hours: Array.from({ length: 24 }, (_, h) => h) })}>
                Hepsi
              </button>
              <button type="button" className="text-primary underline" onClick={() => set({ hours: [12, 15, 18, 21] })}>
                Günde 4
              </button>
              <button type="button" className="text-muted-foreground underline" onClick={() => set({ hours: [] })}>
                Temizle
              </button>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
            {Array.from({ length: 24 }, (_, h) => (
              <button
                key={h}
                type="button"
                onClick={() => toggleHour(h)}
                aria-pressed={cfg.hours.includes(h)}
                className={cn(
                  'h-9 rounded-lg border text-xs font-semibold tabular-nums transition-colors',
                  cfg.hours.includes(h) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground',
                )}
              >
                {cfg.every ? `${String(h).padStart(2, '0')}:xx` : `${String(h).padStart(2, '0')}:${String(cfg.minute).padStart(2, '0')}`}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-bold uppercase">Katılım şartları</h3>
            <p className="text-xs text-muted-foreground">Üye hepsini tamamlarsa otomatik olarak çembere eklenir.</p>
          </div>
          <button
            type="button"
            onClick={() => set({ conditions: [...cfg.conditions, { id: uid(), kind: 'oyun', target: 1, window: 'gun', param: null, label: '' }] })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold"
          >
            <Plus className="size-4" aria-hidden /> Şart ekle
          </button>
        </div>
        {cfg.conditions.map((c) => {
          const meta = CONDITION_KINDS[c.kind]
          const taskName = c.kind === 'gorev' && c.param ? tasks.find((t) => t.id === c.param)?.name : null
          const gameName = meta.param === 'game' && c.param ? games.find((g) => g.id === c.param)?.name : null
          return (
            <div key={c.id} className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className={input}
                  value={c.kind}
                  onChange={(e) => updCond(c.id, { kind: e.target.value as ConditionKind, param: null })}
                  aria-label="Şart türü"
                >
                  {Object.entries(CONDITION_KINDS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
                {meta.counted && (
                  <input
                    type="number"
                    min={1}
                    className={cn(input, 'w-20')}
                    value={c.target}
                    onChange={(e) => updCond(c.id, { target: Math.max(1, Number(e.target.value) || 1) })}
                    aria-label="Hedef"
                  />
                )}
                {c.kind !== 'giris' && c.kind !== 'telegram' && (
                  <select className={input} value={c.window} onChange={(e) => updCond(c.id, { window: e.target.value as ConditionWindow })} aria-label="Süre">
                    {Object.entries(WINDOW_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                )}
                {meta.param === 'task' && (
                  <select className={input} value={c.param ?? ''} onChange={(e) => updCond(c.id, { param: e.target.value || null })} aria-label="Görev">
                    <option value="">Herhangi bir görev</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
                {meta.param === 'game' && (
                  <select className={input} value={c.param ?? ''} onChange={(e) => updCond(c.id, { param: e.target.value || null })} aria-label="Oyun">
                    <option value="">Herhangi bir oyun</option>
                    {games.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => set({ conditions: cfg.conditions.filter((x) => x.id !== c.id) })}
                  className="ml-auto rounded-lg p-2 text-muted-foreground hover:text-destructive"
                  aria-label="Şartı sil"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <input
                className={input}
                placeholder={`Üyeye görünen yazı (boş bırakırsan: ${conditionText({ ...c, label: '' }, taskName, gameName)})`}
                value={c.label}
                maxLength={80}
                onChange={(e) => updCond(c.id, { label: e.target.value })}
              />
            </div>
          )
        })}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-bold uppercase">Ödüller</h3>
            <p className="text-xs text-muted-foreground">
              Kazanana hepsi birden verilir. Şu an: <span className="font-semibold text-foreground">{prizeText(cfg.prizes, names) || '—'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => set({ prizes: [...cfg.prizes, { id: uid(), type: 'coin', amount: 25, ref: null, label: '' }] })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold"
          >
            <Plus className="size-4" aria-hidden /> Ödül ekle
          </button>
        </div>
        {cfg.prizes.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-3">
            <select
              className={input}
              value={p.type}
              onChange={(e) => updPrize(p.id, { type: e.target.value as PrizeType, ref: null })}
              aria-label="Ödül türü"
            >
              {Object.entries(PRIZE_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            {(p.type === 'coin' || p.type === 'kp') && (
              <input
                type="number"
                min={1}
                className={cn(input, 'w-28')}
                value={p.amount}
                onChange={(e) => updPrize(p.id, { amount: Math.max(1, Number(e.target.value) || 1) })}
                aria-label="Miktar"
              />
            )}
            {p.type === 'badge' && (
              <select className={input} value={p.ref ?? ''} onChange={(e) => updPrize(p.id, { ref: e.target.value || null })} aria-label="Rozet">
                <option value="">Rozet seç</option>
                {badges.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            {p.type === 'market' && (
              <select className={input} value={p.ref ?? ''} onChange={(e) => updPrize(p.id, { ref: e.target.value || null })} aria-label="Market ödülü">
                <option value="">Market ödülü seç</option>
                {items.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            <input
              className={cn(input, 'min-w-40 flex-1')}
              placeholder="Duyuruda görünen ad (isteğe bağlı)"
              value={p.label}
              maxLength={60}
              onChange={(e) => updPrize(p.id, { label: e.target.value })}
            />
            <button
              type="button"
              onClick={() => set({ prizes: cfg.prizes.filter((x) => x.id !== p.id) })}
              className="rounded-lg p-2 text-muted-foreground hover:text-destructive"
              aria-label="Ödülü sil"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Market ödülü kazanana talep olarak düşer ve teslimat Market bölümündeki taleplerden takip edilir.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          <Save className="size-4" aria-hidden /> {pending ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        <button
          type="button"
          onClick={test}
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-bold disabled:opacity-60"
        >
          <Play className="size-4" aria-hidden /> 1 dakika sonra ek tur başlat
        </button>
        {msg && (
          <p role="status" className={msg.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
            {msg.text}
          </p>
        )}
      </div>

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <h3 className="font-display font-bold uppercase">Son turlar</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz tur oynanmadı.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Saat</th>
                  <th className="py-2 pr-3 font-medium">Katılımcı</th>
                  <th className="py-2 pr-3 font-medium">Kazanan</th>
                  <th className="py-2 pr-3 font-medium">Ödül</th>
                  <th className="py-2 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.slot} className="border-t border-border">
                    <td className="py-2 pr-3 tabular-nums">
                      {new Date(r.slot).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{r.players}</td>
                    <td className="py-2 pr-3 font-semibold">{r.winner ?? '—'}</td>
                    <td className="py-2 pr-3">{r.prize}</td>
                    <td className="py-2">{r.players === 0 ? 'Katılım yok' : r.paid ? 'Ödendi' : 'Bekliyor'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
