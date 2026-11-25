'use client'

/*
  Gizemli Sandık on the Şans Çarkı terrace: Jako on the left, the three chests on the right (the middle one raised
  on the dais, the other two on the floor in front of it), and between them the title plaque, each chest's reward
  range and what to do next. On phones (stage under 600 wide) Jako is behind the balustrade, the chests fill the
  foot of the stage and the ranges sit under it as chips.

  Which chest pays what is decided on the server (playMini) once a chest is chosen; this component shows the chosen
  chest opening and what the other two held.
*/

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Clock } from 'lucide-react'
import { playMini } from '@/app/actions/wallet'
import { CHEST_IDS } from '@/lib/rewards-shared'
import { playSound } from '@/lib/sound'
import { usePrefersReducedMotion } from '@/lib/use-motion'
import { cn } from '@/lib/utils'
import { TableBrand } from '../arena/table-brand'
import { useCatalog } from '../catalog-context'
import { DetailButton, DetailModal } from '../detail-modal'
import { usePoints } from '../points-context'
import type { MiniGameProps } from './lucky-wheel'
import { formatRemaining } from './mini-status'
import { burst } from './wheel-stage/burst'
import type { ActorState } from './wheel-stage/jako-actor'
import { ActionButton, ActionNote, PayChips, PayRows, StagePlaque, type PayRow } from './wheel-stage/parts'
import { StageBackdrop } from './wheel-stage/stage'

const rulesFor = (dailyPlays: number) => [
  `Günde ${dailyPlays} sandık hakkın var, haklar her gün 00:00’da yenilenir.`,
  'Her sandıkta garantili ödül vardır, boş sandık yoktur.',
  'Hangi sandığı açacağını sen seçersin; her sandığın ödül aralığı üstünde yazar.',
  'Kazanılan Kanka Coin anında bakiyene eklenir.',
  'Promo kod ödülleri hesabındaki “Kodlarım” alanına düşer, 7 gün geçerlidir.',
  'Bot, çoklu hesap veya otomasyon tespit edilirse ödüller iptal edilir.',
]

export type ChestDraw = (
  index: number,
) => Promise<{ ok: true; prizes: number[]; points: number; balance: number } | { ok: false; error: string; balance?: number }>

const serverDraw: ChestDraw = async (index) => {
  const res = await playMini('sandik', index)
  if (res.ok && res.game === 'sandik') return { ok: true, prizes: res.prizes, points: res.points, balance: res.balance }
  return { ok: false, error: res.ok ? 'Sandık açılamadı, tekrar dene.' : res.error, balance: res.balance }
}

type Phase = 'idle' | 'opening' | 'opened'

const OPEN_MS = 1300

const rewardRange = (rewards: number[]) => `${Math.min(...rewards)}–${Math.max(...rewards)} KC`

/** "Altın Sandık" as "Altın": the narrow pay rows sit under a plaque that already says what they are. */
const shortName = (name: string) => name.replace(/\s+sandık$/i, '') || name

/*
  Where each chest stands, by its place in the list: left and right on the floor, the middle one on the dais.
  Percentages of the stage; the chest art has a margin of its own, so the boxes overlap a little.
*/
const SPOTS = [
  'left-[19.5%] bottom-[3%] z-[2] w-[36%] @min-[600px]:left-[56.8%] @min-[600px]:bottom-[2%] @min-[600px]:w-[15.5%]',
  'left-1/2 bottom-[14%] z-[1] w-[46%] @min-[600px]:left-[69.7%] @min-[600px]:bottom-[17.5%] @min-[600px]:w-[21%]',
  'left-[80.5%] bottom-[3%] z-[2] w-[36%] @min-[600px]:left-[83.6%] @min-[600px]:bottom-[2%] @min-[600px]:w-[15.5%]',
]

