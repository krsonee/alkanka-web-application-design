'use client'

import { useState, useTransition } from 'react'
import { Check, Link2, Loader2, Scissors } from 'lucide-react'
import { makeRecordShortLink } from '@/app/panel/record-link-actions'
import { recordPath, type RecordKind } from '@/lib/record-links'
import { SITE_URL } from '@/lib/seo'
import { cn } from '@/lib/utils'

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

type Note = { ok: boolean; text: string; url?: string }

/** "Linki kopyala" and "Kısa link üret" for one record; `compact` is the icon-only pair that fits a list row. */
export function RecordLink({ kind, id, name, compact = false, className }: { kind: RecordKind; id: string | number; name: string; compact?: boolean; className?: string }) {
  const [pending, start] = useTransition()
  const [note, setNote] = useState<Note | null>(null)
  const full = `${SITE_URL}${recordPath(kind, id, name)}`

  const copyFull = async () => {
    const done = await copy(full)
    setNote({ ok: true, text: done ? 'Link kopyalandı' : 'Kopyalanamadı, linki elle seç', url: full })
  }
  const makeShort = () =>
    start(async () => {
      const result = await makeRecordShortLink(kind, String(id), name)
      if (!result.ok) {
        setNote({ ok: false, text: result.error })
        return
      }
      const done = await copy(result.url)
      const what = result.created ? 'Kısa link üretildi' : 'Bu kaydın kısa linki zaten var'
      setNote({ ok: true, text: done ? `${what}, kopyalandı` : `${what}, elle seç`, url: result.url })
    })

  const button = compact
    ? 'flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50'
    : 'flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50'

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      <button type="button" onClick={() => void copyFull()} aria-label={compact ? `${name} linkini kopyala` : undefined} title={compact ? 'Linki kopyala' : undefined} className={button}>
        <Link2 className={compact ? 'size-4' : 'size-3.5'} aria-hidden="true" />
        {!compact && 'Linki kopyala'}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={makeShort}
        aria-label={compact ? `${name} için kısa link üret` : undefined}
        title={compact ? 'Kısa link üret' : undefined}
        className={button}
      >
        {pending ? <Loader2 className={cn('animate-spin', compact ? 'size-4' : 'size-3.5')} aria-hidden="true" /> : <Scissors className={compact ? 'size-4' : 'size-3.5'} aria-hidden="true" />}
        {!compact && 'Kısa link üret'}
      </button>
      <p role="status" className={cn('flex min-w-0 basis-full flex-wrap items-center gap-x-2 gap-y-0.5 text-xs', !note && 'sr-only', note?.ok === false ? 'text-destructive' : 'text-muted-foreground')}>
        {note && (
          <>
            <span className="flex items-center gap-1 font-semibold">
              {note.ok && <Check className="size-3.5 text-success" aria-hidden="true" />}
              {note.text}
            </span>
            {note.url && <span className="min-w-0 select-all break-all font-mono text-foreground">{note.url}</span>}
          </>
        )}
      </p>
    </div>
  )
}
