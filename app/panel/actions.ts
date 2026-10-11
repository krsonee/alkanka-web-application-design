'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ADMIN_COOKIE, checkPassword, createSessionValue, isAdmin } from '@/lib/admin-auth'
import { deleteContent, setContent, type HeroOverride, type SlideOverride } from '@/lib/content'
import { HERO_PAGES, JAKO_POSES, isAllowedImage } from '@/lib/site-registry'
import { SLIDES } from '@/components/alkanka/data'
import { LOGO_SPONSORS, LOGO_TEAMS } from '@/lib/logo-registry'
import { SHARE_KEY } from '@/lib/share'

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

export async function saveShare(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const text = (name: string, max: number) => String(form.get(name) ?? '').trim().slice(0, max)
    const image = text('image', 500)
    if (image && !isAllowedImage(image)) throw new Error('Görsel /images/ ile ya da https:// ile başlamalı.')
    await setContent(SHARE_KEY, {
      title: text('title', 90),
      description: text('description', 200),
      siteName: text('siteName', 40),
      image,
    })
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Paylaşım önizlemesi kaydedildi. WhatsApp/Telegram eski önizlemeyi bir süre önbellekte tutabilir.' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}

export async function saveAds(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const { AD_PAGES, AD_POSITIONS, ADS_KEY } = await import('@/lib/ads')
    const value: Record<string, { image: string; href: string; alt: string }> = {}
    for (const page of AD_PAGES) {
      for (const pos of AD_POSITIONS) {
        const key = `${page.id}:${pos.id}`
        const image = String(form.get(`${key}:image`) ?? '').trim()
        const href = String(form.get(`${key}:href`) ?? '').trim()
        if (!image) continue
        if (!isAllowedImage(image)) return { message: `${page.label} / ${pos.label}: görsel https:// veya /images/ ile başlamalı.` }
        if (href && !/^https:\/\//.test(href) && !href.startsWith('/')) return { message: `${page.label} / ${pos.label}: link https:// ile başlamalı.` }
        value[key] = { image, href, alt: String(form.get(`${key}:alt`) ?? '').trim().slice(0, 80) }
      }
    }
    await setContent(ADS_KEY, value)
    for (const page of AD_PAGES) revalidatePath(`/${page.id}`)
    return { ok: true, message: 'Reklam alanları kaydedildi.' }
  } catch (error) {
    return { message: error instanceof Error ? error.message : 'Kaydedilemedi.' }
  }
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

export async function saveLogos(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const kind = String(form.get('kind'))
    const allowed = kind === 'sponsors' ? LOGO_SPONSORS : kind === 'teams' ? LOGO_TEAMS : null
    if (!allowed) return { message: 'Geçersiz liste.' }
    const value: Record<string, string> = {}
    for (const item of allowed) {
      const url = String(form.get(`logo:${item.id}`) ?? '').trim()
      if (!url) continue
      if (!isAllowedImage(url)) return { message: `${item.label}: logo /images/ ya da https:// ile başlamalı.` }
      value[item.id] = url.slice(0, 500)
    }
    await setContent(`logos:${kind}`, value)
    revalidatePath('/', 'layout')
    return { ok: true, message: `Kaydedildi (${Object.keys(value).length} logo).` }
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
