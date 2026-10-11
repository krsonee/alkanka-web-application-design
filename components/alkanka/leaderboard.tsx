import Link from 'next/link'
import { Medal } from 'lucide-react'
import { leaderboard, predictionBoard, recentAwards } from '@/lib/kanka-puan'
import { getMember } from '@/lib/member'
import { JakoTip } from './jako'
import { SpecialEmblem } from './kp/emblem'
import { RankBoards, type BoardPeriod } from './rank-boards'

const PERIODS: BoardPeriod[] = ['gun', 'hafta', 'ay']

async function load() {
  try {
    const [kp, tips, awards, me] = await Promise.all([
      Promise.all(PERIODS.map((p) => leaderboard(15, p))),
      Promise.all(PERIODS.map((p) => predictionBoard(p, 15))),
      recentAwards({ limit: 8 }),
      getMember().catch(() => null),
    ])
    return {
      kp: Object.fromEntries(PERIODS.map((p, i) => [p, kp[i]])) as Record<BoardPeriod, (typeof kp)[number]>,
      tips: Object.fromEntries(PERIODS.map((p, i) => [p, tips[i]])) as Record<BoardPeriod, (typeof tips)[number]>,
      awards,
      meId: me?.id ?? null,
    }
  } catch (error) {
    console.error('[siralama] veriler yüklenemedi', error)
    const empty = { gun: [], hafta: [], ay: [] }
    return { kp: empty, tips: empty, awards: [], meId: null }
  }
}

const dateTR = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' })

export async function Leaderboard() {
  const { kp, tips, awards, meId } = await load()
  return (
    <section aria-label="Sıralama" className="flex flex-col gap-5">
      <JakoTip pose="kazandi" title="Zirveye oyna">
        Sitede vakit geçir, oyun oyna, görev yap, sohbette aktif ol, tahmin tut. Her dönemin birincisi değerli şampiyon rozetini kapar!
      </JakoTip>

      <RankBoards kp={kp} tips={tips} meId={meId} />

      <section aria-labelledby="champions" className="panel-gold overflow-hidden rounded-xl">
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h3 id="champions" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
            <Medal className="size-4 text-primary" aria-hidden /> Son şampiyonlar
          </h3>
          <Link href="/rozetler" className="text-xs font-semibold text-primary hover:underline">Tüm rozetler</Link>
        </header>
        {awards.length ? (
          <ul className="grid sm:grid-cols-2">
            {awards.map((a) => (
              <li key={a.id} className="flex items-center gap-3 border-b border-border px-4 py-3 sm:odd:border-r">
                <SpecialEmblem icon={a.icon} tier={a.tier} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">{a.userName.split(' ')[0]}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{a.badgeName}{a.note ? ` · ${a.note}` : ''}</span>
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{dateTR(a.awardedAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Henüz şampiyon rozeti verilmedi. İlk şampiyon sen ol!</p>
        )}
      </section>
    </section>
  )
}
