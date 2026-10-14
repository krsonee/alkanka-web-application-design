'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import type { PanelModule } from '@/lib/panel-modules'
import { panelLogout } from '@/app/panel/auth-actions'
import { deleteContent, setContent, type HeroOverride, type SlideOverride } from '@/lib/content'
import { HERO_PAGES, JAKO_POSES, isAllowedImage } from '@/lib/site-registry'
import { SLIDES } from '@/components/alkanka/data'
import { LOGO_TEAMS, listLogoSponsors } from '@/lib/logo-registry'
import { SHARE_KEY } from '@/lib/share'
import { TEXT_FIELDS, TEXTS_KEY } from '@/lib/site-texts-shared'

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

async function requireAdmin(module: PanelModule) {
  if (!(await canPanel(module))) throw new Error('Oturum süresi doldu, tekrar giriş yap.')
}

export async function saveShare(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('logo')
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
    await requireAdmin('logo')
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

export async function logout() {
  await panelLogout()
}

export async function saveHero(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('hero')
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
    await requireAdmin('hero')
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

export async function saveTexts(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('texts')
    const value: Record<string, string> = {}
    for (const f of TEXT_FIELDS) {
      const v = String(form.get(f.key) ?? '').trim().slice(0, f.max)
      if (!v) continue
      if (f.key === 'auth.bonus' && !/^\d{1,6}$/.test(v)) return { message: 'Kayıt bonusu sadece rakam olmalı.' }
      value[f.key] = v
    }
    await setContent(TEXTS_KEY, value)
    revalidatePath('/', 'layout')
    return { ok: true, message: `Kaydedildi (${Object.keys(value).length} özel metin).` }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}

export async function saveSlide(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin('slide')
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
    await requireAdmin('logo')
    const kind = String(form.get('kind'))
    const allowed = kind === 'sponsors' ? await listLogoSponsors() : kind === 'teams' ? LOGO_TEAMS : null
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
    await requireAdmin('slide')
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
