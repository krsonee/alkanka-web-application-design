import { rows, sql } from '@/lib/db'
import { ARENA_META, type ArenaGame } from '@/lib/arena'

type MetricRow = {
  game: string
  finished: number
  cancelled: number
  avg_minutes: number | null
  forfeit_tables: number
  bot_tables: number
  bot_plays: number
  bot_wins: number
}

const fmt = new Intl.NumberFormat('tr-TR')
const pct = (part: number, whole: number) => (whole > 0 ? `%${Math.round((part / whole) * 100)}` : '—')

export async function TableMetrics() {
  const data = await rows<MetricRow>(sql`WITH t AS (
      SELECT id, game, status, created_at, updated_at, players,
        coalesce((options->>'forfeits')::int, 0) AS forfeits,
        players @> '[{"bot": true}]'::jsonb AS has_bots
      FROM game_tables
      WHERE created_at > now() - interval '7 days' AND tournament_id IS NULL
    ), h AS (
      SELECT t.game, count(*)::int AS plays, count(*) FILTER (WHERE gh.result = 'win')::int AS wins
      FROM game_history gh JOIN t ON t.id = gh.table_id
      WHERE t.has_bots AND gh.mode = 'pvp'
      GROUP BY t.game
    )
    SELECT t.game,
      count(*) FILTER (WHERE status = 'bitti')::int AS finished,
      count(*) FILTER (WHERE status = 'iptal')::int AS cancelled,
      round(avg(extract(epoch FROM updated_at - created_at) / 60) FILTER (WHERE status = 'bitti'))::int AS avg_minutes,
      count(*) FILTER (WHERE status = 'bitti' AND forfeits > 0)::int AS forfeit_tables,
      count(*) FILTER (WHERE status = 'bitti' AND has_bots)::int AS bot_tables,
      coalesce(max(h.plays), 0)::int AS bot_plays,
      coalesce(max(h.wins), 0)::int AS bot_wins
    FROM t LEFT JOIN h ON h.game = t.game
    GROUP BY t.game
    ORDER BY finished DESC`).catch(() => null)

  return (
    <section aria-labelledby="table-metrics-title" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <header className="flex flex-col gap-0.5">
        <h2 id="table-metrics-title" className="font-display text-lg font-bold text-foreground">Masa ölçümleri (7 gün)</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Biten ve iptal olan masalar, ortalama maç süresi, oyundan çıkılan masalar ve botlu masalarda oyuncunun kazanma oranı.
        </p>
      </header>

      {data === null ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Masa ölçümleri okunamadı. Sayfayı yenileyip tekrar dene.
        </p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Son 7 günde açılmış masa yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-semibold">Oyun</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Biten</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">İptal</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Ort. süre</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Çıkılan</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Botlu</th>
                <th scope="col" className="py-2 text-right font-semibold">Bota karşı kazanma</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.game} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3 font-semibold text-foreground">{ARENA_META[m.game as ArenaGame]?.title ?? m.game}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmt.format(m.finished)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                    {fmt.format(m.cancelled)} <span className="text-xs">({pct(m.cancelled, m.finished + m.cancelled)})</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{m.avg_minutes == null ? '—' : `${m.avg_minutes} dk`}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{pct(m.forfeit_tables, m.finished)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{pct(m.bot_tables, m.finished)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {pct(m.bot_wins, m.bot_plays)} <span className="text-xs text-muted-foreground">({fmt.format(m.bot_plays)} maç)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
