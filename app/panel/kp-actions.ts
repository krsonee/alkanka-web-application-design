'use server'

import { logPanel, memberTag } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import {
  adjustPoints,
  awardBadge,
  awardBadgeId,
  awardContest,
  badgeCount,
  isRoleBadge,
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

import { saveQuestConfig } from '@/lib/kp-extras'
import type { WeeklyQuestConfig } from '@/lib/kanka-puan-shared'
import { saveOnlineConfig, saveTickerConfig } from '@/lib/online-rewards'
import type { OnlineConfig, TickerConfig } from '@/lib/online-rewards-shared'

export async function updateTicker(cfg: TickerConfig) {
  return guard(async () => {
    await saveTickerConfig(cfg)
    await logPanel('badges', 'Kazananlar şeridi kaydedildi')
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
    await logPanel('badges', 'Seviyeler kaydedildi', null, `${levels.length} seviye`)
    return 'Seviyeler kaydedildi.'
  })
}

export async function updateRules(rules: PointRules) {
  return guard(async () => {
    await saveRules(rules)
    await logPanel('badges', 'Puan kuralları kaydedildi')
    return 'Puan kuralları kaydedildi.'
  })
}

export async function updateWeeklyQuest(cfg: WeeklyQuestConfig) {
  return guard(async () => {
    await saveQuestConfig(cfg)
    await logPanel('badges', cfg.enabled ? 'Haftalık görev yayına alındı' : 'Haftalık görev kapatıldı')
    return cfg.enabled ? 'Haftalık görev yayında.' : 'Haftalık görev kapatıldı.'
  })
}

export async function updateOnlineRewards(cfg: OnlineConfig) {
  return guard(async () => {
    await saveOnlineConfig(cfg)
    revalidatePath('/gorevler')
    await logPanel('badges', 'Online ödülleri kaydedildi')
    return 'Online ödülleri kaydedildi.'
  })
}

export async function upsertBadge(input: BadgeInput) {
  return guard(async () => {
    await saveSpecialBadge(input)
    await logPanel('badges', 'Rozet kaydedildi', input.name)
    return 'Rozet kaydedildi.'
  })
}

export async function removeBadge(id: string) {
  return guard(async () => {
    await deleteSpecialBadge(id)
    await logPanel('badges', 'Rozet silindi', id)
    return 'Rozet silindi.'
  })
}

const NO_ROLE_PERMISSION = 'Görevli rozetlerini sadece yönetici veya yetkili personel verebilir.'

export async function heldBadgeCount(badgeId: string, userId: string): Promise<number> {
  if (!(await canPanel('badges'))) return 0
  return badgeCount(String(userId), String(badgeId)).catch(() => 0)
}

export async function giveBadge(badgeId: string, userId: string, note: string) {
  return guard(async () => {
    if ((await isRoleBadge(badgeId)) && !(await canPanel('roles'))) throw new Error(NO_ROLE_PERMISSION)
    const ok = await awardBadge(badgeId, userId, `manuel-${Date.now()}`, note || undefined)
    if (ok) await logPanel('badges', 'Rozet verildi', await memberTag(userId), `${badgeId}${note ? ` · ${note}` : ''}`)
    return ok ? 'Rozet verildi.' : 'Bu üye rozeti zaten almış.'
  })
}

export async function giveContestBadge(badgeId: string) {
  return guard(async () => {
    const message = await awardContest(badgeId)
    await logPanel('badges', 'Yarışma rozeti dağıtıldı', badgeId, typeof message === 'string' ? message : null)
    return message
  })
}

export async function takeBackAward(awardId: number) {
  return guard(async () => {
    const badgeId = await awardBadgeId(awardId)
    if (badgeId && (await isRoleBadge(badgeId)) && !(await canPanel('roles'))) throw new Error(NO_ROLE_PERMISSION)
    await revokeAward(awardId)
    await logPanel('badges', 'Rozet geri alındı', badgeId ?? `Kayıt #${awardId}`)
    return 'Rozet geri alındı.'
  })
}

export async function changePoints(userId: string, points: number, note: string) {
  return guard(async () => {
    await adjustPoints(userId, points, note)
    await logPanel('badges', points > 0 ? 'Kanka puanı eklendi' : 'Kanka puanı düşüldü', await memberTag(userId), `${points} KP · ${note}`)
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
