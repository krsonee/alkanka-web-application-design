import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Tasks } from '@/components/alkanka/tasks'
import { getMember } from '@/lib/member'
import { completedTaskIds, listPublicTasks } from '@/lib/tasks'

export const metadata = pageMeta('gorevler')
export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const member = await getMember()
  const [tasks, done] = await Promise.all([
    listPublicTasks().catch(() => []),
    member ? completedTaskIds(member.id).catch(() => [] as number[]) : Promise.resolve([] as number[]),
  ])
  const finished = new Set(done)
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
      <Tasks tasks={tasks.map((task) => ({ id: task.id, title: task.title, detail: task.detail, points: task.points, done: finished.has(task.id) }))} />
    </>
  )
}
