'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { setSoundMuted, useSoundMuted, type SoundName } from '@/lib/sound'
import { cn } from '@/lib/utils'

export function SoundToggle({ className }: { className?: string }) {
  const muted = useSoundMuted()
  return (
    <button
      type="button"
      onClick={() => setSoundMuted(!muted)}
      aria-pressed={!muted}
      aria-label={muted ? 'Sesleri aç' : 'Sesleri kapat'}
      title={muted ? 'Sesleri aç' : 'Sesleri kapat'}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg border border-border bg-secondary text-foreground transition-colors hover:bg-secondary/70',
        muted && 'text-muted-foreground',
        className,
      )}
    >
      {muted ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
    </button>
  )
}

/** Sound for the local player's own action, played right after the server accepts it. */
export function actionSound(game: string, type: string): SoundName {
  if (type === 'roll' || type === 'rollDice') return 'dice'
  if (type === 'shoot' || type === 'shot') return 'cue'
  if (type === 'buy' || type === 'pay' || type === 'build') return 'coin'
  if (game === 'batak' || game === 'pisti' || game === 'papaz') return 'card'
  if (game === 'okey' || game === 'okey101') return 'tile'
  if (game === 'tavla' || game === 'monopoly') return 'tile'
  if (game === 'bilardo') return 'cue'
  return 'tick'
}
