'use server'

import { revalidatePath } from 'next/cache'
import { getBalance, getMember } from '@/lib/member'
import { avatarOf, buyAvatar, chooseAvatar, getLookState, setCover, setTeam, type LookState } from '@/lib/avatars'
import { getKpStatus } from '@/lib/kanka-puan'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

type Result = { ok: true; balance: number; reward: number; message: string; state: LookState } | { ok: false; error: string }

async function run(key: string, fn: (userId: string) => Promise<{ reward?: number; message: string }>): Promise<Result> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Bunun için giriş yapmalısın.' }
  if (await hitRateLimit(`look:${key}:${member.id}`, 12, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  try {
    const out = await fn(member.id)
    revalidatePath('/profil')
    const [balance, state] = await Promise.all([getBalance(member.id), getLookState(member.id)])
    return { ok: true, balance, reward: out.reward ?? 0, message: out.message, state }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'İşlem başarısız.' }
  }
}

export async function chooseAvatarAction(avatarId: string) {
  return run('choose', async (uid) => {
    const { reward } = await chooseAvatar(uid, String(avatarId))
    return { reward, message: reward ? `Avatarın kaydedildi, +${reward} KC hoş geldin ödülü kazandın!` : 'Avatarın güncellendi.' }
  })
}

export async function buyAvatarAction(avatarId: string) {
  return run('buy', async (uid) => {
    const { reward } = await buyAvatar(uid, String(avatarId))
    return { reward, message: reward ? `Avatar senin! Üstüne +${reward} KC ilk avatar ödülü.` : 'Avatar senin, profiline takıldı.' }
  })
}

export async function setCoverAction(coverId: string) {
  return run('cover', async (uid) => {
    await setCover(uid, String(coverId))
    return { message: 'Kapak görselin güncellendi.' }
  })
}

export async function setTeamAction(teamId: string | null) {
  return run('team', async (uid) => {
    await setTeam(uid, teamId ? String(teamId) : null)
    return { message: teamId ? 'Favori takımın kaydedildi.' : 'Favori takım kaldırıldı.' }
  })
}

export type LookSummary = { avatar: string | null; level: number; levelName: string; progress: number; nextName: string | null; kp: number }

export async function getLookSummary(): Promise<LookSummary | null> {
  const member = await getMember()
  if (!member) return null
  const [avatar, kp] = await Promise.all([avatarOf(member.id).catch(() => null), getKpStatus(member.id).catch(() => null)])
  return {
    avatar,
    level: (kp?.level.index ?? 0) + 1,
    levelName: kp?.level.name ?? 'Çaylak',
    progress: kp?.level.progress ?? 0,
    nextName: kp?.level.next?.name ?? null,
    kp: kp?.kp ?? 0,
  }
}
