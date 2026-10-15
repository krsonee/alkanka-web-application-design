'use client'

import { useEffect, useRef, useState } from 'react'
import { Smile } from 'lucide-react'
import { cn } from '@/lib/utils'

const GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Sık', emojis: ['🔥', '🎉', '🎁', '💰', '💎', '🏆', '🚀', '⚡', '✅', '❤️', '👑', '⭐'] },
  { label: 'Yüz', emojis: ['😀', '😂', '🤣', '😍', '😎', '🤩', '😉', '🥳', '😱', '🤑', '😇', '🤔', '😅', '🙏', '👏', '💪'] },
  { label: 'Oyun', emojis: ['🎰', '🎲', '🃏', '♠️', '♥️', '♦️', '♣️', '🎯', '🎮', '🕹️', '🍀', '🎡', '🪙', '💵', '💸', '📈'] },
  { label: 'İşaret', emojis: ['👉', '👇', '📢', '📣', '🔔', '⏰', '⏳', '📅', '🆕', '🆓', '🔝', '💯', '❗', '⚠️', '🎊', '✨'] },
]

export function EmojiPicker({ onPick, label = 'Emoji ekle' }: { onPick: (emoji: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold',
          open ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
        )}
      >
        <Smile className="size-4" aria-hidden />
        Emoji
      </button>
      {open && (
        <div role="dialog" aria-label="Emoji seç" className="absolute right-0 z-20 mt-2 flex w-72 flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-xl">
          {GROUPS.map((g) => (
            <div key={g.label} className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{g.label}</span>
              <div className="grid grid-cols-8 gap-0.5">
                {g.emojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => onPick(e)}
                    aria-label={e}
                    className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-secondary"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
