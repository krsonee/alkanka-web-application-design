import 'server-only'
import { rows, sql } from '@/lib/db'
import { normalizeChat } from '@/lib/telegram-mirror'
import { ensurePostTables, getPost, parse, precheckPost, sendPost, type SendOutcome } from '@/lib/tg-posts'
import {
  DEFAULT_GRACE_MIN,
  DEFAULT_OPTIONS,
  GRACE_CHOICES,
  MAX_PLANS,
  TR_ZONE,
  hasButtons,
  mediaKindOf,
  nextRun,
  normalizeContent,
  plainText,
  type PlanKind,
  type PlanRepeat,
  type PlanRow,
  type PlanStatus,
  type PostButton,
  type PostContent,
  type PostMedia,
} from '@/lib/tg-posts-shared'

const MIN_LEAD_MS = 60 * 1000
const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000
const STUCK_AFTER_MIN = 10
const PER_TICK = 3
const REPEATS: PlanRepeat[] = ['none', 'daily', 'weekly']

const mapPlan = (r: Record<string, unknown>): PlanRow => ({
  id: Number(r.id),
  kind: (['template', 'scheduled'].includes(String(r.kind)) ? String(r.kind) : 'draft') as PlanKind,
  name: String(r.name ?? ''),
  author: String(r.author ?? ''),
  botId: r.bot_id == null ? null : Number(r.bot_id),
  chatIds: parse<string[]>(r.chat_ids, []).map(String),
  content: {
    text: String(r.text ?? ''),
    media: parse<PostMedia[]>(r.media, []).map(({ path, name, size }) => ({ kind: mediaKindOf(path), path, name, size })),
    buttons: parse<PostButton[][]>(r.buttons, []),
    options: { ...DEFAULT_OPTIONS, ...parse<Partial<PostContent['options']>>(r.options, {}) },
  },
  sendAt: r.send_at ? new Date(r.send_at as string | Date).toISOString() : null,
  repeat: (REPEATS.includes(String(r.repeat) as PlanRepeat) ? String(r.repeat) : 'none') as PlanRepeat,
  graceMin: Number(r.grace_min ?? DEFAULT_GRACE_MIN),
  status: (['sending', 'failed', 'missed'].includes(String(r.status)) ? String(r.status) : 'waiting') as PlanStatus,
  lastError: r.last_error ? String(r.last_error) : null,
  updatedAt: new Date((r.updated_at as string | Date) ?? Date.now()).toISOString(),
})

