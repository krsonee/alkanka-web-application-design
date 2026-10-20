'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSWRConfig } from 'swr'
import { ArrowRight, Megaphone, UserRound } from 'lucide-react'
import { markInboxRead } from '@/app/actions/inbox'
import type { InboxMessage } from '@/lib/inbox'
import { JakoEmpty } from '../jako'
import { cn } from '@/lib/utils'

const TZ = 'Europe/Istanbul'
const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: TZ })
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ })

type Filter = 'hepsi' | 'ozel' | 'duyuru'

const detailLinkClass = 'flex items-center gap-1.5 self-start text-sm font-bold text-gold underline-offset-4 hover:underline'

function dayLabel(key: string, sample: Date) {
  const today = dayKeyFmt.format(new Date())
  const yesterday = dayKeyFmt.format(new Date(Date.now() - 86_400_000))
  if (key === today) return 'Bugün'
  if (key === yesterday) return 'Dün'
  return dayFmt.format(sample)
}

export function InboxList({ messages }: { messages: InboxMessage[] }) {
  const { mutate } = useSWRConfig()
  const [filter, setFilter] = useState<Filter>('hepsi')
  const hasUnread = messages.some((m) => !m.read)

  useEffect(() => {
    if (!hasUnread) return
    markInboxRead('all').then(() => mutate('inbox-status'))
  }, [hasUnread, mutate])

  const counts = useMemo(
    () => ({
      hepsi: messages.length,
      ozel: messages.filter((m) => m.personal).length,
      duyuru: messages.filter((m) => !m.personal).length,
      yeni: messages.filter((m) => !m.read).length,
    }),
    [messages],
  )

  const groups = useMemo(() => {
    const visible = messages.filter((m) => (filter === 'hepsi' ? true : filter === 'ozel' ? m.personal : !m.personal))
    const map = new Map<string, { label: string; items: InboxMessage[] }>()
    for (const m of visible) {
      const d = new Date(m.createdAt)
      const key = dayKeyFmt.format(d)
      const g = map.get(key) ?? { label: dayLabel(key, d), items: [] }
      g.items.push(m)
      map.set(key, g)
    }
    return [...map.entries()].map(([key, g]) => ({ key, ...g }))
  }, [messages, filter])

  if (!messages.length) {
    return (
      <JakoEmpty pose="dusunen" title="Mesaj kutun boş kanka">
        Sana özel bir mesaj geldiğinde Jako ekranda belirip haber verecek. Gelen tüm mesajlar burada saklanır.
      </JakoEmpty>
    )
  }

  const filters: { id: Filter; label: string }[] = [
    { id: 'hepsi', label: 'Tümü' },
    { id: 'ozel', label: 'Sana özel' },
    { id: 'duyuru', label: 'Duyurular' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Mesaj türü" className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                filter === f.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
              <span className={cn('rounded-full px-1.5 text-[10px]', filter === f.id ? 'bg-primary-foreground/20' : 'bg-secondary')}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
        {counts.yeni > 0 && (
          <span className="ml-auto rounded-full bg-gold/15 px-2.5 py-1 text-xs font-bold text-gold">{counts.yeni} yeni mesaj</span>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Bu türde mesajın yok kanka.</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-label={g.label} className="flex flex-col gap-2">
            <h3 className="sticky top-14 z-[1] self-start rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-muted-foreground backdrop-blur">
              {g.label} · {g.items.length}
            </h3>
            <ol className="flex flex-col gap-3">
              {g.items.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    'relative flex flex-col gap-2 overflow-hidden rounded-2xl border bg-card p-4',
                    m.read ? 'border-border' : 'border-primary/40',
                  )}
                >
                  {!m.read && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider',
                        m.personal ? 'bg-gold/15 text-gold' : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {m.personal ? <UserRound className="size-3" aria-hidden /> : <Megaphone className="size-3" aria-hidden />}
                      {m.personal ? 'Sana özel' : 'Duyuru'}
                    </span>
                    {!m.read && <span className="rounded-full bg-primary px-2 py-0.5 font-bold text-primary-foreground">Yeni</span>}
                    <time dateTime={m.createdAt} className="ml-auto text-muted-foreground">
                      {timeFmt.format(new Date(m.createdAt))}
                    </time>
                  </div>
                  <h4 className="font-display text-base font-bold text-foreground text-pretty">{m.title}</h4>
                  {m.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.imageUrl} alt={m.title} loading="lazy" className="max-h-96 w-full rounded-xl border border-border bg-secondary object-contain" />
                  )}
                  {m.body && <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground text-pretty">{m.body}</p>}
                  {m.url && m.url !== '/' && (
                    /^https?:\/\//.test(m.url) ? (
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className={detailLinkClass}>
                        Detaya git
                        <ArrowRight className="size-4" aria-hidden />
                      </a>
                    ) : (
                      <Link href={m.url} className={detailLinkClass}>
                        Detaya git
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    )
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  )
}
