import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Tasks } from '@/components/alkanka/tasks'
import { listTasks } from '@/lib/engage'
import { getCurrentMember } from '@/lib/member-auth'

export const metadata = pageMeta('gorevler')
export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const member = await getCurrentMember().catch(() => null)
  const tasks = await listTasks(member?.id ?? null).catch(() => [])
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
      <Tasks tasks={tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        reward: task.reward,
        claimed: task.claimed,
        needsCode: task.needsCode,
      }))} />
    </>
  )
}
