'use client'

/*
  Gizemli Sandık in its own room: a vault with three plinths, one chest on each (the middle one on the taller
  plinth; on phones the three stand as a triangle). Each chest's reward range is on a plate on its plinth, and the
  plate turns into what the chest held once one is opened. The win is written across the top of the vault, Jako
  leans in at the lower right and says what to do (lower left on phones, where the stage is 9 : 16).

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
import { CallerBubble, JakoCaller, StageResult, StageShade, StageTitle, type CallerMood } from './mini-stage/caller'
import { burst } from './wheel-stage/burst'
import { ActionButton } from './wheel-stage/parts'

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

/** "Altın Sandık" as "Altın": the plate sits under the chest it names. */
const shortName = (name: string) => name.replace(/\s+sandık$/i, '') || name

/*
  Where each chest stands, by its place in the list: on the left, middle and right plinth of the vault art.
  Percentages of the stage; the chest art has a margin of its own under it, which is where the plate goes.
*/
const SPOTS = [
  'left-[21.8%] bottom-[21.6%] z-[2] w-[37%] @min-[600px]:left-[30.2%] @min-[600px]:bottom-[19.6%] @min-[600px]:w-[17.5%]',
  'left-1/2 bottom-[31.4%] z-[1] w-[45%] @min-[600px]:bottom-[20.7%] @min-[600px]:w-[21.5%]',
  'left-[78.2%] bottom-[19.8%] z-[2] w-[37%] @min-[600px]:left-[69.6%] @min-[600px]:bottom-[19.6%] @min-[600px]:w-[17.5%]',
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
  const [mood, setMood] = useState<CallerMood>('idle')
  const [rules, setRules] = useState(false)
  const chestRefs = useRef<(HTMLButtonElement | null)[]>([])

  async function open(index: number) {
    if (phase !== 'idle' || !canPlay()) return
    setPicked(index)
    setPhase('opening')
    setError('')
    setMood('busy')
    playSound('chip')
    const [res] = await Promise.all([draw(index), new Promise((done) => setTimeout(done, reduced ? 0 : OPEN_MS))])
    if (!res.ok) {
      setPhase('idle')
      setPicked(null)
      setMood('idle')
      setError(res.error)
      if (typeof res.balance === 'number') setBalance(res.balance)
      return
    }
    setContents(res.prizes)
    setWon(res.points)
    setPhase('opened')
    setBalance(res.balance)
    setMood('win')
    playSound('win')
    const box = chestRefs.current[index]?.getBoundingClientRect()
    if (box) burst(box.left + box.width / 2, box.top + box.height * 0.45, res.points >= jackpot ? 48 : 28)
    onPlayed()
  }

  function reset() {
    setPhase('idle')
    setPicked(null)
    setMood('idle')
  }

  const revealed = phase === 'opened'
  const plays = Math.max(1, playsLeft ?? 1)
  const says = error
    ? error
    : phase === 'opening'
      ? 'Kilit dönüyor…'
      : revealed
        ? won >= jackpot
          ? 'Jackpot! Helal kanka.'
          : 'Helal kanka, cebe girdi.'
        : locked
          ? 'Bugünkü sandığını açtın, yarın yine gel.'
          : 'Bir sandığa dokun kanka, içindeki senin.'

  return (
    <article className="flex min-w-0 flex-col gap-3">
      <section aria-labelledby="gizemli-sandik-baslik" className="@container min-w-0">
        <h3 id="gizemli-sandik-baslik" className="sr-only">
          Gizemli Sandık
        </h3>
        <div className="relative isolate aspect-[9/16] w-full overflow-hidden rounded-2xl border border-gold/25 bg-background @min-[600px]:aspect-[2/1] @min-[600px]:max-h-[600px]">
          <Image src="/images/chests/vault-mobile.webp" alt="" fill sizes="100vw" priority className="object-cover @min-[600px]:hidden" />
          <Image
            src="/images/chests/vault-desktop.webp"
            alt=""
            fill
            sizes="(min-width: 1280px) 1024px, 100vw"
            priority
            className="hidden object-cover @min-[600px]:block"
          />
          <StageShade />
          <TableBrand center={false} corners={false} jako={false} plaque="top" />
          <StageTitle
            title="Gizemli Sandık"
            sub={
              <>
                En büyük ödül <span className="text-gold">{jackpot} KC</span>
                {' · '}
                {locked ? 'yeni sandık 00:00’da' : playsLeft == null ? `günde ${config.dailyPlays} sandık` : `${plays} hakkın var`}
              </>
            }
          />

          {revealed && picked !== null && (
            <StageResult className="top-[13%] @min-[600px]:top-[8%]" points={won} label={chests[picked]?.name ?? 'Sandık'} />
          )}

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
                  'group absolute aspect-square -translate-x-1/2 rounded-2xl outline-offset-[-6px] [-webkit-tap-highlight-color:transparent] disabled:cursor-default',
                  SPOTS[i] ?? SPOTS[0],
                )}
              >
                {opened && (
                  <span
                    aria-hidden="true"
                    className="vault-beam absolute bottom-[38%] left-1/2 h-[190%] w-[86%] origin-bottom -translate-x-1/2 bg-linear-to-b from-transparent via-gold/20 to-gold/50 [clip-path:polygon(38%_0,62%_0,100%_100%,0_100%)]"
                  />
                )}
                <span
                  className={cn(
                    'absolute inset-0 transition-[filter,translate,scale] duration-300',
                    waiting && 'chest-wait group-hover:scale-[1.06] group-hover:brightness-115 group-active:scale-100',
                    isPicked && phase === 'opening' && 'chest-rattle',
                    (phase !== 'idle' || locked) && !isPicked && 'brightness-[0.45] saturate-[0.5]',
                  )}
                  style={{ animationDelay: `${i * -1.1}s` }}
                >
                  <Image
                    src={`/images/chests/stage/${chest.id}-closed.webp`}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 200px, 45vw"
                    className={cn('object-contain drop-shadow-[0_1cqw_0.8cqw_rgb(0_0_0/0.6)]', opened && 'opacity-0')}
                  />
                  <Image
                    src={`/images/chests/stage/${chest.id}-open.webp`}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 200px, 45vw"
                    className={cn('object-contain drop-shadow-[0_1cqw_0.8cqw_rgb(0_0_0/0.6)]', 'origin-[50%_86%] scale-[1.18]', opened ? 'chest-open' : 'opacity-0')}
                  />
                </span>
                <span
                  key={revealed ? 'held' : 'range'}
                  className={cn(
                    'absolute top-[91%] left-1/2 flex -translate-x-1/2 items-baseline gap-[0.4em] rounded-md px-[0.7em] py-[0.25em] text-[clamp(10px,2.9cqw,12px)] leading-tight font-extrabold whitespace-nowrap tabular-nums @min-[600px]:text-[clamp(10px,1.2cqw,13px)]',
                    revealed && 'wheel-rise',
                    opened
                      ? 'bg-gold text-gold-foreground'
                      : revealed
                        ? 'bg-background/85 text-foreground/70 inset-ring inset-ring-foreground/15'
                        : 'bg-background/85 text-foreground inset-ring inset-ring-gold/40',
                  )}
                >
                  {revealed ? (
                    `${opened ? '+' : ''}${amount.toLocaleString('tr-TR')} KC`
                  ) : (
                    <>
                      {shortName(chest.name)}
                      <span className="font-bold text-gold">{rewardRange(chest.rewards)}</span>
                    </>
                  )}
                </span>
              </button>
            )
          })}

          <JakoCaller mood={mood} className="left-[-10%] w-[48%] @min-[600px]:hidden" />
          <JakoCaller mood={mood} mirrored className="right-[-5%] hidden w-[28%] @min-[600px]:block" />

          <div className="absolute right-[4%] bottom-[2.5%] left-[33%] flex flex-col items-stretch gap-1.5 @min-[600px]:contents">
            <div className="flex @min-[600px]:absolute @min-[600px]:right-[19.5%] @min-[600px]:bottom-[6%] @min-[600px]:w-[20%] @min-[600px]:justify-end">
              <CallerBubble tail="left" tone={error ? 'error' : 'plain'} className="@min-[600px]:hidden">
                {says}
              </CallerBubble>
              <CallerBubble tail="right" tone={error ? 'error' : 'plain'} className="hidden @min-[600px]:block">
                {says}
              </CallerBubble>
            </div>
            {(revealed || locked) && (
              <div className="flex flex-col items-stretch @min-[600px]:absolute @min-[600px]:bottom-[4.5%] @min-[600px]:left-1/2 @min-[600px]:w-[20%] @min-[600px]:-translate-x-1/2">
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
              </div>
            )}
          </div>
        </div>
      </section>

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
