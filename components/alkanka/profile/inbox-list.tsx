'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useSWRConfig } from 'swr'
import { ArrowRight, Megaphone, UserRound } from 'lucide-react'
import { markInboxRead } from '@/app/actions/inbox'
import type { InboxMessage } from '@/lib/inbox'
import { JakoEmpty } from '../jako'
import { cn } from '@/lib/utils'

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

export function InboxList({ messages }: { messages: InboxMessage[] }) {
  const { mutate } = useSWRConfig()
  const hasUnread = messages.some((m) => !m.read)

  useEffect(() => {
    if (!hasUnread) return
    markInboxRead('all').then(() => mutate('inbox-status'))
  }, [hasUnread, mutate])

  if (!messages.length) {
    return (
      <JakoEmpty pose="dusunen" title="Mesaj kutun boş kanka">
        Sana özel bir mesaj geldiğinde Jako ekranda belirip haber verecek. Gelen tüm mesajlar burada saklanır.
      </JakoEmpty>
    )
  }

  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) => (
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
              {dateFmt.format(new Date(m.createdAt))}
            </time>
          </div>
          <h3 className="font-display text-base font-bold text-foreground text-pretty">{m.title}</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground text-pretty">{m.body}</p>
          {m.url && (
            <Link href={m.url} className="flex items-center gap-1.5 self-start text-sm font-bold text-gold underline-offset-4 hover:underline">
              Detaya git
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </li>
      ))}
    </ol>
  )
}
