'use client'

import { useMemo, useState } from 'react'
import { Check, Search, Target } from 'lucide-react'
import { PREDICT_PERFECT_MULT, PREDICT_PICKS, type Participant } from '@/lib/cember-shared'
import { JAKO_PP } from './cember-arena'
import { serverNow } from './cember-clock'
import { cn } from '@/lib/utils'

export function PredictPanel({
  slot,
  participants,
  meId,
  kp,
  closesAt,
  saved,
  onSaved,
  compact,
}: {
  slot: string
  participants: Participant[]
  meId: string | null
  kp: number
  closesAt: number
  saved: string[]
  onSaved: (picks: string[]) => void
  compact: boolean
}) {
  const [draft, setDraft] = useState<string[]>(saved)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const closed = serverNow() >= closesAt

  const pickable = useMemo(
    () =>
      participants
        .map((p, i) => ({ ...p, image: p.image ?? JAKO_PP[i % JAKO_PP.length] }))
        .filter((p) => p.id !== meId),
    [participants, meId],
  )
  const q = query.trim().toLocaleLowerCase('tr')
  const list = q ? pickable.filter((p) => p.name.toLocaleLowerCase('tr').includes(q)) : pickable
  const dirty = draft.length !== saved.length || draft.some((id) => !saved.includes(id))
  const maxKp = PREDICT_PICKS * kp * PREDICT_PERFECT_MULT

  const toggle = (id: string) => {
    setMsg('')
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length >= PREDICT_PICKS ? d : [...d, id]))
  }

  const submit = async () => {
    if (!draft.length || busy) return
    setBusy(true)
    setMsg('')
    const res = await fetch('/api/cember/tahmin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot, picks: draft }),
    })
      .then((r) => r.json())
      .catch(() => null)
    setBusy(false)
    if (res?.ok) {
      onSaved(res.picks)
      setMsg('Tahminin kaydedildi, turu izle kanka.')
    } else setMsg(res?.error ?? 'Tahmin kaydedilemedi.')
  }

  return (
    <section aria-labelledby="predict-title" className="flex w-full flex-col gap-2 rounded-2xl border border-gold/40 bg-card p-3 text-left">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 id="predict-title" className="flex items-center gap-1.5 font-display text-sm font-bold text-foreground">
            <Target className="size-4 text-gold" aria-hidden />
            İlk 3&apos;ü tahmin et
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {`Her doğru tahmin +${kp} KP · ${PREDICT_PICKS}/${PREDICT_PICKS} tutarsa ${PREDICT_PERFECT_MULT} kat (${maxKp} KP)`}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-secondary-foreground">
          {draft.length}/{PREDICT_PICKS}
        </span>
      </div>

      {!meId ? (
        <p className="py-2 text-center text-sm text-muted-foreground">Tahmin yapmak için giriş yap kanka.</p>
      ) : closed ? (
        <p className="py-2 text-center text-sm text-muted-foreground">
          {saved.length ? 'Tahminler kapandı, sonuçları bekle.' : 'Tahmin süresi doldu.'}
        </p>
      ) : (
        <>
          {pickable.length > 8 && (
            <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-2">
              <Search className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="sr-only">Oyuncu ara</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Oyuncu ara"
                className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
          )}
          <ul className={cn('grid grid-cols-2 gap-1.5 overflow-y-auto pr-1', compact ? 'max-h-32' : 'max-h-44')}>
            {list.slice(0, 60).map((p) => {
              const on = draft.includes(p.id)
              const full = !on && draft.length >= PREDICT_PICKS
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    disabled={full}
                    aria-pressed={on}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition-colors',
                      on ? 'border-gold bg-gold/15 text-foreground' : 'border-border bg-background text-foreground hover:border-gold/50',
                      full && 'opacity-40',
                    )}
                  >
                    <img src={p.image || '/placeholder.svg'} alt="" className="size-6 shrink-0 rounded-full object-cover" />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {on && <Check className="size-3.5 shrink-0 text-gold" aria-hidden />}
                  </button>
                </li>
              )
            })}
            {!list.length && <li className="col-span-2 py-2 text-center text-xs text-muted-foreground">Oyuncu bulunamadı</li>}
          </ul>
          <button
            type="button"
            onClick={submit}
            disabled={!draft.length || busy || !dirty}
            className="h-9 rounded-lg bg-gold text-sm font-bold text-gold-foreground transition-opacity disabled:opacity-50"
          >
            {busy ? 'Kaydediliyor...' : saved.length && !dirty ? 'Tahmin kaydedildi' : saved.length ? 'Tahmini güncelle' : 'Tahmini gönder'}
          </button>
        </>
      )}
      {msg && (
        <p role="status" className="text-center text-xs text-muted-foreground">
          {msg}
        </p>
      )}
    </section>
  )
}

/** Shown on the result screen: how the viewer's picks landed. */
export function PredictOutcome({ picks, podium, kp }: { picks: string[]; podium: string[]; kp: number }) {
  if (!picks.length || kp <= 0) return null
  const hits = picks.filter((id) => podium.includes(id)).length
  const points = hits * kp * (hits === PREDICT_PICKS ? PREDICT_PERFECT_MULT : 1)
  return (
    <p role="status" className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
      <Target className="size-3.5 text-gold" aria-hidden />
      {hits ? `Tahminin ${hits}/${PREDICT_PICKS} tuttu · +${points} KP` : `Tahminin tutmadı (0/${PREDICT_PICKS})`}
    </p>
  )
}
