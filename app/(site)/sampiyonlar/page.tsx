import Link from 'next/link'
import { Crown } from 'lucide-react'
import { pageMeta } from '@/lib/seo'
import { listPodiums, type Podium } from '@/lib/kanka-puan'
import { EditableHero } from '@/components/alkanka/editable-hero'

export const revalidate = 300

export const metadata = pageMeta('sampiyonlar')

const KIND = { hafta: 'Haftanın şampiyonları', ay: 'Ayın şampiyonları' } as const
const PLACE_STYLE = ['bg-primary text-primary-foreground', 'bg-secondary text-secondary-foreground', 'bg-muted text-foreground']

function periodLabel(p: Podium) {
  const d = new Date(`${p.label}T12:00:00+03:00`)
  if (p.kind === 'ay') return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' })
  const end = new Date(d.getTime() + 6 * 86_400_000)
  const f = (x: Date) => x.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' })
  return `${f(d)} – ${f(end)}`
}

function PodiumCard({ p }: { p: Podium }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-bold text-foreground">{KIND[p.kind]}</h3>
        <span className="text-xs text-muted-foreground">{periodLabel(p)}</span>
      </header>
      <ol className="flex flex-col gap-2">
        {p.rows.map((r) => (
          <li key={r.place} className="flex items-center gap-3">
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${PLACE_STYLE[r.place - 1]}`}>
              {r.place === 1 ? <Crown className="size-4" aria-label="1." /> : r.place}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{r.name}</span>
            <span className="font-mono text-sm tabular-nums text-muted-foreground">{r.kp.toLocaleString('tr-TR')} KP</span>
          </li>
        ))}
      </ol>
    </li>
  )
}

export default async function ChampionsPage() {
  const podiums = await listPodiums(24).catch(() => [] as Podium[])
  return (
    <>
      <EditableHero
        slug="sampiyonlar"
        image="/images/heroes/siralama.png"
        compact
        eyebrow="Şampiyon Kürsüsü"
        title="Kürsüye çıkan kalır"
        description="Her hafta ve her ay ilk 3 kanka buraya kalıcı olarak yazılır. Sıradaki isim sen ol."
        pose="kazandi"
      />
      <section aria-label="Geçmiş kürsüler" className="flex flex-col gap-4">
        {podiums.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {podiums.map((p) => (
              <PodiumCard key={`${p.kind}-${p.label}`} p={p} />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm leading-relaxed text-muted-foreground">
            İlk kürsü bu haftanın sonunda kurulacak. Haftalık ligde ilk 3&apos;e gir, adın burada kalsın.
          </p>
        )}
        <Link href="/siralama" className="self-center text-sm font-semibold text-primary hover:underline">
          Canlı sıralamaya dön
        </Link>
      </section>
    </>
  )
}
