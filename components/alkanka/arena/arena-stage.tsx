'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ARENA_META, isBotTableGame, type ArenaGame, type ArenaGameSettings } from '@/lib/arena'
import { StakeGate, type GameApi } from './stake-gate'
import { Tavla } from './tavla'
import { BilardoPool } from './bilardo-pool'
import { BlackjackLive } from './blackjack-live'
import { RouletteLive } from './roulette-live'
import { HeadGame } from './head-game'
import { TableLobby } from './table-lobby'
import { PvpTablesPanel } from './pvp-tables-panel'
import { wizardEnabledFor, type SetupConfig } from '@/lib/home-v2-shared'
import { LiveLobby } from './live-lobby'

const noSubscribe = () => () => {}

export const RULES: Record<ArenaGame, string[]> = {
  tavla: [
    'Standart tavla kuralları: 15 pul, kırık pul bara gider ve önce oyuna girmek zorundadır.',
    'Çift atarsan zarı dört kez oynarsın. Oynanabilecek en çok zarı oynamak zorunlusun.',
    'Tüm pulların evine geldiğinde toplamaya başlarsın. 15 pulu ilk toplayan kazanır.',
  ],
  okey: [
    'Masa 4 kişiliktir; kanka masasında boş koltuklara bot oturtabilirsin. Gösterge taşının bir üstü okeydir, istediğin taşın yerine geçer.',
    'Sıran gelince ortadan çek ya da rakibin attığı taşı al, sonra bir taş at.',
    'Taşları ıstakada istediğin yere sürükle; seri ve perleri dizip 14 taşla ya da 7 çiftle elini aç.',
    'Bitiş katları: normal bitiş 1 kat, okeyle bitiş 2 kat, çiftten bitiş 2 kat, çiftten ve okeyle bitiş 4 kat.',
  ],
  okey101: [
    'Herkese 21 taş, başlayana 22 taş dağıtılır. Gösterge taşının bir üstü okeydir.',
    'Elini açmak için seri ve perlerinin toplamı en az 101 olmalı ya da en az 5 çift ile çifte gidersin. Açtıktan sonra yerdeki perlere işleyebilirsin.',
    'Eli ilk bitiren kazanır. Açamayan 202, açan elindeki taşlar kadar ceza yer; çifte gidenin cezası ikiye katlanır. Okeyle, elden ya da çiftten bitirince cezalar 2 kat, okeyle çiftten bitirince 4 kat yazılır. Yandan alınan taş o tur pere ya da işlemeye kullanılmalı, yoksa geri verilir (101 ceza). Set sonunda en az cezası olan kazanır.',
  ],
  papaz: [
    '51 kart: Sinek Papaz desteden çıkarılır, böylece Maça Papaz eşsiz kalır. Kartlar 2-6 oyuncuya dağıtılır.',
    'Aynı sayı ve aynı renkteki kartlar (siyah-siyah, kırmızı-kırmızı) eş sayılır ve otomatik yere atılır.',
    'Sıran gelince yanındaki oyuncunun kapalı kartlarından birini seçip çekersin. Kartı biten kurtulur, Maça Papaz elinde kalan kaybeder.',
  ],
  pisti: [
    '52 kart. Yere 4 kart (3 kapalı), herkese 4 kart dağıtılır. 2 kişi ya da 4 kişi oynanır. 4 kişide eşli (karşılıklı oturanlar eş) ya da tekli seçilebilir.',
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
    'Sayı 36x. Çizgiler de oynanır: iki sayı arası (ayrık) 18x, alt kenar (sokak, 3 sayı) 12x, dört sayının köşesi 9x, iki sokak arası (altılı) 6x.',
    'Düzine ve 2:1 kolon 3x, renk / tek-çift / 1-18 / 19-36 2x öder. Sıfır gelirse dış bahisler kaybeder.',
    'Kanka masasında aynı başlangıç fişiyle 5 tur oynarsınız, fişi çok olan kazanır.',
  ],
  'kafa-topu': [
    '90 saniyelik maç. Topa kafa vur, rakip kaleye sok. Berabere biterse uzatma oynanır.',
    'Klavye: A/D yürü, W zıpla. 2. oyuncu ok tuşları. Mobilde ekran butonlarını kullan.',
    'Kanka masasında ikiniz de bota karşı oynarsınız, gol farkı yüksek olan kazanır.',
  ],
  'kafa-basketbolu': [
    '90 saniyelik maç. Topu potadan geçir, her sayı 2 puan.',
    'Klavye: A/D yürü, W zıpla. 2. oyuncu ok tuşları. Mobilde ekran butonlarını kullan.',
    'Kanka masasında ikiniz de bota karşı oynarsınız, sayı farkı yüksek olan kazanır.',
  ],
}

