'use server'

import { logPanel, memberTag } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import {
  approveWithdrawal,
  deleteWithdrawal,
  markWithdrawalFake,
  rejectWithdrawal,
  saveSiteReward,
  saveWithdrawSettings,
  unblockWithdrawUser,
  type WithdrawReward,
  type WithdrawSettings,
} from '@/lib/withdrawals'

type Result = { ok: true; message?: string } | { ok: false; error: string }

async function guard(fn: () => Promise<string | void>): Promise<Result> {
  if (!(await canPanel('community'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const message = await fn()
    revalidatePath('/panel')
    revalidatePath('/guven')
    return { ok: true, message: message || undefined }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}

export async function approveShare(id: number, reward: WithdrawReward) {
  return guard(async () => {
    const message = await approveWithdrawal(id, reward)
    await logPanel('community', 'Çekim paylaşımı onaylandı', `Paylaşım #${id}`, `${reward.coin} KC · ${reward.kp} KP${reward.item ? ` · ${reward.item}` : ''}`)
    return message
  })
}

export async function rejectShare(id: number, note: string) {
  return guard(async () => {
    await rejectWithdrawal(id, note)
    await logPanel('community', 'Çekim paylaşımı reddedildi', `Paylaşım #${id}`, note || null)
    return 'Reddedildi, üyeye bildirildi.'
  })
}

export async function fakeShare(id: number) {
  return guard(async () => {
    await markWithdrawalFake(id)
    await logPanel('community', 'Çekim paylaşımı sahte işaretlendi', `Paylaşım #${id}`, 'Üye paylaşımdan engellendi')
    return 'Sahte olarak işaretlendi, üye paylaşımdan engellendi.'
  })
}

export async function removeShare(id: number) {
  return guard(async () => {
    await deleteWithdrawal(id)
    await logPanel('community', 'Çekim paylaşımı silindi', `Paylaşım #${id}`)
    return 'Paylaşım silindi.'
  })
}

export async function unblockShareUser(userId: string) {
  return guard(async () => {
    await unblockWithdrawUser(userId)
    await logPanel('community', 'Paylaşım engeli kaldırıldı', await memberTag(userId))
    return 'Engel kaldırıldı.'
  })
}

export async function updateWithdrawSettings(input: Partial<WithdrawSettings>) {
  return guard(async () => {
    await saveWithdrawSettings(input)
    await logPanel('community', 'Çekim paylaşımı ayarları kaydedildi')
    return 'Ayarlar kaydedildi.'
  })
}

export async function updateSiteReward(siteId: string, reward: WithdrawReward | null) {
  return guard(async () => {
    await saveSiteReward(siteId, reward)
    await logPanel('community', reward ? 'Site çekim ödülü kaydedildi' : 'Site çekim ödülü varsayılana döndü', `Sponsor ${siteId}`)
    return reward ? 'Site ödülü kaydedildi.' : 'Site varsayılan ödüle döndü.'
  })
}
