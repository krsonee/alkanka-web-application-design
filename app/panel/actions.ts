'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ADMIN_COOKIE, checkPassword } from '@/lib/admin-auth'
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, isAuthenticated, verifyPassword } from '@/lib/admin-gate'
import { deleteContent, extraHeroes, extraSlideIds, EXTRA_HEROES_KEY, EXTRA_SLIDES_KEY, getAllContent, setContent, type HeroOverride, type SlideOverride } from '@/lib/content'
import { HERO_PAGES, JAKO_POSES, isAllowedImage } from '@/lib/site-registry'
import { SLIDES } from '@/components/alkanka/data'
import { LOGO_SPONSORS, LOGO_TEAMS } from '@/lib/logo-registry'
import { slugify } from '@/lib/slug'
import { SHARE_KEY } from '@/lib/share'
import { TEXT_FIELDS, TEXTS_KEY } from '@/lib/site-texts-shared'

export type ActionState = { ok?: boolean; message?: string }

const LIMITS = { eyebrow: 40, title: 90, description: 280, speech: 160, cta: 30 } as const

function field(form: FormData, name: keyof typeof LIMITS) {
  return String(form.get(name) ?? '').trim().slice(0, LIMITS[name])
}

const SAFE_ID = /^[a-z0-9-]{1,40}$/

function imageField(form: FormData) {
  const value = String(form.get('image') ?? '').trim()
  if (!value) return ''
  if (!isAllowedImage(value)) throw new Error('Görsel /images/, /uploads/ ya da https:// ile başlamalı.')
  return value
}

function linkField(form: FormData) {
  const href = String(form.get('href') ?? '').trim().slice(0, 300)
  if (!href) return ''
  if (href.startsWith('/') || /^https:\/\//.test(href)) return href
  throw new Error('Link / veya https:// ile başlamalı.')
}

async function requireAdmin() {
  if (!(await isAuthenticated())) throw new Error('Oturum süresi doldu, tekrar giriş yap.')
}

/** Design login reads ADMIN_PASSWORD. If that variable is unset, the old admin gate's password is used. */
function passwordMatches(password: string) {
  if (process.env.ADMIN_PASSWORD?.trim()) return checkPassword(password)
  try {
    return verifyPassword(password)
  } catch {
    return false
  }
}

export async function panelConfigured() {
  if (process.env.ADMIN_PASSWORD?.trim()) return true
  try {
    const { getAdminPassword } = await import('@/lib/secrets')
    getAdminPassword()
    return true
  } catch {
    return false
  }
}

function cookieSecure() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  if (site.startsWith('https://')) return true
  if (site.startsWith('http://')) return false
  return process.env.NODE_ENV === 'production'
}

export async function saveShare(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const text = (name: string, max: number) => String(form.get(name) ?? '').trim().slice(0, max)
    const image = text('image', 500)
    if (image && !isAllowedImage(image)) throw new Error('Görsel /images/, /uploads/ ya da https:// ile başlamalı.')
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
        if (!isAllowedImage(image)) return { message: `${page.label} / ${pos.label}: görsel /uploads/, /images/ veya https:// ile başlamalı.` }
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
  if (!passwordMatches(password)) return { message: 'Şifre yanlış.' }
  let token: string
  try {
    token = createSessionToken()
  } catch {
    return { message: 'Oturum anahtarı ayarlı değil.' }
  }
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  revalidatePath('/panel')
  return { ok: true }
}

export async function logout() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
  jar.delete(ADMIN_COOKIE)
  revalidatePath('/panel')
}

