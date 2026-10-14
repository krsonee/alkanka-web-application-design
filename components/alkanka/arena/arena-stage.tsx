'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ARENA_META, type ArenaGame, type ArenaGameSettings, type GameMode } from '@/lib/arena'
import { StakeGate, type GameApi } from './stake-gate'
import { Tavla } from './tavla'
import { Okey } from './okey'
import { Bilardo } from './bilardo'
import { BlackjackHouse } from './blackjack'
import { RouletteLive } from './roulette-live'
import { HeadGame } from './head-game'
import { TableLobby } from './table-lobby'
import { LiveLobby } from './live-lobby'

export const RULES: Record<ArenaGame, string[]> = {
  tavla: [
    'Standart tavla kuralları: 15 pul, kırık pul bara gider ve önce oyuna girmek zorundadır.',
    'Çift atarsan zarı dört kez oynarsın. Oynanabilecek en çok zarı oynamak zorunlusun.',
    'Tüm pulların evine geldiğinde toplamaya başlarsın. 15 pulu ilk toplayan kazanır.',
  ],
  okey: [
    'Bot masası 4 kişilik, kanka masası 1v1. Gösterge taşının bir üstü okeydir, istediğin taşın yerine geçer.',
    'Sıran gelince ortadan çek ya da rakibin attığı taşı al, sonra bir taş at.',
    'Taşları ıstakada istediğin yere sürükle; seri ve perleri dizip 14 taşla ya da 7 çiftle elini aç.',
  ],
  bilardo: [
    '8 top kuralı: ilk sokulan top grubunu belirler, düz (1-7) ya da çizgili (9-15).',
    'Kendi topunu sokarsan tekrar vurursun. Beyazı sokmak ya da önce rakip topa vurmak faul sayılır.',
    'Grubunu temizledikten sonra siyah 8 numarayı sokan kazanır. Siyah erken düşerse kaybedersin.',
  ],
  blackjack: [
    'Kartlar sunucuda karılır. 21’e en yakın olan kazanır, 21’i geçen yanar.',
    'Krupiye 17’ye kadar çeker. Blackjack 2.5x, normal kazanç 2x öder.',
    'Kanka masasında ikiniz de aynı bahisle 5 el oynarsınız, fişi çok olan potu alır.',
  ],
  rulet: [
    'Avrupa ruleti (tek sıfır). Herkes aynı canlı masada oynar, top sunucuda atılır.',
    'Sayıya 36x, düzineye 3x, renk / tek-çift / alt-üst 2x öder.',
    'Kanka masasında aynı başlangıç fişiyle 5 tur oynarsınız, fişi çok olan kazanır.',
  ],
  'kafa-topu': [
    '60 saniyelik maç. Topa kafa vur, rakip kaleye sok.',
    'Klavye: A/D yürü, W zıpla. 2. oyuncu ok tuşları. Mobilde ekran butonlarını kullan.',
    'Kanka masasında ikiniz de bota karşı oynarsınız, gol farkı yüksek olan kazanır.',
  ],
  'kafa-basketbolu': [
    '60 saniyelik maç. Topu potadan geçir, her sayı 2 puan.',
    'Klavye: A/D yürü, W zıpla. 2. oyuncu ok tuşları. Mobilde ekran butonlarını kullan.',
    'Kanka masasında ikiniz de bota karşı oynarsınız, sayı farkı yüksek olan kazanır.',
  ],
}

function BotGame({ game, api }: { game: ArenaGame; api: GameApi }) {
  if (game === 'tavla') return <Tavla {...api} />
  if (game === 'okey') return <Okey {...api} />
  if (game === 'bilardo') return <Bilardo finish={api.finish} />
  const sport = game === 'kafa-topu' ? 'futbol' : 'basket'
  return (
    <HeadGame
      sport={sport}
      mode="bot"
      onEnd={(s) => api.finish(s.for > s.against ? 'win' : s.for < s.against ? 'lose' : 'draw', `${s.for} - ${s.against}`, s)}
    />
  )
}

/** House games (blackjack, rulet) have their own live tables instead of the StakeGate flow. */
function BotMode({ game, settings }: { game: ArenaGame; settings: ArenaGameSettings }) {
  if (game === 'blackjack') return <BlackjackHouse settings={settings} />
  if (game === 'rulet') return <RouletteLive settings={settings} />
  return null
}

function LocalMode({ game }: { game: ArenaGame }) {
  const [round, setRound] = useState(0)
  const [last, setLast] = useState<string | null>(null)
  const sport = game === 'kafa-topu' ? 'futbol' : 'basket'
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <span className="text-muted-foreground">Aynı cihazda arkadaşınla oyna. KC kullanılmaz, sadece eğlence.</span>
        {last && <span className="font-semibold text-foreground">Son maç: {last}</span>}
      </div>
      <HeadGame
        key={round}
        sport={sport}
        mode="local"
        names={['Kanka 1', 'Kanka 2']}
        onEnd={(s) => {
          setLast(`${s.for} - ${s.against}`)
          setRound((r) => r + 1)
        }}
      />
    </div>
  )
}

export function ArenaStage({ game, settings }: { game: ArenaGame; settings: ArenaGameSettings }) {
  const meta = ARENA_META[game]
  const modes = meta.modes.filter((m) => m !== 'pvp' || settings.pvpEnabled)
  const [mode, setMode] = useState<GameMode | null>(modes.length === 1 ? modes[0] : null)
  const [entered, setEntered] = useState<{ mode: GameMode; bet: number } | null>(null)
  const [invitedTable, setInvitedTable] = useState<string | null>(null)
  const houseGame = game === 'blackjack' || game === 'rulet'

  // Telegram invite links land here as ?masa=<id>; open the kanka lobby with that table highlighted.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('masa')
    if (!id || !modes.includes('pvp')) return
    setInvitedTable(id)
    setMode('pvp')
    setEntered({ mode: 'pvp', bet: settings.bets[0] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const back = (
    <button
      type="button"
      onClick={() => setEntered(null)}
      className="flex w-fit items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Mod ve bahis seçimine dön
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      {entered == null && (
        <StakeGate
          game={game}
          settings={settings}
          rules={RULES[game]}
          modeSelect={{
            modes,
            mode,
            onChange: setMode,
            botExternal: houseGame,
            onEnter: (m, bet) => setEntered({ mode: m, bet }),
          }}
        >
          {(api) => <BotGame game={game} api={api} />}
        </StakeGate>
      )}
      {entered && back}
      {entered?.mode === 'bot' && <BotMode game={game} settings={settings} />}
      {entered?.mode === 'pvp' && <TableLobby game={game} settings={settings} rules={RULES[game]} invitedId={invitedTable} initialStake={entered.bet} />}
      {entered?.mode === 'local' && <LocalMode game={game} />}
      {modes.includes('pvp') && game !== 'rulet' && (
        <div className="mt-4 border-t border-border pt-6">
          <LiveLobby game={game} />
        </div>
      )}
    </div>
  )
}
