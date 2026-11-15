'use client'

import { Plus, Trash2 } from 'lucide-react'
import { btnGhost, input } from '@/components/panel/tg-hub-ui'
import type { ReplyButton } from '@/lib/tg-hub-shared'

const iconButton = 'inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-destructive'

/** Link buttons under a bot message: one row per button, text and address side by side. */
export function ReplyButtonsEditor({ value, onChange, max, label = 'Butonlar' }: { value: ReplyButton[]; onChange: (next: ReplyButton[]) => void; max: number; label?: string }) {
  const set = (index: number, patch: Partial<ReplyButton>) => onChange(value.map((b, i) => (i === index ? { ...b, ...patch } : b)))
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">
        {label} (isteğe bağlı, en fazla {max})
      </span>
      {value.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
            <input aria-label={`${i + 1}. buton yazısı`} className={input} placeholder="Buton yazısı" maxLength={40} value={b.text} onChange={(e) => set(i, { text: e.target.value })} />
            <input aria-label={`${i + 1}. buton linki`} className={input} placeholder="https://…" inputMode="url" value={b.url} onChange={(e) => set(i, { url: e.target.value })} />
          </div>
          <button type="button" className={iconButton} aria-label={`${i + 1}. butonu sil`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      {value.length < max && (
        <button type="button" className={`${btnGhost} gap-1.5 self-start`} onClick={() => onChange([...value, { text: '', url: '' }])}>
          <Plus className="size-4" aria-hidden="true" />
          Buton ekle
        </button>
      )}
    </div>
  )
}
