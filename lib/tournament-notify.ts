import 'server-only'
import { matchHref, type FinishReason } from './tournaments-shared'

/**
 * Messages go out after the response: a round of a large knockout opens hundreds of tables at once,
 * and the player whose move ended the round must not wait for all of them. Never throws.
 */
async function later(run: () => Promise<unknown>) {
  const safe = () => run().catch((error) => console.error('[tournaments] bildirim gönderilemedi', (error as Error).message))
  try {
    const { after } = await import('next/server')
    after(safe)
  } catch {
    await safe()
  }
}

const isMember = (id: string) => !id.startsWith('misafir:')

/** Tells both players of every newly opened match, in the site inbox and on their devices, with a link straight to the table. */
export async function notifyMatchReady(input: {
  game: string
  title: string
  round: string
  joinMinutes: number
  matches: { tableId: string; players: { id: string; name: string }[] }[]
}) {
  const notes = input.matches.flatMap((match) =>
    match.players
      .filter((p) => isMember(p.id))
      .map((p) => {
        const rival = match.players.find((x) => x.id !== p.id)?.name ?? 'belli oldu'
        return {
          userId: p.id,
          name: p.name,
          title: 'Turnuva maçın hazır',
          body: `${input.title} · ${input.round}. Rakibin: ${rival}. ${input.joinMinutes} dakika içinde masaya girmezsen maçı hükmen kaybedersin.`,
          url: matchHref({ game: input.game, tableId: match.tableId }),
        }
      }),
  )
  if (!notes.length) return
  await later(async () => {
    const [{ sendMessages }, { sendEach }] = await Promise.all([import('@/lib/inbox'), import('@/lib/push')])
    await sendMessages(notes.map((n) => ({ userId: n.userId, targetLabel: n.name, title: n.title, body: n.body, url: n.url, sentBy: 'Sistem' })))
    await sendEach(notes.map((n) => ({ userId: n.userId, payload: { title: n.title, body: n.body, url: n.url } })))
  })
}

const CANCEL_TEXT: Partial<Record<FinishReason, string>> = {
  'kayit-yok': 'Başlangıç saatinde en az 2 kayıt olmadığı için turnuva iptal edildi.',
  oynanmadi: 'Hiçbir maç oynanmadığı için turnuva iptal edildi.',
  gec: 'Turnuva saatinde başlatılamadığı için iptal edildi.',
  oyun: 'Bu oyunda turnuva düzenlenemediği için turnuva iptal edildi.',
  panel: 'Turnuva yönetim tarafından iptal edildi.',
}

/** Tells every entrant that the tournament is off and what came back to their balance. */
export async function notifyCancelled(input: { title: string; reason: FinishReason; entrants: { userId: string; name: string; fee: number }[] }) {
  const why = CANCEL_TEXT[input.reason] ?? 'Turnuva iptal edildi.'
  const notes = input.entrants.filter((e) => isMember(e.userId))
  if (!notes.length) return
  await later(async () => {
    const { sendMessages } = await import('@/lib/inbox')
    await sendMessages(
      notes.map((e) => ({
        userId: e.userId,
        targetLabel: e.name,
        title: `Turnuva iptal edildi: ${input.title}`.slice(0, 120),
        body: e.fee > 0 ? `${why} ${e.fee.toLocaleString('tr-TR')} KC kayıt ücretin hesabına iade edildi.` : why,
        url: '/turnuvalar',
        sentBy: 'Sistem',
      })),
    )
  })
}
