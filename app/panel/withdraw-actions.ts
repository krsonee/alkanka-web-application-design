'use server'

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
  return guard(() => approveWithdrawal(id, reward))
}

export async function rejectShare(id: number, note: string) {
  return guard(async () => {
    await rejectWithdrawal(id, note)
    return 'Reddedildi, üyeye bildirildi.'
  })
}

export async function fakeShare(id: number) {
  return guard(async () => {
    await markWithdrawalFake(id)
    return 'Sahte olarak işaretlendi, üye paylaşımdan engellendi.'
  })
}

export async function removeShare(id: number) {
  return guard(async () => {
    await deleteWithdrawal(id)
    return 'Paylaşım silindi.'
  })
}

export async function unblockShareUser(userId: string) {
  return guard(async () => {
    await unblockWithdrawUser(userId)
    return 'Engel kaldırıldı.'
  })
}

export async function updateWithdrawSettings(input: Partial<WithdrawSettings>) {
  return guard(async () => {
    await saveWithdrawSettings(input)
    return 'Ayarlar kaydedildi.'
  })
}

export async function updateSiteReward(siteId: string, reward: WithdrawReward | null) {
  return guard(async () => {
    await saveSiteReward(siteId, reward)
    return reward ? 'Site ödülü kaydedildi.' : 'Site varsayılan ödüle döndü.'
  })
}
