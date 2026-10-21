import 'server-only'
import { rows, sql } from '@/lib/db'
import { SITE_URL } from '@/lib/seo'
import { listPublicSponsors } from '@/lib/sites'
import { callBot } from '@/lib/telegram-mirror'
import type { TgMessage } from '@/lib/telegram-chat'
import type { HubConfig } from '@/lib/tg-hub-shared'

type Kind = 'site' | 'sponsor'
type Button = { text: string; url: string }

let ready: Promise<unknown> | null = null
function ensureTable() {
  ready ??= rows(sql`CREATE TABLE IF NOT EXISTS tg_autoreply_last (
    chat_id text NOT NULL, kind text NOT NULL, sent_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (chat_id, kind))`).catch((error) => {
    ready = null
    throw error
  })
  return ready
}

function fold(text: string) {
  return text.toLocaleLowerCase('tr').replace(/[ıİ]/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u')
}

/** Sponsor wins over site because "sponsor siteleri" is a request for the list, not our address. */
export function detectKind(text: string): Kind | null {
  const t = fold(text)
  if (/sponsor/.test(t)) return 'sponsor'
  if (/site/.test(t)) return 'site'
  return null
}

/** Atomic per-chat cooldown so a busy chat cannot make the bot repeat itself. */
async function claimSlot(chatId: string, kind: Kind, cooldown: number) {
  const r = await rows(sql`INSERT INTO tg_autoreply_last (chat_id, kind, sent_at) VALUES (${chatId}, ${kind}, now())
    ON CONFLICT (chat_id, kind) DO UPDATE SET sent_at = now()
    WHERE tg_autoreply_last.sent_at < now() - make_interval(secs => ${cooldown})
    RETURNING chat_id`)
  return r.length > 0
}

function pairs(buttons: Button[]) {
  const out: Button[][] = []
  for (let i = 0; i < buttons.length; i += 2) out.push(buttons.slice(i, i + 2))
  return out
}

async function sponsorButtons(limit: number): Promise<Button[]> {
  const list = await listPublicSponsors().catch(() => [])
  return list.slice(0, limit).map((s) => ({ text: s.name, url: `${SITE_URL}/git/${encodeURIComponent(s.id)}` }))
}

export async function autoReply(hub: HubConfig, token: string, m: TgMessage, text: string) {
  const cfg = hub.autoReply
  if (!cfg?.enabled || !text || text.startsWith('/')) return
  const kind = detectKind(text)
  if (!kind) return
  await ensureTable()
  if (!(await claimSlot(String(m.chat.id), kind, cfg.cooldownSeconds))) return

  const siteUrl = cfg.siteUrl || SITE_URL
  let body: string
  let keyboard: Button[][]
  if (kind === 'site') {
    body = cfg.siteText
    keyboard = [[{ text: 'Alkanka’ya git', url: siteUrl }]]
  } else {
    const buttons = await sponsorButtons(cfg.sponsorLimit)
    body = cfg.sponsorText
    keyboard = [...pairs(buttons), [{ text: 'Tüm sponsorlar', url: `${siteUrl.replace(/\/$/, '')}/sponsorlar` }]]
  }

  const sent = await callBot<{ message_id: number }>(token, 'sendMessage', {
    chat_id: m.chat.id,
    text: body,
    reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true },
    reply_markup: { inline_keyboard: keyboard },
    link_preview_options: { is_disabled: true },
  }).catch(() => null)
  if (!sent) return
  // Keep the chat clean: the answer disappears after 10 minutes via the background tick.
  await rows(sql`INSERT INTO tg_autodel (chat_id, message_id, due_at)
    VALUES (${String(m.chat.id)}, ${sent.message_id}, now() + interval '10 minutes')`).catch(() => null)
}
