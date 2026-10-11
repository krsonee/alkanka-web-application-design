import {
  Award,
  Crown,
  Eye,
  Feather,
  Flame,
  Gem,
  Heart,
  Medal,
  MessageSquare,
  Rocket,
  Shield,
  Star,
  Swords,
  Target,
  Trophy,
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
}

const TIER_STYLE: Record<string, string> = {
  bronz: 'bg-secondary text-secondary-foreground ring-border',
  altin: 'bg-gold text-gold-foreground ring-gold/40',
  elmas: 'bg-accent text-accent-foreground ring-accent/40',
  efsane: 'bg-foreground text-primary ring-primary',
}

export const TIER_TEXT: Record<string, string> = {
  bronz: 'text-muted-foreground',
  altin: 'text-gold',
  elmas: 'text-accent',
  efsane: 'text-primary',
}

const SIZES = {
  sm: { box: 'size-9', icon: 'size-4', num: 'text-sm' },
  md: { box: 'size-14', icon: 'size-6', num: 'text-xl' },
  lg: { box: 'size-20', icon: 'size-9', num: 'text-3xl' },
}

const hexClip = { clipPath: 'polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)' }

/** Hexagon emblem for a level: material changes every 5 levels. */
export function LevelEmblem({ level, size = 'md', locked = false, className }: { level: number; size?: keyof typeof SIZES; locked?: boolean; className?: string }) {
  const s = SIZES[size]
  return (
    <span
      style={hexClip}
      className={cn('flex shrink-0 items-center justify-center font-display font-bold tabular-nums', s.box, s.num, locked ? 'bg-muted text-muted-foreground' : TIER_STYLE[levelTier(level)], className)}
      aria-hidden
    >
      {level}
    </span>
  )
}

/** Round emblem for valuable (special) badges. */
export function SpecialEmblem({ icon, tier, size = 'md', className }: { icon: string; tier: string; size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size]
  const Icon = ICONS[icon] ?? Award
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-background', s.box, TIER_STYLE[tier] ?? TIER_STYLE.altin, className)} aria-hidden>
      <Icon className={s.icon} />
    </span>
  )
}
