import Link from 'next/link'
import { Medal } from 'lucide-react'
import { AUTO_LABELS, leaderboard, listSpecialBadges, predictionBoard, rankMoves, recentAwards, type AwardRow, type RankMove } from '@/lib/kanka-puan'
import { publicRankName } from '@/lib/kanka-puan-shared'
import { getMember } from '@/lib/member'
import { pinnedFor } from '@/lib/badge-value'
import { SpecialEmblem } from './kp/emblem'
import { SprintBanner } from './sprint-banner'
import { RankBoards, type BoardPeriod, type KpRow, type Prize, type TipRow } from './rank-boards'

const PERIODS: BoardPeriod[] = ['gun', 'hafta', 'ay']
const EMPTY = { gun: [], hafta: [], ay: [] }

async function load() {
  try {
    const [kp, tips, badges, awards, me] = await Promise.all([
      Promise.all(PERIODS.map((p) => leaderboard(200, p))),
      Promise.all(PERIODS.map((p) => predictionBoard(p, 100))),
      listSpecialBadges().catch(() => []),
      recentAwards({ limit: 60 }).catch(() => [] as AwardRow[]),
      getMember().catch(() => null),
    ])

    const ids = [...new Set(kp.flat().map((r) => r.userId))]
    const pins = await pinnedFor(ids).catch(() => ({}) as Awaited<ReturnType<typeof pinnedFor>>)
    const kpBy = Object.fromEntries(
      PERIODS.map((p, i) => [
        p,
        kp[i].map<KpRow>((r) => ({
          userId: r.userId,
          name: r.name,
          kp: r.kp,
          level: r.level,
          levelName: r.levelName,
          specials: r.specials,
          pins: pins[r.userId],
          parts: {
            time: r.breakdown.time,
            games: r.breakdown.games,
            tasks: r.breakdown.tasks,
            chat: r.breakdown.chat,
            league: r.breakdown.league,
            referrals: r.breakdown.referrals,
          },
        })),
      ]),
    ) as Record<BoardPeriod, KpRow[]>

    const autoBadges = badges.filter((b) => b.auto)
    const prizeFor = (suffix: string): Prize[] =>
      autoBadges
        .filter((b) => b.auto?.endsWith(suffix))
        .map((b) => ({ id: b.id, name: b.name, icon: b.icon, tier: b.tier, bonus: b.bonus, label: b.auto ? AUTO_LABELS[b.auto] : b.description }))

    const championIds = new Set(autoBadges.map((b) => b.id))
    const champions = awards.filter((a) => championIds.has(a.badgeId)).slice(0, 6)

    const [moveHafta, moveAy] = await Promise.all([
      rankMoves('hafta', kp[1]).catch((e) => (console.error('[siralama] sıra değişimi', e), {})),
      rankMoves('ay', kp[2]).catch((e) => (console.error('[siralama] sıra değişimi', e), {})),
    ])

    const order: BoardPeriod[] = ['hafta', 'ay', 'gun']
    const initial = kpBy.hafta.length >= 3 ? 'hafta' : order.reduce((best, p) => (kpBy[p].length > kpBy[best].length ? p : best), 'hafta' as BoardPeriod)

    return {
      kp: kpBy,
      tips: Object.fromEntries(PERIODS.map((p, i) => [p, tips[i]])) as Record<BoardPeriod, TipRow[]>,
      prizes: { gun: [], hafta: prizeFor('-hafta'), ay: prizeFor('-ay') } as Record<BoardPeriod, Prize[]>,
      champions,
      moves: { gun: {}, hafta: moveHafta, ay: moveAy } as Record<BoardPeriod, Record<string, RankMove>>,
      meId: me?.id ?? null,
      signedIn: Boolean(me),
      initial,
    }
  } catch (error) {
    console.error('[siralama] veriler yüklenemedi', error)
    return { kp: EMPTY, tips: EMPTY, prizes: EMPTY, champions: [] as AwardRow[], moves: { gun: {}, hafta: {}, ay: {} } as Record<BoardPeriod, Record<string, RankMove>>, meId: null, signedIn: false, initial: 'hafta' as BoardPeriod }
  }
}

const dateTR = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' })

function ChampionsWall({ champions }: { champions: AwardRow[] }) {
  return (
    <section aria-labelledby="sampiyonlar" className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2 px-1">
        <h2 id="sampiyonlar" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Medal className="size-5 text-primary" aria-hidden /> Şampiyonlar duvarı
        </h2>
        <span className="flex items-center gap-3">
          <Link href="/sampiyonlar" className="text-xs font-semibold text-primary hover:underline">
            Şampiyon kürsüsü
          </Link>
          <Link href="/rozetler" className="text-xs font-semibold text-primary hover:underline">
            Tüm rozetler
          </Link>
        </span>
      </header>
      {champions.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {champions.map((a) => (
            <li key={a.id} className="panel-gold flex items-center gap-3 rounded-xl px-3.5 py-3">
              <SpecialEmblem icon={a.icon} tier={a.tier} size="md" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[11px] font-bold uppercase tracking-wider text-primary">{a.badgeName}</span>
                <span className="truncate font-display text-base font-bold text-foreground">{publicRankName(a.userName)}</span>
                <span className="truncate text-[11px] text-muted-foreground">{dateTR(a.awardedAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">
          Duvar henüz boş. Bu haftanın şampiyonu ilk ismi yazdırır kanka!
        </p>
      )}
    </section>
  )
}

export async function Leaderboard() {
  const data = await load()
  return (
    <section aria-label="Sıralama" className="flex flex-col gap-8">
      <SprintBanner />
      <RankBoards kp={data.kp} tips={data.tips} prizes={data.prizes} moves={data.moves} meId={data.meId} signedIn={data.signedIn} initial={data.initial} />
      <ChampionsWall champions={data.champions} />
    </section>
  )
}
