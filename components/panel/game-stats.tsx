import { rows, sql } from '@/lib/db'
import { ARENA_META, type ArenaGame } from '@/lib/arena'
import { cn } from '@/lib/utils'

type StatRow = { game: string; mode: string; plays: number; players: number; stake: number; delta: number }

const MODE_LABEL: Record<string, string> = { masa: 'Masa', pvp: 'Oyuncuya karşı', bot: 'Bota karşı' }
const fmt = new Intl.NumberFormat('tr-TR')

function gameTitle(game: string) {
  return ARENA_META[game as ArenaGame]?.title ?? game
}

export async function GameStats() {
  const stats = await rows<StatRow>(sql`SELECT game, mode,
      count(*)::int AS plays,
      count(DISTINCT user_id)::int AS players,
      coalesce(sum(stake), 0)::int AS stake,
      coalesce(sum(delta), 0)::int AS delta
    FROM game_history
    WHERE created_at > now() - interval '7 days' AND mode IN ('masa', 'pvp', 'bot')
    GROUP BY game, mode
    ORDER BY plays DESC`).catch(() => null)

  return (
    <section aria-labelledby="game-stats-title" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <header className="flex flex-col gap-0.5">
        <h2 id="game-stats-title" className="font-display text-lg font-bold text-foreground">Son 7 gün</h2>
        <p className="text-sm text-muted-foreground">
          Oyun başına el sayısı, oyuncu, toplam bahis ve kasa sonucu. Oran değiştirince etkisini buradan izle.
        </p>
      </header>

      {stats === null ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Oyun istatistikleri okunamadı. Sayfayı yenileyip tekrar dene.
        </p>
      ) : stats.length === 0 ? (
        <p className="text-sm text-muted-foreground">Son 7 günde oynanmış el yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-semibold">Oyun</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Mod</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">El</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Oyuncu</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Toplam bahis</th>
                <th scope="col" className="py-2 text-right font-semibold">Kasa sonucu</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => {
                const house = -s.delta
                return (
                  <tr key={`${s.game}-${s.mode}`} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 font-semibold text-foreground">{gameTitle(s.game)}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{MODE_LABEL[s.mode] ?? s.mode}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmt.format(s.plays)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmt.format(s.players)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmt.format(s.stake)}</td>
                    <td
                      className={cn(
                        'py-2 text-right font-semibold tabular-nums',
                        house > 0 ? 'text-primary' : house < 0 ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {house > 0 ? '+' : ''}
                      {fmt.format(house)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {'Kasa sonucu: artı = oyuncular kaybetti, eksi = oyuncular kazandı. Oyuncuya karşı oyunlarda komisyon dışında kasa payı yoktur.'}
      </p>
    </section>
  )
}
