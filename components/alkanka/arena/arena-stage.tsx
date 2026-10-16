'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ARENA_META, type ArenaGame, type ArenaGameSettings, type GameMode } from '@/lib/arena'
import { StakeGate, type GameApi } from './stake-gate'
import { Tavla } from './tavla'
import { Okey } from './okey'
import { Bilardo } from './bilardo'
import { BlackjackLive } from './blackjack-live'
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
  okey101: [
    'Herkese 21 taş, başlayana 22 taş dağıtılır. Gösterge taşının bir üstü okeydir.',
    'Elini açmak için seri ve perlerinin toplamı en az 101 olmalı ya da en az 5 çift ile çifte gidersin. Açtıktan sonra yerdeki perlere işleyebilirsin.',
    'Eli ilk bitiren kazanır. Açamayan 202, açan elindeki taşlar kadar ceza yer; çifte gidenin cezası ikiye katlanır. Set sonunda en az cezası olan kazanır.',
  ],
  pisti: [
    '52 kart. Yere 4 kart (3 kapalı), herkese 4 kart dağıtılır. 2 kişi ya da 4 kişi eşli oynanır, karşılıklı oturanlar eştir.',
    'Yerdeki en üst kartla aynı kartı atan ya da Vale atan yeri toplar. Yerde tek kart varken aynısıyla alırsan pişti: 10 puan, Vale ile Vale pişti 20 puan.',
    'El sonunda en çok kart 3, her As ve Vale 1, sinek 2 2, karo 10 3 puan. Masada seçilen 101 ya da 151 puana ilk ulaşan kazanır.',
  ],
  batak: [
    'Klasik: 4 kişi, 13 kart, ihale en az 5. Koz Maça: ihale yok, koz maça, herkes el tahmini yapar. Eşli: 2+2 takım, ihale en az 8, ihalecinin eşi kartlarını açar. Gömmeli: 3 kişi, 16 kart, ihaleci yerdeki 4 kartı alıp 4 kart gömer.',
    'Atılan renge uymak, mümkünse yükseltmek zorundasın. Rengin yoksa koz çakmalısın. Koz kırılmadan kozla açılamaz.',
    'Sözünü tutan aldığı el kadar puan alır, ihaleyi alıp tutamayan ihalesi kadar eksi yer, hiç el almayan batar. Set sonunda en yüksek puan kazanır.',
  ],
  monopoly: [
    'Klasik 40 kareli tahta. Zar at, ilerle, sahipsiz mülkü satın al; başkasının mülküne gelince kira ödersin.',
    'Bir renk grubunun tamamına sahip olunca ev, 4 evden sonra otel dikebilirsin. Çift atarsan tekrar atarsın, üç çift hapse sokar.',
    'Parası biten iflas eder. Son kalan oyuncu ya da 20 tur sonunda en zengin olan masayı kazanır.',
  ],
  bilardo: [
    '8 top kuralı: ilk sokulan top grubunu belirler, düz (1-7) ya da çizgili (9-15).',
    'Kendi topunu sokarsan tekrar vurursun. Beyazı sokmak ya da önce rakip topa vurmak faul sayılır.',
    'Grubunu temizledikten sonra siyah 8 numarayı sokan kazanır. Siyah erken düşerse kaybedersin.',
  ],
  blackjack: [
    'Kartlar sunucuda karılır. 21’e en yakın olan kazanır, 21’i geçen yanar.',
    'Krupiye 17’ye kadar çeker. Blackjack 2.5x, normal kazanç 2x öder.',
    'Tek canlı masa, 6 koltuk. Boş koltuk varsa otomatik oturursun, tüm masalar doluysa yeni masa açılır.',
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

function BotMode({ game, settings }: { game: ArenaGame; settings: ArenaGameSettings }) {
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
  const [watching, setWatching] = useState<string | null>(null)
  const houseGame = game === 'blackjack' || game === 'rulet'

  const watch = (id: string | null) => {
    setWatching(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  // Roulette and blackjack are shared live tables: no bot / player choice, no stake gate.
  // Blackjack seats you at the first 6-seat table with a free spot, or opens a new one.
  if (game === 'rulet') return <RouletteLive settings={settings} />
  if (game === 'blackjack') return <BlackjackLive settings={settings} />

  if (watching) {
    return (
      <div className="flex flex-col gap-4">
        <LiveLobby game={game} watching={watching} onWatch={watch} />
      </div>
    )
  }

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
      {modes.includes('pvp') && (
        <div className="mt-4 border-t border-border pt-6">
          <LiveLobby game={game} watching={null} onWatch={watch} />
        </div>
      )}
    </div>
  )
}
