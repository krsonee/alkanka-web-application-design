'use client'

import { useState, useTransition } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { loadTournamentMatches } from '@/app/panel/arena-actions'
import { MATCH_END_LABEL, type MatchRecord } from '@/lib/tournaments-shared'

const clock = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const STATUS: Record<MatchRecord['status'], string> = { oynaniyor: 'Açık', bitti: 'Bitti', iptal: 'Kapatıldı' }

const OUT_LABEL: Record<string, string> = { pes: 'pes etti', sure: 'süresi doldu', gelmedi: 'gelmedi' }

/** How the table stands, in the words the panel reads: who is awaited, or how it closed. */
function outcome(m: MatchRecord) {
  if (m.status === 'oynaniyor') {
    if (m.started) return 'Oynanıyor'
    const missing = m.players.filter((p) => !p.arrived && !p.out).map((p) => p.name)
    return missing.length ? `Bekleniyor: ${missing.join(', ')}` : 'Oyuncular masada'
  }
  const winners = m.players.filter((p) => p.winner).map((p) => p.name)
  const why = m.how ? MATCH_END_LABEL[m.how] : 'oynanarak'
  if (m.status === 'iptal') return m.how ? `Sonuçsuz (${MATCH_END_LABEL[m.how]})` : 'Sonuçsuz'
  if (!winners.length) return `Kazanan yok (${why})`
  return `${m.seats > 2 ? 'Tur atlayan' : 'Kazanan'}: ${winners.join(', ')} (${why})`
}

/**
 * The tournament's tables, read when the list is opened: which match is open, who has sat down,
 * how each one closed and when. Nothing here changes a match.
 */
export function TournamentMatches({ id, running }: { id: number; running: boolean }) {
  const [matches, setMatches] = useState<MatchRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const load = () =>
    start(async () => {
      const res = await loadTournamentMatches(id)
      setError(res.matches ? null : (res.message ?? 'Maçlar okunamadı.'))
      if (res.matches) setMatches(res.matches)
    })

  const open = matches?.filter((m) => m.status === 'oynaniyor').length ?? 0

  return (
    <details
      className="rounded-xl border border-border"
      onToggle={(e) => {
        if (e.currentTarget.open && matches === null && !pending) load()
      }}
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">Maçlar{matches ? ` (${matches.length}${open ? `, ${open} açık` : ''})` : ''}</summary>
      <div className="flex flex-col gap-3 border-t border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Açılan her masa burada durur: oyuncular, kim masaya girdi, nasıl bitti. {running ? 'Liste kendiliğinden yenilenmez; güncel durum için "Yenile"ye bas.' : ''}
          </p>
          <button
            type="button"
            onClick={load}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
            Yenile
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
        {matches === null && !error && <p className="text-sm text-muted-foreground">Maçlar okunuyor...</p>}
        {matches?.length === 0 && <p className="text-sm text-muted-foreground">Bu turnuva için açılmış masa yok.</p>}
        {matches && matches.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Turnuva maçları</caption>
              <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2.5 text-left">Tur</th>
                  <th scope="col" className="px-3 py-2.5 text-left">Oyuncular</th>
                  <th scope="col" className="px-3 py-2.5 text-left">Durum</th>
                  <th scope="col" className="px-3 py-2.5 text-left">Sonuç</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Açıldı / kapandı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {matches.map((m) => (
                  <tr key={m.tableId} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-foreground">
                      {m.roundName}
                      <span className="block font-normal text-muted-foreground">
                        {m.seats > 2 ? 'masa' : 'maç'} {m.match + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <ul className="flex flex-col gap-0.5">
                        {m.players.map((p) => (
                          <li key={p.id} className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
                            <span className={cn('font-semibold', p.winner ? 'text-primary' : 'text-foreground')}>{p.name}</span>
                            <span className="text-muted-foreground">{p.out ? (OUT_LABEL[p.out] ?? 'ayrıldı') : p.arrived ? 'masaya girdi' : 'masaya girmedi'}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 font-bold',
                          m.status === 'oynaniyor' ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        {STATUS[m.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs leading-relaxed text-foreground">
                      {outcome(m)}
                      {m.status === 'oynaniyor' && !m.started && m.joinBy && <span className="block text-muted-foreground">Son giriş: {clock(m.joinBy)}</span>}
                      {m.moves > 0 && <span className="block text-muted-foreground">{m.moves} hamle</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                      {clock(m.openedAt)}
                      <span className="block">{m.closedAt ? clock(m.closedAt) : '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  )
}
