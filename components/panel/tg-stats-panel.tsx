'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATS_SPANS, type StatsDay, type TgStats } from '@/lib/tg-resilience-shared'
import { Card, btnGhost, input, useFirstShown } from '@/components/panel/tg-hub-ui'
import { loadTgStatsAction } from '@/app/panel/tg-resilience-actions'

const count = (n: number) => n.toLocaleString('tr-TR')
const shortDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`

type Bar = { key: string; label: string; value: number }

/** The table under each chart carries the same numbers, so the bars themselves are one image to a screen reader. */
function Bars({ bars, summary, ticks }: { bars: Bar[]; summary: string; ticks: string[] }) {
  const max = Math.max(0, ...bars.map((b) => b.value))
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-32 items-end gap-0.5" role="img" aria-label={summary}>
        {bars.map((b) => (
          <div key={b.key} className="flex h-full min-w-0 flex-1 items-end" title={`${b.label}: ${count(b.value)}`}>
            <div className="w-full rounded-t-sm bg-primary" style={{ height: max && b.value ? `${Math.max(3, (b.value / max) * 100)}%` : '0%' }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs tabular-nums text-muted-foreground" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  )
}

function Totals({ data }: { data: TgStats }) {
  const sum = (key: 'messages' | 'joins' | 'removed' | 'leaves') => data.days.reduce((n, d) => n + d[key], 0)
  const cells = [
    { label: 'Mesaj', value: sum('messages') },
    { label: 'Yazan kişi', value: data.writers },
    { label: 'Yeni giriş', value: sum('joins') },
    { label: 'Girenlerden çıkarılan', value: sum('removed') },
    { label: 'Ayrılan', value: sum('leaves') },
  ]
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cells.map((c) => (
        <div key={c.label} className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-3">
          <dt className="text-xs text-muted-foreground">{c.label}</dt>
          <dd className="text-xl font-semibold tabular-nums text-foreground">{count(c.value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function DayTable({ days, withMembers }: { days: StatsDay[]; withMembers: boolean }) {
  const cell = 'px-3 py-1.5 text-right tabular-nums'
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Gün
            </th>
            {['Mesaj', 'Giriş', 'Çıkarılan', 'Ayrılan', ...(withMembers ? ['Üye'] : [])].map((h) => (
              <th key={h} scope="col" className="px-3 py-2 text-right font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-foreground">
          {[...days].reverse().map((d) => (
            <tr key={d.day}>
              <th scope="row" className="px-3 py-1.5 text-left font-normal tabular-nums">
                {shortDay(d.day)}
              </th>
              <td className={cell}>{count(d.messages)}</td>
              <td className={cell}>{count(d.joins)}</td>
              <td className={cell}>{count(d.removed)}</td>
              <td className={cell}>{count(d.leaves)}</td>
              {withMembers && <td className={cell}>{d.members == null ? '—' : count(d.members)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Report({ data }: { data: TgStats }) {
  const messages = data.days.reduce((n, d) => n + d.messages, 0)
  const first = data.days[0]?.day
  const last = data.days.at(-1)?.day
  const busiest = data.hours
    .map((n, h) => ({ h, n }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
  const quiet = !messages && !data.days.some((d) => d.joins || d.leaves)

  return (
    <>
      <Totals data={data} />
      {quiet && <p className="text-sm text-muted-foreground">Bu dönemde kayıtlı mesaj, giriş ya da çıkış yok.</p>}
      <Card title="Günlük mesaj" hint={first && last ? `${shortDay(first)} - ${shortDay(last)} arası, Türkiye saatiyle gün gün.` : undefined}>
        <Bars
          bars={data.days.map((d) => ({ key: d.day, label: shortDay(d.day), value: d.messages }))}
          summary={`Son ${data.span} günde toplam ${count(messages)} mesaj. Günlük sayılar aşağıdaki tabloda.`}
          ticks={first && last ? [shortDay(first), shortDay(last)] : []}
        />
        <DayTable days={data.days} withMembers={Boolean(data.chatId)} />
      </Card>
      <Card
        title="En yoğun saatler"
        hint={
          busiest.length
            ? `En çok mesaj: ${busiest.map((b) => `${hourLabel(b.h)} (${count(b.n)})`).join(', ')}. Duyuru ve post için en kalabalık saatler bunlar.`
            : 'Bu dönemde mesaj yok.'
        }
      >
        <Bars
          bars={data.hours.map((n, h) => ({ key: String(h), label: hourLabel(h), value: n }))}
          summary={busiest.length ? `Saatlere göre mesaj dağılımı. En yoğun saat ${hourLabel(busiest[0].h)}.` : 'Saatlere göre mesaj dağılımı: kayıt yok.'}
          ticks={['00', '06', '12', '18', '23']}
        />
      </Card>
    </>
  )
}

export function StatsSection() {
  const { ref, shown } = useFirstShown<HTMLDivElement>()
  const [chatId, setChatId] = useState('')
  const [span, setSpan] = useState<number>(STATS_SPANS[0])
  const { data, error, isLoading, isValidating, mutate } = useSWR(shown ? ['tg-stats', chatId, span] : null, () => loadTgStatsAction(chatId, span), {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })
  const busy = isLoading || isValidating

  return (
    <div ref={ref} className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground sm:max-w-xs">
          Sohbet
          <select className={input} value={chatId} onChange={(e) => setChatId(e.target.value)}>
            <option value="">Korunan tüm sohbetler</option>
            {(data?.chats ?? []).map((c) => (
              <option key={c.chatId} value={c.chatId}>
                {c.title || c.chatId}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Dönem" className="flex rounded-lg border border-border p-0.5">
            {STATS_SPANS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={span === s}
                onClick={() => setSpan(s)}
                className={cn('h-8 rounded-md px-3 text-sm font-medium', span === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                Son {s} gün
              </button>
            ))}
          </div>
          <button type="button" className={`${btnGhost} gap-2`} disabled={busy} onClick={() => void mutate()}>
            <RefreshCw className={cn('size-4', busy && 'animate-spin')} aria-hidden="true" />
            Yenile
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">İstatistik okunamadı. Biraz sonra &quot;Yenile&quot; butonuna bas.</p>
      ) : data ? (
        data.chats.length ? (
          <Report data={data} />
        ) : (
          <p className="text-sm text-muted-foreground">Korunan listede sohbet yok. İstatistik, Telegram Merkezi &gt; Kurulum bölümünde listeye eklenen grup ve kanallar için tutulur.</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">{busy || !shown ? 'Yükleniyor…' : 'Bu ekran için "Telegram moderasyon" izni gerekli.'}</p>
      )}

      <ul className="flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed text-muted-foreground">
        <li>Mesaj sayısı Bekçi&apos;nin gruplarda gördüğü mesajlardır; mesaj ve giriş kayıtları 35 gün tutulur.</li>
        <li>Gruplardaki giriş ve çıkışlar her zaman sayılır. Kanaldaki giriş ve çıkışlar yalnızca Koruma sekmesindeki giriş takibi ya da açık bir kampanya linki varken sayılır.</li>
        <li>Üye sayısı, kanal sağlığı alarmı açıkken saatte bir kaydedilir ve tek bir sohbet seçiliyken gösterilir.</li>
      </ul>
    </div>
  )
}
