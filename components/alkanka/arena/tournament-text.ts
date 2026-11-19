import { TURN_SECONDS } from '@/lib/arena'
import { LEAGUE_DRAW_POINTS, LEAGUE_WIN_POINTS } from '@/lib/league'
import {
  CANCEL_TEXT,
  PACE_MS,
  PACE_SHORT,
  SOURCE_TEXT,
  TABLE_PASS,
  entrantsNeeded,
  matchLengthOf,
  roundName,
  type Tournament,
} from '@/lib/tournaments-shared'
import { formatAC } from '../points-context'

const ISTANBUL = 'Europe/Istanbul'

export function formatTR(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: ISTANBUL, day: 'numeric', month: 'long', weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function formatShortTR(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: ISTANBUL, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

/** The day alone, for a tournament that is over: the hour it closed at tells nobody anything. */
export function formatDayTR(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: ISTANBUL, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}

const clockTR = (iso: string) => new Intl.DateTimeFormat('tr-TR', { timeZone: ISTANBUL, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const weekdayTR = (iso: string) => new Intl.DateTimeFormat('tr-TR', { timeZone: ISTANBUL, weekday: 'long' }).format(new Date(iso))

/** The format in two or three words, for the line above a tournament's name. */
export function formatLine(t: Tournament) {
  if (t.format === 'puan') return 'Puan ligi'
  if (t.format === 'lig') return `Lig · ${PACE_SHORT[t.league.pace]}${t.league.legs === 2 ? ' · çift devre' : ''}`
  return t.tableSize > 2 ? `Eleme · ${t.tableSize} kişilik masa` : 'Eleme · birebir'
}

/** How this tournament is played, in one sentence a newcomer can follow. */
export function formatPitch(t: Tournament, gameTitle: string) {
  if (t.format === 'puan') return `Eşleşme yok: lig süresince oynadığın ${gameTitle} oyunları puan getirir, bitişte ilk sıralar ödülü alır.`
  if (t.format === 'lig') {
    return `Herkes herkesle ${t.league.legs === 2 ? 'iki kez' : 'bir kez'} oynar${PACE_MS[t.league.pace] ? `, ${PACE_SHORT[t.league.pace]} açılır` : ''}; en çok puanı toplayan şampiyon olur.`
  }
  return t.tableSize > 2
    ? `${t.tableSize} kişilik masalarda oynanır: her masanın ilk ${t.bracket?.pass ?? TABLE_PASS} oyuncusu tur atlar, final masasının birincisi şampiyon olur.`
    : 'Birebir eleme: kaybeden elenir, kazanan tur atlar; finali kazanan şampiyon olur.'
}

export type TournamentStep = { title: string; text: string }

/** The same in three steps, from signing up to the prize. */
export function tournamentSteps(t: Tournament, gameTitle: string): TournamentStep[] {
  const entry: TournamentStep = {
    title: 'Kaydol',
    text: `${t.entryFee ? `Katılım ${formatAC(t.entryFee)} KC, kayıtta bir kez kesilir.` : 'Katılım ücretsiz.'} Kayıtlar başlangıç saatinde kapanır.`,
  }
  const sit = `açılınca bildirim gelir; ${t.joinMinutes} dakika içinde masana gir.`
  if (t.format === 'puan') {
    return [
      entry,
      { title: `${gameTitle} oyna`, text: `Turnuva masası açılmaz. ${gameTitle} masalarında her zamanki gibi oynarsın; masa kaç kişilik olursa olsun bitirdiğin oyun sayılır.` },
      {
        title: 'Puan topla, ödülü al',
        text: `Galibiyet ${LEAGUE_WIN_POINTS}, beraberlik ${LEAGUE_DRAW_POINTS} puan. ${t.endsAt ? `Lig ${formatTR(t.endsAt)} biter;` : 'Lig bitince'} ilk sıralar ödülü alır.`,
      },
    ]
  }
  if (t.format === 'lig') {
    const pace = t.league.pace === 'gunluk' ? 'Her gün bir tur açılır' : t.league.pace === 'haftalik' ? 'Her hafta bir tur açılır' : 'Turlar art arda oynanır'
    return [
      entry,
      { title: 'Maçına gir', text: `${pace}, her turda tek maçın olur. Maçın ${sit}` },
      { title: 'Puan topla', text: `Galibiyet ${LEAGUE_WIN_POINTS} puan. Bütün turlar bitince en çok puanı toplayan şampiyon olur.` },
    ]
  }
  if (t.tableSize > 2) {
    return [
      entry,
      { title: 'Masana gir', text: `Oyuncular kura ile ${t.tableSize} kişilik masalara dağıtılır. Masan ${sit}` },
      { title: 'Tur atla', text: `Her masanın ilk ${t.bracket?.pass ?? TABLE_PASS} oyuncusu sonraki tura geçer. Final masasının birincisi şampiyon olur.` },
    ]
  }
  return [
    entry,
    { title: 'Maçına gir', text: `Eşleşmeler kura ile çekilir. Maçın ${sit}` },
    { title: 'Kazan, tur atla', text: 'Kaybeden elenir, kazanan sonraki tura geçer. Finali kazanan şampiyon olur.' },
  ]
}

/** What is going on in a running tournament right now, in one short line. */
export function runningLine(t: Tournament) {
  if (t.format === 'puan') {
    const top = t.points?.[0]
    return top && top.points > 0 ? `Lider ${t.names[top.key] ?? top.key} · ${top.points} puan` : 'Puan ligi sürüyor'
  }
  const league = t.format === 'lig'
  const shared = t.tableSize > 2
  const live = t.liveMatches.filter((m) => m.status === 'oynaniyor').length
  const round = t.currentRound != null ? roundName(league, t.currentRound, t.bracket?.rounds.length ?? 0) : null
  if (round && t.nextRoundAt) return `${round} ${formatShortTR(t.nextRoundAt)} açılır`
  if (!round) return 'Turnuva sürüyor'
  return `${round} oynanıyor${live > 0 ? ` · ${live} ${shared ? 'masa' : 'maç'}` : ''}`
}

/** How a shared table of this game is ranked, in the words players read. */
const TABLE_ORDER: Partial<Record<Tournament['game'], string>> = {
  okey101: 'Masada en az ceza puanı olan birinci olur.',
  batak: 'Masada en çok puanı toplayan birinci olur.',
  pisti: 'Masada en çok puanı toplayan birinci olur.',
  monopoly: 'Masada varlığı en yüksek olan birinci olur; iflas eden sona düşer.',
}

function pointsRules(t: Tournament, gameTitle: string) {
  const { source, maxGames } = t.league
  return [
    `Puan ligi: turnuva masası açılmaz, kimse eşleştirilmez. Lig süresince ${gameTitle} oyunlarını her zamanki gibi oynarsın; bitirdiğin her oyun puan tablosuna yazılır.`,
    `Sadece ${gameTitle} sayılır; başka oyunlar bu lige puan yazmaz. Masanın kaç kişilik olduğu fark etmez.`,
    `${SOURCE_TEXT[source]} Bahissiz deneme masaları ve başka turnuvaların maçları sayılmaz.`,
    `Galibiyet ${LEAGUE_WIN_POINTS} puan, beraberlik ${LEAGUE_DRAW_POINTS} puan, yenilgi 0 puan.`,
    maxGames
      ? `Her oyuncunun lig başladıktan sonraki ilk ${maxGames} oyunu sayılır; sonraki oyunlar puan getirmez. Herkes aynı sayıda oyunla yarışır.`
      : 'Sayılan oyun sayısında sınır yok: ne kadar çok kazanırsan o kadar puan toplarsın.',
    'Eşitlikte aynı puanı daha az oyunla toplayan, o da eşitse önce kaydolan üstte yer alır.',
    `Kontenjan ${t.maxPlayers} oyuncu. Kayıtlar başlangıç saatinde kapanır; o ana kadar kaydını iptal edebilirsin.`,
    'Lig başlangıç saatinde kendiliğinden başlar; o andan sonra bitirdiğin oyunlar sayılır. En az 2 kayıt yoksa iptal olur, ücretler iade edilir.',
    ...(t.endsAt
      ? [
          `Lig ${formatTR(t.endsAt)} biter; o ana kadar biten oyunlar sayılır. Ödüller o anki sıralamaya göre dağıtılır. Sayılan bir oyunu olmayan oyuncu ödül alamaz; hiç kimse oynamazsa lig iptal olur ve ücretler iade edilir.`,
        ]
      : []),
    'Masalardaki bahis ve kazanç her zamanki gibidir; lig bunlara dokunmaz.',
  ]
}

function leagueRules(t: Tournament) {
  const { pace, legs } = t.league
  const everyone = legs === 2 ? 'iki kez (çift devre)' : 'bir kez'
  const head = `Fikstürlü lig: herkes herkesle ${everyone} oynar. Galibiyet ${LEAGUE_WIN_POINTS} puan kazandırır, en çok puanı toplayan şampiyon olur.`
  if (!PACE_MS[pace]) return [head, 'Bir turun bütün maçları bitince sıradaki tur hemen açılır; lig aynı oturumda oynanır.']
  const when = pace === 'gunluk' ? `ertesi gün aynı saatte (${clockTR(t.startsAt)})` : `bir hafta sonra aynı gün ve saatte (${weekdayTR(t.startsAt)} ${clockTR(t.startsAt)})`
  return [
    head,
    `İlk tur başlangıç saatinde açılır, sonraki her tur ${when}. Her turda tek maçın olur; fikstürde her turun tarihi yazar.`,
    'Bir turda süren maç varsa sıradaki tur o maç bitince açılır. Tur açıldığında bildirim gelir.',
  ]
}

export function tournamentRules(t: Tournament, gameTitle: string) {
  const isLeague = t.format === 'lig'
  const seats = t.tableSize
  const shared = seats > 2 && t.format === 'eleme'
  const pass = t.bracket?.pass ?? TABLE_PASS
  const length = matchLengthOf(t.game, t.matchLength)
  const fee = t.entryFee
    ? `Katılım ${formatAC(t.entryFee)} KC, bir kez kayıtta kesilir; kayıt iptalinde ve turnuva iptalinde iade edilir. Ödüller turnuva bitince Kanka Coin olarak hesabına yüklenir.`
    : 'Katılım ücretsiz. Ödüller turnuva bitince Kanka Coin olarak hesabına kendiliğinden yüklenir.'
  const fair = 'Birden fazla hesapla katılmak, maç ayarlamak veya hile tespit edilirse oyuncu diskalifiye edilir ve ödülü iptal olur.'
  if (t.format === 'puan') return [...pointsRules(t, gameTitle), fee, fair]
  const rules = shared
    ? [
        `Masa usulü eleme: oyuncular kura ile ${seats} kişilik masalara dağıtılır. Her masanın ilk ${pass} oyuncusu bir sonraki tura geçer, diğerleri elenir. Final masasının birincisi şampiyon olur.`,
        `Kontenjan ${t.maxPlayers} oyuncu. Kayıtlar başlangıç saatinde kapanır; o ana kadar kaydını iptal edebilirsin.`,
        `Turnuva başlangıç saatinde kendiliğinden başlar. En az ${entrantsNeeded(t.format, seats)} kayıt yoksa iptal olur, ücretler iade edilir.`,
        `Kontenjan dolmazsa oyuncular masalara eşit dağıtılır. Eksik kalan koltuğa bot oturur; bot tur atlayamaz ve ödül alamaz, sırası en iyi oyuncuya geçer. ${pass} ya da daha az oyuncusu olan masa oynanmaz, oyuncuları doğrudan tur atlar.`,
        `Masan açılınca bildirim gelir ve sitenin üstünde "Turnuva maçın hazır" kutusu çıkar. ${t.joinMinutes} dakika içinde masaya girmeyen elenir, koltuğuna bot oturur ve masa onsuz oynanır. Masaya kimse girmezse masa herkes için kayıp sayılır.`,
        `Masalar ${gameTitle} standart kurallarıyla, herkes kendi adına (eşsiz) ve bahissiz oynanır. ${TABLE_ORDER[t.game] ?? 'Sıralama oyunun kendi sonucuna göre belirlenir.'}`,
        `${
          TURN_SECONDS[t.game]
            ? 'Hamle süren dolarsa hamlen kendiliğinden yapılır; üst üste 3 kez dolarsa elenirsin ve koltuğuna bot oturur.'
            : 'Süresinde oynamayan elenir ve koltuğuna bot oturur.'
        } Masadaki "Pes et" düğmesiyle masayı bırakırsan da elenirsin; masa sensiz devam eder.`,
      ]
    : [
        ...(isLeague ? leagueRules(t) : ['Eleme usulü: kaybeden elenir, kazanan bir sonraki tura geçer. Final kazananı şampiyon olur.']),
        `Kontenjan ${t.maxPlayers} oyuncu. Kayıtlar başlangıç saatinde kapanır; o ana kadar kaydını iptal edebilirsin.`,
        'Turnuva başlangıç saatinde kendiliğinden başlar ve oyuncular eşleşir. En az 2 kayıt yoksa iptal olur, ücretler iade edilir.',
        `Maçın açılınca bildirim gelir ve sitenin üstünde "Turnuva maçın hazır" kutusu çıkar. ${t.joinMinutes} dakika içinde masaya girmeyen maçı hükmen kaybeder; iki oyuncu da girmezse maç ikisi için de kayıp sayılır.`,
        `Maçlar ${gameTitle.toLowerCase()} masasında standart kurallarla, birebir ve bahissiz oynanır. ${
          TURN_SECONDS[t.game]
            ? 'Hamle süren dolarsa hamlen kendiliğinden yapılır; üst üste 3 kez dolarsa maçı hükmen kaybedersin.'
            : 'Süresinde oynamayan maçı hükmen kaybeder.'
        } Masadaki "Pes et" düğmesiyle maçı bırakabilirsin.`,
        ...(length ? [`Maç uzunluğu: ${length.label.toLocaleLowerCase('tr')}. ${length.hint}`] : []),
      ]
  if (t.endsAt) {
    rules.push(
      `Turnuva en geç ${formatTR(t.endsAt)} biter. Bütün ${shared ? 'masalar' : 'maçlar'} daha önce biterse sonuç beklenmeden yazılır. Bitiş saatinde süren ${shared ? 'masalar' : 'maçlar'} kapanır; ${
        isLeague
          ? 'o anki puan durumu geçerli olur, oynanmayan maç sayılmaz.'
          : 'şampiyon belli değilse turnuvada kalan oyuncular paylaştıkları sıraların ödülünü eşit bölüşür.'
      }`,
    )
  }
  rules.push(fee, fair)
  return rules
}

/** What a closed tournament says about how it closed, when that is not simply "all matches were played". */
export function closeNote(t: Tournament) {
  if (t.status === 'iptal') return `${(t.finishReason && CANCEL_TEXT[t.finishReason]) ?? 'Turnuva iptal edildi.'}${t.entryFee ? ' Kayıt ücretleri iade edildi.' : ''}`
  // A points league always closes at its end time: that is how it is meant to end.
  if (t.status !== 'bitti' || t.finishReason !== 'sure' || t.format === 'puan') return null
  if (t.format === 'lig') return 'Bitiş saati geldi; o anki puan durumu geçerli oldu, oynanmayan maçlar sayılmadı.'
  return t.winner ? null : 'Bitiş saati geldiğinde şampiyon belli değildi. Turnuvada kalan oyuncular ödülü eşit paylaştı.'
}
