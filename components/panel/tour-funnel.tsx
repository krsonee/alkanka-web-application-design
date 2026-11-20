'use client'

import { useState, useTransition } from 'react'
import { Loader2, RotateCcw, TrendingDown } from 'lucide-react'
import { resetTourFunnelAction } from '@/app/panel/tour-actions'
import type { ActionState } from '@/app/panel/actions'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { TOUR_AUDIENCES, type TourAudience } from '@/lib/tour-config'
import type { TourFunnel } from '@/lib/tour'

const WHO: Record<TourAudience, string> = { guest: 'Misafirler', member: 'Üyeler' }

const percent = (part: number, total: number) => (total > 0 ? `%${Math.round((part / total) * 100)}` : '-')

export function TourFunnelCard({ funnel }: { funnel: TourFunnel }) {
  const [busy, start] = useTransition()
  const [state, setState] = useState<ActionState>({})
  const empty = TOUR_AUDIENCES.every((a) => funnel[a].runs === 0)

  const reset = async () => {
    if (!(await askConfirm('Adım sayımı sıfırlansın mı? Bugüne kadar toplanan bırakma oranları silinir.'))) return
    start(async () => setState(await resetTourFunnelAction()))
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5" aria-labelledby="tour-funnel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <h2 id="tour-funnel" className="font-display text-lg font-bold uppercase text-foreground">
            Hangi adımda bırakılıyor
          </h2>
        </div>
        <button
          type="button"
          disabled={busy || empty}
          onClick={() => void reset()}
          className="flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-3.5" aria-hidden="true" />}
          Sayımı sıfırla
        </button>
      </div>
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
        Her tur açılışı bir kez sayılır: hangi adımlar görüldü, hangi adımda kapatıldı. “Burada bıraktı” o adımdayken turu kapatan ya da sayfadan çıkanları gösterir. En
        yüksek oranlı adım, metni ya da yeri gözden geçirilecek adımdır. Adımları çok değiştirdiysen sayımı sıfırla.
      </p>

      {empty ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Henüz sayım yok. Tur sitede açıldıkça burası dolar.</p>
      ) : (
        TOUR_AUDIENCES.filter((a) => funnel[a].runs > 0).map((audience) => {
          const data = funnel[audience]
          const worst = Math.max(0, ...data.steps.map((s) => (s.seen > 0 ? s.exits / s.seen : 0)))
          return (
            <div key={audience} className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-foreground">
                {WHO[audience]}
                <span className="font-normal text-muted-foreground">
                  {' '}
                  · {data.runs.toLocaleString('tr-TR')} kez açıldı, {data.finished.toLocaleString('tr-TR')} kez bitirildi ({percent(data.finished, data.runs)})
                </span>
              </h3>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="bg-background text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Adım
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">
                        Gören
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">
                        Burada bıraktı
                      </th>
                      <th scope="col" className="w-40 px-3 py-2 font-semibold">
                        Bırakma oranı
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.steps.map((s, i) => {
                      const rate = s.seen > 0 ? s.exits / s.seen : 0
                      const top = worst > 0 && rate === worst
                      return (
                        <tr key={s.id}>
                          <th scope="row" className="px-3 py-2 font-medium text-foreground">
                            {i + 1}. {s.title}
                          </th>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground">{s.seen.toLocaleString('tr-TR')}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground">{s.exits.toLocaleString('tr-TR')}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                                <div className={top ? 'h-full bg-destructive' : 'h-full bg-primary'} style={{ width: `${Math.round(rate * 100)}%` }} />
                              </div>
                              <span className={top ? 'w-10 text-right text-xs font-bold tabular-nums text-destructive' : 'w-10 text-right text-xs tabular-nums text-muted-foreground'}>
                                {percent(s.exits, s.seen)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}

      {state.message ? (
        <p role="status" className={state.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
          {state.message}
        </p>
      ) : null}
    </section>
  )
}
