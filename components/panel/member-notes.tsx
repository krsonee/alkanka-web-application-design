'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { confirmed } from '@/components/panel/confirm-dialog'
import { addNoteAction, deleteNoteAction } from '@/app/panel/members-actions'
import { NOTE_MAX, type MemberNote } from '@/lib/members-bulk-shared'

type Result = { ok: true; message: string } | { ok: false; error: string }

const when = (iso: string) => new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' })

export function MemberNotes({
  userId,
  notes,
  busy,
  run,
}: {
  userId: string
  notes: MemberNote[]
  busy: boolean
  run: (fn: () => Promise<Result>, after?: () => void) => void
}) {
  const [text, setText] = useState('')
  const length = text.trim().length

  return (
    <>
      <p className="text-xs leading-relaxed text-muted-foreground">Sadece panel personeli görür, üyeye gösterilmez. Notu yazan kişi ya da ana yönetici silebilir.</p>
      <textarea
        aria-label="Yeni not"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={NOTE_MAX}
        placeholder="Örn. Çekim talebinde kimlik istendi, cevap bekleniyor."
        className="resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none focus:border-primary"
      />
      <div className="flex items-center justify-between gap-3">
        <span aria-live="polite" className={cn('text-xs tabular-nums', text.length >= NOTE_MAX ? 'text-live' : 'text-muted-foreground')}>
          {`${text.length} / ${NOTE_MAX}${text.length >= NOTE_MAX ? ' · sınıra ulaştın, fazlası yazılmaz' : ''}`}
        </span>
        <button
          type="button"
          disabled={busy || length < 3}
          onClick={() => run(() => addNoteAction(userId, text), () => setText(''))}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Not ekle
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="rounded-lg bg-background px-3 py-2 text-sm text-muted-foreground">Bu üye için henüz not yok.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="flex flex-col gap-1 rounded-lg bg-background px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{n.author}</span>
                  {` · ${when(n.createdAt)}`}
                </span>
                {n.canDelete && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => confirmed('Bu not silinsin mi? Geri alınamaz.', () => run(() => deleteNoteAction(n.id)))}
                    aria-label={`${n.author} tarafından yazılan notu sil`}
                    className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
