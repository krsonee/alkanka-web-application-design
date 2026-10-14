'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Clock, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRemaining } from './mini-status'
import type { MiniGameProps } from './lucky-wheel'
import { ParticleBurst } from './particle-burst'
import { playMini } from '@/app/actions/wallet'
import { usePoints } from '../points-context'
import { DetailButton, DetailModal } from '../detail-modal'

const CHESTS = [
  { id: 'bronze', name: 'Bronz Sandık', odds: 'Sık', rewards: [40, 60, 75, 90] },
  { id: 'gold', name: 'Altın Sandık', odds: 'Nadir', rewards: [150, 200, 300, 500] },
  { id: 'silver', name: 'Gümüş Sandık', odds: 'Orta', rewards: [75, 100, 120, 150] },
] as const

const LABELS: Record<number, string> = {
  500: 'Jackpot! 500 KC',
  300: 'VIP Promo Kod + 300 KC',
  200: '24s 2x Boost + 200 KC',
  150: '150 Kanka Coin',
}

const RULES = [
  'Günde 1 sandık hakkın var, hak her gün 00:00’da yenilenir.',
  'Her sandıkta garantili ödül vardır, boş sandık yoktur.',
  'Bronz sandık sık ama küçük, altın sandık nadir ama büyük ödül verir.',
  'Kazanılan Kanka Coin anında bakiyene eklenir.',
  'Promo kod ödülleri hesabındaki “Kodlarım” alanına düşer, 7 gün geçerlidir.',
  'Bot, çoklu hesap veya otomasyon tespit edilirse ödüller iptal edilir.',
]

type Phase = 'idle' | 'shaking' | 'opened'


export function MysteryChests({ lockedFor, canPlay, onPlayed }: MiniGameProps) {
  const { setBalance } = usePoints()
  const locked = lockedFor > 0
  const [phase, setPhase] = useState<Phase>('idle')
  const [picked, setPicked] = useState<number | null>(null)
  const [contents, setContents] = useState<number[]>([])
  const [rules, setRules] = useState(false)

  function open(index: number) {
    if (phase !== 'idle' || !canPlay()) return
    setPicked(index)
    setPhase('shaking')
    const started = Date.now()
    void playMini('sandik', index).then((res) => {
      setTimeout(() => {
        if (!res.ok || res.game !== 'sandik') {
          if (typeof res.balance === 'number') setBalance(res.balance)
          setPhase('idle')
          setPicked(null)
          return
        }
        setContents(res.prizes)
        setPhase('opened')
        setBalance(res.balance)
        onPlayed()
      }, Math.max(0, 1400 - (Date.now() - started)))
    })
  }

  function reset() {
    setPhase('idle')
    setPicked(null)
  }

  const won = picked !== null ? contents[picked] : 0
  const label = (p: number) => LABELS[p] ?? `${p} Kanka Coin`

  return (
    <article className="panel-gold relative flex flex-col gap-5 overflow-hidden rounded-2xl p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col items-start gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-gold">Günlük bonus</span>
          <h3 className="font-display text-xl font-bold text-foreground">Gizemli Sandıklar</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">Günde 1 sandık seç. Her sandıkta garantili ödül var.</p>
          <DetailButton onClick={() => setRules(true)} label="Oyun kuralları" />
        </div>
        {phase === 'opened' && !locked ? (
          <button
            type="button"
            onClick={reset}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Tekrar dene
          </button>
        ) : locked ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-gold/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-gold">
            <Clock className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Sonraki sandık: </span>
            {formatRemaining(lockedFor)}
          </span>
        ) : (
          <Image
            src="/images/mascots/jako-sandik.png"
            alt=""
            width={96}
            height={96}
            className="hidden size-20 shrink-0 rounded-xl object-cover sm:block"
          />
        )}
      </header>

      <div className="grid grid-cols-3 gap-3">
        {CHESTS.map((chest, i) => {
          const isPicked = picked === i
          const revealed = phase === 'opened'
          const opened = revealed && isPicked
          return (
            <button
              key={chest.id}
              type="button"
              onClick={() => open(i)}
              disabled={phase !== 'idle' || locked}
              aria-label={revealed ? `${chest.name}: ${label(contents[i])}` : `${chest.name} aç`}
              className={cn(
                'group relative flex flex-col items-center gap-2 rounded-2xl border bg-card/70 p-2 pb-3 transition-all duration-300',
                phase === 'idle' && 'hover:-translate-y-1 hover:border-gold/50 hover:bg-card',
                isPicked ? 'border-gold/60 glow-gold' : 'border-border',
                revealed && !isPicked && 'opacity-50 grayscale-[40%]',
                locked && phase === 'idle' && 'cursor-not-allowed opacity-50 grayscale-[60%]',
              )}
            >
              <span className={cn('relative block aspect-square w-full', isPicked && phase === 'shaking' && 'animate-shake')}>
                <Image
                  src={`/images/chests/${chest.id}-${opened ? 'open' : 'closed'}.png`}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 180px, 30vw"
                  className={cn('object-contain transition-transform duration-300', opened && 'animate-pop scale-110', phase === 'idle' && 'group-hover:scale-105')}
                />
                {opened && <ParticleBurst count={24} distance={90} />}
              </span>
              {revealed ? (
                <span className={cn('animate-pop text-center text-xs font-semibold', isPicked ? 'text-gold' : 'text-muted-foreground')}>
                  {label(contents[i])}
                </span>
              ) : (
                <span className="flex flex-col items-center text-center">
                  <span className="text-xs font-semibold text-foreground">{chest.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{chest.odds}</span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div aria-live="polite" className="flex min-h-12 items-center gap-3">
        {phase === 'opened' && picked !== null ? (
          <>
            <Image src="/images/mascots/jako-kazandi.png" alt="" width={56} height={56} className="size-12 animate-pop rounded-full object-cover" />
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Jako:</span> Helal kanka!{' '}
              <span className="font-semibold text-gold">{label(won)}</span> senin.
              {locked && <> Sonraki sandık <span className="tabular-nums text-foreground">{formatRemaining(lockedFor)}</span> sonra.</>}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {phase === 'shaking'
              ? 'Sandık açılıyor…'
              : locked
                ? `Bugünkü sandığını açtın. Yeni sandık ${formatRemaining(lockedFor)} sonra (00:00).`
                : 'Açmak için bir sandığa dokun.'}
          </p>
        )}
      </div>

      <DetailModal
        onClose={() => setRules(false)}
        content={
          rules
            ? {
                eyebrow: 'Mini oyun',
                title: 'Gizemli Sandıklar kuralları',
                image: '/images/mascots/jako-sandik.png',
                description: 'Üç sandıktan birini seç, içindeki ödül anında senin. Sandık türüne göre ödül aralığı değişir.',
                prizes: CHESTS.map((c) => ({ place: c.name, prize: `${c.rewards[0]} – ${c.rewards[c.rewards.length - 1]} KC` })),
                rules: RULES,
              }
            : null
        }
      />
    </article>
  )
}
