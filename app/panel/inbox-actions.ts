'use server'

import { revalidatePath } from 'next/cache'
import { canPanel, getPanelSession } from '@/lib/panel-auth'
import { findMember } from '@/lib/member-limits'
import { deleteMessage, sendMessage } from '@/lib/inbox'
import { rows, sql } from '@/lib/db'

type Result = { ok: true; message: string } | { ok: false; error: string }

export async function searchMembersForMessage(query: string) {
  if (!(await canPanel('messages'))) return []
  return findMember(String(query ?? '').slice(0, 100))
}

export async function sendInboxMessage(input: { userId: string | null; title: string; body: string; url: string }): Promise<Result> {
  if (!(await canPanel('messages'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  const title = String(input.title ?? '').trim().slice(0, 80)
  const body = String(input.body ?? '').trim().slice(0, 1000)
  const rawUrl = String(input.url ?? '').trim()
  if (!title || !body) return { ok: false, error: 'Başlık ve mesaj zorunlu.' }
  if (rawUrl && (!rawUrl.startsWith('/') || rawUrl.startsWith('//'))) return { ok: false, error: 'Link / ile başlamalı (ör. /oyunlar/cark).' }

  let targetLabel = 'Tüm üyeler'
  const userId = input.userId ? String(input.userId) : null
  if (userId) {
    const u = await rows<{ name: string | null; email: string }>(sql`SELECT name, email FROM "user" WHERE id = ${userId}`)
    if (!u[0]) return { ok: false, error: 'Üye bulunamadı.' }
    targetLabel = u[0].name || u[0].email
  }

  try {
    const session = await getPanelSession()
    await sendMessage({ userId, targetLabel, title, body, url: rawUrl ? rawUrl.slice(0, 200) : null, sentBy: session?.username ?? '' })
    revalidatePath('/panel')
    return { ok: true, message: userId ? `${targetLabel} adlı üyeye gönderildi.` : 'Tüm üyelere gönderildi.' }
  } catch (error) {
    console.error('[inbox] gönderilemedi', error)
    return { ok: false, error: 'Mesaj gönderilemedi.' }
  }
}

export async function deleteInboxMessage(id: number): Promise<Result> {
  if (!(await canPanel('messages'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  await deleteMessage(Number(id))
  revalidatePath('/panel')
  return { ok: true, message: 'Mesaj silindi.' }
}
