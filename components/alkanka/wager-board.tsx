import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { currentPeriod, wagerBoard } from '@/lib/growth'

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const label = (p: string) => {
  const [y, m] = p.split('-').map(Number)
  return `${MONTHS[(m || 1) - 1]} ${y}`
}
const maskAmount = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} ₺`

export async function WagerBoard() {
  const period = currentPeriod()
  const rows = await wagerBoard(period, 20).catch(() => [])

  return (
    <section aria-labelledby="cevrim-baslik" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="cevrim-baslik" className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
            <Trophy className="size-5 text-primary" aria-hidden="true" />
            Aylık çevrim yarışı · {label(period)}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sponsor sitelerde yaptığın toplam çevrim. Hesabını profilinden bağla, onaylandıktan sonra listeye girersin.
          </p>
        </div>
        <Link href="/profil#sponsor-hesaplari" className="text-sm font-semibold text-primary hover:underline">
          Hesabını bağla
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-secondary px-4 py-6 text-center text-sm text-muted-foreground">
          Bu ayın çevrim verisi henüz yüklenmedi. Ay içinde güncellenir.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {rows.map((r, i) => (
            <li key={r.userId} className="flex items-center gap-3 px-4 py-3">
              <span className="w-6 text-center font-display text-sm font-bold tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{r.name}</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">{r.sites} site</span>
              <span className="font-display text-sm font-bold tabular-nums text-foreground">{maskAmount(r.amount)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
