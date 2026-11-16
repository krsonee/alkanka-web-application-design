'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel, getPanelSession } from '@/lib/panel-auth'
import { findMember } from '@/lib/member-limits'
import { deleteMessage, memberLabel, sendMessage } from '@/lib/inbox'
import { deleteTemplate, saveTemplate } from '@/lib/outbox'
import { MAX_TEMPLATES, cleanMessage, type SendResult } from '@/lib/outbox-shared'

type Result = SendResult

const NO_ACCESS: Result = { ok: false, error: 'Bu bölüm için yetkin yok.' }

export async function searchMembersForMessage(query: string) {
  if (!(await canPanel('messages'))) return []
  return findMember(String(query ?? '').slice(0, 100))
}

export async function sendInboxMessage(input: { userId: string | null; title: string; body: string; url: string; imageUrl?: string }): Promise<Result> {
  if (!(await canPanel('messages'))) return NO_ACCESS
  const clean = cleanMessage(input)
  if (!clean.ok) return clean

  let targetLabel = 'Tüm üyeler'
  const userId = input.userId ? String(input.userId) : null
  if (userId) {
    const label = await memberLabel(userId)
    if (!label) return { ok: false, error: 'Üye bulunamadı.' }
    targetLabel = label
  }

  try {
    const session = await getPanelSession()
    await sendMessage({ userId, targetLabel, ...clean.value, sentBy: session?.username ?? '' })
    revalidatePath('/panel')
    await logPanel('messages', userId ? 'Üyeye mesaj gönderildi' : 'Tüm üyelere mesaj gönderildi', userId ? targetLabel : null, clean.value.title)
    return { ok: true, message: userId ? `${targetLabel} adlı üyeye gönderildi.` : 'Tüm üyelere gönderildi.' }
  } catch (error) {
    console.error('[inbox] gönderilemedi', error)
    return { ok: false, error: 'Mesaj gönderilemedi.' }
  }
}

export async function deleteInboxMessage(id: number): Promise<Result> {
  if (!(await canPanel('messages'))) return NO_ACCESS
  await deleteMessage(Number(id))
  revalidatePath('/panel')
  await logPanel('messages', 'Mesaj silindi', `Mesaj #${id}`)
  return { ok: true, message: 'Mesaj silindi.' }
}

export async function saveMessageTemplate(input: { title: string; body: string; url: string }): Promise<Result> {
  if (!(await canPanel('messages'))) return NO_ACCESS
  const clean = cleanMessage(input)
  if (!clean.ok) return clean
  if (!clean.value.body) return { ok: false, error: 'Şablon için mesaj metni gerekli.' }
  const session = await getPanelSession()
  const outcome = await saveTemplate({ title: clean.value.title, body: clean.value.body, url: clean.value.url ?? '', by: session?.username ?? '' })
  if (outcome === 'full') return { ok: false, error: `En fazla ${MAX_TEMPLATES} şablon saklanır. Önce kullanmadığın birini sil.` }
  revalidatePath('/panel')
  await logPanel('messages', outcome === 'updated' ? 'Mesaj şablonu güncellendi' : 'Mesaj şablonu kaydedildi', clean.value.title)
  return { ok: true, message: outcome === 'updated' ? 'Aynı başlıklı şablon güncellendi.' : 'Şablon kaydedildi.' }
}

export async function deleteMessageTemplate(id: number): Promise<Result> {
  if (!(await canPanel('messages'))) return NO_ACCESS
  const title = await deleteTemplate(Number(id))
  if (!title) return { ok: false, error: 'Şablon bulunamadı.' }
  revalidatePath('/panel')
  await logPanel('messages', 'Mesaj şablonu silindi', title)
  return { ok: true, message: 'Şablon silindi.' }
}
