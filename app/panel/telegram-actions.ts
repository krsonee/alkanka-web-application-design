'use server'

import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin-auth'
import {
  addBot,
  addSource,
  addTarget,
  deleteBot,
  deleteSource,
  deleteTarget,
  getCronKey,
  normalizeChannel,
  runMirror,
  setSourceActive,
  setTargetActive,
  testTarget,
} from '@/lib/telegram-mirror'
import { encodeFilter } from '@/lib/telegram-filters'
import type { ActionState } from './actions'

const EXPIRED = { message: 'Oturum süresi doldu, tekrar giriş yap.' }
const errorText = (error: unknown) => String((error as Error).message ?? error)

export async function addBotAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return EXPIRED
  try {
    const me = await addBot(String(form.get('token') ?? '').trim())
    revalidatePath('/panel')
    return { ok: true, message: `@${me.username} bağlandı. Şimdi bu bot için hedef kanal ekle.` }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function deleteBotAction(form: FormData) {
  if (!(await isAdmin())) return
  await deleteBot(Number(form.get('id')))
  revalidatePath('/panel')
}

export async function addTargetAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return EXPIRED
  const botId = Number(form.get('botId'))
  if (!botId) return { message: 'Önce bir bot seç.' }
  try {
    const title = await addTarget(botId, String(form.get('chat') ?? ''))
    revalidatePath('/panel')
    return { ok: true, message: `"${title}" hedef kanal olarak bağlandı.` }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function toggleTargetAction(form: FormData) {
  if (!(await isAdmin())) return
  await setTargetActive(Number(form.get('id')), form.get('active') === 'true')
  revalidatePath('/panel')
}

export async function deleteTargetAction(form: FormData) {
  if (!(await isAdmin())) return
  await deleteTarget(Number(form.get('id')))
  revalidatePath('/panel')
}

export async function testTargetAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return EXPIRED
  try {
    const title = await testTarget(Number(form.get('id')))
    return { ok: true, message: `Test mesajı "${title}" kanalına gönderildi.` }
  } catch (error) {
    return { message: `Gönderilemedi: ${errorText(error)}` }
  }
}

export async function addSourceAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return EXPIRED
  const channel = normalizeChannel(String(form.get('channel') ?? ''))
  const brand = String(form.get('brand') ?? '').trim().slice(0, 40)
  const link = String(form.get('link') ?? '').trim().slice(0, 500)
  const presets = form.getAll('presets').map(String)
  const keywords = encodeFilter(presets, String(form.get('keywords') ?? '')).slice(0, 300)
  const targetId = Number(form.get('targetId')) || null
  if (!channel) return { message: 'Kanal adı geçersiz. Örnek: @markaresmi ya da t.me/markaresmi' }
  if (!brand) return { message: 'Marka adı zorunlu.' }
  try {
    const url = new URL(link)
    if (url.protocol !== 'https:') throw new Error()
  } catch {
    return { message: 'Link https:// ile başlayan geçerli bir adres olmalı.' }
  }
  await addSource({ channel, brand, link, keywords, targetId })
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

export async function rotateCronKeyAction() {
  if (!(await isAdmin())) return
  await getCronKey(true)
  revalidatePath('/panel')
}

export async function runMirrorAction(): Promise<ActionState> {
  if (!(await isAdmin())) return EXPIRED
  try {
    const r = await runMirror()
    revalidatePath('/panel')
    const parts = [`${r.checked} kaynak kontrol edildi`, `${r.sent} post paylaşıldı`]
    if (r.skipped) parts.push(`${r.skipped} atlandı`)
    if (r.failed) parts.push(`${r.failed} başarısız`)
    if (r.primed) parts.push(`${r.primed} yeni kaynak için başlangıç noktası kaydedildi`)
    return { ok: r.errors.length === 0, message: parts.join(', ') + '.' + (r.errors.length ? ` Hatalar: ${r.errors.join(' | ')}` : '') }
  } catch (error) {
    return { message: errorText(error) }
  }
}
