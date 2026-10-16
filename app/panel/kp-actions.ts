'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import {
  adjustPoints,
  awardBadge,
  awardBadgeId,
  awardContest,
  ROLE_BADGE_IDS,
  contestStandings,
  deleteSpecialBadge,
  revokeAward,
  saveLevels,
  saveRules,
  saveSpecialBadge,
  searchMembers,
  type AutoKind,
  type BadgeInput,
  type ContestRow,
  type LevelDef,
  type PointRules,
} from '@/lib/kanka-puan'

import { saveOnlineConfig, saveTickerConfig } from '@/lib/online-rewards'
import type { OnlineConfig, TickerConfig } from '@/lib/online-rewards-shared'

export async function updateTicker(cfg: TickerConfig) {
  return guard(async () => {
    await saveTickerConfig(cfg)
    return 'Kazananlar şeridi kaydedildi.'
  })
}

type Result = { ok: true; message?: string } | { ok: false; error: string }

async function guard(fn: () => Promise<string | void>): Promise<Result> {
  if (!(await canPanel('badges'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const message = await fn()
    revalidatePath('/panel')
    revalidatePath('/rozetler')
    revalidatePath('/profil')
    return { ok: true, message: message || undefined }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}

export async function updateLevels(levels: LevelDef[]) {
  return guard(async () => {
    await saveLevels(levels)
    return 'Seviyeler kaydedildi.'
  })
}

export async function updateRules(rules: PointRules) {
  return guard(async () => {
    await saveRules(rules)
    return 'Puan kuralları kaydedildi.'
  })
}

export async function updateOnlineRewards(cfg: OnlineConfig) {
  return guard(async () => {
    await saveOnlineConfig(cfg)
    revalidatePath('/gorevler')
    return 'Online ödülleri kaydedildi.'
  })
}

export async function upsertBadge(input: BadgeInput) {
  return guard(async () => {
    await saveSpecialBadge(input)
    return 'Rozet kaydedildi.'
  })
}

export async function removeBadge(id: string) {
  return guard(async () => {
    await deleteSpecialBadge(id)
    return 'Rozet silindi.'
  })
}

const NO_ROLE_PERMISSION = 'Görevli rozetlerini sadece yönetici veya yetkili personel verebilir.'

export async function giveBadge(badgeId: string, userId: string, note: string) {
  return guard(async () => {
    if (ROLE_BADGE_IDS.includes(badgeId) && !(await canPanel('roles'))) throw new Error(NO_ROLE_PERMISSION)
    const ok = await awardBadge(badgeId, userId, `manuel-${Date.now()}`, note || undefined)
    return ok ? 'Rozet verildi.' : 'Bu üye rozeti zaten almış.'
  })
}

export async function giveContestBadge(badgeId: string) {
  return guard(() => awardContest(badgeId))
}

export async function takeBackAward(awardId: number) {
  return guard(async () => {
    const badgeId = await awardBadgeId(awardId)
    if (badgeId && ROLE_BADGE_IDS.includes(badgeId) && !(await canPanel('roles'))) throw new Error(NO_ROLE_PERMISSION)
    await revokeAward(awardId)
    return 'Rozet geri alındı.'
  })
}

export async function changePoints(userId: string, points: number, note: string) {
  return guard(async () => {
    await adjustPoints(userId, points, note)
    return `${points > 0 ? '+' : ''}${points} KP işlendi.`
  })
}

export async function findMembers(q: string) {
  if (!(await canPanel('badges'))) return []
  return searchMembers(q)
}

export async function previewContest(kind: Exclude<AutoKind, 'turnuva'>): Promise<{ period: string; rows: ContestRow[] } | null> {
  if (!(await canPanel('badges'))) return null
  return contestStandings(kind)
}
