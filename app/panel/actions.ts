'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ADMIN_COOKIE, checkPassword, createSessionValue, isAdmin } from '@/lib/admin-auth'
import { deleteContent, setContent, type HeroOverride, type SlideOverride } from '@/lib/content'
import { HERO_PAGES, JAKO_POSES, isAllowedImage } from '@/lib/site-registry'
import { SLIDES } from '@/components/alkanka/data'

export type ActionState = { ok?: boolean; message?: string }

const LIMITS = { eyebrow: 40, title: 90, description: 280, speech: 160, cta: 30 } as const

function field(form: FormData, name: keyof typeof LIMITS) {
  return String(form.get(name) ?? '').trim().slice(0, LIMITS[name])
}

function imageField(form: FormData) {
  const value = String(form.get('image') ?? '').trim()
  if (!value) return ''
  if (!isAllowedImage(value)) throw new Error('Görsel /images/ ile ya da https:// ile başlamalı.')
  return value
}

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Oturum süresi doldu, tekrar giriş yap.')
}

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const password = String(form.get('password') ?? '')
  const token = createSessionValue()
  if (!token || !checkPassword(password)) return { message: 'Şifre yanlış.' }
  ;(await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
  revalidatePath('/panel')
  return { ok: true }
}

export async function logout() {
  ;(await cookies()).delete(ADMIN_COOKIE)
  revalidatePath('/panel')
}

export async function saveHero(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const slug = String(form.get('slug'))
    const page = HERO_PAGES.find((p) => p.slug === slug)
    if (!page) return { message: 'Sayfa bulunamadı.' }
    const pose = String(form.get('pose') ?? '')
    const value: HeroOverride = {
      eyebrow: field(form, 'eyebrow'),
      title: field(form, 'title'),
      description: field(form, 'description'),
      speech: field(form, 'speech'),
      image: imageField(form),
      pose: (JAKO_POSES as readonly string[]).includes(pose) ? pose : '',
    }
    await setContent(`hero:${slug}`, value)
    revalidatePath(page.path)
    return { ok: true, message: 'Kaydedildi.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}

export async function resetHero(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const page = HERO_PAGES.find((p) => p.slug === String(form.get('slug')))
    if (!page) return { message: 'Sayfa bulunamadı.' }
    await deleteContent(`hero:${page.slug}`)
    revalidatePath(page.path)
    revalidatePath('/panel')
    return { ok: true, message: 'Varsayılana döndü.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Sıfırlanamadı.' }
  }
}

export async function saveSlide(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const id = String(form.get('id'))
    if (!SLIDES.some((s) => s.id === id)) return { message: 'Slayt bulunamadı.' }
    const value: SlideOverride = {
      eyebrow: field(form, 'eyebrow'),
      title: field(form, 'title'),
      description: field(form, 'description'),
      cta: field(form, 'cta'),
      image: imageField(form),
    }
    await setContent(`slide:${id}`, value)
    revalidatePath('/')
    return { ok: true, message: 'Kaydedildi.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}

export async function resetSlide(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const id = String(form.get('id'))
    if (!SLIDES.some((s) => s.id === id)) return { message: 'Slayt bulunamadı.' }
    await deleteContent(`slide:${id}`)
    revalidatePath('/')
    revalidatePath('/panel')
    return { ok: true, message: 'Varsayılana döndü.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Sıfırlanamadı.' }
  }
}
