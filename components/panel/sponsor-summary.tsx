import type { ReactNode } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { EARNING_MODELS, EARNING_STATUSES } from '@/lib/marketing-shared'
import type { SponsorSummary, SummarySection } from '@/lib/sponsor-summary-shared'

const num = (v: number) => v.toLocaleString('tr-TR')
const money = (v: number, currency: string) => `${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${currency}`
const shortDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`
const labelOf = (list: readonly { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id

function Tile({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-background p-3">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="text-xl font-bold tabular-nums text-foreground">{value}</dd>
      {note ? <dd className="text-xs leading-relaxed text-muted-foreground">{note}</dd> : null}
    </div>
  )
}

function ClickChart({ daily }: { daily: SponsorSummary['clicks']['daily'] }) {
  const peak = daily.reduce((best, d) => (d.n > best.n ? d : best), daily[0] ?? { day: '', n: 0 })
  if (!peak || peak.n === 0) return <p className="text-sm text-muted-foreground">Son 30 günde tıklama yok.</p>
  return (
    <div className="flex flex-col gap-1.5">
      <div role="img" aria-label={`Son 30 günün günlük tıklaması. En yoğun gün ${shortDay(peak.day)}, ${num(peak.n)} tıklama.`} className="flex h-20 items-end gap-px">
        {daily.map((d) => (
          <span
            key={d.day}
            title={`${shortDay(d.day)}: ${num(d.n)} tıklama`}
            style={{ height: `${d.n === 0 ? 2 : Math.max(6, Math.round((d.n / peak.n) * 100))}%` }}
            className={d.n === 0 ? 'min-w-0 flex-1 rounded-sm bg-border' : 'min-w-0 flex-1 rounded-sm bg-primary'}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>{shortDay(daily[0].day)}</span>
        <span>{`En yoğun gün ${shortDay(peak.day)}: ${num(peak.n)}`}</span>
        <span>{shortDay(daily[daily.length - 1].day)}</span>
      </div>
    </div>
  )
}

const SECTION_LINK: Record<SummarySection, { href: string; label: string }> = {
  community: { href: '/panel?b=community', label: 'Yorum ve şikayetler' },
  growth: { href: '/panel?b=growth', label: 'Tıklama ve bağlı hesaplar' },
  marketing: { href: '/panel?b=marketing', label: 'Hakediş' },
  catalog: { href: '/panel?b=catalog&s=campaigns', label: 'Kampanya ve bonuslar' },
}

export function SponsorSummaryPanel({ summary, sections, onClose }: { summary: SponsorSummary; sections: SummarySection[]; onClose: () => void }) {
  const { clicks, reviews, complaints, accounts, content, earnings, deal } = summary
  const lastFtd = earnings?.rows.find((e) => e.ftd > 0 && e.status !== 'rejected') ?? null
  const openComplaints = complaints.open + complaints.forwarded
  const noLink = !summary.links.entry && !summary.links.site
  return (
    <section aria-label={`${summary.name} özeti`} className="flex flex-col gap-4 border-t border-border bg-card p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-bold text-foreground">{summary.name} özeti</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">Sitede bu sponsora ait ne varsa tek yerde. Sayılar şu an okundu; sponsorun kendi panelindeki kayıt ve yatırımı site bilemez, onlar hakedişe elle girilir.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Özeti kapat" className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      {(summary.missing.length > 0 || noLink || !summary.active) && (
        <ul className="flex flex-col gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs leading-relaxed text-foreground">
          {summary.missing.length > 0 && <li>{`Şu sayılar okunamadı, 0 görünüyor ama gerçek değer bilinmiyor: ${summary.missing.join(', ')}.`}</li>}
          {noLink && <li>Giriş adresi de site adresi de boş. Sitedeki &quot;Siteye git&quot; düğmesi hiçbir yere gitmez.</li>}
          {!summary.active && <li>Bu sponsor gizli; sitede görünmüyor.</li>}
        </ul>
      )}

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Tıklama · son 30 gün" value={num(clicks.month)} note={`Son 7 gün ${num(clicks.week)} · toplam ${num(clicks.total)} · ${num(clicks.members)} giriş yapmış üye`} />
        <Tile
          label="Üye yorum puanı"
          value={reviews.average === null ? 'Yok' : `${reviews.average.toLocaleString('tr-TR')} / 5`}
          note={`${num(reviews.approved)} yayında · ${num(reviews.pending)} onay bekliyor · editör puanı ${reviews.editorRating.toLocaleString('tr-TR')}`}
        />
        <Tile label="Açık şikayet" value={num(openComplaints)} note={`${num(complaints.resolved)} çözüldü · ${num(complaints.rejected)} reddedildi`} />
        <Tile label="Takipçi" value={num(summary.followers)} note="Adres değişince bildirim alan üye" />
        <Tile label="Bağlı hesap" value={num(accounts.approved)} note={`${num(accounts.pending)} onay bekliyor · ${num(accounts.rejected)} reddedildi`} />
        <Tile label="Kampanya" value={`${num(content.liveCampaigns)} yayında`} note={`Toplam ${num(content.campaigns)} kampanya · ${num(content.bonuses)} bonus`} />
        <Tile
          label="Anlaşma"
          value={deal.daysLeft === null ? 'Süresiz' : deal.daysLeft < 0 ? 'Süresi bitti' : deal.daysLeft === 0 ? 'Bugün bitiyor' : `${num(deal.daysLeft)} gün kaldı`}
          note={[deal.daysLeft === null ? 'Bitiş tarihi girilmedi' : `Bitiş ${deal.ends.split('-').reverse().join('.')}`, deal.fee ? `aylık ${money(deal.fee, 'TL')}` : 'aylık bedel girilmedi'].join(' · ')}
        />
        {earnings && deal.fee > 0 && (
          <Tile
            label="Kayıt başı maliyet"
            value={lastFtd ? money(deal.fee / lastFtd.ftd, 'TL') : 'Hesaplanamadı'}
            note={lastFtd ? `${lastFtd.period}: aylık bedel ÷ ${num(lastFtd.ftd)} FTD` : 'Hakedişte FTD girilmiş bir ay yok'}
          />
        )}
        {earnings && <Tile label="İlk yatırım (FTD)" value={num(earnings.ftd)} note="Hakedişe girilen aylardan" />}
        {earnings &&
          earnings.totals.map((t) => (
            <Tile key={t.currency} label={`Hakediş · ${t.currency}`} value={money(t.paid, t.currency)} note={`ödendi · ${money(t.claimed, t.currency)} talep edildi · ${money(t.pending, t.currency)} hesaplanıyor`} />
          ))}
      </dl>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-muted-foreground">Günlük tıklama</h4>
          <ClickChart daily={clicks.daily} />
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-muted-foreground">Tıklama nereden geldi · son 30 gün</h4>
          {clicks.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kayıt yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {clicks.sources.map((s) => (
                <li key={s.src} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-foreground">{s.src}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{num(s.n)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold text-muted-foreground">Hakediş · son dönemler</h4>
        {!earnings ? (
          <p className="text-sm text-muted-foreground">Hakediş tutarlarını görmek için hesabında Kampanya izni olmalı.</p>
        ) : earnings.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu sponsor için hakediş girilmemiş.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-96 text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Dönem</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Model</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">FTD</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Tutar</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Kayıt başı</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {earnings.rows.map((e, i) => (
                  <tr key={`${e.period}-${i}`}>
                    <td className="px-3 py-2 tabular-nums text-foreground">{e.period}</td>
                    <td className="px-3 py-2 text-muted-foreground">{labelOf(EARNING_MODELS, e.model)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">{num(e.ftd)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">{money(e.amount, e.currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{e.ftd ? money(e.amount / e.ftd, e.currency) : '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{labelOf(EARNING_STATUSES, e.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sections.length > 0 && (
        <nav aria-label={`${summary.name} ile ilgili bölümler`} className="flex flex-wrap gap-2 text-xs font-semibold">
          {sections.map((id) => (
            <Link key={id} href={SECTION_LINK[id].href} className="rounded-lg border border-border px-3 py-2 text-foreground hover:bg-secondary">
              {SECTION_LINK[id].label}
            </Link>
          ))}
        </nav>
      )}
    </section>
  )
}
