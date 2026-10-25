import { ArrowUpRight, Clock, Gift } from 'lucide-react'
import { DEAL_LABELS, type Deal } from '@/lib/deal-types'

const DAY = 86_400_000

function ageLabel(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
  if (days <= 0) return 'Bugün'
  if (days === 1) return 'Dün'
  return `${days} gün önce`
}

function snippet(body: string, title: string) {
  const rest = body.replace(title, '').replace(/\s+/g, ' ').trim()
  return rest.length > 180 ? `${rest.slice(0, 177)}...` : rest
}

function DealRow({ deal, sponsorId, ended }: { deal: Deal; sponsorId: string; ended: boolean }) {
  const text = snippet(deal.body, deal.title)
  return (
    <li className={`flex flex-col gap-2 rounded-xl border border-border/60 bg-background/40 p-3 md:p-4 ${ended ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
        <span className={`rounded-full px-2 py-0.5 ${ended ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}`}>
          {ended ? 'Sona erdi' : DEAL_LABELS[deal.kind]}
        </span>
        <span className="flex items-center gap-1 normal-case tracking-normal text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          <time dateTime={deal.createdAt}>{ageLabel(deal.createdAt)}</time>
        </span>
      </div>
      <h3 className="font-display text-sm font-bold leading-snug text-foreground text-pretty md:text-base">{deal.title}</h3>
      {text ? <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{text}</p> : null}
      {!ended ? (
        <a
          href={`/git/${sponsorId}`}
          target="_blank"
          rel="nofollow sponsored noopener"
          className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary"
        >
          Fırsatı al
          <ArrowUpRight className="size-4" aria-hidden />
        </a>
      ) : null}
    </li>
  )
}

export function SponsorDeals({ name, sponsorId, deals, freshDays }: { name: string; sponsorId: string; deals: Deal[]; freshDays: number }) {
  const cutoff = Date.now() - freshDays * DAY
  const live = deals.filter((d) => new Date(d.createdAt).getTime() >= cutoff)
  const ended = deals.filter((d) => new Date(d.createdAt).getTime() < cutoff).slice(0, 10)

  return (
    <section aria-labelledby="guncel-bonuslar" className="sd-panel sd-rise flex flex-col gap-4 rounded-2xl p-4 md:p-5">
      <div className="flex flex-col gap-1">
        <h2 id="guncel-bonuslar" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Gift className="size-5 text-primary" aria-hidden />
          {name} güncel bonuslar ve fırsatlar
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {name} kanalında paylaşılan son kampanyalar burada otomatik güncellenir. Son {freshDays} günün fırsatları aktif olarak gösterilir.
        </p>
      </div>

      {live.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {live.map((d) => <DealRow key={d.id} deal={d} sponsorId={sponsorId} ended={false} />)}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Şu an aktif bir {name} fırsatı yok. Takip edersen yeni kampanya gelince haber veririz.
        </p>
      )}

      {ended.length ? (
        <details className="group flex flex-col gap-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">Geçmiş fırsatlar ({ended.length})</summary>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {ended.map((d) => <DealRow key={d.id} deal={d} sponsorId={sponsorId} ended />)}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
