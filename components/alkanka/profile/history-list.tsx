import Link from 'next/link'
import { Coins, Gamepad2, Gift, History, ShoppingBag, Trophy, type LucideIcon } from 'lucide-react'
import type { HistoryRow } from '@/lib/member'
import { TR_TZ } from '@/lib/tr-time'
import { cn } from '@/lib/utils'

const GAME_NAMES: Record<string, string> = {
  okey: 'Okey',
  okey101: '101 Okey',
  tavla: 'Tavla',
  batak: 'Batak',
  pisti: 'Pişti',
  papaz: 'Papaz Kaçtı',
  monopoly: 'Jakopoly',
  bilardo: 'Bilardo',
  'kafa-topu': 'Kafa Topu',
  'kafa-basketbolu': 'Kafa Basketbolu',
  blackjack: 'Blackjack',
  rulet: 'Rulet',
  cark: 'Şans Çarkı',
  zar: 'Zar At',
  sandik: 'Gizemli Sandık',
  cember: 'Jako Çemberi',
  tahmin: 'Tahmin ligi',
  market: 'Market',
  turnuva: 'Turnuva',
  etkinlik: 'Etkinlik',
  uygulama: 'Uygulama ödülü',
}

const MODE_NAMES: Record<string, string> = {
  bot: 'Bota karşı',
  pvp: 'Oyuncuya karşı',
  turnuva: 'Turnuva maçı',
  masa: 'Masa',
  admin: 'Ekip girdi',
}

const WHEN = new Intl.DateTimeFormat('tr-TR', { timeZone: TR_TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmt = (n: number) => n.toLocaleString('tr-TR')

function outcome(row: HistoryRow): string {
  if (row.result === 'refund') return 'İade'
  if (row.mode === 'odul') return 'Ödül'
  if (row.mode === 'harcama') return 'Harcama'
  if (row.result === 'win') return 'Kazandın'
  if (row.result === 'loss') return 'Kaybettin'
  return 'Berabere'
}

function iconFor(row: HistoryRow): LucideIcon {
  if (row.mode === 'odul') return row.game === 'cember' || row.game === 'tahmin' ? Trophy : Gift
  if (row.mode === 'harcama') return row.game === 'market' ? ShoppingBag : Coins
  if (row.mode === 'turnuva') return Trophy
  return Gamepad2
}

function detail(row: HistoryRow, name: string): string {
  const parts: string[] = []
  const who = row.opponent.trim()
  if (who && who !== name) parts.push(who)
  const mode = MODE_NAMES[row.mode]
  if (mode) parts.push(mode)
  if (row.stake > 0 && row.mode !== 'harcama') parts.push(`${fmt(row.stake)} KC masa`)
  return parts.join(' · ')
}

export function HistoryList({ rows, played, wins }: { rows: HistoryRow[]; played: number; wins: number }) {
  const rate = played ? Math.round((wins / played) * 100) : 0
  const summary = [
    { label: 'Oynanan oyun', value: fmt(played) },
    { label: 'Kazanılan', value: fmt(wins) },
    { label: 'Kazanma oranı', value: `%${rate}` },
  ]

  return (
    <section aria-labelledby="gecmis" className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <h2 id="gecmis" className="font-display text-lg font-bold text-foreground">Oyun geçmişi</h2>
        <span className="text-xs tabular-nums text-muted-foreground">Son {rows.length} kayıt</span>
      </div>

      <dl className="grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-card">
        {summary.map((s, i) => (
          <div key={s.label} className={cn('flex flex-col gap-0.5 px-4 py-3', i > 0 && 'border-l border-border')}>
            <dt className="text-[11px] text-muted-foreground">{s.label}</dt>
            <dd className="font-display text-lg font-bold tabular-nums text-foreground">{s.value}</dd>
          </div>
        ))}
      </dl>

      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-card p-5">
          <History className="size-5 text-gold" aria-hidden />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Henüz kaydın yok. Bir masaya otur ya da günlük çarkı çevir; her oyun, ödül ve harcama burada sıralanır.
          </p>
          <Link href="/oyunlar" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">
            Oyunlara git
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
          {rows.map((row, i) => {
            const name = GAME_NAMES[row.game] ?? row.game
            const Icon = iconFor(row)
            const sub = detail(row, name)
            return (
              <li key={row.id} className={cn('flex items-center gap-3 px-4 py-3', i > 0 && 'border-t border-border')}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-gold">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{outcome(row)}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {sub ? `${sub} · ` : ''}
                    <time dateTime={row.createdAt}>{WHEN.format(new Date(row.createdAt))}</time>
                  </span>
                </div>
                <span
                  className={cn(
                    'shrink-0 font-display text-sm font-bold tabular-nums',
                    row.delta > 0 ? 'text-success' : row.delta < 0 ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {row.delta > 0 ? '+' : row.delta < 0 ? '−' : ''}
                  {fmt(Math.abs(row.delta))} KC
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
