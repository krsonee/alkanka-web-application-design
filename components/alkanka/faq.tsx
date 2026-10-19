'use client'

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Check, ChevronDown, Link2, Search, SearchX, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TELEGRAM_URL } from './data'

export type FaqItem = { id: string; slug: string; q: string; a: string }
export type FaqGroup = { id: string; label: string; items: FaqItem[] }

type Cta = { href: string; label: string; external?: boolean }

const CTA_RULES: { match: RegExp; cta: Cta }[] = [
  { match: /uygulama|ana ekran|bildirim/, cta: { href: '/uygulama', label: 'Uygulamayı kur, KC kap' } },
  { match: /cekim/, cta: { href: '/guven', label: 'Çekimini paylaş' } },
  { match: /rozet/, cta: { href: '/rozetler', label: 'Rozetlere bak' } },
  { match: /seviye|siralama/, cta: { href: '/siralama', label: 'Sıralamada yerini gör' } },
  { match: /turnuva/, cta: { href: '/turnuvalar', label: 'Turnuvalara göz at' } },
  { match: /partner|sponsor/, cta: { href: '/sponsorlar', label: 'Sponsorları incele' } },
  { match: /promo|telegram|vip/, cta: { href: TELEGRAM_URL, label: 'Telegram kanalına katıl', external: true } },
  { match: /gorev/, cta: { href: '/gorevler', label: 'Görevlere git' } },
  { match: /kampanya|oran/, cta: { href: '/kampanyalar', label: 'Kampanyalara bak' } },
  { match: /market|kalkan/, cta: { href: '/market', label: 'Markete git' } },
  { match: /oyun|cark|sandik|hile/, cta: { href: '/oyunlar', label: 'Oyunlara git' } },
  { match: /sifre|hesab|guven/, cta: { href: '/guven', label: 'Güven merkezi' } },
]

