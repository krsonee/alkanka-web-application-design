'use client'

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/alkanka/modal'
import { useAddressChoice } from '@/components/alkanka/use-address-choice'
import { ThemeDecor, themeSurfaceProps } from '@/components/alkanka/arena/table-theme'
import { THEME_GAMES, THEME_RARITY, type TableTheme, type ThemeGame } from '@/lib/table-themes'

const GAME_NAMES: Record<ThemeGame, string> = {
  okey: 'Okey',
  '101': '101 Okey',
  tavla: 'Tavla',
  bilardo: 'Bilardo',
  batak: 'Batak',
  pisti: 'Pişti',
}

/** What each game is called in the page's address (`?oyun=tavla`). */
const GAME_WORDS: Record<ThemeGame, string> = { okey: 'okey', '101': '101', tavla: 'tavla', bilardo: 'bilardo', batak: 'batak', pisti: 'pisti' }

const TILE_INKS = ['ttp-ink-red', 'ttp-ink-blue', 'ttp-ink-black', 'ttp-ink-amber'] as const

function Tile({ n, ink, className }: { n: number; ink: number; className?: string }) {
  return <i className={cn('ttp-tile', TILE_INKS[ink % 4], className)}>{n}</i>
}

function Seats() {
  return (
    <>
      <i className="ttp-seat" style={{ left: '50%', top: '9%' }} />
      <i className="ttp-seat" style={{ left: '7%', top: '46%' }} />
      <i className="ttp-seat" style={{ left: '93%', top: '46%' }} />
    </>
  )
}

const RACK = [3, 4, 5, 9, 9, 9, 11, 12, 13, 1, 7, 7, 7, 2]

function OkeyScene({ melds }: { melds: boolean }) {
  return (
    <>
      <Seats />
      <div className="ttp-center">
        <i className="ttp-pile" />
        <Tile n={8} ink={0} />
      </div>
      {melds && (
        <div className="ttp-melds">
          {[0, 1, 2].map((g) => (
            <span key={g}>
              {[0, 1, 2, 3].map((k) => (
                <Tile key={k} n={g === 1 ? 10 : 4 + k + g} ink={g === 1 ? k : g} className="ttp-tile-sm" />
              ))}
            </span>
          ))}
        </div>
      )}
      <div className="ttp-rack">
        {RACK.map((n, i) => (
          <Tile key={i} n={n} ink={i < 3 ? 0 : i < 6 ? i : i < 9 ? 2 : i < 10 ? 3 : i < 13 ? i : 1} />
        ))}
      </div>
    </>
  )
}

/** Where the checkers sit on the mock board: point index (0-23, top row first) → how many, and whose. */
const CHECKERS: [number, number, 'a' | 'b'][] = [
  [0, 2, 'a'],
  [5, 5, 'b'],
  [7, 3, 'b'],
  [11, 5, 'a'],
  [12, 5, 'b'],
  [16, 3, 'a'],
  [18, 5, 'a'],
  [23, 2, 'b'],
]

function TavlaScene() {
  return (
    <div className="ttp-board">
      {Array.from({ length: 24 }, (_, i) => {
        const top = i < 12
        const col = top ? i : 23 - i
        const stack = CHECKERS.find((c) => c[0] === i)
        return (
          <span key={i} className={cn('ttp-point', top ? 'ttp-point-top' : 'ttp-point-bottom')} style={{ left: `${(col + (col > 5 ? 1 : 0)) * 7.692}%` }}>
            <i className={cn('ttp-spike', (i + (top ? 0 : 1)) % 2 ? 'ttp-spike-a' : 'ttp-spike-b')} />
            {stack &&
              Array.from({ length: stack[1] }, (_, k) => (
                <i key={k} className={cn('ttp-checker', stack[2] === 'a' ? 'ttp-checker-a' : 'ttp-checker-b')} style={{ [top ? 'top' : 'bottom']: `${k * 17}%` }} />
              ))}
          </span>
        )
      })}
      <i className="ttp-bar" />
      <div className="ttp-dice">
        <i>5</i>
        <i>3</i>
      </div>
    </div>
  )
}

const BALLS = ['#e8b923', '#1f4fb4', '#c2202a', '#5b2a86', '#e2671b', '#1d7c49', '#7a1e22', '#111214', '#e8b923', '#1f4fb4']

/** The rack: one ball, then two, three and four, each row a column of the triangle. */
const RACK_ROWS = [[0], [1, 2], [3, 4, 5], [6, 7, 8, 9]]

function BilardoScene() {
  return (
    <>
      {['0 0', '50% 0', '100% 0', '0 100%', '50% 100%', '100% 100%'].map((p) => {
        const [left, top] = p.split(' ')
        return <i key={p} className="ttp-pocket" style={{ left, top }} />
      })}
      <div className="ttp-balls">
        {RACK_ROWS.map((row) => (
          <span key={row[0]}>
            {row.map((n) => (
              <i key={n} className="ttp-ball" style={{ backgroundColor: BALLS[n] }} />
            ))}
          </span>
        ))}
      </div>
      <i className="ttp-ball ttp-cue-ball" />
      <i className="ttp-cue" />
    </>
  )
}

