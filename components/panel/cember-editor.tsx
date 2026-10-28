'use client'


import { askConfirm } from '@/components/panel/confirm-dialog'
import { useState, useTransition } from 'react'
import { Copy, Play, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import { saveCember, startTestRound } from '@/app/panel/cember-actions'
import { CemberDemo } from './cember-demo'
import { InstantEvent } from './instant-event'
import type { UpcomingSlot } from '@/lib/cember'
import {
  CONDITION_KINDS,
  DEFAULT_CEMBER,
  MAX_EVENTS,
  MAX_PLAYERS,
  MIN_SLOT_GAP_MIN,
  NOTICE_MINUTES,
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
  WEEKDAY_SHORT,
  GAME_META,
  KD_DURATIONS,
  MAX_BOTS,
  MAX_WINNERS,
  type CemberGame,
  recommendedCemberEvents,
  slotMinutes,
} from '@/lib/cember-shared'
import { cn } from '@/lib/utils'

type Option = { id: string; name: string }
type RecentRound = { slot: string; title: string; players: number; winner: string | null; prize: string; paid: boolean }

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
  upcoming: initialUpcoming,
}: {
  initial: CemberConfig[]
  tasks: Option[]
  games: Option[]
  badges: Option[]
  items: Option[]
  recent: RecentRound[]
  upcoming: UpcomingSlot[]
}) {
  const [events, setEvents] = useState<CemberConfig[]>(initial.length ? initial : [{ ...DEFAULT_CEMBER, id: uid() }])
  const [upcoming, setUpcoming] = useState(initialUpcoming)
  const [sel, setSel] = useState(0)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const cfg = events[Math.min(sel, events.length - 1)]
  const set = (patch: Partial<CemberConfig>) => setEvents((list) => list.map((e) => (e.id === cfg.id ? { ...e, ...patch } : e)))

  const addEvent = (from?: CemberConfig) => {
    if (events.length >= MAX_EVENTS) return setMsg({ ok: false, text: `En fazla ${MAX_EVENTS} etkinlik kurabilirsin.` })
    const base = from ?? DEFAULT_CEMBER
    const next: CemberConfig = {
      ...base,
      id: uid(),
      title: from ? `${from.title} (kopya)`.slice(0, 40) : `Jako Çemberi ${events.length + 1}`,
      // New events start with no hours so they never clash with an existing schedule on save.
      hours: [],
      extraSlots: [],
      conditions: base.conditions.map((c) => ({ ...c, id: uid() })),
      prizes: base.prizes.map((p) => ({ ...p, id: uid() })),
    }
    setEvents((list) => [...list, next])
    setSel(events.length)
    setMsg(null)
  }

  const loadRecommended = () => {
    void askConfirm('Mevcut etkinliklerin yerine önerilen 5 günlük seans + hafta sonu Mega Çember yüklensin mi? Kaydet\'e basınca kalıcı olur.').then((ok) => {
      if (!ok) return
    setEvents(recommendedCemberEvents({ badgeId: badges[0]?.id ?? null, itemId: items[0]?.id ?? null }))
    setSel(0)
    setMsg({ ok: true, text: 'Şablon yüklendi. Ödülleri kontrol edip Kaydet\'e bas.' })
    })
  }

  const removeEvent = () => {
    void askConfirm(`"${cfg.title}" silinsin mi? Kaydet'e basınca kalıcı olur.`).then((ok) => {
      if (!ok) return
    setEvents((list) => list.filter((e) => e.id !== cfg.id))
    setSel((s) => Math.max(0, s - 1))
    })
  }

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
      const r = await saveCember(events)
      if (r.events) setEvents(r.events)
      if (r.upcoming) setUpcoming(r.upcoming)
      setMsg({ ok: r.ok, text: r.message })
    })

  const test = () =>
    start(async () => {
      const saved = await saveCember(events)
      if (!saved.ok) return setMsg({ ok: false, text: saved.message })
      if (saved.events) setEvents(saved.events)
      const r = await startTestRound(cfg.id, 60)
      setMsg({ ok: r.ok, text: r.message })
    })

  const hoursLabel = (e: CemberConfig) => {
    const perHour = slotMinutes(e).length
    const total = e.hours.length * perHour
    return e.enabled ? (total ? `Günde ${total} tur` : 'Saat seçilmedi') : 'Kapalı'
  }

  if (!cfg) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Hiç etkinlik yok.</p>
        <button type="button" onClick={() => addEvent()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">
          <Plus className="size-4" aria-hidden /> Etkinlik ekle
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <CemberDemo title={cfg.title} prize={prizeText(cfg.prizes, names)} />

      <InstantEvent
        key={cfg.id}
        events={events}
        selectedId={cfg.id}
        upcoming={upcoming}
        onSaved={(r) => {
          if (r.events) setEvents(r.events)
          if (r.upcoming) setUpcoming(r.upcoming)
          if (!r.clash) setMsg({ ok: r.ok, text: r.message })
        }}
      />

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Etkinlikler">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold uppercase text-foreground">Etkinlikler</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Her etkinliğin kendi saatleri, şartları ve ödülü olur. Turlar arasında en az {MIN_SLOT_GAP_MIN} dakika olmalı. Her turdan {NOTICE_MINUTES}{' '}
              dakika önce sitede ve Telegram&apos;da duyuru çıkar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadRecommended} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary px-3 text-sm font-semibold text-primary">
              <Sparkles className="size-4" aria-hidden /> Önerilen 5 seans + Mega
            </button>
            <button type="button" onClick={() => addEvent(cfg)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold">
              <Copy className="size-4" aria-hidden /> Kopyala
            </button>
            <button type="button" onClick={() => addEvent()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground">
              <Plus className="size-4" aria-hidden /> Yeni etkinlik
            </button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
          {events.map((e, i) => (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={e.id === cfg.id}
              onClick={() => setSel(i)}
              className={cn(
                'flex min-w-36 shrink-0 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors',
                e.id === cfg.id ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/50',
              )}
            >
              <span className="max-w-44 truncate text-sm font-semibold text-foreground">{e.title || 'Adsız'}</span>
              <span className="text-xs text-muted-foreground">
                {hoursLabel(e)} · {prizeText(e.prizes, names) || 'Ödül yok'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-bold uppercase text-foreground">{cfg.title || 'Etkinlik'}</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
              Şartları tamamlayan üyeler (en fazla {MAX_PLAYERS}) seçtiğin saatlerde çembere girer. Sitede olan herkese pencere açılır, oyunlar o sırada
              durur, kazanana ödül otomatik verilir ve sohbete duyuru düşer.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {events.length > 1 && (
              <button type="button" onClick={removeEvent} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" aria-hidden /> Sil
              </button>
            )}
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={cfg.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="size-4 accent-primary" />
            Etkinlik açık
          </label>
          </div>
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
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Günler (hiçbiri seçili değilse her gün)</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_SHORT.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set({ days: cfg.days.includes(i) ? cfg.days.filter((x) => x !== i) : [...cfg.days, i].sort((a, b) => a - b) })}
                  aria-pressed={cfg.days.includes(i)}
                  className={cn(
                    'h-9 min-w-12 rounded-lg border px-2 text-xs font-semibold transition-colors',
                    cfg.days.includes(i) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ArenaSettings cfg={cfg} set={set} />

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
                {meta.param === 'site' && (
                  <input
                    className={input}
                    value={c.param ?? ''}
                    onChange={(e) => updCond(c.id, { param: e.target.value.trim() || null })}
                    placeholder="Sponsor site kimliği (boş = herhangi)"
                    aria-label="Sponsor site"
                  />
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
          <Save className="size-4" aria-hidden /> {pending ? 'Kaydediliyor...' : 'Tümünü kaydet'}
        </button>
        <button
          type="button"
          onClick={test}
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-bold disabled:opacity-60"
        >
          <Play className="size-4" aria-hidden /> Bu etkinlik için 1 dk sonra test turu
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
                  <th className="py-2 pr-3 font-medium">Etkinlik</th>
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
                    <td className="py-2 pr-3">{r.title}</td>
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

const SURVIVAL_PRESETS: { id: string; label: string; desc: string; opts: CemberConfig['survival'] }[] = [
  { id: 'klasik', label: 'Herkes Kendi İçin', desc: 'Tekli. Kayan kalelere düşen elenir, belirlenen sayıda son kalan kazanır.', opts: { teams: 0, rule: 'last', shield: true } },
  { id: 'takim', label: 'Takım Savaşı', desc: 'Altın vs Mavi. Rakip takımın son oyuncusu kaleye düşünce biter. Takım kalkanı açık.', opts: { teams: 2, rule: 'last', shield: true } },
  { id: 'cogunluk', label: 'Süre Sonu Çoğunluk', desc: 'Altın vs Mavi. Süre bitince sahada daha çok oyuncusu kalan takım kazanır.', opts: { teams: 2, rule: 'most', shield: true } },
  { id: 'kaos', label: 'Kalkansız Takım', desc: 'Altın vs Mavi, kalkan yok. Takım arkadaşına çarpmak da kaleye savurabilir.', opts: { teams: 2, rule: 'last', shield: false } },
]

function ArenaSettings({ cfg, set }: { cfg: CemberConfig; set: (patch: Partial<CemberConfig>) => void }) {
  const isSv = cfg.game === 'survival'
  const isKd = cfg.game === 'karadelik' || isSv
  const sv = cfg.survival
  const setSv = (patch: Partial<CemberConfig['survival']>) => set({ survival: { ...sv, ...patch } })
  const bots = cfg.bots
  const setBots = (patch: Partial<CemberConfig['bots']>) => set({ bots: { ...bots, ...patch } })
  const tiers = [...cfg.tiers].sort((a, b) => a.min - b.min)
  const setTier = (i: number, patch: Partial<{ min: number; winners: number }>) =>
    set({ tiers: tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) })
  const clampW = (n: number) => Math.min(MAX_WINNERS, Math.max(1, Math.round(n) || 1))

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4" aria-label="Oyun ve kazananlar">
      <div>
        <h3 className="font-display text-base font-bold">Oyun, kazananlar ve botlar</h3>
        <p className="text-xs text-muted-foreground">Bu etkinlikte hangi oyun oynansın, kaç kişi ödül alsın, arena kaç kişiyle dolsun.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Oyun</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(GAME_META) as CemberGame[]).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={cfg.game === g}
              onClick={() => set(g === 'cember' ? { game: g, winnerMode: 'fixed', winners: 1 } : { game: g })}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors',
                cfg.game === g ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/50',
              )}
            >
              <span className="text-sm font-bold">{GAME_META[g].label}</span>
              <span className="text-xs text-muted-foreground">
                {g === 'cember'
                  ? 'Kaleye düşen elenir, son kalan tek kişi kazanır.'
                  : g === 'karadelik'
                    ? 'Kara deliğe düşen elenir. Süre bitince Final, son 1–10 kişi kazanır.'
                    : 'Dikey sahada iki yanda kayan kaleler. Kaleye düşen elenir. Tekli ya da Altın–Mavi takımlı.'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isSv && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
          <span className="text-sm font-semibold">Survival kuralları</span>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Hazır şablonlar</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {SURVIVAL_PRESETS.map((p) => {
                const active = p.opts.teams === sv.teams && (sv.teams === 0 || (p.opts.shield === sv.shield && p.opts.rule === sv.rule))
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSv(p.opts)}
                    className={cn(
                      'flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-colors',
                      active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50',
                    )}
                  >
                    <span className="text-xs font-bold">{p.label}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{p.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Mod</span>
            <div className="flex flex-wrap gap-2">
              {([0, 2] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={sv.teams === t}
                  onClick={() => setSv({ teams: t })}
                  className={cn(
                    'h-9 rounded-lg border px-3 text-xs font-semibold transition-colors',
                    sv.teams === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {t === 0 ? 'Tekli (herkes kendi için)' : 'Takımlı (Altın vs Mavi)'}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {sv.teams === 2
                ? 'Kazanan takımdaki tüm gerçek üyeler ödül alır, turda elenmiş olsalar bile. En az bir gerçek üye her zaman kazanan takımda olur.'
                : 'Kaleye düşen elenir. Sahada kazanan sayısı kadar oyuncu kalınca tur biter.'}
            </span>
          </div>
          {sv.teams === 2 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Kazanma kuralı</span>
              <div className="flex flex-wrap gap-2">
                {(['last', 'most'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={sv.rule === r}
                    onClick={() => setSv({ rule: r })}
                    className={cn(
                      'h-9 rounded-lg border px-3 text-xs font-semibold transition-colors',
                      sv.rule === r ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground',
                    )}
                  >
                    {r === 'last' ? 'Son kalan takım' : 'Süre sonu çoğunluk'}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {sv.rule === 'last'
                  ? 'Bir takımın sahadaki ve sıradaki tüm oyuncuları kaleye düşünce diğer takım kazanır.'
                  : 'Süre bitince sahada daha çok oyuncusu kalan takım kazanır. Eşitlikte ani ölüm: ilk oyuncusunu kaybeden takım kaybeder.'}
              </span>
            </div>
          )}
          {sv.teams === 2 && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={sv.shield} onChange={(e) => setSv({ shield: e.target.checked })} className="mt-0.5 size-4 accent-primary" />
              <span>Takım kalkanı: aynı takımdan iki oyuncu çarpışınca ikisi de 1 saniye kaleye düşmez, kale ağzından geri seker.</span>
            </label>
          )}
        </div>
      )}

      {isKd && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Final&apos;e kadar süre</span>
              <select className={input} value={cfg.duration} onChange={(e) => set({ duration: Number(e.target.value) })}>
                {KD_DURATIONS.map((s) => (
                  <option key={s} value={s}>
                    {s < 60 ? `${s} saniye` : `${s / 60} dakika`}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">Süre bitince Final Savaşı başlar, kazanan sayısına inene kadar devam eder</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Ödül paylaşımı</span>
              <select className={input} value={cfg.prizeSplit} onChange={(e) => set({ prizeSplit: e.target.value as CemberConfig['prizeSplit'] })}>
                <option value="each">Her kazanan ödülün tamamını alır</option>
                <option value="split">KC/KP kazananlar arasında bölünür</option>
              </select>
              <span className="text-xs text-muted-foreground">Rozet ve market ödülü her kazanana ayrı verilir</span>
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Kaç kişi kazansın</span>
            <div className="flex flex-wrap gap-2">
              {(['fixed', 'tiers'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={cfg.winnerMode === m}
                  onClick={() => set({ winnerMode: m })}
                  className={cn(
                    'h-9 rounded-lg border px-3 text-xs font-semibold transition-colors',
                    cfg.winnerMode === m ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {m === 'fixed' ? 'Sabit sayı' : 'Katılıma göre kademeli'}
                </button>
              ))}
            </div>
            {cfg.winnerMode === 'fixed' ? (
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={cfg.winners === n}
                    onClick={() => set({ winners: n })}
                    className={cn(
                      'h-9 min-w-12 rounded-lg border px-2 text-xs font-semibold tabular-nums transition-colors',
                      cfg.winners === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground',
                    )}
                  >
                    {n} kişi
                  </button>
                ))}
                <input
                  type="number"
                  aria-label="Kazanan sayısı"
                  className={cn(input, 'w-20')}
                  min={1}
                  max={MAX_WINNERS}
                  value={cfg.winners}
                  onChange={(e) => set({ winners: clampW(Number(e.target.value)) })}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {tiers.map((t, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <input
                      type="number"
                      aria-label="En az gerçek katılımcı"
                      className={cn(input, 'w-20')}
                      min={1}
                      max={MAX_PLAYERS}
                      value={t.min}
                      onChange={(e) => setTier(i, { min: Math.min(MAX_PLAYERS, Math.max(1, Number(e.target.value) || 1)) })}
                    />
                    <span className="text-muted-foreground">ve üstü gerçek katılımcıda</span>
                    <input
                      type="number"
                      aria-label="Kazanan sayısı"
                      className={cn(input, 'w-16')}
                      min={1}
                      max={MAX_WINNERS}
                      value={t.winners}
                      onChange={(e) => setTier(i, { winners: clampW(Number(e.target.value)) })}
                    />
                    <span className="text-muted-foreground">kişi kazanır</span>
                    {tiers.length > 1 && (
                      <button
                        type="button"
                        aria-label="Kademeyi sil"
                        onClick={() => set({ tiers: tiers.filter((_, j) => j !== i) })}
                        className="rounded-lg p-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                ))}
                {tiers.length < 6 && (
                  <button
                    type="button"
                    onClick={() => set({ tiers: [...tiers, { min: (tiers.at(-1)?.min ?? 0) + 20, winners: clampW((tiers.at(-1)?.winners ?? 1) + 2) }] })}
                    className="flex w-fit items-center gap-1 text-xs font-semibold text-primary"
                  >
                    <Plus className="size-3.5" aria-hidden /> Kademe ekle
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={bots.enabled} onChange={(e) => setBots({ enabled: e.target.checked })} className="size-4 accent-primary" />
          Az katılımda arenayı botlarla doldur
        </label>
        {bots.enabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Arena doluluğu (hedef kişi)</span>
              <input
                type="number"
                className={input}
                min={2}
                max={MAX_PLAYERS}
                value={bots.target}
                onChange={(e) => setBots({ target: Math.min(MAX_PLAYERS, Math.max(2, Number(e.target.value) || 2)) })}
              />
              <span className="text-xs text-muted-foreground">Gerçek katılımcı bu sayıdan azsa aradaki fark botla dolar</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">En fazla bot</span>
              <input
                type="number"
                className={input}
                min={0}
                max={MAX_BOTS}
                value={bots.max}
                onChange={(e) => setBots({ max: Math.min(MAX_BOTS, Math.max(0, Number(e.target.value) || 0)) })}
              />
              <span className="text-xs text-muted-foreground">Örnek: 8 gerçek kişi, hedef 64 → {Math.max(0, Math.min(bots.max, bots.target - 8))} bot eklenir</span>
            </label>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Botlar ödül almaz. Hiç gerçek katılımcı yoksa tur açılmaz.</p>
      </div>
    </section>
  )
}
