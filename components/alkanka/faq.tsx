'use client'

import { useState } from 'react'
import { ChevronDown, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FAQ, TELEGRAM_URL } from './data'
import { JakoTip } from './jako'
import { SectionHeading } from './section-heading'

export type FaqGroup = { id: string; label: string; items: { q: string; a: string }[] }

export function Faq({ groups }: { groups?: FaqGroup[] } = {}) {
  const source = groups ?? FAQ
  const [cat, setCat] = useState(source[0]?.id ?? '')
  const [open, setOpen] = useState<string | null>(source[0]?.items[0]?.q ?? null)
  const group = source.find((g) => g.id === cat) ?? source[0]
  if (!group) {
    return (
      <JakoTip pose="dusunen" title="Soru yok">
        Sıkça sorulan sorular paneldeki SSS menüsünden eklenir.
      </JakoTip>
    )
  }

  return (
    <section aria-label="Sıkça sorulan sorular" className="flex flex-col gap-5">

      <JakoTip pose="dusunen" title="Kafana takılan mı var?">
        Cevabı burada bulamazsan Telegram&apos;dan yaz kanka, ekip 7/24 orada.
      </JakoTip>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {source.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={cat === g.id}
            onClick={() => {
              setCat(g.id)
              setOpen(g.items[0].q)
            }}
            className={cn(
              'shrink-0 rounded-lg border px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
              cat === g.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ul className="flex flex-col gap-2 xl:col-span-2">
          {group.items.map((item) => {
            const isOpen = open === item.q
            return (
              <li key={item.q} className="panel-gold overflow-hidden rounded-xl">
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : item.q)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-foreground"
                  >
                    {item.q}
                    <ChevronDown className={cn('size-4 shrink-0 text-primary transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
                  </button>
                </h3>
                {isOpen && <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>}
              </li>
            )
          })}
        </ul>

        <aside className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent/10 p-5">
          <h3 className="font-display text-lg font-bold text-foreground">Cevabını bulamadın mı?</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {"Telegram'dan doğrudan bize yaz. Kampanya ve ödeme sorunlarını ilgili partnere biz iletiyoruz."}
          </p>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto flex h-10 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            <Send className="size-4" aria-hidden="true" />
            {"Telegram'dan sor"}
          </a>
        </aside>
      </div>
    </section>
  )
}