function BotGame({ game, api, settings }: { game: ArenaGame; api: GameApi; settings: ArenaGameSettings }) {
  if (game === 'tavla') return <Tavla {...api} />
  if (game === 'bilardo') return <BilardoPool bet={api.bet} win={Math.round(api.bet * settings.multiplier)} finish={api.finish} />
  const sport = game === 'kafa-topu' ? 'futbol' : 'basket'
  return (
    <HeadGame
      sport={sport}
      mode="bot"
      stake={api.bet}
      win={api.win}
      refundable={api.refundable}
      onCancel={api.cancel}
      onKickoff={api.kickoff}
      onEnd={(s) => api.finish(s.for > s.against ? 'win' : s.for < s.against ? 'lose' : 'draw', `${s.for} - ${s.against}`, s)}
      onRematch={api.again ? (s) => api.again?.(s.for > s.against ? 'win' : s.for < s.against ? 'lose' : 'draw', `${s.for} - ${s.against}`, s) : undefined}
    />
  )
}

export function ArenaStage({ game, settings, setup }: { game: ArenaGame; settings: ArenaGameSettings; setup?: SetupConfig }) {
  const [openWizard, setOpenWizard] = useState(false)
  const meta = ARENA_META[game]
  const pvp = meta.modes.includes('pvp') && settings.pvpEnabled
  // Games with server bots play "bota karşı" at a table; the rest run their bot in the browser.
  const botPlay = isBotTableGame(game) ? 'table' : meta.modes.includes('bot') ? 'session' : null
  const hasTables = pvp || botPlay === 'table'
  const [entered, setEntered] = useState<{ bet: number } | null>(null)
  const [invitedTable, setInvitedTable] = useState<string | null>(null)
  const [watching, setWatching] = useState<string | null>(null)

  const watch = (id: string | null) => {
    setWatching(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openTableRoom = (id: string, stake: number) => {
    const url = new URL(window.location.href)
    url.searchParams.set('masa', id)
    window.history.replaceState(window.history.state, '', url)
    setInvitedTable(id)
    setEntered({ bet: stake })
  }

  const backToLobby = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('masa')
    window.history.replaceState(window.history.state, '', url)
    setInvitedTable(null)
    setOpenWizard(false)
    setEntered(null)
  }

  // Telegram invite links land here as ?masa=<id>; open the table lobby with that table highlighted.
  // Applied during render rather than in a mount effect: this page hydrates at offscreen priority, so a
  // setState in an effect lands in the idle lane and waits behind every pending server action.
  const search = useSyncExternalStore(
    noSubscribe,
    () => window.location.search,
    () => null,
  )
  const [linkRead, setLinkRead] = useState(false)
  const linkTarget = (query: string) => {
    const params = new URLSearchParams(query)
    const id = params.get('masa')
    if (id) return { id }
    return wizardEnabledFor(setup, game) && params.has('masa-ac') ? { id: null } : null
  }
  if (search !== null && !linkRead) {
    setLinkRead(true)
    const target = hasTables ? linkTarget(search) : null
    if (target) {
      if (target.id) setInvitedTable(target.id)
      else setOpenWizard(true)
      setEntered({ bet: settings.bets[0] })
    }
  }

  useEffect(() => {
    if (!hasTables || linkTarget(window.location.search)) return
    // A refresh (or a PWA relaunch) can drop ?masa; fall back to the table the player is still seated at.
    let cancelled = false
    fetch(`/api/tables?game=${game}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { mine?: { id: string; game: string; status: string }[] } | null) => {
        const mine = (d?.mine ?? []).filter((t) => t.game === game)
        const live = mine.find((t) => t.status === 'oynaniyor') ?? mine.find((t) => t.status === 'bekliyor')
        if (cancelled || !live) return
        const url = new URL(window.location.href)
        url.searchParams.set('masa', live.id)
        window.history.replaceState(window.history.state, '', url)
        setEntered({ bet: settings.bets[0] })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          quick={{
            bot: botPlay,
            pvp,
            onTable: openTableRoom,
            tables: (
              <PvpTablesPanel
                game={game}
                commission={settings.commission}
                onSeated={openTableRoom}
                onBrowse={() => {
                  setOpenWizard(false)
                  setEntered({ bet: settings.bets[0] })
                }}
                onCreate={() => {
                  setOpenWizard(wizardEnabledFor(setup, game))
                  setEntered({ bet: settings.bets[0] })
                }}
              />
            ),
          }}
        >
          {(api) => <BotGame game={game} api={api} settings={settings} />}
        </StakeGate>
      )}
      {entered && (
        <button
          type="button"
          onClick={backToLobby}
          className="flex w-fit items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Geri
        </button>
      )}
      {entered && (
        <TableLobby
          game={game}
          settings={settings}
          rules={RULES[game]}
          invitedId={invitedTable}
          initialStake={entered.bet}
          setup={setup}
          openWizard={openWizard}
          onRoomClosed={backToLobby}
        />
      )}
      {hasTables && (
        <div className="mt-4 border-t border-border pt-6 [body:has([data-table-live])_&]:hidden">
          <LiveLobby game={game} watching={null} onWatch={watch} />
        </div>
      )}
    </div>
  )
}