export async function saveHero(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const content = await getAllContent()
    const extras = extraHeroes(content)
    let slug = String(form.get('slug') ?? '').trim().toLowerCase()
    const creating = form.get('create') === '1'
    if (creating && !slug) slug = slugify(String(form.get('label') ?? '')).slice(0, 40)
    if (!SAFE_ID.test(slug)) return { message: 'Sayfa adı gerekli. Küçük harf, rakam ve tire kullan.' }
    const page = HERO_PAGES.find((p) => p.slug === slug)
    const extra = extras.find((h) => h.slug === slug)
    if (creating && page) return { message: 'Bu sayfa zaten var. Alttaki kartından düzenle.' }
    if (!page && !extra) {
      if (!creating) return { message: 'Sayfa bulunamadı.' }
      const label = String(form.get('label') ?? form.get('title') ?? '').trim().slice(0, 60) || slug
      extras.push({ slug, label, path: `/sayfa/${slug}` })
      await setContent(EXTRA_HEROES_KEY, extras)
    }
    const pose = String(form.get('pose') ?? '')
    const value: HeroOverride = {
      eyebrow: field(form, 'eyebrow'),
      title: field(form, 'title') || String(form.get('label') ?? '').trim().slice(0, 90),
      description: field(form, 'description'),
      speech: field(form, 'speech'),
      image: imageField(form),
      pose: (JAKO_POSES as readonly string[]).includes(pose) ? pose : '',
    }
    await setContent(`hero:${slug}`, value)
    revalidatePath(page?.path ?? `/sayfa/${slug}`)
    revalidatePath('/panel')
    return { ok: true, message: creating && !page ? 'Yeni sayfa başlığı eklendi.' : 'Kaydedildi.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}

export async function resetHero(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const slug = String(form.get('slug') ?? '')
    if (!SAFE_ID.test(slug)) return { message: 'Sayfa bulunamadı.' }
    const content = await getAllContent()
    const extras = extraHeroes(content)
    const extra = extras.find((h) => h.slug === slug)
    const page = HERO_PAGES.find((p) => p.slug === slug)
    if (!page && !extra) return { message: 'Sayfa bulunamadı.' }
    await deleteContent(`hero:${slug}`)
    if (extra) await setContent(EXTRA_HEROES_KEY, extras.filter((h) => h.slug !== slug))
    revalidatePath(page?.path ?? extra?.path ?? `/sayfa/${slug}`)
    revalidatePath('/panel')
    return { ok: true, message: extra && !page ? 'Sayfa başlığı silindi.' : 'Varsayılana döndü.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Sıfırlanamadı.' }
  }
}

export async function saveTexts(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
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
    await requireAdmin()
    const id = String(form.get('id') ?? '').trim()
    if (!SAFE_ID.test(id)) return { message: 'Slayt bulunamadı.' }
    const content = await getAllContent()
    const extras = extraSlideIds(content)
    const known = SLIDES.some((s) => s.id === id)
    const creating = form.get('create') === '1'
    if (!known && !extras.includes(id)) {
      if (!creating) return { message: 'Slayt bulunamadı.' }
      await setContent(EXTRA_SLIDES_KEY, [...extras, id])
    }
    const value: SlideOverride = {
      eyebrow: field(form, 'eyebrow'),
      title: field(form, 'title'),
      description: field(form, 'description'),
      cta: field(form, 'cta'),
      image: imageField(form),
      href: linkField(form),
      hidden: form.get('hidden') === '1',
    }
    await setContent(`slide:${id}`, value)
    revalidatePath('/')
    revalidatePath('/panel')
    return { ok: true, message: creating && !known ? 'Yeni slayt eklendi.' : 'Kaydedildi.' }
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
    if (kind === 'sponsors') return { message: 'Sponsor logoları Sponsorlar menüsündeki Logo yükle butonuyla kaydedilir.' }
    const value: Record<string, string> = {}
    for (const item of allowed) {
      const url = String(form.get(`logo:${item.id}`) ?? '').trim()
      if (!url) continue
      if (!isAllowedImage(url)) return { message: `${item.label}: logo /uploads/, /images/ ya da https:// ile başlamalı.` }
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
    const id = String(form.get('id') ?? '')
    if (!SAFE_ID.test(id)) return { message: 'Slayt bulunamadı.' }
    const content = await getAllContent()
    const extras = extraSlideIds(content)
    const custom = extras.includes(id)
    if (!custom && !SLIDES.some((s) => s.id === id)) return { message: 'Slayt bulunamadı.' }
    await deleteContent(`slide:${id}`)
    if (custom) await setContent(EXTRA_SLIDES_KEY, extras.filter((item) => item !== id))
    revalidatePath('/')
    revalidatePath('/panel')
    return { ok: true, message: custom ? 'Slayt silindi.' : 'Varsayılana döndü.' }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Sıfırlanamadı.' }
  }
}
