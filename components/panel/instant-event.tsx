'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, CalendarClock, Coins, X, Zap } from 'lucide-react'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { cancelInstantEvent, saveCember, setInstantBudget, startInstantEvent, type CemberActionResult } from '@/app/panel/cember-actions'
import { GAME_META, type CemberConfig } from '@/lib/cember-shared'
import type { InstantBudget, UpcomingSlot } from '@/lib/cember'
import { cn } from '@/lib/utils'

const START_OPTIONS = [
  { seconds: 20, label: 'Hemen', hint: '20 sn içinde' },
  { seconds: 60, label: '1 dk', hint: 'geri sayımla' },
  { seconds: 180, label: '3 dk', hint: 'geri sayımla' },
  { seconds: 300, label: '5 dk', hint: 'geri sayımla' },
]

const trTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })
const trDay = (iso: string) => {
  const d = (s: string | number) => new Date(s).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })
  return d(iso) === d(Date.now()) ? 'Bugün' : 'Yarın'
}

type Clash = NonNullable<CemberActionResult['clash']>

export function InstantEvent({
  events,
  selectedId,
  upcoming,
  budget,
  onSaved,
}: {
  events: CemberConfig[]
  selectedId: string
  upcoming: UpcomingSlot[]
  budget: InstantBudget
  onSaved: (r: CemberActionResult) => void
}) {
  const [eventId, setEventId] = useState(selectedId)
  const [limit, setLimit] = useState(String(budget.dailyKc || ''))
  const [delay, setDelay] = useState(START_OPTIONS[0].seconds)
  const [clash, setClash] = useState<Clash | null>(null)
  const [pending, start] = useTransition()
  const chosen = events.find((e) => e.id === eventId) ?? events[0]

  const launch = (placeAfterClash: boolean) =>
    start(async () => {
      if (!chosen) return
      const saved = await saveCember(events)
      if (!saved.ok) return onSaved(saved)
      const r = await startInstantEvent(chosen.id, delay, placeAfterClash)
      setClash(r.clash ?? null)
      onSaved(r)
    })

  const cancel = (slot: UpcomingSlot) => {
    void askConfirm(`${trTime(slot.at)} "${slot.title}" anlık turu iptal edilsin mi? Ödül dağıtılmaz.`).then((ok) => {
      if (!ok) return
      start(async () => onSaved(await cancelInstantEvent(slot.eventId, slot.at)))
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4" aria-labelledby="instant-title">
      <div className="flex flex-col gap-1">
        <h2 id="instant-title" className="flex items-center gap-2 font-display text-lg font-bold uppercase text-foreground">
          <Zap className="size-5 text-primary" aria-hidden /> Anlık Etkinlik
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
          Sohbet hareketliyken takvime dokunmadan tur aç. Seçtiğin etkinliğin oyunu, modu, bot ayarı, şartları ve ödülü kullanılır; takvimdeki saatler değişmez.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Etkinlik</span>
            <select
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground"
              value={chosen?.id ?? ''}
              onChange={(e) => {
                setEventId(e.target.value)
                setClash(null)
              }}
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title || 'Adsız'} · {GAME_META[e.game].short}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-semibold">Başlangıç</legend>
            <div className="grid grid-cols-4 gap-2">
              {START_OPTIONS.map((o) => (
                <button
                  key={o.seconds}
                  type="button"
                  aria-pressed={delay === o.seconds}
                  onClick={() => {
                    setDelay(o.seconds)
                    setClash(null)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-sm transition-colors',
                    delay === o.seconds ? 'border-primary bg-primary/10 font-bold text-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary/50',
                  )}
                >
                  {o.label}
                  <span className="text-xs font-normal text-muted-foreground">{o.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {clash ? (
            <div role="alert" className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <p className="flex items-start gap-2 leading-relaxed text-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <span>
                  Takvimdeki &quot;{clash.title}&quot; turu {trTime(clash.at)}&apos;de başlıyor. İki tur aynı anda ekrana gelemez; anlık turu{' '}
                  <strong>{trTime(clash.suggestAt)}</strong>&apos;e koyabilirim.
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => launch(true)}
                  className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  Turdan sonraya koy ({trTime(clash.suggestAt)})
                </button>
                <button type="button" onClick={() => setClash(null)} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-semibold">
                  Vazgeç
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending || !chosen}
              onClick={() => launch(false)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              <Zap className="size-4" aria-hidden /> {pending ? 'Kuruluyor...' : 'Anlık etkinliği başlat'}
            </button>
          )}
          <form
            className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3"
            onSubmit={(e) => {
              e.preventDefault()
              start(async () => onSaved(await setInstantBudget(Number(limit) || 0)))
            }}
          >
            <label htmlFor="instant-budget" className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Coins className="size-4 text-primary" aria-hidden /> Günlük anlık etkinlik bütçesi
            </label>
            <div className="flex gap-2">
              <input
                id="instant-budget"
                type="number"
                min={0}
                step={100}
                inputMode="numeric"
                placeholder="Limit yok"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground"
              />
              <span className="inline-flex items-center text-sm text-muted-foreground">KC</span>
              <button type="submit" disabled={pending} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-60">
                Kaydet
              </button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {budget.dailyKc
                ? `Bugün ${budget.usedKc.toLocaleString('tr-TR')} / ${budget.dailyKc.toLocaleString('tr-TR')} KC ayrıldı. Her anlık tur, kazanan sayısına göre dağıtabileceği en yüksek KC kadar yer tutar; bütçeyi aşan tur açılmaz.`
                : `Limit yok. Bugün anlık turlar için ${budget.usedKc.toLocaleString('tr-TR')} KC ayrıldı. 0 ya da boş bırakırsan sınırsız olur.`}
            </p>
          </form>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Değişiklikler önce kaydedilir. Başlamadan iptal edilen turda ödül dağıtılmaz; duyuru çıkmışsa site şeridi kendiliğinden kalkar.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarClock className="size-4 text-primary" aria-hidden /> Önümüzdeki 24 saat
          </h3>
          {upcoming.length ? (
            <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border bg-background">
              {upcoming.map((s) => {
                const cancellable = s.instant && Date.parse(s.at) > Date.now() + 15_000
                return (
                  <li key={`${s.at}-${s.eventId}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="w-16 shrink-0 font-mono tabular-nums text-foreground">
                      {trTime(s.at)}
                      <span className="block text-xs text-muted-foreground">{trDay(s.at)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-foreground">{s.title}</span>
                      <span className="text-xs text-muted-foreground">{GAME_META[s.game].label}</span>
                    </span>
                    {s.instant && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">Anlık</span>}
                    {cancellable && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => cancel(s)}
                        aria-label={`${trTime(s.at)} anlık turunu iptal et`}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Önümüzdeki 24 saatte tur yok.</p>
          )}
        </div>
      </div>
    </section>
  )
}
