'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { sendToAll } from '@/lib/push'
import type { ActionState } from './actions'

export async function sendPushAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('push'))) return { message: 'Oturum süresi doldu, tekrar giriş yap.' }
  const title = String(form.get('title') ?? '').trim().slice(0, 60)
  const body = String(form.get('body') ?? '').trim().slice(0, 180)
  const rawUrl = String(form.get('url') ?? '/').trim() || '/'
  if (!title || !body) return { message: 'Başlık ve mesaj zorunlu.' }
  if (!rawUrl.startsWith('/') || rawUrl.startsWith('//')) return { message: 'Link / ile başlamalı (ör. /oyunlar/cark).' }
  try {
    const r = await sendToAll({ title, body, url: rawUrl.slice(0, 200) })
    revalidatePath('/panel')
    return { ok: true, message: `${r.sent} cihaza gönderildi${r.failed ? `, ${r.failed} başarısız` : ''}${r.removed ? ` (${r.removed} eski abonelik silindi)` : ''}.` }
  } catch (error) {
    console.error('[push] gönderilemedi', error)
    return { message: 'Bildirim gönderilemedi.' }
  }
}
