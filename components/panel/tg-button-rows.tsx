'use client'

import { useId, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { BUTTON_TEXT_MAX, MAX_POST_BUTTONS, type PostButton } from '@/lib/tg-buttons'

const input =
  'w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none'

export type LinkChoice = { label: string; url: string }

/** Buttons placed under a shared post. Posts the rows as JSON in a hidden field. */
export function ButtonRows({
  name = 'buttons',
  initial = [],
  links = [],
  legend = 'Post altı butonları',
}: {
  name?: string
  initial?: PostButton[]
  /** Ready links (short links, sponsor links) offered while typing the address. */
  links?: LinkChoice[]
  legend?: string
}) {
  const [rows, setRows] = useState<PostButton[]>(initial)
  const listId = useId()
  const edit = (index: number, patch: Partial<PostButton>) => setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-foreground">{legend}</legend>
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {links.length > 0 && (
        <datalist id={listId}>
          {links.map((link) => (
            <option key={link.url} value={link.url}>
              {link.label}
            </option>
          ))}
        </datalist>
      )}
      {rows.map((row, i) => (
        <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            aria-label={`${i + 1}. butonun yazısı`}
            value={row.text}
            maxLength={BUTTON_TEXT_MAX}
            placeholder="Örn. Siteye git"
            onChange={(e) => edit(i, { text: e.target.value })}
            className={`${input} sm:basis-2/5`}
          />
          <input
            aria-label={`${i + 1}. butonun linki`}
            value={row.url}
            type="url"
            inputMode="url"
            list={links.length ? listId : undefined}
            placeholder="https://..."
            onChange={(e) => edit(i, { url: e.target.value })}
            className={`${input} sm:flex-1`}
          />
          <button
            type="button"
            onClick={() => setRows((list) => list.filter((_, at) => at !== i))}
            aria-label={`${i + 1}. butonu kaldır`}
            className="inline-flex size-9 shrink-0 items-center justify-center self-end rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:self-auto"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      {rows.length < MAX_POST_BUTTONS && (
        <button
          type="button"
          onClick={() => setRows((list) => [...list, { text: '', url: '' }])}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Buton ekle
        </button>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {rows.length
          ? `Her buton kendi satırında çıkar. En fazla ${MAX_POST_BUTTONS} buton. Albümlü postta butonlar albümün altındaki yazıya eklenir.`
          : 'Buton yok. Eklersen bu kaynağın her paylaşımının altında çıkar.'}
        {links.length > 0 && ' Link kutusuna yazmaya başlayınca kayıtlı kısa linklerin önerilir.'}
      </p>
    </fieldset>
  )
}