/** `draw` is where an opened chest's outcome comes from: the server, unless a preview passes its own. */
export function MysteryChests({ lockedFor, playsLeft, canPlay, onPlayed, draw = serverDraw }: MiniGameProps & { draw?: ChestDraw }) {
  const { setBalance } = usePoints()
  const config = useCatalog().rewards.chest
  const reduced = usePrefersReducedMotion()
  const chests = config.chests.map((chest, i) => ({ ...chest, id: CHEST_IDS[i] ?? 'bronze' }))
  const jackpot = Math.max(...chests.flatMap((chest) => chest.rewards))
  const locked = lockedFor > 0
  const [phase, setPhase] = useState<Phase>('idle')
  const [picked, setPicked] = useState<number | null>(null)
  const [contents, setContents] = useState<number[]>([])
  const [won, setWon] = useState(0)
  const [error, setError] = useState('')
  const [actor, setActor] = useState<ActorState>('idle')
  const [rules, setRules] = useState(false)
  const chestRefs = useRef<(HTMLButtonElement | null)[]>([])

  async function open(index: number) {
    if (phase !== 'idle' || !canPlay()) return
    setPicked(index)
    setPhase('opening')
    setError('')
    setActor('spin')
    playSound('chip')
    const [res] = await Promise.all([draw(index), new Promise((done) => setTimeout(done, reduced ? 0 : OPEN_MS))])
    if (!res.ok) {
      setPhase('idle')
      setPicked(null)
      setActor('idle')
      setError(res.error)
      if (typeof res.balance === 'number') setBalance(res.balance)
      return
    }
    setContents(res.prizes)
    setWon(res.points)
    setPhase('opened')
    setBalance(res.balance)
    setActor('win')
    playSound('win')
    const box = chestRefs.current[index]?.getBoundingClientRect()
    if (box) burst(box.left + box.width / 2, box.top + box.height * 0.45, res.points >= jackpot ? 48 : 28)
    onPlayed()
  }

  function reset() {
    setPhase('idle')
    setPicked(null)
    setActor('idle')
  }

  const revealed = phase === 'opened'
  const plays = Math.max(1, playsLeft ?? 1)
  const rows: PayRow[] = chests.map((chest, i) => ({
    name: shortName(chest.name),
    prize: revealed ? `${(i === picked ? won : (contents[i] ?? 0)).toLocaleString('tr-TR')} KC` : rewardRange(chest.rewards),
  }))
  const lit = revealed ? picked : null
  const hint = error
    ? error
    : phase === 'opening'
      ? 'Sandık açılıyor…'
      : locked && !revealed
        ? 'Bugünkü sandık hakkın bitti.'
        : 'Bir sandığa dokun, içindeki ödül senin.'

  return (
    <article className="flex min-w-0 flex-col gap-3">
      <section aria-labelledby="gizemli-sandik-baslik" className="@container min-w-0">
        <h3 id="gizemli-sandik-baslik" className="sr-only">
          Gizemli Sandık
        </h3>
        <div className="relative isolate aspect-[9/16] w-full overflow-hidden rounded-2xl border border-gold/25 bg-background @min-[600px]:aspect-[2/1] @min-[600px]:max-h-[600px]">
          <StageBackdrop state={actor} armed={!locked && phase === 'idle'} />
          <TableBrand center={false} corners={false} jako={false} plaque="top" />
          <StagePlaque long>Gizemli Sandık</StagePlaque>

          <div className="absolute top-[23.5%] left-[31.5%] hidden w-[19.5%] @min-[600px]:block">
            <PayRows label="Sandıklardaki ödüller" rows={rows} lit={lit} />
          </div>

          <div
            className={cn(
              'absolute left-1/2 flex w-[84%] -translate-x-1/2 flex-col items-stretch gap-2 text-center @min-[600px]:top-[49%] @min-[600px]:bottom-[6%] @min-[600px]:left-[31.5%] @min-[600px]:w-[19.5%] @min-[600px]:translate-x-0',
              revealed || locked ? 'top-[35.5%]' : 'top-[42%]',
            )}
          >
            {revealed ? (
              <div className="wheel-rise flex flex-col items-center">
                <p className="text-[clamp(13px,3.6cqw,16px)] font-bold text-foreground [text-shadow:0_1px_0_rgb(0_0_0/0.7)] @min-[600px]:text-[clamp(11px,1.4cqw,14px)]">
                  {won >= jackpot ? 'Jackpot! Helal kanka' : 'Helal kanka!'}
                </p>
                <p className="flex items-baseline gap-1.5 font-display text-[clamp(34px,11cqw,48px)] leading-[1.1] font-extrabold tracking-tight text-gold tabular-nums [text-shadow:0_2px_0_rgb(0_0_0/0.6)] @min-[600px]:text-[clamp(22px,3.6cqw,40px)]">
                  +{won.toLocaleString('tr-TR')}
                  <span className="text-[0.42em] font-bold tracking-normal">KC</span>
                </p>
              </div>
            ) : (
              <p
                className={cn(
                  'text-[clamp(13px,3.6cqw,16px)] leading-relaxed font-semibold [text-shadow:0_1px_0_rgb(0_0_0/0.7)] @min-[600px]:text-[clamp(11px,1.4cqw,14px)]',
                  error ? 'text-destructive' : 'text-foreground/85',
                )}
              >
                {hint}
              </p>
            )}
            <div className="flex flex-col items-stretch gap-1.5 @min-[600px]:mt-auto">
              {(revealed || locked) && (
                <ActionButton onClick={reset} disabled={locked}>
                  {locked ? (
                    <>
                      <Clock className="size-4" aria-hidden="true" />
                      <span className="sr-only">Sonraki sandık: </span>
                      {formatRemaining(lockedFor)}
                    </>
                  ) : (
                    'Tekrar dene'
                  )}
                </ActionButton>
              )}
              <div className={cn(revealed && 'hidden @min-[600px]:block')}>
                <ActionNote>
                  {locked
                    ? 'Yeni sandık 00:00’da açılır.'
                    : playsLeft == null
                      ? `Günde ${config.dailyPlays} sandık hakkın var.`
                      : `${plays} sandık hakkın var.`}
                </ActionNote>
              </div>
            </div>
          </div>

          {chests.map((chest, i) => {
            const isPicked = picked === i
            const opened = revealed && isPicked
            const amount = isPicked ? won : (contents[i] ?? 0)
            const waiting = phase === 'idle' && !locked
            return (
              <button
                key={i}
                ref={(el) => {
                  chestRefs.current[i] = el
                }}
                type="button"
                onClick={() => open(i)}
                disabled={!waiting}
                aria-label={revealed ? `${chest.name}: ${amount} Kanka Coin` : `${chest.name} aç, ${rewardRange(chest.rewards)}`}
                className={cn(
                  'absolute aspect-square -translate-x-1/2 rounded-2xl outline-offset-[-6px] transition-[filter,translate] duration-300 [-webkit-tap-highlight-color:transparent] disabled:cursor-default',
                  SPOTS[i] ?? SPOTS[0],
                  waiting && 'hover:-translate-y-[3%] hover:brightness-110 active:translate-y-0',
                )}
              >
                <span
                  className={cn(
                    'absolute inset-0 transition-[filter] duration-300',
                    isPicked && phase === 'opening' && 'chest-rattle',
                    (phase !== 'idle' || locked) && !isPicked && 'brightness-[0.5] saturate-[0.55]',
                  )}
                >
                  <Image
                    src={`/images/chests/stage/${chest.id}-closed.webp`}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 220px, 42vw"
                    className={cn('object-contain drop-shadow-[0_1.2cqw_1cqw_rgb(0_0_0/0.55)]', opened && 'opacity-0')}
                  />
                  <Image
                    src={`/images/chests/stage/${chest.id}-open.webp`}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 220px, 42vw"
                    className={cn('object-contain drop-shadow-[0_1.2cqw_1cqw_rgb(0_0_0/0.55)]', opened ? 'chest-open' : 'opacity-0')}
                  />
                </span>
                <span
                  className={cn(
                    'absolute left-1/2 -translate-x-1/2 rounded-md px-2 py-0.5 text-[clamp(11px,3cqw,13px)] leading-5 font-extrabold whitespace-nowrap tabular-nums @min-[600px]:text-[clamp(10px,1.25cqw,13px)]',
                    revealed
                      ? isPicked
                        ? 'wheel-rise bottom-[90%] bg-gold text-gold-foreground'
                        : 'wheel-rise bottom-[84%] bg-background/85 text-foreground/80 inset-ring inset-ring-foreground/15'
                      : 'bottom-0 bg-background/80 text-foreground inset-ring inset-ring-gold/35',
                  )}
                >
                  {revealed ? `${isPicked ? '+' : ''}${amount.toLocaleString('tr-TR')} KC` : chest.name}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="@container">
        <div className="@min-[600px]:hidden">
          <PayChips label="Sandıklardaki ödüller" rows={rows} lit={lit} columns={3} />
        </div>
      </div>

      <section aria-label="Sandıklardan çıkabilecek ödüller" className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">İçinden neler çıkabilir?</span>
          <div className="flex items-center gap-2">
            <DetailButton onClick={() => setRules(true)} label="Oyun kuralları" />
            <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
              {locked ? formatRemaining(lockedFor) : `${plays} hak`}
            </span>
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {chests.map((chest, i) => (
            <li key={i} className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-foreground">{chest.name}</span>
              <span className="flex flex-wrap gap-1">
                {[...new Set(chest.rewards)]
                  .sort((a, b) => a - b)
                  .map((reward) => (
                    <span
                      key={reward}
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                        reward === jackpot ? 'bg-gold/20 text-gold' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {reward} KC
                    </span>
                  ))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p aria-live="polite" className="sr-only">
        {error || (revealed && picked !== null ? `${chests[picked]?.name}: ${won} Kanka Coin kazandın` : '')}
      </p>

      <DetailModal
        onClose={() => setRules(false)}
        content={
          rules
            ? {
                eyebrow: 'Mini oyun',
                title: 'Gizemli Sandıklar kuralları',
                image: '/images/mascots/jako-sandik.png',
                description: 'Üç sandıktan birini seç, içindeki ödül anında senin. Sandık türüne göre ödül aralığı değişir.',
                prizes: chests.map((chest) => ({ place: chest.name, prize: rewardRange(chest.rewards) })),
                rules: rulesFor(config.dailyPlays),
              }
            : null
        }
      />
    </article>
  )
}