const TR_MAP: Record<string, string> = { ı: 'i', ğ: 'g', ü: 'u', ş: 's', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' }

/** Length-preserving normalize so match indexes map back onto the original text. */
function normalize(value: string) {
  return value.toLocaleLowerCase('tr').replace(/[ığüşöçâîû]/g, (char) => TR_MAP[char] ?? char)
}

function ctaFor(item: FaqItem): Cta | null {
  for (const source of [normalize(item.q), normalize(item.a)]) {
    const rule = CTA_RULES.find((entry) => entry.match.test(source))
    if (rule) return rule.cta
  }
  return null
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>
  const haystack = normalize(text)
  const ranges: [number, number][] = []
  for (const term of terms) {
    let from = haystack.indexOf(term)
    while (from !== -1) {
      ranges.push([from, from + term.length])
      from = haystack.indexOf(term, from + term.length)
    }
  }
  if (!ranges.length) return <>{text}</>
  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else merged.push([...range])
  }
  const parts: ReactNode[] = []
  let cursor = 0
  merged.forEach(([start, end]) => {
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(
      <mark key={start} className="rounded-sm bg-primary/25 px-0.5 text-foreground">
        {text.slice(start, end)}
      </mark>,
    )
    cursor = end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}

function TelegramLink({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  )
}

export function Faq({ groups }: { groups: FaqGroup[] }) {
  const [cat, setCat] = useState(groups[0]?.id ?? '')
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query)

  const all = useMemo(
    () => groups.flatMap((group) => group.items.map((item) => ({ ...item, groupId: group.id, groupLabel: group.label }))),
    [groups],
  )
  const terms = useMemo(
    () => normalize(deferredQuery).split(/\s+/).filter((term) => term.length >= 2),
    [deferredQuery],
  )
  const searching = terms.length > 0
  const results = useMemo(() => {
    if (!searching) return []
    return all.filter((item) => {
      const haystack = normalize(`${item.q} ${item.a} ${item.groupLabel}`)
      return terms.every((term) => haystack.includes(term))
    })
  }, [all, terms, searching])

  const popular = useMemo(() => groups.map((group) => group.items[0]).filter(Boolean).slice(0, 4), [groups])
  const group = groups.find((entry) => entry.id === cat) ?? groups[0]
  const visible = searching ? results : (group?.items ?? []).map((item) => ({ ...item, groupId: group.id, groupLabel: group.label }))

  function focusQuestion(slug: string, smooth = true) {
    const target = all.find((item) => item.slug === slug)
    if (!target) return
    setQuery('')
    setCat(target.groupId)
    setOpen(slug)
    requestAnimationFrame(() => {
      document.getElementById(slug)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
    })
  }

  useEffect(() => {
    const fromHash = () => {
      const slug = decodeURIComponent(window.location.hash.slice(1))
      if (slug) focusQuestion(slug, false)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all])

  async function copyLink(slug: string) {
    const url = `${window.location.origin}${window.location.pathname}#${slug}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(slug)
      window.setTimeout(() => setCopied((current) => (current === slug ? null : current)), 2000)
    } catch {
      window.location.hash = slug
    }
  }

  function selectCategory(id: string) {
    setCat(id)
    setOpen(null)
    setQuery('')
  }

  if (groups.length === 0 || !group) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Sorular yakında burada olacak.
      </p>
    )
  }

  return (
    <section aria-label="Sıkça sorulan sorular" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div role="search" className="faq-search relative w-full max-w-xl">
          <label htmlFor="faq-search" className="sr-only">
            Sorularda ara
          </label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            id="faq-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('')
            }}
            placeholder="Ara: çekim, bonus, seviye, şifre..."
            autoComplete="off"
            enterKeyHint="search"
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Aramayı temizle"
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {!searching && popular.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar [mask-image:linear-gradient(to_right,#000_88%,transparent)] md:[mask-image:none]">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-primary">Çok soruldu</span>
            {popular.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => focusQuestion(item.slug)}
                className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {item.q}
              </button>
            ))}
          </div>
        )}

        <p aria-live="polite" className={cn('text-xs text-muted-foreground', !searching && 'sr-only')}>
          {searching ? `${results.length} sonuç bulundu` : ''}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6">
        <nav aria-label="Soru kategorileri" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto no-scrollbar [mask-image:linear-gradient(to_right,#000_85%,transparent)] lg:flex-col lg:overflow-visible lg:[mask-image:none]">
            {groups.map((entry) => {
              const active = !searching && cat === entry.id
              return (
                <li key={entry.id} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectCategory(entry.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {entry.label}
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[10px] tabular-nums',
                        active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {entry.items.length}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 hidden flex-col gap-2 rounded-xl border border-accent/30 bg-accent/10 p-4 lg:flex">
            <p className="text-sm font-semibold text-foreground">Cevabını bulamadın mı?</p>
            <p className="text-xs leading-relaxed text-muted-foreground">Ekip 7/24 Telegram&apos;da.</p>
            <TelegramLink className="flex h-9 items-center justify-center gap-2 rounded-lg bg-accent text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90">
              <Send className="size-3.5" aria-hidden="true" />
              {"Telegram'dan sor"}
            </TelegramLink>
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-3">
          {searching && results.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 px-5 py-8 text-center">
              <SearchX className="size-7 text-accent" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <p className="font-display text-lg font-bold text-foreground text-balance">
                  {`"${query.trim()}" için cevap bulamadık`}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                  Farklı bir kelime dene ya da Telegram&apos;dan yaz, ekip hemen yardımcı olsun.
                </p>
              </div>
              <TelegramLink className="flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90">
                <Send className="size-4" aria-hidden="true" />
                {"Telegram'dan sor"}
              </TelegramLink>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((item) => {
                const isOpen = open === item.slug || (searching && results.length <= 2)
                const cta = ctaFor(item)
                return (
                  <li
                    key={item.slug}
                    id={item.slug}
                    className={cn(
                      'panel-gold scroll-mt-28 overflow-hidden rounded-xl transition-shadow',
                      isOpen && 'faq-open',
                    )}
                  >
                    <h3>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`${item.slug}-answer`}
                        onClick={() => setOpen(open === item.slug ? null : item.slug)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-foreground"
                      >
                        <span className="flex min-w-0 flex-col gap-0.5">
                          {searching && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">{item.groupLabel}</span>
                          )}
                          <span className="text-pretty">
                            <Highlight text={item.q} terms={terms} />
                          </span>
                        </span>
                        <ChevronDown
                          className={cn('size-4 shrink-0 text-primary transition-transform duration-300', isOpen && 'rotate-180')}
                          aria-hidden="true"
                        />
                      </button>
                    </h3>
                    <div
                      id={`${item.slug}-answer`}
                      inert={!isOpen}
                      className={cn(
                        'grid transition-[grid-template-rows] duration-300 ease-out',
                        isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="flex flex-col gap-3 px-4 pb-4">
                          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                            <Highlight text={item.a} terms={terms} />
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {cta &&
                              (cta.external ? (
                                <a
                                  href={cta.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                                >
                                  {cta.label}
                                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                                </a>
                              ) : (
                                <Link
                                  href={cta.href}
                                  className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                                >
                                  {cta.label}
                                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                                </Link>
                              ))}
                            <button
                              type="button"
                              onClick={() => copyLink(item.slug)}
                              className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                            >
                              {copied === item.slug ? (
                                <Check className="size-3.5 text-success" aria-hidden="true" />
                              ) : (
                                <Link2 className="size-3.5" aria-hidden="true" />
                              )}
                              {copied === item.slug ? 'Link kopyalandı' : 'Linki kopyala'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <p className="text-center text-xs text-muted-foreground lg:hidden">
            Aradığını bulamadın mı?{' '}
            <TelegramLink className="font-semibold text-accent underline-offset-4 hover:underline">
              {"Telegram'dan sor"}
            </TelegramLink>
          </p>
        </div>
      </div>
    </section>
  )
}
