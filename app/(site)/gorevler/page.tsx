import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Tasks } from '@/components/alkanka/tasks'
import { getMember } from '@/lib/member'
import { getStreak, type StreakState } from '@/lib/checkin'
import { completedTaskIds, listPublicTasks, taskClaimMap, taskProgressMap, type ClaimStatus } from '@/lib/tasks'

export const metadata = pageMeta('gorevler')
export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const member = await getMember()
  const noStreak: StreakState = { streak: 0, checkedToday: false }
  const [tasks, done, claims, streak] = await Promise.all([
    listPublicTasks().catch(() => []),
    member ? completedTaskIds(member.id).catch(() => [] as number[]) : Promise.resolve([] as number[]),
    member ? taskClaimMap(member.id).catch(() => ({} as Record<number, ClaimStatus>)) : Promise.resolve({} as Record<number, ClaimStatus>),
    member ? getStreak(member.id).catch(() => noStreak) : Promise.resolve(noStreak),
  ])
  const finished = new Set(done)
  const progress = member ? await taskProgressMap(member.id, tasks).catch(() => ({} as Record<number, number>)) : {}
  return (
    <>
      <EditableHero slug="gorevler"
        image="/images/heroes/gorevler.png"
        highlights={['Günlük giriş serisi', '7. gün VIP sandık', 'Ekstra Kanka Coin']}
        eyebrow="Görevler"
        title="Günlük görevler"
        description="Her gün giriş yap, seriyi koru. 7. günde VIP ödül sandığı açılır. Görevler ekstra Kanka Coin kazandırır."
        pose="dusunen"
        speech="Seriyi bozma kanka, 7. gün VIP sandık seni bekliyor."
      />
      <Tasks
        streak={streak}
        tasks={tasks.map((task) => ({ id: task.id, title: task.title, detail: task.detail, points: task.points, link: task.link, needsApproval: task.needsApproval, period: task.period, kind: task.kind, target: task.target, param: task.param, progress: progress[task.id] ?? 0, claim: claims[task.id] ?? null, done: finished.has(task.id) }))}
      />
    </>
  )
}
