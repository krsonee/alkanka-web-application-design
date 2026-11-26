import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Tasks } from '@/components/alkanka/tasks'
import { OnlineRewards } from '@/components/alkanka/kp/online-rewards'
import { MemberPerks } from '@/components/alkanka/kp/member-perks'
import { getBirthday, getBoostConfig, shieldCount } from '@/lib/boosts'
import { getMember } from '@/lib/member'
import { getStreak, type StreakState } from '@/lib/checkin'
import { bundleDetail, bundleTarget, completedTaskIds, inviteLeague, listPublicTasks, taskClaimMap, taskPartStates, taskProgressMap, visibleTasksFor, type ClaimStatus, type PartState, type ProgressMemo, type TaskDeal } from '@/lib/tasks'
import { dealRights } from '@/lib/market'

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
  const view = visibleTasksFor(member?.id ?? null, tasks, finished)
  const withParts = view.tasks.filter((task) => task.parts.length && !finished.has(task.id))
  const memo: ProgressMemo = new Map()
  // A finished task with a market price: the price counts only what was done after it was linked, so ask the market.
  const priced = Boolean(member) && view.tasks.some((task) => task.deals?.length && finished.has(task.id))
  const [progress, partStates, league, perks, rights] = await Promise.all([
    member ? taskProgressMap(member.id, view.tasks, memo).catch(() => ({} as Record<number, number>)) : Promise.resolve({} as Record<number, number>),
    Promise.all(withParts.map((task) => taskPartStates(member?.id ?? null, task, memo).catch(() => [] as PartState[]))),
    inviteLeague(10),
    member
      ? Promise.all([getBoostConfig(), shieldCount(member.id), getBirthday(member.id)])
          .then(([cfg, shields, birthday]) => ({ shields, shieldPrice: cfg.shieldPrice, birthday, birthdayCoin: cfg.birthday.coin }))
          .catch(() => null)
      : Promise.resolve(null),
    member && priced ? dealRights(member.id).catch(() => null) : Promise.resolve(null),
  ])
  const dealOf = (deal: TaskDeal): TaskDeal => {
    if (!rights) return deal
    const wait = rights.waiting[deal.itemId]
    if (wait) return { ...deal, state: 'wait', wait }
    const left = rights.left[deal.itemId]
    return left === undefined ? deal : { ...deal, state: left > 0 ? 'open' : 'spent' }
  }
  const partsOf = new Map(withParts.map((task, index) => [task.id, partStates[index]]))
  const shown = view.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    detail: task.kind === 'bundle' ? bundleDetail(task.detail, bundleTarget(task, view.tasks)) : task.detail,
    points: task.points,
    link: task.link,
    needsApproval: task.needsApproval,
    period: task.period,
    kind: task.kind,
    target: task.kind === 'bundle' ? bundleTarget(task, view.tasks) : task.target,
    param: task.kind === 'secret_code' ? null : task.param,
    progress: progress[task.id] ?? 0,
    claim: claims[task.id] ?? null,
    done: finished.has(task.id),
    category: task.category,
    chain: task.chain,
    chainStep: task.chainStep,
    chainState: view.chainState[task.id] ?? null,
    badge: task.badge,
    cap: task.cap,
    deals: finished.has(task.id) ? task.deals?.map(dealOf) : task.deals,
    parts: partsOf.get(task.id),
  }))
  return (
    <>
      <EditableHero slug="gorevler"
        compact
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
        tasks={shown}
        inviteLeague={league}
        meId={member?.id ?? null}
      />
      <OnlineRewards />
      {member && perks && <MemberPerks {...perks} />}
    </>
  )
}
