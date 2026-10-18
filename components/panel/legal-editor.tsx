'use client'

import { useActionState } from 'react'
import { ExternalLink, Save } from 'lucide-react'
import { saveLegal, type LegalActionState } from '@/app/panel/legal-actions'
import { LEGAL_MAX, type LegalDoc } from '@/lib/legal-shared'

export function LegalEditor({ docs }: { docs: LegalDoc[] }) {
  const [state, action, pending] = useActionState<LegalActionState, FormData>(saveLegal, {})
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold uppercase text-foreground">Yasal sayfalar</h2>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Altbilgide ve kayıt formunda bağlantısı olan sayfalar. {'"## Başlık"'} satırı ara başlık, {'"- "'} ile başlayan satır madde,
          {' "**kalın**"'} kalın yazı olur. Metni tamamen silip kaydedersen varsayılan metne döner.
        </p>
      </div>
      {docs.map((d) => (
        <details key={d.slug} className="group rounded-xl border border-border bg-card">
          <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm font-bold text-foreground">
            {d.title}
            <a
              href={`/yasal/${d.slug}`}
              target="_blank"
              rel="noopener"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Sayfayı aç <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </summary>
          <div className="flex flex-col gap-3 border-t border-border p-4">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              Başlık
              <input
                name={`${d.slug}.title`}
                defaultValue={d.title}
                maxLength={80}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground focus:border-primary/50 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              Metin
              <textarea
                name={`${d.slug}.body`}
                defaultValue={d.body}
                maxLength={LEGAL_MAX}
                rows={14}
                className="rounded-lg border border-border bg-background p-3 font-mono text-xs font-normal leading-relaxed text-foreground focus:border-primary/50 focus:outline-none"
              />
            </label>
          </div>
        </details>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          <Save className="size-4" aria-hidden="true" />
          {pending ? 'Kaydediliyor…' : 'Yasal sayfaları kaydet'}
        </button>
        {state.message && (
          <p role="status" className={state.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
