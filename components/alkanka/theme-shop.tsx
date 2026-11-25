'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Coins, Eye, Loader2, Lock, Palette, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAC, usePoints } from '@/components/alkanka/points-context'
import { readAddress, useAddressChoice, writeAddress } from '@/components/alkanka/use-address-choice'
import { ThemeSwatch, useThemeState } from '@/components/alkanka/arena/table-theme'
import { ThemePreview } from '@/components/alkanka/theme-preview'
import { TABLE_THEMES, THEME_CATEGORIES, THEME_RARITY, type TableTheme, type ThemeCategory } from '@/lib/table-themes'

type ShopCategory = Exclude<ThemeCategory, 'std'>

const SHOP_CATS = (Object.keys(THEME_CATEGORIES) as ThemeCategory[]).filter((c): c is ShopCategory => c !== 'std')

/** What the theme categories are called in the page's address. */
const CATEGORY_WORD: Record<ShopCategory, string> = { fan: 'taraftar', hero: 'kahraman', car: 'araba', nat: 'doga' }

export function ThemeShop() {
  const { state, loaded, owned, buy } = useThemeState()
  const { points, setBalance, requireLogin } = usePoints()
  const [cat, setCat] = useAddressChoice('tema', CATEGORY_WORD, 'fan')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  // A copied address (`?onizle=car1&oyun=tavla`) opens the same preview.
  useEffect(() => {
    const asked = readAddress('onizle')
    if (asked && TABLE_THEMES.some((t) => t.id === asked && t.cat !== 'std')) setPreview(asked)
  }, [])

  const showPreview = (id: string | null) => {
    setPreview(id)
    writeAddress('onizle', id)
    if (!id) writeAddress('oyun', null)
  }

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

  const facts = (t: TableTheme) => {
    const offer = state.catalog[t.id]
    const has = owned.has(t.id)
    const lowLevel = state.signedIn && state.level < offer.minLevel
    const isTask = offer.source === 'task'
    const tooPoor = !has && !isTask && state.signedIn && points < offer.price
    return { offer, has, lowLevel, isTask, tooPoor }
  }

  /** What the member can do with a theme: the same control on the card and under the preview. */
  const action = (t: TableTheme) => {
    const { offer, has, lowLevel, isTask, tooPoor } = facts(t)
    if (has) {
      return (
        <p className="flex items-center justify-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground">
          <Check className="size-3.5" aria-hidden="true" />
          Sende
          {lowLevel ? ` · Lv ${offer.minLevel} ile açılır` : ''}
        </p>
      )
    }
    if (isTask) {
      return (
        <Link
          href="/gorevler"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-secondary"
        >
          <Target className="size-3.5" aria-hidden="true" />
          Görev ödülü
        </Link>
      )
    }
    return (
      <button
        type="button"
        disabled={!loaded || busy !== null || lowLevel || tooPoor}
        onClick={() => onBuy(t.id)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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
    )
  }

  const offered = preview ? state.catalog[preview] : undefined
  const shown = offered && offered.active !== false && offered.source !== 'free' ? (TABLE_THEMES.find((t) => t.id === preview) ?? null) : null
  const shownFacts = shown ? facts(shown) : null

  return (
    <section id="masa-temalari" aria-labelledby="masa-temalari-baslik" className="flex w-full scroll-mt-24 flex-col gap-4">
      <ThemePreview
        theme={shown}
        onClose={() => showPreview(null)}
        minLevel={shownFacts?.offer.minLevel ?? 1}
        price={
          !shownFacts ? null : shownFacts.has ? (
            'Bu tema sende'
          ) : shownFacts.isTask ? (
            'Görevle kazanılır'
          ) : (
            <span className="flex items-center gap-1.5 text-primary">
              <Coins className="size-4" aria-hidden="true" />
              {formatAC(shownFacts.offer.price)}
            </span>
          )
        }
        action={
          shown && (
            <div className="flex flex-col gap-1.5">
              {action(shown)}
              {msg?.id === shown.id && (
                <p role={msg.ok ? 'status' : 'alert'} className={cn('text-[11px] font-medium', msg.ok ? 'text-primary' : 'text-destructive')}>
                  {msg.text}
                </p>
              )}
            </div>
          )
        }
      />
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
            Satın aldığın tema kalıcı olarak senin olur ve okey, 101, tavla, bilardo, batak ve piştide geçerlidir. Her temanın bir rozet seviyesi var; o seviyeye ulaşınca kullanabilirsin.
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
          const { offer, has, isTask } = facts(t)
          return (
            <li key={t.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2.5 text-card-foreground">
              <button
                type="button"
                onClick={() => showPreview(t.id)}
                aria-label={`${t.name} temasını oyun masalarında önizle`}
                className="group relative block rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <ThemeSwatch t={t} className="aspect-[16/10] w-full" />
                <span className="absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-[11px] font-bold text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Eye className="size-3" aria-hidden="true" />
                  Önizle
                </span>
              </button>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-bold leading-tight text-balance" title={t.name}>{t.name}</p>
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

              {action(t)}

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
