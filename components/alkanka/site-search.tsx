'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, SPONSORS } from './data'

type Result = { id: string; label: string; hint: string; href: string }

const GAMES: [string, string][] = [
  ['tavla', 'Tavla'],
  ['okey', 'Okey'],
  ['101-okey', '101 Okey'],
  ['bilardo', 'Bilardo'],
  ['blackjack', 'Blackjack'],
  ['rulet', 'Rulet'],
  ['kafa-topu', 'Kafa Topu'],
  ['kafa-basketbolu', 'Kafa Basketbolu'],
]

const INDEX: Result[] = [
  ...NAV_ITEMS.map((n) => ({ id: `p-${n.id}`, label: n.label, hint: 'Sayfa', href: n.href })),
  ...SPONSORS.map((s) => ({ id: `s-${s.id}`, label: s.name, hint: `Sponsor · ${s.welcome}`, href: `/sponsorlar#${s.id}` })),
  ...GAMES.map(([id, label]) => ({ id: `g-${id}`, label, hint: 'Oyun', href: `/oyunlar#${id}` })),
]

const normalize = (v: string) =>
  v.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i')

export function SiteSearch() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const results = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return []
    return INDEX.filter((r) => normalize(`${r.label} ${r.hint}`).includes(q)).slice(0, 8)
  }, [query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (r: Result) => {
    setOpen(false)
    setQuery('')
    router.push(r.href)
  }

  return (
    <div className="relative hidden max-w-md flex-1 md:flex">
      <label className="relative flex w-full">
        <span className="sr-only">Sayfa, site veya oyun ara</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="site-search-results"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter' && results[active]) {
              e.preventDefault()
              go(results[active])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder="Site, kampanya veya oyun ara…"
          className="h-10 w-full rounded-lg border border-border bg-card pr-14 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          Ctrl K
        </kbd>
      </label>
      {open && query.trim() && (
        <ul
          id="site-search-results"
          role="listbox"
          className="absolute top-12 left-0 z-50 w-full overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">Sonuç yok kanka, başka bir şey dene.</li>
          ) : (
            results.map((r, i) => (
              <li key={r.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(r)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm',
                    i === active ? 'bg-primary/10 text-foreground' : 'text-foreground/90',
                  )}
                >
                  <span className="truncate font-medium">{r.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{r.hint}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
