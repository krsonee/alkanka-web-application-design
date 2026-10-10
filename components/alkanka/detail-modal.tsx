'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { Check, ScrollText } from 'lucide-react'
import { JakoAvatar, JakoTip } from './jako'
import { Modal } from './modal'

export type DetailContent = {
  eyebrow: string
  title: string
  image?: string
  description: string
  facts?: { label: string; value: string }[]
  steps?: string[]
  prizes?: { place: string; prize: string }[]
  rules: string[]
  note?: string
}

export function DetailModal({
  content,
  onClose,
  action,
}: {
  content: DetailContent | null
  onClose: () => void
  action?: ReactNode
}) {
  return (
    <Modal open={!!content} onClose={onClose} title={content?.title ?? 'Detay'}>
      {content && (
        <>
          {content.image && (
            <div className="relative h-40 shrink-0">
              <Image src={content.image} alt="" fill sizes="512px" className="object-cover" />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            </div>
          )}
          <div className="flex flex-col gap-5 p-5">
            <header className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">{content.eyebrow}</span>
              <h2 className="font-display text-2xl font-bold text-balance">{content.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{content.description}</p>
            </header>

            {content.facts && content.facts.length > 0 && (
              <dl className="grid grid-cols-2 gap-2">
                {content.facts.map((f) => (
                  <div key={f.label} className="flex flex-col gap-0.5 rounded-lg bg-background p-3">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</dt>
                    <dd className="font-display text-sm font-bold">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {content.steps && content.steps.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Nasıl yapılır?</h3>
                <ol className="flex flex-col gap-2">
                  {content.steps.map((s, i) => (
                    <li key={s} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {content.prizes && content.prizes.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Ödül dağılımı</h3>
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {content.prizes.map((p) => (
                    <li key={p.place} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{p.place} sıra</span>
                      <span className="font-display font-bold text-primary">{p.prize}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/5 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <JakoAvatar pose="dusunen" size="sm" className="size-8 rounded-lg" />
                Kurallar
              </h3>
              <ul className="flex flex-col gap-1.5">
                {content.rules.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                    <Check className="mt-1 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    {r}
                  </li>
                ))}
              </ul>
            </section>

            {content.note && (
              <JakoTip pose="dusunen" size="sm" title="Jako hatırlatıyor">
                {content.note}
              </JakoTip>
            )}
            {action}
          </div>
        </>
      )}
    </Modal>
  )
}

export function DetailButton({ onClick, label = 'Detay & kurallar' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-xs font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
    >
      <ScrollText className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  )
}
