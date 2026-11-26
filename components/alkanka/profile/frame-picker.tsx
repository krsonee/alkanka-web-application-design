'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, ShoppingBag, UserRound } from 'lucide-react'
import { FrameArt, FrameRing } from '@/components/alkanka/member-avatar'
import { TIER_FRAME_CHOICE, isArtFrame, type AvatarFrame, type FrameOption, type FrameState } from '@/lib/frames-shared'
import { cn } from '@/lib/utils'

function Face({ src, className }: { src: string | null; className?: string }) {
  return (
    <span className={cn('flex size-full items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground', className)}>
      {src ? <Image src={src} alt="" width={224} height={224} className="size-full object-cover" /> : <UserRound className="size-1/2" aria-hidden />}
    </span>
  )
}

/** An avatar wearing `frame`. `large` shows a drawn frame with everything it has; small shows only its ring. */
function Framed({ src, frame, large }: { src: string | null; frame: AvatarFrame | null; large?: boolean }) {
  return (
    <span className={cn('relative block shrink-0 rounded-full', large ? 'size-28 max-sm:size-24' : 'size-12')}>
      <Face src={src} />
      {isArtFrame(frame) ? <FrameArt frame={frame} cut={large ? 'show' : 'ring'} /> : <FrameRing frame={frame} weight={large ? 'lg' : 'md'} outside />}
    </span>
  )
}

function statusOf(option: FrameOption, worn: boolean) {
  if (worn) return { text: 'Takılı', tone: 'text-gold' }
  if (option.owned) return { text: option.id === TIER_FRAME_CHOICE ? 'Kullanılabilir' : 'Sende', tone: 'text-live' }
  if (option.product) return { text: 'Markette', tone: 'text-primary' }
  return { text: 'Satışta değil', tone: 'text-muted-foreground' }
}

/** The frame a member wears: every frame can be tried on their own avatar, the ones they hold can be put on. */
export function FramePicker({
  frames,
  avatarSrc,
  pending,
  onWear,
}: {
  frames: FrameState
  avatarSrc: string | null
  pending: boolean
  onWear: (id: string) => void
}) {
  const [focus, setFocus] = useState(frames.choice)
  const shown = frames.options.find((o) => o.id === focus) ?? frames.options.find((o) => o.id === frames.choice) ?? frames.options[0]
  if (!shown) return <p className="text-sm text-muted-foreground">Çerçeveler şu an yüklenemedi, biraz sonra tekrar dene.</p>
  const worn = shown.id === frames.choice

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex h-64 items-center justify-center overflow-hidden bg-background/60 max-sm:h-56">
          <Framed src={avatarSrc} frame={shown.frame} large />
        </div>
        <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="font-display text-base font-bold text-foreground">{shown.name}</h3>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{shown.about}</p>
          </div>
          <div className="shrink-0">
            {worn ? (
              <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-gold/15 px-4 text-sm font-bold text-gold">
                <Check className="size-4" aria-hidden /> Takılı
              </span>
            ) : shown.owned ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => onWear(shown.id)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 max-sm:w-full"
              >
                {shown.id === TIER_FRAME_CHOICE ? 'Rozet çerçevesini kullan' : 'Bu çerçeveyi tak'}
              </button>
            ) : shown.product ? (
              <Link
                href={`/market/${shown.product}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary/50 px-4 text-sm font-bold text-primary transition-colors hover:bg-primary/10 max-sm:w-full"
              >
                <ShoppingBag className="size-4" aria-hidden /> Markette gör
              </Link>
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">Şu an satışta değil</span>
            )}
          </div>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {frames.options.map((option) => {
          const isWorn = option.id === frames.choice
          const status = statusOf(option, isWorn)
          return (
            <li key={option.id}>
              <button
                type="button"
                aria-pressed={option.id === shown.id}
                onClick={() => setFocus(option.id)}
                className={cn(
                  'flex h-full w-full flex-col items-center gap-3 rounded-2xl border bg-card px-3 pb-3 pt-6 text-center transition-colors',
                  option.id === shown.id ? 'border-gold' : 'border-border hover:border-gold/40',
                )}
              >
                <span className={cn('flex', !option.owned && 'opacity-70')}>
                  <Framed src={avatarSrc} frame={option.frame} />
                </span>
                <span className="mt-2 flex flex-col gap-0.5">
                  <span className="text-pretty text-sm font-semibold leading-tight text-foreground">{option.name}</span>
                  <span className={cn('text-[11px] font-bold', status.tone)}>{status.text}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
