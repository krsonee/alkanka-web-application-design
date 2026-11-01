'use client'

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Check, Lock, Palette, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePoints } from '@/components/alkanka/points-context'
import {
  DEFAULT_OFFERS,
  getTableTheme,
  patternCSS,
  TABLE_THEMES,
  THEME_CATEGORIES,
  THEME_RARITY,
  themeArt,
  themeLock,
  themeLogo,
  themeVars,
  type TableTheme,
  type ThemeCategory,
  type ThemeGame,
  type ThemeLock,
  type ThemeState,
} from '@/lib/table-themes'

const KEY = '/api/me/table-themes'
const EMPTY: ThemeState = { picks: {}, owned: [], level: 0, levelNames: [], catalog: DEFAULT_OFFERS, signedIn: false }
const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : EMPTY)) as Promise<ThemeState>

async function readError(r: Response, fallback: string) {
  return ((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? fallback
}

/** Member's picks, owned themes, badge level and the live catalog, shared by the picker, the game tables and the shop. */
export function useThemeState() {
  const { data, mutate, isLoading } = useSWR<ThemeState>(KEY, fetcher, { revalidateOnFocus: false, dedupingInterval: 30_000 })
  const state = data ?? EMPTY
  const owned = useMemo(() => new Set(state.owned), [state.owned])
  const lockOf = useCallback(
    (id: string): ThemeLock | null => themeLock(state.catalog[id], owned.has(id), state.level),
    [state.catalog, state.level, owned],
  )

  const pick = async (game: ThemeGame, themeId: string | null) => {
    const picks = { ...state.picks }
    if (themeId) picks[game] = themeId
    else delete picks[game]
    await mutate(
      async () => {
        const r = await fetch(KEY, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ game, themeId }) })
        if (!r.ok) throw new Error(await readError(r, 'Tema kaydedilemedi.'))
        return r.json()
      },
      { optimisticData: { ...state, picks }, rollbackOnError: true, revalidate: false },
    )
  }

  const buy = async (themeId: string) => {
    const r = await fetch(`${KEY}/buy`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ themeId }) })
    if (!r.ok) throw new Error(await readError(r, 'Satın alınamadı.'))
    const j = (await r.json()) as { balance: number; state: ThemeState }
    await mutate(j.state, { revalidate: false })
    return j.balance
  }

  return { state, loaded: Boolean(data) && !isLoading, owned, lockOf, pick, buy }
}

/** `undefined` = no shared table around, so each player sees their own pick. */
const ScopeCtx = createContext<string | null | undefined>(undefined)

/**
 * Wrap a multiplayer table so every seat renders the same theme: the rarest one picked by any seated player.
 * Pass member ids in seat order; ties go to the earlier seat.
 */
export function TableThemeScope({ game, userIds, children }: { game: ThemeGame; userIds: string[]; children: ReactNode }) {
  const ids = userIds.filter(Boolean).join(',')
  const key = ids ? `/api/table-themes/best?game=${game}&u=${encodeURIComponent(ids)}` : null
  const { data } = useSWR<{ themeId: string | null }>(key, (u: string) => fetch(u).then((r) => r.json()), {
    revalidateOnFocus: false,
    refreshInterval: 30_000,
  })
  return <ScopeCtx.Provider value={key && data ? data.themeId : undefined}>{children}</ScopeCtx.Provider>
}

