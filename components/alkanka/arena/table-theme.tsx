'use client'

import { useEffect, useId, useState } from 'react'
import useSWR from 'swr'
import { Check, Palette, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getTableTheme,
  patternCSS,
  TABLE_THEMES,
  THEME_CATEGORIES,
  THEME_RARITY,
  themeArt,
  themeLogo,
  themeVars,
  type TableTheme,
  type ThemeCategory,
  type ThemeGame,
} from '@/lib/table-themes'

type Picks = Partial<Record<ThemeGame, string>>

const KEY = '/api/me/table-themes'
const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : { picks: {} })) as Promise<{ picks: Picks }>

/** The member's saved table theme for a game. `null` keeps the game's original look untouched. */
export function useTableTheme(game: ThemeGame) {
  const { data, mutate } = useSWR(KEY, fetcher, { revalidateOnFocus: false, dedupingInterval: 60_000 })
  const theme = getTableTheme(data?.picks?.[game])
  const setTheme = async (themeId: string | null) => {
    const next: Picks = { ...(data?.picks ?? {}) }
    if (themeId) next[game] = themeId
    else delete next[game]
    await mutate(
      async () => {
        const r = await fetch(KEY, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ game, themeId }) })
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? 'Tema kaydedilemedi.')
        return r.json()
      },
      { optimisticData: { picks: next }, rollbackOnError: true, revalidate: false },
    )
  }
  return { theme, setTheme }
}

/** Props to spread onto a table surface so the `[data-tt]` CSS overrides apply. */
export function themeSurfaceProps(theme: TableTheme | null) {
  if (!theme) return {}
  return { 'data-tt': theme.id, 'data-tt-cat': theme.cat, style: themeVars(theme) }
}

/**
 * Decorative layers (art, print, fan logo, ambient light). Render as an early child of the
 * `relative` table surface so gameplay elements stay painted above it and keep all pointer input.
 */
export function ThemeDecor({ theme, logo = true, className }: { theme: TableTheme | null; logo?: boolean; className?: string }) {
  if (!theme) return null
  const art = themeArt(theme)
  const emblem = logo ? themeLogo(theme) : null
  return (
    <div aria-hidden="true" className={cn('tt-decor', className)} style={themeVars(theme)}>
      {art && <i className="tt-art" style={{ backgroundImage: `url(${art})` }} />}
      <i className="tt-pat" style={{ background: patternCSS(theme) }} />
      {emblem && <i className="tt-logo" style={{ backgroundImage: `url(${emblem})` }} />}
      {theme.ambient && <i className={cn('tt-amb', `tt-amb-${theme.ambient}`)} />}
    </div>
  )
}

const CATS = Object.keys(THEME_CATEGORIES) as ThemeCategory[]

function Swatch({ t }: { t: TableTheme }) {
  const art = themeArt(t)
  const emblem = themeLogo(t)
  return (
    <span className="tt-swatch" style={{ backgroundColor: t.felt }}>
      {art && <i className="tt-art" style={{ backgroundImage: `url(${art})` }} />}
      <i className="tt-pat" style={{ background: patternCSS(t) }} />
      {emblem && <i className="tt-logo" style={{ backgroundImage: `url(${emblem})` }} />}
    </span>
  )
}

/** Small "Masa teması" button that opens a picker; selection is saved per game for the member. */
export function TableThemePicker({ game, className }: { game: ThemeGame; className?: string }) {
  const { theme, setTheme } = useTableTheme(game)
  const [open, setOpen] = useState(false)
  const [cat, setCat] = useState<ThemeCategory>(theme?.cat ?? 'std')
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const choose = async (id: string | null) => {
    setError(null)
    try {
      await setTheme(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tema kaydedilemedi.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCat(theme?.cat ?? 'std')
          setOpen(true)
        }}
        className={cn(
          'inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-primary/40 ring-offset-2 ring-offset-background transition hover:brightness-110',
          className,
        )}
      >
        <Palette className="size-4" aria-hidden="true" />
        <span>Masa teması seç</span>
        {theme && <span className="max-w-28 truncate rounded-full bg-primary-foreground/15 px-2 py-0.5 text-xs font-semibold">{theme.name}</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85dvh] w-full max-w-xl flex-col gap-3 rounded-t-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id={titleId} className="font-display text-lg font-bold">
                Masa teması
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-secondary" aria-label="Kapat">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div role="tablist" aria-label="Tema kategorisi" className="flex gap-1.5 overflow-x-auto pb-1">
              {CATS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={cat === c}
                  onClick={() => setCat(c)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    cat === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
                  )}
                >
                  {THEME_CATEGORIES[c]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {cat === 'std' && (
                <button
                  type="button"
                  onClick={() => choose(null)}
                  aria-pressed={!theme}
                  className={cn('tt-card', !theme && 'tt-card-on')}
                >
                  <span className="tt-swatch tt-swatch-default" />
                  <span className="flex items-center justify-between gap-1 text-xs font-semibold">
                    Oyunun kendi masası {!theme && <Check className="size-3.5 text-primary" aria-hidden="true" />}
                  </span>
                </button>
              )}
              {TABLE_THEMES.filter((t) => t.cat === cat).map((t) => {
                const on = theme?.id === t.id
                return (
                  <button key={t.id} type="button" onClick={() => choose(t.id)} aria-pressed={on} className={cn('tt-card', on && 'tt-card-on')}>
                    <Swatch t={t} />
                    <span className="flex items-center justify-between gap-1 text-xs font-semibold">
                      <span className="truncate">{t.name}</span>
                      {on && <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{THEME_RARITY[t.rarity]}</span>
                  </button>
                )
              })}
            </div>
            {error && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
