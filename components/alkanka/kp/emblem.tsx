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

const TIER_RIM: Record<string, string> = {
  bronz: 'bg-gradient-to-b from-muted-foreground/80 to-muted-foreground/20',
  altin: 'bg-gradient-to-b from-gold to-gold/30',
  elmas: 'bg-gradient-to-b from-accent to-accent/30',
  efsane: 'bg-gradient-to-br from-gold via-primary to-accent',
}

const TIER_ICON: Record<string, string> = {
  bronz: 'text-foreground/80',
  altin: 'text-gold',
  elmas: 'text-accent',
  efsane: 'text-primary',
}

export const TIER_TEXT: Record<string, string> = {
  bronz: 'text-muted-foreground',
  altin: 'text-gold',
  elmas: 'text-accent',
  efsane: 'text-primary',
}

const SIZES = {
  xs: { box: 'size-7', pad: 'p-[2px]', icon: 'size-3.5', tag: 'hidden' },
  sm: { box: 'size-9', pad: 'p-[2px]', icon: 'size-4', tag: 'hidden' },
  md: { box: 'size-12', pad: 'p-[3px]', icon: 'size-5', tag: 'text-[9px] min-w-4 h-4 px-1' },
  lg: { box: 'size-16', pad: 'p-1', icon: 'size-7', tag: 'text-[10px] min-w-5 h-5 px-1' },
}

const hexClip = { clipPath: 'polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)' }

/** Hexagon medallion for a level: symbol per level, rim material changes every 5 levels. */
export function LevelEmblem({ level, size = 'md', locked = false, className }: { level: number; size?: keyof typeof SIZES; locked?: boolean; className?: string }) {
  const s = SIZES[size]
  const tier = levelTier(level)
  const Icon = locked ? Lock : levelIcon(level)
  return (
    <span className={cn('relative inline-flex shrink-0', s.box, className)} aria-hidden>
      <span style={hexClip} className={cn('flex size-full', s.pad, locked ? 'bg-border' : TIER_RIM[tier])}>
        <span style={hexClip} className="flex size-full items-center justify-center bg-card">
          <Icon className={cn(s.icon, locked ? 'text-muted-foreground' : TIER_ICON[tier])} strokeWidth={1.75} />
        </span>
      </span>
      <span
        className={cn(
          'absolute -bottom-0.5 -right-1 items-center justify-center rounded-full border border-background font-display font-bold tabular-nums leading-none',
          s.tag === 'hidden' ? 'hidden' : 'flex',
          s.tag,
          locked ? 'bg-muted text-muted-foreground' : 'bg-foreground text-background',
        )}
      >
        {level}
      </span>
    </span>
  )
}

/** Round medallion for valuable (special) badges, with a subtle halo for top tiers. */
export function SpecialEmblem({ icon, tier, size = 'md', className }: { icon: string; tier: string; size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size]
  const Icon = ICONS[icon] ?? Award
  const rim = TIER_RIM[tier] ?? TIER_RIM.altin
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 rounded-full',
        s.box,
        s.pad,
        rim,
        tier === 'efsane' && 'shadow-[0_0_18px_-4px_var(--primary)]',
        tier === 'elmas' && 'shadow-[0_0_14px_-6px_var(--accent)]',
        className,
      )}
      aria-hidden
    >
      <span className="flex size-full items-center justify-center rounded-full bg-card ring-1 ring-inset ring-border">
        <Icon className={cn(s.icon, TIER_ICON[tier] ?? TIER_ICON.altin)} strokeWidth={1.75} />
      </span>
    </span>
  )
}
