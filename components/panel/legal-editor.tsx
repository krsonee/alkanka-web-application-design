'use client'

import { useActionState, useRef, useState } from 'react'
import { Bold, Eye, ExternalLink, Heading2, List, Pencil, Save } from 'lucide-react'
import { saveLegal, type LegalActionState } from '@/app/panel/legal-actions'
import { LEGAL_MAX, type LegalDoc } from '@/lib/legal-shared'
import { renderLegalBody } from '@/lib/legal-render'
import { cn } from '@/lib/utils'

function DocEditor({ doc }: { doc: LegalDoc }) {
  const [body, setBody] = useState(doc.body)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const ref = useRef<HTMLTextAreaElement>(null)

  function apply(kind: 'bold' | 'heading' | 'list') {
    const el = ref.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e, value } = el
    let next = value
    let caret = e
    if (kind === 'bold') {
      const picked = value.slice(s, e) || 'kalın yazı'
      next = `${value.slice(0, s)}**${picked}**${value.slice(e)}`
      caret = s + picked.length + 4
    } else {
      const prefix = kind === 'heading' ? '## ' : '- '
      const lineStart = value.lastIndexOf('\n', s - 1) + 1
      const lineEndIdx = value.indexOf('\n', e)
      const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx
      const lines = value
        .slice(lineStart, lineEnd)
        .split('\n')
        .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l.replace(/^(## |- )/, '')))
        .join('\n')
      next = value.slice(0, lineStart) + lines + value.slice(lineEnd)
      caret = lineStart + lines.length
    }
    setBody(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  const tools = [
    { id: 'heading' as const, label: 'Ara başlık', icon: Heading2 },
    { id: 'bold' as const, label: 'Kalın', icon: Bold },
    { id: 'list' as const, label: 'Madde listesi', icon: List },
  ]

  return (
    <div className="flex flex-col gap-3 border-t border-border p-4">
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
        Başlık
        <input
          name={`${doc.slug}.title`}
          defaultValue={doc.title}
          maxLength={80}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1" role="toolbar" aria-label="Biçimlendirme">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={mode === 'preview'}
                onClick={() => apply(t.id)}
                title={t.label}
                aria-label={t.label}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
              >
                <t.icon className="size-4" aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg bg-secondary p-1" role="tablist" aria-label="Görünüm">
            {([
              ['edit', 'Düzenle', Pencil],
              ['preview', 'Önizleme', Eye],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => setMode(id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs',
                  mode === id ? 'bg-card font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <textarea
          ref={ref}
          name={`${doc.slug}.body`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={LEGAL_MAX}
          rows={16}
          aria-label={`${doc.title} metni`}
          className={cn(
            'rounded-lg border border-border bg-background p-3 text-sm leading-relaxed text-foreground focus:border-primary/50 focus:outline-none',
            mode === 'preview' && 'hidden',
          )}
        />
        {mode === 'preview' && (
          <div className="flex max-h-[30rem] flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-background p-5 text-sm leading-relaxed text-muted-foreground">
            {body.trim() ? renderLegalBody(body) : <p>Metin boş; kaydedersen varsayılan metin kullanılır.</p>}
          </div>
        )}
        <span className="text-right text-xs tabular-nums text-muted-foreground">{`${body.length.toLocaleString('tr-TR')}/${LEGAL_MAX.toLocaleString('tr-TR')}`}</span>
      </div>
    </div>
  )
}

export function LegalEditor({ docs }: { docs: LegalDoc[] }) {
  const [state, action, pending] = useActionState<LegalActionState, FormData>(saveLegal, {})
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold uppercase text-foreground">Yasal sayfalar</h2>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Altbilgide ve kayıt formunda bağlantısı olan sayfalar. Araç çubuğuyla ara başlık, kalın yazı ve madde ekle; Önizleme sekmesi sitedeki görünümün aynısıdır. Metni tamamen silip kaydedersen varsayılan metne döner.
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
          <DocEditor doc={d} />
        </details>
      ))}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/95 p-3 backdrop-blur">
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
