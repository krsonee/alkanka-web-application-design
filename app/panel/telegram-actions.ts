'use server'

import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin-auth'
import { addSource, deleteSource, normalizeChannel, runMirror, sendTestMessage, setSourceActive } from '@/lib/telegram-mirror'
import type { ActionState } from './actions'

const EXPIRED = { message: 'Oturum süresi doldu, tekrar giriş yap.' }

export async function addSourceAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return EXPIRED
  const channel = normalizeChannel(String(form.get('channel') ?? ''))
  const brand = String(form.get('brand') ?? '').trim().slice(0, 40)
  const link = String(form.get('link') ?? '').trim().slice(0, 500)
  const keywords = String(form.get('keywords') ?? '').trim().slice(0, 300)
  if (!channel) return { message: 'Kanal adı geçersiz. Örnek: @markaresmi ya da t.me/markaresmi' }
  if (!brand) return { message: 'Marka adı zorunlu.' }
  try {
    const url = new URL(link)
    if (url.protocol !== 'https:') throw new Error()
  } catch {
    return { message: 'Link https:// ile başlayan geçerli bir adres olmalı.' }
  }
  await addSource({ channel, brand, link, keywords })
  revalidatePath('/panel')
  return { ok: true, message: `@${channel} eklendi. İlk kontrolde mevcut postlar atlanır, sadece yeni postlar paylaşılır.` }
}

export async function toggleSourceAction(form: FormData) {
  if (!(await isAdmin())) return
  await setSourceActive(Number(form.get('id')), form.get('active') === 'true')
  revalidatePath('/panel')
}

export async function deleteSourceAction(form: FormData) {
  if (!(await isAdmin())) return
  await deleteSource(Number(form.get('id')))
  revalidatePath('/panel')
}

export async function runMirrorAction(): Promise<ActionState> {
  if (!(await isAdmin())) return EXPIRED
  try {
    const r = await runMirror()
    revalidatePath('/panel')
    const parts = [`${r.checked} kanal kontrol edildi`, `${r.sent} post paylaşıldı`]
    if (r.skipped) parts.push(`${r.skipped} atlandı`)
    if (r.failed) parts.push(`${r.failed} başarısız`)
    if (r.primed) parts.push(`${r.primed} yeni kanal başlangıç noktası kaydedildi`)
    return { ok: r.errors.length === 0, message: parts.join(', ') + '.' + (r.errors.length ? ` Hatalar: ${r.errors.join(' | ')}` : '') }
  } catch (error) {
    return { message: String((error as Error).message) }
  }
}

export async function testBotAction(): Promise<ActionState> {
  if (!(await isAdmin())) return EXPIRED
  try {
    await sendTestMessage()
    return { ok: true, message: 'Test mesajı kanala gönderildi.' }
  } catch (error) {
    return { message: `Gönderilemedi: ${String((error as Error).message)}` }
  }
}
