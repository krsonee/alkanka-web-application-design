'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import {
  deleteCampaign,
  deleteEarning,
  saveCampaign,
  saveEarning,
  saveTracking,
  setEarningStatus,
  type CampaignInput,
  type EarningInput,
} from '@/lib/marketing'
import type { EarningStatus, TrackingSettings } from '@/lib/marketing-shared'

type Result = { ok: boolean; message: string }
const EXPIRED: Result = { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }

async function run(fn: () => Promise<unknown>, success: string, layout = false): Promise<Result> {
  if (!(await canPanel('marketing'))) return EXPIRED
  try {
    await fn()
    revalidatePath('/panel')
    if (layout) revalidatePath('/', 'layout')
    return { ok: true, message: success }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'İşlem tamamlanamadı.' }
  }
}

export async function saveTrackingAction(input: TrackingSettings) {
  return run(() => saveTracking(input), 'Etiketler kaydedildi. Sitede birkaç dakika içinde çalışmaya başlar.', true)
}

export async function saveCampaignAction(input: CampaignInput) {
  return run(() => saveCampaign(input), input.id ? 'Kampanya güncellendi.' : 'Kampanya linki oluşturuldu.')
}

export async function deleteCampaignAction(id: number) {
  return run(() => deleteCampaign(id), 'Kampanya silindi.')
}

export async function saveEarningAction(input: EarningInput) {
  return run(() => saveEarning(input), input.id ? 'Hakediş güncellendi.' : 'Hakediş kaydı eklendi.')
}

export async function setEarningStatusAction(id: number, status: EarningStatus) {
  return run(() => setEarningStatus(id, status), 'Durum güncellendi.')
}

export async function deleteEarningAction(id: number) {
  return run(() => deleteEarning(id), 'Kayıt silindi.')
}
