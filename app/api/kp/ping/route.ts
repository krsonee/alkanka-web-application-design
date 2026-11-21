import { getMember } from '@/lib/member'
import { pingActive } from '@/lib/kanka-puan'
import { notePlayMinute } from '@/lib/goal-play'
import { tickOnline } from '@/lib/online-rewards'
import { myMatches } from '@/lib/tournaments'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const member = await getMember()
  if (!member) return Response.json({ ok: false }, { status: 401 })
  try {
    const body = (await request.json().catch(() => null)) as { game?: unknown } | null
    const [online, matches] = await Promise.all([
      tickOnline(member.id).catch((error) => {
        console.error('[kp-ping] online', error)
        return null
      }),
      // Rides on the minute ping every member already sends, so a new round reaches open pages without a poll of its own.
      myMatches(member.id).catch(() => null),
      // Written only while a running event asks for time spent in a game.
      notePlayMinute(member.id, body?.game).catch((error) => console.error('[kp-ping] oyun süresi', (error as Error).message)),
    ])
    return Response.json({ ok: true, ...(await pingActive(member.id)), online, matches })
  } catch (error) {
    console.error('[kp-ping]', error)
    return Response.json({ ok: false }, { status: 500 })
  }
}
