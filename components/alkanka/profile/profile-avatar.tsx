import Image from 'next/image'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { FrameArt, FrameRing } from '@/components/alkanka/member-avatar'
import { ART_FRAMES, frameLabel, isArtFrame, type AvatarFrame } from '@/lib/frames-shared'
import { cn } from '@/lib/utils'

const EDGE: Record<Exclude<AvatarFrame, 'defne' | 'mavi-alev' | 'ejder'>, string> = {
  altin: 'border-gold ring-4 ring-gold/30',
  elmas: 'border-accent ring-4 ring-accent/40',
  efsane: 'border-ruby ring-4 ring-ruby/40 shadow-lg shadow-ruby/30',
  ozel: 'border-background ring-4 ring-gold/30',
}

/** How close the drawn frame may come to what surrounds the avatar: the card's own padding takes the rest. */
const KEEP_CLEAR = '0.5rem'

/**
 * The large avatar in the profile header, with the member's frame. A drawn frame reaches well past the
 * avatar, so the avatar is given that much room on its sides and below; above it the frame lies over the cover.
 */
export function ProfileAvatar({
  frame,
  avatar,
  name,
}: {
  frame?: AvatarFrame | null
  avatar: { src: string; name: string } | null
  name: string
}) {
  const art = isArtFrame(frame) ? frame : null
  const crest = art ? ART_FRAMES[art].crest : null
  const room = crest
    ? {
        marginInline: `calc(var(--avatar) * ${((crest.w - 1) / 2).toFixed(3)} - ${KEEP_CLEAR})`,
        marginBottom: `calc(var(--avatar) * ${((crest.h - 1) / 2).toFixed(3)} - ${KEEP_CLEAR})`,
      }
    : undefined
  return (
    <span className="relative block shrink-0 size-[var(--avatar)] [--avatar:7rem] max-sm:[--avatar:6rem] md:[--avatar:8rem]" style={room}>
      <Link
        href="/profil?sekme=gorunum"
        scroll={false}
        className={cn(
          'group relative block size-full overflow-hidden rounded-full bg-background',
          art ? '' : cn('border-4', frame ? EDGE[frame as keyof typeof EDGE] : 'border-gold'),
        )}
        title={frame ? frameLabel(frame) : undefined}
        aria-label={avatar ? `Avatarın: ${avatar.name}. Değiştir` : 'Avatar seç'}
      >
        {frame === 'ozel' && <FrameRing frame="ozel" weight="lg" />}
        {avatar ? (
          <Image src={avatar.src} alt="" fill sizes="128px" className="object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center bg-primary font-display text-4xl font-bold text-primary-foreground">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-background/80 pb-2.5 pt-1 text-[10px] font-bold text-foreground opacity-90 transition-opacity group-hover:opacity-100">
          <Pencil className="size-3" aria-hidden /> {avatar ? 'Değiştir' : 'Seç'}
        </span>
      </Link>
      {art && <FrameArt frame={art} cut="crest" />}
    </span>
  )
}
