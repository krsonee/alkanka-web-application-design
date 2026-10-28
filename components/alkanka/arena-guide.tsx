import Image from 'next/image'
import { CalendarClock, Clock, Shield, Trophy, Users } from 'lucide-react'
import { getCemberEvents } from '@/lib/cember'
import { GAME_META, WEEKDAY_SHORT, type CemberConfig, type CemberGame } from '@/lib/cember-shared'

type GameInfo = {
  image: string
  tagline: string
  how: string[]
  modes: { name: string; text: string }[]
}

const GAMES: Record<CemberGame, GameInfo> = {
  cember: {
    image: '/images/arena/jako-cemberi.png',
    tagline: 'Çemberde dön, son kalan sen ol.',
    how: [
      'Tur saatinden önce etkinlik şartını tamamla, katılım hakkın açılsın.',
      'Tur başlayınca tüm katılımcılar çembere dizilir, ok döner ve elenenler tek tek düşer.',
      'Çemberde son kalan kanka ödülü alır.',
    ],
    modes: [{ name: 'Klasik', text: 'Tek kazanan, tam ödül.' }],
  },
  karadelik: {
    image: '/images/arena/kara-delik.png',
    tagline: 'Kara delik herkesi çekiyor, sen dayan.',
    how: [
      'Masadaki herkes ortadaki kara deliğin çekimine karşı ayakta kalmaya çalışır.',
      'Belirlenen süre dolunca Final Savaşı başlar, delik büyür ve çekim sertleşir.',
      'Deliğe en son düşenler sıralamaya göre ödül kazanır.',
    ],
    modes: [
      { name: 'Sabit kazanan', text: 'Belirlenen sayıda son kalan kazanır.' },
      { name: 'Kademeli', text: 'Katılım arttıkça kazanan sayısı da artar.' },
    ],
  },
  survival: {
    image: '/images/arena/survival-arena.png',
    tagline: 'Tek başına ya da takımınla arenada hayatta kal.',
    how: [
      'Oyuncular arenada çarpışır, kalkanı olan ilk darbeyi atlatır.',
      'Arena zamanla daralır, dışarıda kalan elenir.',
      'Kurala göre son ayakta kalan ya da en çok eleme yapan kazanır.',
    ],
    modes: [
      { name: 'Tekli', text: 'Herkes kendi için oynar.' },
      { name: 'Takımlı', text: 'Altın ve Mavi takım. Kazanan takımın oyuncuları ödül alır.' },
      { name: 'Son kalan', text: 'Ayakta kalan en son oyuncu ya da takım kazanır.' },
      { name: 'En çok eleme', text: 'Tur sonunda en çok rakip eleyen kazanır.' },
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
  if (e.winnerMode === 'tiers') return 'Katılıma göre kademeli kazanan'
  return `${e.winners} kazanan`
}

function modeText(e: CemberConfig) {
  if (e.game === 'karadelik') return `Final Savaşı ${e.duration} sn sonra`
  if (e.game === 'survival') {
    const t = e.survival.teams === 2 ? 'Takımlı' : 'Tekli'
    const r = e.survival.rule === 'most' ? 'en çok eleme' : 'son kalan'
    return `${t}, ${r}${e.survival.shield ? ', kalkanlı' : ''}`
  }
  return 'Klasik'
}

export async function ArenaGuide() {
  const events = (await getCemberEvents().catch(() => [] as CemberConfig[])).filter((e) => e.enabled)

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">AL KANKA Arena oyunları</h2>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          Üç canlı oyun, her gün belli saatlerde. Şartı tamamla, tur saatinde sitede ol, ekrana düşen tura katıl.
          Tur başlamadan {3} dakika önce bildirim gelir.
        </p>
      </header>

      <ul className="grid gap-6 lg:grid-cols-3">
        {ORDER.map((g) => {
          const info = GAMES[g]
          const own = events.filter((e) => e.game === g)
          return (
            <li key={g} className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card">
              <div className="relative aspect-[4/3]">
                <Image src={info.image} alt={`${GAME_META[g].label} oyun görseli`} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
              </div>
              <div className="flex flex-1 flex-col gap-5 p-5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-bold">{GAME_META[g].label}</h3>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground tabular-nums">
                      {own.length > 0 ? `${own.length} etkinlik` : 'Yakında'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{info.tagline}</p>
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nasıl oynanır</h4>
                  <ol className="flex flex-col gap-2 text-sm leading-relaxed">
                    {info.how.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modlar</h4>
                  <dl className="flex flex-col gap-1.5 text-sm">
                    {info.modes.map((m) => (
                      <div key={m.name} className="flex flex-col">
                        <dt className="font-semibold">{m.name}</dt>
                        <dd className="text-muted-foreground">{m.text}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <section aria-labelledby="arena-saatleri" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-5 text-primary" aria-hidden="true" />
          <h2 id="arena-saatleri" className="text-xl font-bold">Oyun saatleri</h2>
        </div>
        {events.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">
            Şu an planlı arena turu yok. Yeni saatler Telegram kanalında duyurulur.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {ORDER.flatMap((g) => events.filter((e) => e.game === g)).map((e) => (
              <li key={e.id} className="flex gap-4 rounded-2xl border border-border/70 bg-card p-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
                  <Image src={GAMES[e.game].image} alt="" fill sizes="64px" className="object-cover" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="font-semibold">{e.title}</h3>
                    <span className="text-xs font-medium text-primary">{GAME_META[e.game].label}</span>
                  </div>
                  <p className="flex items-start gap-1.5 text-sm">
                    <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>
                      <span className="font-medium">{dayText(e.days)}</span>
                      <span className="text-muted-foreground"> · {hourText(e)}</span>
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Shield className="size-3.5" aria-hidden="true" />{modeText(e)}</span>
                    <span className="flex items-center gap-1"><Trophy className="size-3.5" aria-hidden="true" />{winnerText(e)}</span>
                    <span className="flex items-center gap-1"><Users className="size-3.5" aria-hidden="true" />En fazla {e.maxPlayers} oyuncu</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
