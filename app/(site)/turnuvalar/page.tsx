import type { Metadata } from 'next'
import Link from 'next/link'
import { Swords } from 'lucide-react'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { TournamentCard } from '@/components/alkanka/arena/tournament-card'
import { listTournaments } from '@/lib/tournaments'

export const metadata: Metadata = {
  title: 'Turnuvalar | AL KANKA',
  description: 'Tavla, okey ve bilardo turnuvalarına katıl, Kanka Coin ödül havuzunu kap.',
}

export default async function TournamentsPage() {
  const all = (await listTournaments()).filter((t) => t.status !== 'iptal')
  const live = all.filter((t) => t.status !== 'bitti')
  const done = all.filter((t) => t.status === 'bitti')

  return (
    <>
      <EditableHero
        slug="turnuvalar"
        image="/images/heroes/turnuvalar.png"
        eyebrow="Turnuvalar"
        title="Kanka turnuvaları"
        description="Tavla, okey ve bilardo turnuvalarına kaydol. Eşleşmeler canlı güncellenir, şampiyon ödül havuzunu alır."
        pose="kazandi"
        speech="Masada görüşürüz kanka!"
      />

      {live.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-10 text-center">
          <Swords className="size-9 text-primary" aria-hidden="true" />
          <h2 className="font-display text-2xl font-bold uppercase text-foreground">Yeni turnuva yakında</h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Şu an kayıtları açık bir turnuva yok. Duyurular Telegram kanalımızda. O zamana kadar masalarda ısınabilirsin.
          </p>
          <Link href="/oyunlar" className="mt-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground">
            Masa oyunlarına git
          </Link>
        </div>
      ) : (
        <section aria-label="Aktif turnuvalar" className="flex flex-col gap-6">
          {live.map((t) => (
            <TournamentCard key={t.id} t={t} />
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section aria-labelledby="gecmis" className="flex flex-col gap-4">
          <h2 id="gecmis" className="font-display text-2xl font-bold uppercase text-foreground">
            Geçmiş turnuvalar
          </h2>
          <div className="flex flex-col gap-6">
            {done.map((t) => (
              <TournamentCard key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
