'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Share2 } from 'lucide-react'
import { LevelEmblem } from '@/components/alkanka/kp/emblem'
import { Modal } from '@/components/alkanka/modal'

const STORAGE_KEY = 'alkanka:last-seen-level'
const SPARKS = Array.from({ length: 18 }, (_, i) => i)

/** Celebrates once when a member arrives at a higher level than the last one this device saw. */
export function LevelUpCelebration({ userId, level, name, badge }: { userId: string; level: number; name: string; badge: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const key = `${STORAGE_KEY}:${userId}`
    const seen = Number(window.localStorage.getItem(key) ?? 0)
    if (seen && level > seen) setOpen(true)
    window.localStorage.setItem(key, String(level))
  }, [userId, level])

  async function share() {
    const text = `Alkanka'da ${name} oldum, ${badge} rozeti artık benim!`
    const url = `${window.location.origin}/rozetler`
    if (navigator.share) {
      await navigator.share({ title: 'Yeni rozet', text, url }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(`${text} ${url}`)
    setCopied(true)
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Yeni rozet açıldı" className="max-w-sm">
      <div className="relative flex flex-col items-center gap-4 overflow-hidden px-6 pb-7 pt-10 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
          {SPARKS.map((s) => (
            <span
              key={s}
              className="levelup-spark absolute size-1.5 rounded-full bg-gold"
              style={{ '--a': `${(360 / SPARKS.length) * s}deg`, animationDelay: `${(s % 3) * 120}ms` } as React.CSSProperties}
            />
          ))}
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-gold">Seviye atladın</span>
        <span className="levelup-emblem flex">
          <LevelEmblem level={level} size="xl" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-balance font-display text-2xl font-bold text-foreground">{name} oldun!</h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{badge}</span> rozeti artık isminin yanında.
          </p>
        </div>
        <Image src="/images/badges/hero-jako-rozet.png" alt="Jako rozetini kutluyor" width={120} height={120} className="h-24 w-auto object-contain" />
        <div className="flex w-full flex-col gap-2">
          <button type="button" onClick={share} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground">
            <Share2 className="size-4" aria-hidden /> {copied ? 'Link kopyalandı' : 'Paylaş'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="h-10 text-sm font-semibold text-muted-foreground hover:text-foreground">
            Devam et
          </button>
        </div>
      </div>
    </Modal>
  )
}