const HAND = ['A♠', 'K♠', '10♠', 'Q♥', '7♥', 'J♦', '9♦', '4♣', '2♣']

function Card({ face, style, className }: { face?: string; style?: CSSProperties; className?: string }) {
  const red = face ? /[♥♦]/.test(face) : false
  return (
    <i className={cn('ttp-card', !face && 'ttp-card-back', red && 'ttp-ink-red', className)} style={style}>
      {face}
    </i>
  )
}

function CardScene({ trick }: { trick: boolean }) {
  return (
    <>
      <Seats />
      <div className="ttp-backs" style={{ left: '50%', top: '20%' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} />
        ))}
      </div>
      <div className="ttp-center">
        {trick ? (
          <>
            <Card face="K♥" style={{ transform: 'translate(-70%, 12%) rotate(-12deg)' }} />
            <Card face="9♥" style={{ transform: 'translate(-10%, -22%) rotate(6deg)' }} />
            <Card face="A♥" style={{ transform: 'translate(55%, 10%) rotate(14deg)' }} />
            <Card face="3♠" style={{ transform: 'translate(0, 40%) rotate(-4deg)' }} />
          </>
        ) : (
          <>
            <Card style={{ transform: 'translate(-120%, 0)' }} />
            <Card face="6♣" style={{ transform: 'translate(-8%, 4%) rotate(-9deg)' }} />
            <Card face="J♠" style={{ transform: 'translate(22%, -4%) rotate(8deg)' }} />
          </>
        )}
      </div>
      <div className="ttp-hand">
        {HAND.slice(0, trick ? 9 : 4).map((face, i, all) => (
          <Card key={face} face={face} style={{ transform: `rotate(${(i - (all.length - 1) / 2) * 5}deg) translateY(${Math.abs(i - (all.length - 1) / 2) * 3}%)` }} />
        ))}
      </div>
    </>
  )
}

function Scene({ game }: { game: ThemeGame }) {
  if (game === 'okey') return <OkeyScene melds={false} />
  if (game === '101') return <OkeyScene melds />
  if (game === 'tavla') return <TavlaScene />
  if (game === 'bilardo') return <BilardoScene />
  return <CardScene trick={game === 'batak'} />
}

/** One themed table with a game laid out on it. */
export function ThemeScene({ theme, game }: { theme: TableTheme; game: ThemeGame }) {
  return (
    <div className="ttp-scene" role="img" aria-label={`${theme.name} teması ${GAME_NAMES[game]} masasında`}>
      <div className="ttp-rail" {...themeSurfaceProps(theme)}>
        <div className={cn('ttp-felt', game === 'bilardo' && 'ttp-felt-pool')}>
          <ThemeDecor theme={theme} />
          <Scene game={game} />
        </div>
      </div>
    </div>
  )
}

/**
 * How a table theme looks on each game it works in, before it is bought. The felt, print, light and artwork come
 * from the same decor the real tables draw; the pieces on top are a stand-in for a game in progress.
 */
export function ThemePreview({
  theme,
  onClose,
  price,
  minLevel,
  action,
}: {
  theme: TableTheme | null
  onClose: () => void
  price: ReactNode
  minLevel: number
  action: ReactNode
}) {
  const [game, setGame] = useAddressChoice('oyun', GAME_WORDS, 'okey')
  return (
    <Modal open={theme !== null} onClose={onClose} title={theme ? `${theme.name} önizlemesi` : 'Tema önizlemesi'} className="max-w-2xl">
      {theme && (
        <div className="flex flex-col gap-3 p-4 pt-6 max-sm:pt-7">
          <div className="flex flex-col gap-0.5 pr-10">
            <p className="text-xs font-semibold text-primary">Masa teması önizlemesi</p>
            <h2 className="text-balance font-display text-xl font-bold text-foreground">{theme.name}</h2>
            <p className="text-xs text-muted-foreground">
              {THEME_RARITY[theme.rarity]} · Lv {minLevel} rozetiyle kullanılır
            </p>
          </div>

          <div role="tablist" aria-label="Önizlenecek oyun" className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
            {THEME_GAMES.map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={game === g}
                onClick={() => setGame(g)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors max-sm:py-2.5',
                  game === g ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
                )}
              >
                {GAME_NAMES[g]}
              </button>
            ))}
          </div>

          <ThemeScene theme={theme} game={game} />

          <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
            Tema masanın çuhasını, desenini, ışığını ve kenar rengini değiştirir; taşlar, pullar ve kartlar aynı kalır. Bu bir örnek dizilimdir, oyundaki
            yerleşim masaya göre biraz farklı olabilir.
          </p>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="text-sm font-bold tabular-nums text-foreground">{price}</span>
            <div className="min-w-40">{action}</div>
          </div>
        </div>
      )}
    </Modal>
  )
}
