import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import Link from 'next/link'
import { Events } from '@/components/alkanka/events'
import { publicTickets } from '@/lib/public-boards'

export const metadata = pageMeta('biletler')
export const dynamic = 'force-dynamic'

export default async function TicketsPage() {
  const tickets = await publicTickets()
  return (
    <>
      <EditableHero slug="biletler"
        image="/images/heroes/biletler.png"
        highlights={['Pazar 21:00 canlı çekiliş', 'Günlük turnuva', 'Kanka Coin havuzu']}
        eyebrow="Biletler"
        title="Bilet çekilişleri"
        description="Haftalık bilet çekilişi ve günlük turnuvalar. Katıl, Kanka Coin havuzundan payını al."
        pose="kazandi"
        speech="Pazar 21:00 canlı çekiliş, kaçırma!"
        tone="accent"
      />
      {tickets.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {tickets.map((event) => (
            <li key={event.id} className="panel-gold flex flex-col gap-2 rounded-xl p-5">
              <h2 className="font-display text-xl font-bold text-foreground">{event.title}</h2>
              <p className="text-sm text-muted-foreground">
                Bilet {event.ticketPrice.toLocaleString('tr-TR')} puan · ödül {event.prizePoints.toLocaleString('tr-TR')} puan · {event.sold} bilet
              </p>
              <p className="text-xs text-muted-foreground">Bitiş: {event.endsAt ? new Date(event.endsAt).toLocaleString('tr-TR') : '—'}</p>
              <Link href="/profil" className="text-xs font-bold uppercase tracking-wider text-primary hover:underline">Katılmak için giriş yap</Link>
            </li>
          ))}
        </ul>
      ) : null}
      <Events view="biletler" />
    </>
  )
}
