import Image from 'next/image'
import { Bell, ChevronDown, Clock, Gift, ListChecks, Trophy, Users } from 'lucide-react'
import { getCemberEvents } from '@/lib/cember'
import {
  GAME_META,
  NOTICE_MINUTES,
  WEEKDAY_SHORT,
  conditionText,
  prizeText,
  type CemberConfig,
  type CemberGame,
} from '@/lib/cember-shared'

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

function EventRow({ e }: { e: CemberConfig }) {
  const conds = e.conditions.map((c) => conditionText(c)).filter(Boolean)
  const prize = prizeText(e.prizes)
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="font-semibold">{e.title}</h4>
        <span className="text-xs font-medium text-primary">{modeText(e)}</span>
      </div>
      <p className="flex items-start gap-2 text-sm">
        <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          <span className="font-medium">{dayText(e.days)}</span>
          <span className="text-muted-foreground"> · {hourText(e)}</span>
        </span>
      </p>
      {conds.length > 0 && (
        <div className="flex items-start gap-2 text-sm">
          <ListChecks className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="font-medium">Katılım şartı</span>
            <ul className="flex flex-col text-muted-foreground">
              {conds.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {prize && (
        <p className="flex items-start gap-2 text-sm">
          <Gift className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            <span className="font-medium">Ödül</span>
            <span className="text-muted-foreground">
              {' · '}
              {prize}
              {e.prizeSplit === 'split' && e.game !== 'cember' ? ' (kazananlar arasında paylaşılır)' : ''}
            </span>
          </span>
        </p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Trophy className="size-3.5" aria-hidden="true" />
          {winnerText(e)}
        </span>
        <span className="flex items-center gap-1">
          <Users className="size-3.5" aria-hidden="true" />
          En fazla {e.maxPlayers} oyuncu
        </span>
      </div>
    </li>
  )
}

export async function ArenaGuide() {
  const events = (await getCemberEvents().catch(() => [] as CemberConfig[])).filter((e) => e.enabled)

  return (
    <section id="arena-oyunlari" aria-labelledby="arena-baslik" className="flex scroll-mt-24 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h2 id="arena-baslik" className="text-balance text-2xl font-bold tracking-tight">
          Canlı arena turları
        </h2>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          Belli saatlerde sitede canlı tur açılır. Etkinliğin şartını tamamlayan herkes tura bir top olarak girer.
        </p>
        <p className="flex items-start gap-2 rounded-xl bg-secondary px-3 py-2.5 text-sm leading-relaxed text-secondary-foreground">
          <Bell className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Tur başlamadan {NOTICE_MINUTES} dakika önce bildirim gelir. Tur saatinde sitede ol, ekrana gelen turu izle.
        </p>
      </header>

      <ul className="flex flex-col gap-6">
        {ORDER.map((g) => {
          const info = GAMES[g]
          const own = events.filter((e) => e.game === g)
          return (
            <li key={g} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
              <article className="flex flex-col md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div className="relative aspect-[16/10] md:aspect-auto md:min-h-full">
                  <Image
                    src={info.image}
                    alt={`${GAME_META[g].label} oyun görseli`}
                    fill
                    sizes="(min-width: 768px) 40vw, 100vw"
                    className="object-cover"
                  />
                </div>

                <div className="flex flex-col gap-5 p-5">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-bold">{GAME_META[g].label}</h3>
                      <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold tabular-nums text-secondary-foreground">
                        {own.length > 0 ? `${own.length} etkinlik` : 'Yakında'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-primary">{info.tagline}</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saha</h4>
                    <p className="text-sm leading-relaxed">{info.field}</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tur nasıl akar</h4>
                    <ol className="flex flex-col gap-2.5 text-sm leading-relaxed">
                      {info.flow.map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <details className="group rounded-xl border border-border/70 bg-background">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                      Kurallar ve modlar
                      <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <dl className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 text-sm">
                      {info.rules.map((r) => (
                        <div key={r.title} className="flex flex-col gap-0.5">
                          <dt className="font-semibold">{r.title}</dt>
                          <dd className="leading-relaxed text-muted-foreground">{r.text}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>

                  <div className="flex flex-col gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saatler ve ödüller</h4>
                    {own.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                        Bu oyun için planlı tur yok. Yeni saatler Telegram kanalında duyurulur.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-3">
                        {own.map((e) => (
                          <EventRow key={e.id} e={e} />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
