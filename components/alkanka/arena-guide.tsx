import { getCemberEvents, nextRoundAt } from '@/lib/cember'
import {
  GAME_META,
  NOTICE_MINUTES,
  WEEKDAY_SHORT,
  conditionText,
  prizeText,
  type CemberConfig,
  type CemberGame,
} from '@/lib/cember-shared'
import { ArenaCards, type ArenaGameCard } from './arena-cards'
import { SectionHeading } from './section-heading'

type Rule = { title: string; text: string }
type GameInfo = {
  image: string
  tagline: string
  field: string
  flow: string[]
  rules: Rule[]
}

const GAMES: Record<CemberGame, GameInfo> = {
  cember: {
    image: '/images/arena/jako-cemberi.png',
    tagline: 'Dönen çember sahada son kalan top kazanır.',
    field:
      'Her katılımcı sahada bir toptur. Toplar yer çekimiyle yuvarlak sahanın dibine yığılır. Sahanın kenarında karşılıklı iki kale vardır; kaleler sahayla birlikte döner ve sürekli daralıp genişler.',
    flow: [
      'Tur açılınca tüm toplar sahaya düşer. İlk 2,5 saniye kaleler kapalıdır, yığın yerine oturur.',
      'Dönen saha kenarı yığını sürükler. Bir kale yığının altından geçerken ağzına gelen top dışarı düşer ve elenir.',
      'Elenmeler tek tek gelir, kim düştüyse ekranın akışında görünür. Tur en az 24 saniye sürer.',
      'Zamanla kaleler biraz daha açılır, tur kendiliğinden biter. Sahada kalan son top kazanır.',
    ],
    rules: [
      { title: 'Kazanan', text: 'Her turda tek kazanan vardır, ödülün tamamını alır.' },
      { title: 'Tek katılımcı', text: 'Turda tek kişi varsa kısa bir tur atar ve doğrudan kazanır.' },
      { title: 'Adil sonuç', text: 'Topu sen yönetmezsin. Hareketi fizik belirler ve tur herkesin ekranında birebir aynı oynar.' },
    ],
  },
  karadelik: {
    image: '/images/arena/kara-delik.png',
    tagline: 'Delik açılmadan dayan, Final Savaşı’nda son kalanlardan ol.',
    field:
      'Yuvarlak arenanın ortasında bir kara delik, etrafında dönen iki kol vardır. Her katılımcı bir toptur; toplar duvarlara ve kollara çarparak arenada savrulur.',
    flow: [
      'Delik 11 saniyelik döngüyle çalışır: 5,5 saniye kapalı kalır, ardından ekranda 3-2-1 geri sayımı başlar.',
      'Delik açılınca çekim alanındaki toplar merkeze çekilir. Deliğe düşen top elenir.',
      'Dönen kollar topları deliğe doğru ya da dışarı savurur. Kolların hareketi her turda farklıdır.',
      'Etkinlik süresi dolunca Final Savaşı başlar: delik artık kapanmaz, her saniye büyür, kollar 1,7 kat hızlı döner.',
    ],
    rules: [
      { title: 'Kazanan', text: 'Sahada kazanan sayısı kadar top kalınca tur biter, kalanların hepsi ödül alır.' },
      { title: 'Sabit kazanan', text: 'Etkinlikte belirlenen sayıda (1–10) son kalan kazanır.' },
      { title: 'Kademeli', text: 'Katılımcı sayısı arttıkça kazanan sayısı da artar. Kalabalık tur, daha çok kazanan demek.' },
      { title: 'Az katılım', text: 'Katılımcı sayısı kazanan sayısını geçmiyorsa tur oynanmadan herkes kazanır.' },
      { title: 'Adil sonuç', text: 'Topu sen yönetmezsin. Tur herkesin ekranında birebir aynı oynar.' },
    ],
  },
  survival: {
    image: '/images/arena/survival-arena.png',
    tagline: 'Kayan kalelere düşme, sahada kal.',
    field:
      'Dikey bir futbol sahası. Sağ ve sol kenarda yukarı aşağı kayan birer kale vardır. Her katılımcı bir toptur; toplar durmadan hareket eder, birbirine çarpıp savrulur.',
    flow: [
      'Sahada aynı anda 10–20 top olur, katılım arttıkça sahaya daha çok top çıkar. Kalanlar sırada bekler.',
      'Kayan kalenin ağzına giren top elenir. Kale dışında kalan kenara çarpan top geri seker.',
      'Elenen her topun yerine sıradaki top sahanın ortasından girer. Yeni giren top ilk saniyede kaleye düşmez.',
      'Sırada bekleyen kalmayınca süre işlemeye başlar. Süre dolunca Final Savaşı: kaleler büyür, toplar hızlanır.',
    ],
    rules: [
      { title: 'Tekli mod', text: 'Herkes kendi için oynar. Sahada kazanan sayısı kadar top kalınca tur biter, kalanlar ödül alır.' },
      { title: 'Takımlı mod', text: 'Katılımcılar Altın ve Mavi takıma sırayla dağıtılır, iki takım sahaya eşit sayıda çıkar. Elenenin yerine kendi takımından biri girer.' },
      { title: 'Son kalan takım', text: 'Bir takımın sahadaki ve sıradaki tüm topları kaleye düşünce diğer takım kazanır.' },
      { title: 'Süre sonu çoğunluk', text: 'Süre bitince sahada daha çok topu kalan takım kazanır. Eşitse ani ölüm: ilk topunu kaybeden takım kaybeder.' },
      { title: 'Takım kalkanı', text: 'Açıksa aynı takımdan iki top çarpışınca ikisi de 1 saniye kaleye düşmez, kale ağzından geri seker.' },
      { title: 'Takım ödülü', text: 'Kazanan takımın tüm oyuncuları ödül alır, turda erken elenmiş olsalar bile.' },
    ],
  },
}

