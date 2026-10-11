import type { CSSProperties } from 'react'
import {
  Award,
  Bird,
  Coffee,
  Crown,
  Dices,
  Dumbbell,
  Ear,
  Egg,
  Eye,
  Feather,
  Flag,
  Flame,
  Gem,
  Hand,
  Handshake,
  Heart,
  Lock,
  Map,
  Medal,
  MessageSquare,
  PawPrint,
  Rocket,
  Scroll,
  Shield,
  Stamp,
  Star,
  Swords,
  Target,
  Trophy,
  WandSparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { levelTier } from '@/lib/kanka-puan-shared'
import { cn } from '@/lib/utils'

export const ICONS: Record<string, LucideIcon> = {
  award: Award,
  trophy: Trophy,
  crown: Crown,
  target: Target,
  eye: Eye,
  message: MessageSquare,
  feather: Feather,
  flame: Flame,
  gem: Gem,
  medal: Medal,
  shield: Shield,
  star: Star,
  swords: Swords,
  zap: Zap,
  heart: Heart,
  rocket: Rocket,
  bird: Bird,
}

/** One symbol per level, echoing the default badge names (Jako's journey from egg to golden parrot). */
const LEVEL_ICONS: LucideIcon[] = [
  Egg, Eye, Ear, Handshake, Coffee,
  Dices, Map, Hand, PawPrint, Flag,
  Star, Shield, Stamp, Dumbbell, Scroll,
  Trophy, Gem, Crown, WandSparkles, Bird,
]

export function levelIcon(level: number): LucideIcon {
  if (level >= LEVEL_ICONS.length) return Bird
  return LEVEL_ICONS[Math.max(0, level - 1)]
}

export const TIER_TEXT: Record<string, string> = {
  bronz: 'text-bronze',
  altin: 'text-gold',
  elmas: 'text-accent',
  efsane: 'text-ruby',
}

export const TIER_BG: Record<string, string> = {
  bronz: 'bg-bronze/10 border-bronze/30',
  altin: 'bg-gold/10 border-gold/30',
  elmas: 'bg-accent/10 border-accent/30',
  efsane: 'bg-ruby/10 border-ruby/35',
}

/** Rim metal + face enamel per tier. Efsane pairs a gold rim with ruby enamel (Jako's red tail). */
const MATERIAL: Record<string, { rim: string; face: string }> = {
  bronz: { rim: 'var(--bronze)', face: 'var(--bronze)' },
  altin: { rim: 'var(--gold)', face: 'var(--gold)' },
  elmas: { rim: 'var(--accent)', face: 'var(--accent)' },
  efsane: { rim: 'var(--gold)', face: 'var(--ruby)' },
}

function star(points: number, outer: number, inner: number) {
  const pts: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI * i) / points - Math.PI / 2
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)}% ${(50 + r * Math.sin(a)).toFixed(1)}%`)
  }
  return `polygon(${pts.join(',')})`
}

const SHAPES: Record<string, string> = {
  bronz: 'polygon(50% 0, 96% 14%, 96% 54%, 50% 100%, 4% 54%, 4% 14%)',
  altin: 'polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
  elmas: 'polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)',
  efsane: star(12, 50, 42),
  round: 'circle(50% at 50% 50%)',
}

function materialStyle(tier: string, shape: string): { rim: CSSProperties; face: CSSProperties; shine: CSSProperties } {
  const m = MATERIAL[tier] ?? MATERIAL.altin
  const clipPath = SHAPES[shape]
  return {
    rim: {
      clipPath,
      background: `conic-gradient(from 210deg, color-mix(in oklch, ${m.rim} 55%, var(--foreground)), color-mix(in oklch, ${m.rim} 60%, var(--background)), ${m.rim}, color-mix(in oklch, ${m.rim} 40%, var(--foreground)), color-mix(in oklch, ${m.rim} 55%, var(--background)), color-mix(in oklch, ${m.rim} 55%, var(--foreground)))`,
    },
    face: {
      clipPath,
      background: `radial-gradient(circle at 32% 22%, color-mix(in oklch, ${m.face} 80%, var(--foreground)) 0%, ${m.face} 38%, color-mix(in oklch, ${m.face} 45%, var(--background)) 100%)`,
    },
    shine: {
      clipPath,
      background: 'linear-gradient(165deg, color-mix(in oklch, var(--foreground) 38%, transparent) 0%, transparent 46%)',
    },
  }
}

const SIZES = {
  chip: { box: 'size-5', pad: 'p-[1.5px]', icon: 'size-2.5', tag: 'hidden', lock: 'hidden' },
  xs: { box: 'size-7', pad: 'p-[2px]', icon: 'size-3.5', tag: 'hidden', lock: 'size-3 -bottom-0.5 -right-0.5 [&>svg]:size-2' },
  sm: { box: 'size-10', pad: 'p-[2.5px]', icon: 'size-4', tag: 'hidden', lock: 'size-4 -bottom-0.5 -right-0.5 [&>svg]:size-2.5' },
  md: { box: 'size-14', pad: 'p-[3px]', icon: 'size-6', tag: 'text-[10px] min-w-5 h-5 px-1', lock: 'size-5 -bottom-0.5 -right-0.5 [&>svg]:size-3' },
  lg: { box: 'size-20', pad: 'p-1', icon: 'size-9', tag: 'text-xs min-w-6 h-6 px-1.5', lock: 'size-6 bottom-0 right-0 [&>svg]:size-3.5' },
  xl: { box: 'size-28', pad: 'p-1.5', icon: 'size-12', tag: 'text-sm min-w-8 h-8 px-2', lock: 'size-7 bottom-1 right-1 [&>svg]:size-4' },
}

export type EmblemSize = keyof typeof SIZES

function Medallion({ tier, shape, size, Icon, locked, glow, className, children }: {
  tier: string
  shape: string
  size: EmblemSize
  Icon: LucideIcon
  locked?: boolean
  glow?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const s = SIZES[size]
  const st = materialStyle(tier, shape)
  const m = MATERIAL[tier] ?? MATERIAL.altin
  return (
    <span
      className={cn('relative inline-flex shrink-0', s.box, locked && 'opacity-45 grayscale', className)}
      style={glow && !locked ? { filter: `drop-shadow(0 0 10px color-mix(in oklch, ${m.face} 55%, transparent))` } : undefined}
      aria-hidden
    >
      <span className={cn('flex size-full', s.pad)} style={st.rim}>
        <span className="relative flex size-full items-center justify-center" style={st.face}>
          <span className="absolute inset-0" style={st.shine} />
          <Icon
            className={cn('relative text-foreground', s.icon)}
            strokeWidth={2}
            style={{ filter: 'drop-shadow(0 1px 1px color-mix(in oklch, var(--background) 70%, transparent))' }}
          />
        </span>
      </span>
      {locked && (
        <span className={cn('absolute flex items-center justify-center rounded-full border border-background bg-muted text-muted-foreground', s.lock)}>
          <Lock strokeWidth={2.5} />
        </span>
      )}
      {children}
    </span>
  )
}

/** Level medallion: symbol per level, shape and metal change every 5 levels (shield, hexagon, octagon, star). */
export function LevelEmblem({ level, size = 'md', locked = false, className }: { level: number; size?: EmblemSize; locked?: boolean; className?: string }) {
  const s = SIZES[size]
  const tier = levelTier(level)
  return (
    <Medallion tier={tier} shape={tier} size={size} Icon={levelIcon(level)} locked={locked} glow={tier === 'efsane' || tier === 'elmas'} className={className}>
      {!locked && s.tag !== 'hidden' && (
        <span className={cn('absolute -bottom-0.5 -right-1 flex items-center justify-center rounded-full border-2 border-background bg-foreground font-display font-bold tabular-nums leading-none text-background', s.tag)}>
          {level}
        </span>
      )}
    </Medallion>
  )
}

/** Round medallion for valuable (special) badges. */
export function SpecialEmblem({ icon, tier, size = 'md', locked, className }: { icon: string; tier: string; size?: EmblemSize; locked?: boolean; className?: string }) {
  return <Medallion tier={tier} shape="round" size={size} Icon={ICONS[icon] ?? Award} locked={locked} glow={tier !== 'altin'} className={className} />
}

/** Compact rank marker shown next to a member's name across the site. */
export function RankChip({ level, name, showName = false, className }: { level: number; name?: string; showName?: boolean; className?: string }) {
  if (!level || level < 1) return null
  const tier = levelTier(level)
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 align-middle', className)} title={name ? `Lv ${level} · ${name}` : `Lv ${level}`}>
      <LevelEmblem level={level} size="chip" />
      <span className={cn('font-display text-[10px] font-bold leading-none tabular-nums', TIER_TEXT[tier])}>
        {showName && name ? name : `Lv${level}`}
      </span>
      <span className="sr-only">{name ? `Seviye ${level}, ${name}` : `Seviye ${level}`}</span>
    </span>
  )
}
