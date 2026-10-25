'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { deletePost, savePost } from '@/lib/blog'
import { deleteDeal, extractVerificationCode, setDealsPublishing, setVerification } from '@/lib/deals'
import { slugify } from '@/lib/seo'
import type { ActionState } from './actions'

const EXPIRED = { message: 'Oturum süresi doldu, tekrar giriş yap.' }

function str(form: FormData, key: string, max: number) {
  return String(form.get(key) ?? '').trim().slice(0, max)
}

type Result = { ok: boolean; message: string }

export async function saveRedirectAction(from: string, to: string): Promise<Result> {
  if (!(await canPanel('seo'))) return { ok: false, ...EXPIRED }
  try {
    const { saveRedirect } = await import('@/lib/seo-health')
    await saveRedirect(from, to)
    revalidatePath('/panel')
    return { ok: true, message: 'Yönlendirme kaydedildi. 1 dakika içinde çalışır.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Kaydedilemedi.' }
  }
}

export async function deleteRedirectAction(from: string): Promise<Result> {
  if (!(await canPanel('seo'))) return { ok: false, ...EXPIRED }
  const { deleteRedirect } = await import('@/lib/seo-health')
  await deleteRedirect(from)
  revalidatePath('/panel')
  return { ok: true, message: 'Yönlendirme silindi.' }
}

export async function clear404Action(path: string): Promise<Result> {
  if (!(await canPanel('seo'))) return { ok: false, ...EXPIRED }
  const { clear404 } = await import('@/lib/seo-health')
  await clear404(path)
  revalidatePath('/panel')
  return { ok: true, message: 'Kayıt silindi.' }
}

export async function savePostAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('seo'))) return EXPIRED
  const title = str(form, 'title', 120)
  const excerpt = str(form, 'excerpt', 200)
  const body = str(form, 'body', 30000)
  const cover = str(form, 'cover', 500)
  if (!title || !excerpt || body.length < 50) return { message: 'Başlık, özet ve en az 50 karakter içerik gerekli.' }
  if (cover && !/^(https:\/\/|\/)/.test(cover)) return { message: 'Kapak görseli https:// ya da / ile başlamalı.' }
  const slug = slugify(str(form, 'slug', 90) || title)
  if (!slug) return { message: 'Geçerli bir adres (slug) girilemedi.' }
  const rawId = Number.parseInt(String(form.get('id') ?? ''), 10)
  try {
    await savePost({
      id: Number.isFinite(rawId) ? rawId : null,
      slug,
      title,
      excerpt,
      body,
      cover,
      keywords: str(form, 'keywords', 300),
      published: form.get('published') === 'on',
    })
    revalidatePath('/rehber', 'layout')
    revalidatePath('/sitemap.xml')
    revalidatePath('/panel')
    return { ok: true, message: 'Yazı kaydedildi.' }
  } catch (error) {
    console.error('[blog] kaydedilemedi', error)
    const dup = String(error).includes('unique')
    return { message: dup ? 'Bu adres (slug) başka bir yazıda kullanılıyor.' : 'Yazı kaydedilemedi.' }
  }
}

export async function deletePostAction(id: number) {
  if (!(await canPanel('seo'))) return
  await deletePost(id)
  revalidatePath('/rehber', 'layout')
  revalidatePath('/panel')
}

export async function deleteDealAction(id: number) {
  if (!(await canPanel('seo'))) return
  await deleteDeal(id)
  revalidatePath('/ozel-oranlar')
  revalidatePath('/panel')
}

export async function setDealsPublishingAction(on: boolean) {
  if (!(await canPanel('seo'))) return
  await setDealsPublishing(on)
  revalidatePath('/panel')
}

export async function saveVerificationAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('seo'))) return EXPIRED
  try {
    await setVerification({
      google: extractVerificationCode(str(form, 'google', 400)),
      bing: extractVerificationCode(str(form, 'bing', 400)),
      yandex: extractVerificationCode(str(form, 'yandex', 400)),
      meta: extractVerificationCode(str(form, 'meta', 400)),
    })
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Doğrulama kodları kaydedildi.' }
  } catch (error) {
    console.error('[seo] doğrulama kaydedilemedi', error)
    return { message: 'Kaydedilemedi.' }
  }
}
