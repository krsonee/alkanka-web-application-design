'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Coins, Loader2, Lock, Palette, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAC, usePoints } from '@/components/alkanka/points-context'
import { ThemeSwatch, useThemeState } from '@/components/alkanka/arena/table-theme'
import { TABLE_THEMES, THEME_CATEGORIES, THEME_RARITY, type ThemeCategory } from '@/lib/table-themes'

const SHOP_CATS = (Object.keys(THEME_CATEGORIES) as ThemeCategory[]).filter((c) => c !== 'std')

export function ThemeShop() {
  const { state, loaded, owned, buy } = useThemeState()
  const { points, setBalance, requireLogin } = usePoints()
  const [cat, setCat] = useState<ThemeCategory>('fan')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)

  const list = TABLE_THEMES.filter((t) => t.cat === cat && state.catalog[t.id]?.active !== false && state.catalog[t.id]?.source !== 'free')

  const onBuy = async (id: string) => {
    if (!requireLogin()) return
    setBusy(id)
    setMsg(null)
    try {
      const balance = await buy(id)
      setBalance(balance)
      setMsg({ id, text: 'Tema senin! Oyun öncesi ekranda seçebilirsin.', ok: true })
    } catch (e) {
      setMsg({ id, text: e instanceof Error ? e.message : 'Satın alınamadı.', ok: false })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section id="masa-temalari" aria-labelledby="masa-temalari-baslik" className="mx-auto flex w-full max-w-6xl scroll-mt-24 flex-col gap-4 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Palette className="size-3.5" aria-hidden="true" />
            Masa temaları
          </p>
          <h2 id="masa-temalari-baslik" className="text-balance font-display text-2xl font-bold text-foreground">
            Masanı kendi tarzına çevir
          </h2>
          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Satın aldığın tema kalıcı olarak senin olur ve okey, 101, tavla, bilardo ve batakta geçerlidir. Her temanın bir rozet seviyesi var; o seviyeye ulaşınca kullanabilirsin.
          </p>
        </div>
        {state.signedIn && (
          <p className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-card-foreground">
            Rozetin: Lv {state.level}
            {state.levelNames[state.level - 1] ? ` · ${state.levelNames[state.level - 1]}` : ''}
          </p>
        )}
      </div>

      <div role="tablist" aria-label="Tema kategorisi" className="flex gap-1.5 overflow-x-auto pb-1">
        {SHOP_CATS.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={cat === c}
            onClick={() => setCat(c)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
              cat === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
            )}
          >
            {THEME_CATEGORIES[c]}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((t) => {
          const offer = state.catalog[t.id]
          const has = owned.has(t.id)
          const lowLevel = state.signedIn && state.level < offer.minLevel
          const isTask = offer.source === 'task'
          const tooPoor = !has && !isTask && state.signedIn && points < offer.price
          return (
            <li key={t.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2.5 text-card-foreground">
              <ThemeSwatch t={t} className="aspect-[16/10] w-full" />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {THEME_RARITY[t.rarity]} · Lv {offer.minLevel}
                  </p>
                </div>
                {!isTask && !has && (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-bold tabular-nums text-primary">
                    <Coins className="size-3.5" aria-hidden="true" />
                    {formatAC(offer.price)}
                  </span>
                )}
              </div>

              {has ? (
                <p className="flex items-center justify-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground">
                  <Check className="size-3.5" aria-hidden="true" />
                  Sende
                  {lowLevel ? ` · Lv ${offer.minLevel} ile açılır` : ''}
                </p>
              ) : isTask ? (
                <Link
                  href="/gorevler"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-secondary"
                >
                  <Target className="size-3.5" aria-hidden="true" />
                  Görev ödülü
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={!loaded || busy !== null || lowLevel || tooPoor}
                  onClick={() => onBuy(t.id)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === t.id ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : lowLevel ? (
                    <Lock className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Coins className="size-3.5" aria-hidden="true" />
                  )}
                  {lowLevel ? `Lv ${offer.minLevel} rozeti gerekli` : tooPoor ? 'Coin yetersiz' : 'Satın al'}
                </button>
              )}

              {msg?.id === t.id && (
                <p role={msg.ok ? 'status' : 'alert'} className={cn('text-[11px] font-medium', msg.ok ? 'text-primary' : 'text-destructive')}>
                  {msg.text}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