const clock = (at: Date | number) => new Date(at).toLocaleString('tr-TR', { timeZone: TR_ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const chatsOf = (input: unknown) => [...new Set((Array.isArray(input) ? input : []).map((c) => normalizeChat(String(c))).filter((c): c is string => Boolean(c)))].slice(0, 30)

export async function listPlans(): Promise<PlanRow[]> {
  await ensurePostTables()
  const found = await rows(sql`SELECT * FROM tg_post_plans ORDER BY (kind = 'scheduled') DESC, send_at ASC NULLS LAST, updated_at DESC LIMIT ${MAX_PLANS}`)
  return found.map(mapPlan)
}

async function getPlan(id: number) {
  const r = await rows(sql`SELECT * FROM tg_post_plans WHERE id = ${id}`)
  return r.length ? mapPlan(r[0]) : null
}

function timing(input: { sendAt?: string | null; repeat?: string; graceMin?: number }) {
  const at = input.sendAt ? new Date(input.sendAt) : null
  if (!at || Number.isNaN(at.getTime())) throw new Error('Gönderim tarihini ve saatini seç.')
  const ahead = at.getTime() - Date.now()
  if (ahead < MIN_LEAD_MS) throw new Error('Gönderim saati geçmişte kalıyor. En az bir dakika sonrasını seç.')
  if (ahead > MAX_AHEAD_MS) throw new Error('En fazla bir yıl sonrası için zamanlanabilir.')
  return {
    at,
    repeat: (REPEATS.includes(input.repeat as PlanRepeat) ? input.repeat : 'none') as PlanRepeat,
    graceMin: GRACE_CHOICES.some((g) => g.min === Number(input.graceMin)) ? Number(input.graceMin) : DEFAULT_GRACE_MIN,
  }
}

export async function savePlan(input: {
  id?: number | null
  kind: PlanKind
  name: string
  botId: number | null
  chatIds: unknown
  content: unknown
  author: string
  sendAt?: string | null
  repeat?: string
  graceMin?: number
}): Promise<SendOutcome & { id?: number }> {
  await ensurePostTables()
  const content = normalizeContent(input.content)
  const chats = chatsOf(input.chatIds)
  if (!content.text && !content.media.length && !hasButtons(content)) return { ok: false, message: 'Kaydedilecek bir şey yok. Yazı, medya ya da buton ekle.' }
  let name = String(input.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
  if (input.kind === 'template' && !name) return { ok: false, message: 'Şablona bir ad ver.' }
  name ||= plainText(content.text).replace(/\s+/g, ' ').trim().slice(0, 40) || (input.kind === 'scheduled' ? 'Zamanlı post' : 'Adsız taslak')

  let when: ReturnType<typeof timing> | null = null
  if (input.kind === 'scheduled') {
    if (!input.botId) return { ok: false, message: 'Gönderecek botu seç.' }
    when = timing(input)
    // Refused now rather than at 03:00 with nobody watching.
    const check = await precheckPost({ content, botId: input.botId, chatIds: chats })
    if (!check.ok) return check
  }

  const existing = input.id ? await getPlan(Number(input.id)) : null
  if (!existing) {
    const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tg_post_plans`)
    if (Number(n) >= MAX_PLANS) return { ok: false, message: `En fazla ${MAX_PLANS} taslak, şablon ve zamanlı post tutulur. Kullanmadıklarını sil.` }
  }
  const sendAt = when ? when.at.toISOString() : null
  const fields = {
    kind: input.kind,
    name,
    author: String(input.author ?? '').slice(0, 80),
    botId: input.botId,
    chats: JSON.stringify(chats),
    media: JSON.stringify(content.media),
    buttons: JSON.stringify(content.buttons),
    options: JSON.stringify(content.options),
  }
  let id = existing?.id ?? 0
  if (existing) {
    await rows(sql`UPDATE tg_post_plans SET kind = ${fields.kind}, name = ${fields.name}, author = ${fields.author}, bot_id = ${fields.botId}, chat_ids = ${fields.chats},
      text = ${content.text}, media = ${fields.media}, buttons = ${fields.buttons}, options = ${fields.options}, send_at = ${sendAt}::timestamptz,
      repeat = ${when?.repeat ?? 'none'}, grace_min = ${when?.graceMin ?? DEFAULT_GRACE_MIN}, status = 'waiting', last_error = NULL, updated_at = now() WHERE id = ${existing.id}`)
  } else {
    const [made] = await rows<{ id: number }>(sql`INSERT INTO tg_post_plans (kind, name, author, bot_id, chat_ids, text, media, buttons, options, send_at, repeat, grace_min)
      VALUES (${fields.kind}, ${fields.name}, ${fields.author}, ${fields.botId}, ${fields.chats}, ${content.text}, ${fields.media}, ${fields.buttons}, ${fields.options},
        ${sendAt}::timestamptz, ${when?.repeat ?? 'none'}, ${when?.graceMin ?? DEFAULT_GRACE_MIN}) RETURNING id`)
    id = Number(made.id)
  }
  if (when) return { ok: true, id, message: `Post ${clock(when.at)} için zamanlandı${when.repeat === 'none' ? '' : when.repeat === 'daily' ? ', her gün tekrarlanacak' : ', her hafta tekrarlanacak'}.` }
  return { ok: true, id, message: input.kind === 'template' ? `“${name}” şablonu kaydedildi.` : `“${name}” taslağı kaydedildi.` }
}

export async function deletePlan(id: number): Promise<SendOutcome> {
  await ensurePostTables()
  const gone = await rows(sql`DELETE FROM tg_post_plans WHERE id = ${id} AND status <> 'sending' RETURNING id`)
  return gone.length ? { ok: true, message: 'Silindi.' } : { ok: false, message: 'Kayıt bulunamadı ya da şu an gönderiliyor.' }
}

export async function reschedulePlan(id: number, input: { sendAt: string; repeat: string; graceMin: number }): Promise<SendOutcome> {
  await ensurePostTables()
  const when = timing(input)
  const done = await rows(sql`UPDATE tg_post_plans SET send_at = ${when.at.toISOString()}::timestamptz, repeat = ${when.repeat}, grace_min = ${when.graceMin}, status = 'waiting', last_error = NULL, updated_at = now()
    WHERE id = ${id} AND kind = 'scheduled' AND status <> 'sending' RETURNING id`)
  return done.length ? { ok: true, message: `Yeni gönderim zamanı: ${clock(when.at)}.` } : { ok: false, message: 'Kayıt bulunamadı ya da şu an gönderiliyor.' }
}

/** Takes a scheduled post off the clock without losing it. */
export async function planToDraft(id: number): Promise<SendOutcome> {
  await ensurePostTables()
  const done = await rows(sql`UPDATE tg_post_plans SET kind = 'draft', send_at = NULL, repeat = 'none', status = 'waiting', last_error = NULL, updated_at = now()
    WHERE id = ${id} AND kind = 'scheduled' AND status <> 'sending' RETURNING id`)
  return done.length ? { ok: true, message: 'Zamanlama kaldırıldı; post taslaklara taşındı. “Yeni post” sekmesinden açabilirsin.' } : { ok: false, message: 'Kayıt bulunamadı ya da şu an gönderiliyor.' }
}

/** Copies a sent panel post into the drafts so it can be reused as a new post. */
export async function draftFromPost(postId: number, author: string): Promise<SendOutcome> {
  const post = await getPost(postId)
  if (!post) return { ok: false, message: 'Post bulunamadı.' }
  if (post.origin !== 'panel') return { ok: false, message: 'Sadece panelden gönderilen postlar taslağa kopyalanır; diğerlerinin medyası yalnızca Telegram’da duruyor.' }
  const chats = await rows<{ chat_id: string }>(sql`SELECT DISTINCT chat_id FROM tg_post_sends WHERE post_id = ${postId}`)
  return savePlan({ kind: 'draft', name: '', botId: post.botId, chatIds: chats.map((c) => c.chat_id), content: post.content, author })
}

// --- Sending what is due ---------------------------------------------------------

async function runPlan(plan: PlanRow, late: 'ignore' | 'respect') {
  const due = plan.sendAt ? new Date(plan.sendAt).getTime() : Date.now()
  const now = Date.now()
  // Sent by hand ahead of its time, a repeating post still keeps the run it was waiting for.
  const next = plan.repeat === 'none' ? null : due > now ? due : nextRun(due, plan.repeat, now)
  const settle = (error: string | null, failedAs: PlanStatus) =>
    next
      ? rows(sql`UPDATE tg_post_plans SET send_at = ${new Date(next).toISOString()}::timestamptz, status = 'waiting', last_error = ${error} WHERE id = ${plan.id}`)
      : error
        ? rows(sql`UPDATE tg_post_plans SET status = ${failedAs}, last_error = ${error} WHERE id = ${plan.id}`)
        : rows(sql`DELETE FROM tg_post_plans WHERE id = ${plan.id}`)

  const lateMin = Math.floor((now - due) / 60_000)
  if (late === 'respect' && plan.graceMin > 0 && lateMin > plan.graceMin) {
    await settle(`${clock(due)} gönderimi atlandı: o saatte sitede ve Telegram’da hareket yoktu, post ${lateMin} dakika gecikince gönderilmedi.`.slice(0, 400), 'missed')
    return { ok: false, message: 'Gecikme sınırı aşıldı, gönderilmedi.' }
  }
  let outcome: SendOutcome
  try {
    if (!plan.botId) throw new Error('Gönderecek bot kayıtlı değil')
    outcome = await sendPost({ content: plan.content, botId: plan.botId, chatIds: plan.chatIds, author: `${plan.author || 'Panel'} · zamanlı` })
  } catch (error) {
    outcome = { ok: false, message: String((error as Error)?.message ?? error) }
  }
  const detail = [outcome.message, ...(outcome.checks ?? []).filter((c) => !c.ok).map((c) => `${c.title}: ${c.problem}`)].join(' ')
  await settle(outcome.ok ? null : `${clock(due)} gönderimi yapılamadı: ${detail}`.slice(0, 400), 'failed')
  return outcome
}

/** Called from the traffic-driven tick. A post is claimed before it is sent, so two ticks never send it twice. */
export async function runDuePlans() {
  await ensurePostTables()
  // A send cut off mid-way is not repeated on its own: half of it may already be in Telegram.
  await rows(sql`UPDATE tg_post_plans SET status = 'failed',
    last_error = 'Gönderim yarıda kesildi. “Gönderilenler” listesine bak; post gitmediyse “Şimdi gönder”e bas.'
    WHERE status = 'sending' AND last_run_at < now() - make_interval(mins => ${STUCK_AFTER_MIN})`)
  const claimed = await rows(sql`UPDATE tg_post_plans SET status = 'sending', last_run_at = now()
    WHERE id IN (SELECT id FROM tg_post_plans WHERE kind = 'scheduled' AND status = 'waiting' AND send_at <= now() ORDER BY send_at LIMIT ${PER_TICK} FOR UPDATE SKIP LOCKED)
    RETURNING *`)
  for (const row of claimed) await runPlan(mapPlan(row), 'respect').catch((error) => console.error('[tg-plans] run failed', error))
}

export async function sendPlanNow(id: number): Promise<SendOutcome> {
  await ensurePostTables()
  const claimed = await rows(sql`UPDATE tg_post_plans SET status = 'sending', last_run_at = now() WHERE id = ${id} AND kind = 'scheduled' AND status <> 'sending' RETURNING *`)
  if (!claimed.length) return { ok: false, message: 'Kayıt bulunamadı ya da şu an gönderiliyor.' }
  const plan = mapPlan(claimed[0])
  const outcome = await runPlan(plan, 'ignore')
  if (outcome.ok && plan.repeat !== 'none') return { ...outcome, message: `${outcome.message} Tekrarlayan post sıradaki turuna geçti.` }
  return outcome
}
