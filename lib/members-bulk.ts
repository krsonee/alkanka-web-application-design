import 'server-only'
import { rows, sql } from '@/lib/db'
import { getPanelSession } from '@/lib/panel-auth'
import { sendMessage } from '@/lib/inbox'
import { ensureMemberAdmin, giftMember, logAudit, suspendMember } from '@/lib/members-admin'
import { bulkProblem, SUSPEND_DURATIONS, type BulkInput, type BulkResult, type BulkSkipped } from '@/lib/members-bulk-shared'

type Target = { id: string; name: string | null; email: string; kind: string | null }

const PARALLEL = 5

/**
 * Runs one action for every selected member. A member that fails or does not qualify is skipped and
 * reported; the rest still go through.
 */
export async function bulkMembers(ids: string[], input: BulkInput): Promise<BulkResult> {
  await ensureMemberAdmin()
  const session = await getPanelSession()
  if (!session) throw new Error('Oturum süren doldu, tekrar giriş yap.')

  const unique = [...new Set(ids.map((id) => String(id)).filter(Boolean))]
  const problem = bulkProblem(input, unique.length)
  if (problem) throw new Error(problem)

  const found = await rows<Target>(sql`
    SELECT u.id, u.name, u.email, b.kind FROM public."user" u
    LEFT JOIN member_bans b ON b.user_id = u.id AND (b.until IS NULL OR b.until > now())
    WHERE u.id IN (${sql.join(unique.map((id) => sql`${id}`), sql`, `)})`)
  const byId = new Map(found.map((m) => [m.id, m]))

  const skipped: BulkSkipped[] = []
  let done = 0

  const one = async (id: string) => {
    const m = byId.get(id)
    if (!m) return void skipped.push({ name: id, why: 'Üye bulunamadı (silinmiş olabilir).' })
    const name = m.name || m.email
    try {
      if (input.kind === 'message') {
        await sendMessage({ userId: m.id, targetLabel: name, title: input.title.trim(), body: input.body.trim(), url: input.url.trim() || null, sentBy: session.username })
      } else if (input.kind === 'gift') {
        await giftMember(m.id, input.amount, input.message)
      } else {
        if (m.kind === 'ban') return void skipped.push({ name, why: 'Kalıcı banlı, dokunulmadı.' })
        if (m.kind === 'suspend') return void skipped.push({ name, why: 'Zaten dondurulmuş, süresi değiştirilmedi.' })
        await suspendMember(m.id, input.duration, input.reason)
      }
      done += 1
    } catch (error) {
      skipped.push({ name, why: error instanceof Error ? error.message : 'İşlem yapılamadı.' })
    }
  }

  for (let i = 0; i < unique.length; i += PARALLEL) {
    await Promise.all(unique.slice(i, i + PARALLEL).map(one))
  }

  const left = skipped.length ? ` · ${skipped.length} üye atlandı` : ''
  if (input.kind === 'message') await logAudit('Toplu mesaj gönderildi', null, `${done} üye · ${input.title.trim()}${left}`)
  else if (input.kind === 'gift') await logAudit('Toplu hediye gönderildi', null, `${done} üye · üye başına +${input.amount} KC · toplam ${done * input.amount} KC${left}`)
  else {
    const duration = SUSPEND_DURATIONS.find((d) => d.id === input.duration)?.label ?? input.duration
    await logAudit('Toplu dondurma yapıldı', null, `${done} üye · ${duration} · ${input.reason.trim()}${left}`)
  }

  return { done, skipped }
}