/** The theme to paint on this game's table. `null` keeps the game's original look untouched. */
export function useTableTheme(game: ThemeGame) {
  const scoped = useContext(ScopeCtx)
  const { state, loaded, lockOf } = useThemeState()
  const own = state.picks[game]
  const usable = own && loaded && !lockOf(own) ? own : null
  return { theme: getTableTheme(scoped !== undefined ? scoped : usable) }
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

export function ThemeSwatch({ t, className }: { t: TableTheme | null; className?: string }) {
  if (!t) return <span className={cn('tt-swatch tt-swatch-default', className)} />
  const art = themeArt(t)
  const emblem = themeLogo(t)
  return (
    <span className={cn('tt-swatch', className)} style={{ backgroundColor: t.felt }}>
      {art && <i className="tt-art" style={{ backgroundImage: `url(${art})` }} />}
      <i className="tt-pat" style={{ background: patternCSS(t) }} />
      {emblem && <i className="tt-logo" style={{ backgroundImage: `url(${emblem})` }} />}
    </span>
  )
}

export function lockLabel(lock: ThemeLock) {
  if (lock.kind === 'level') return `Lv ${lock.level} rozeti gerekli`
  if (lock.kind === 'shop') return `${lock.price.toLocaleString('tr-TR')} KC · Mağazada`
  if (lock.kind === 'task') return 'Görev ödülü'
  return 'Şu an kullanılamıyor'
}

function ThemeCard({ t, lock, on, minLevel, onPick }: { t: TableTheme; lock: ThemeLock | null; on: boolean; minLevel: number; onPick: () => void }) {
  const body = (
    <>
      <span className="relative block">
        <ThemeSwatch t={t} />
        {lock && (
          <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-background/55">
            <Lock className="size-5 text-foreground" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="flex items-center justify-between gap-1 text-xs font-semibold">
        <span className="truncate">{t.name}</span>
        {on && <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
      </span>
      <span className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
        <span>{THEME_RARITY[t.rarity]}</span>
        <span>Lv {minLevel}</span>
      </span>
      {lock && <span className="text-[11px] font-semibold text-primary">{lockLabel(lock)}</span>}
    </>
  )
  if (lock?.kind === 'shop') {
    return (
      <Link href="/market#masa-temalari" className="tt-card opacity-90">
        {body}
      </Link>
    )
  }
  if (lock?.kind === 'task') {
    return (
      <Link href="/gorevler" className="tt-card opacity-90">
        {body}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onPick} disabled={Boolean(lock)} aria-pressed={on} className={cn('tt-card', on && 'tt-card-on', lock && 'cursor-not-allowed opacity-70')}>
      {body}
    </button>
  )
}

/** Theme row shown on the pre-game screens; the choice applies to the next table this member sits at. */
export function TableThemeField({ game, className }: { game: ThemeGame; className?: string }) {
  const { state, lockOf, pick } = useThemeState()
  const { requireLogin } = usePoints()
  const own = state.picks[game]
  const current = own && !lockOf(own) ? getTableTheme(own) : null
  const [open, setOpen] = useState(false)
  const [cat, setCat] = useState<ThemeCategory>(current?.cat ?? 'std')
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
      await pick(game, id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tema kaydedilemedi.')
    }
  }

  const levelName = state.levelNames[state.level - 1]

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-card-foreground">
        <ThemeSwatch t={current} className="w-20 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Masa teması</p>
          <p className="truncate text-sm font-bold">{current?.name ?? 'Oyunun kendi masası'}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!requireLogin()) return
            setCat(current?.cat ?? 'std')
            setError(null)
            setOpen(true)
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110"
        >
          <Palette className="size-3.5" aria-hidden="true" />
          Değiştir
        </button>
      </div>
      <p className="text-pretty text-[11px] leading-relaxed text-muted-foreground">
        Çok oyunculu masalarda oyuncular arasında en nadir temayı seçenin teması herkese uygulanır.
      </p>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85dvh] w-full max-w-2xl flex-col gap-3 rounded-t-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-lg font-bold">
                  Masa teması
                </h2>
                {state.level > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Rozetin: Lv {state.level}
                    {levelName ? ` · ${levelName}` : ''}
                  </p>
                )}
              </div>
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
            <div className="grid grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
              {cat === 'std' && (
                <button type="button" onClick={() => choose(null)} aria-pressed={!current} className={cn('tt-card', !current && 'tt-card-on')}>
                  <ThemeSwatch t={null} />
                  <span className="flex items-center justify-between gap-1 text-xs font-semibold">
                    Oyunun kendi masası {!current && <Check className="size-3.5 text-primary" aria-hidden="true" />}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Herkese açık</span>
                </button>
              )}
              {TABLE_THEMES.filter((t) => t.cat === cat).map((t) => (
                <ThemeCard
                  key={t.id}
                  t={t}
                  lock={lockOf(t.id)}
                  on={current?.id === t.id}
                  minLevel={state.catalog[t.id]?.minLevel ?? 1}
                  onPick={() => choose(t.id)}
                />
              ))}
            </div>
            {error && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