const ORDER: CemberGame[] = ['cember', 'karadelik', 'survival']
const pad = (n: number) => String(n).padStart(2, '0')

function dayText(days: number[]) {
  if (days.length === 0 || days.length === 7) return 'Her gün'
  const s = [...days].sort((a, b) => a - b)
  if (s.join() === '5,6') return 'Hafta sonu'
  if (s.join() === '0,1,2,3,4') return 'Hafta içi'
  return s.map((d) => WEEKDAY_SHORT[d]).join(', ')
}

function hourText(e: CemberConfig) {
  if (e.hours.length === 0) return 'Saat belirlenmedi'
  const all = e.hours.length === 24
  const base = all ? 'Gün boyu' : [...e.hours].sort((a, b) => a - b).map((h) => `${pad(h)}:${pad(e.minute)}`).join(' · ')
  if (e.every > 0) return `${base}${all ? '' : ' saatlerinde'}, her ${e.every} dakikada bir`
  return all ? `${base}, her saat :${pad(e.minute)}` : base
}

function winnerText(e: CemberConfig) {
  if (e.game === 'cember') return '1 kazanan'
  if (e.game === 'survival' && e.survival.teams === 2) return 'Kazanan takımın tamamı'
  if (e.winnerMode === 'tiers') return 'Katılıma göre kademeli'
  return `${e.winners} kazanan`
}

function modeText(e: CemberConfig) {
  if (e.game === 'karadelik') return `Final Savaşı ${e.duration} sn sonra`
  if (e.game === 'survival') {
    if (e.survival.teams === 0) return `Tekli · Final ${e.duration} sn sonra`
    const r = e.survival.rule === 'most' ? 'süre sonu çoğunluk' : 'son kalan takım'
    return `Altın vs Mavi · ${r}${e.survival.shield ? ' · kalkanlı' : ''}`
  }
  return 'Klasik çember'
}

export async function ArenaGuide() {
  const events = (await getCemberEvents().catch(() => [] as CemberConfig[])).filter((e) => e.enabled)
  const now = Date.now()

  const cards: ArenaGameCard[] = ORDER.map((g) => {
    const info = GAMES[g]
    return {
      game: g,
      label: GAME_META[g].label,
      image: info.image,
      tagline: info.tagline,
      field: info.field,
      flow: info.flow,
      rules: info.rules.map((r) => `${r.title}: ${r.text}`),
      events: events
        .filter((e) => e.game === g)
        .map((e) => ({
          id: e.id,
          title: e.title,
          mode: modeText(e),
          days: dayText(e.days),
          hours: hourText(e),
          prize: prizeText(e.prizes)
            ? `${prizeText(e.prizes)}${e.prizeSplit === 'split' && e.game !== 'cember' ? ' (paylaşılır)' : ''}`
            : null,
          winners: winnerText(e),
          maxPlayers: e.maxPlayers,
          conds: e.conditions.map((c) => conditionText(c)).filter(Boolean),
          next: nextRoundAt(e, now),
        })),
    }
  })

  return (
    <section id="arena-oyunlari" aria-labelledby="arena-baslik" className="flex scroll-mt-24 flex-col gap-5">
      <SectionHeading
        id="arena-baslik"
        title="Canlı arena turları"
        description="Belli saatlerde sitede canlı tur açılır. Etkinliğin şartını tamamlayan herkes tura bir top olarak girer, son kalanlar ödülü alır."
      />
      <ArenaCards cards={cards} notice={NOTICE_MINUTES} />
    </section>
  )
}
