'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { getTvConfig, saveTvConfig, scanGoals, settlePredictions, testGoalBot } from '@/lib/kankatv-engage'
import { parseTiers } from '@/lib/kankatv-shared'
import type { ActionState } from './actions'

const EXPIRED = { message: 'Oturum süresi doldu, tekrar giriş yap.' }
const errorText = (error: unknown) => String((error as Error).message ?? error)
const on = (form: FormData, key: string) => form.get(key) === 'on'
const num = (form: FormData, key: string) => Number(form.get(key))

function refresh() {
  revalidatePath('/panel')
  revalidatePath('/kankatv')
}

export async function saveTvAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const targetIds = form.getAll('targetIds').map(Number).filter((n) => Number.isInteger(n) && n > 0)
    const goalBotEnabled = on(form, 'goalBotEnabled')
    if (goalBotEnabled && !targetIds.length) return { message: 'Gol botunu açmak için en az bir hedef grup/kanal seç.' }
    await saveTvConfig({
      watch: { enabled: on(form, 'watchEnabled'), minutes: num(form, 'watchMinutes'), coin: num(form, 'watchCoin'), dailyCap: num(form, 'watchCap') },
      predict: { enabled: on(form, 'predictEnabled'), coin: num(form, 'predictCoin'), dailyLimit: num(form, 'predictLimit') },
      reactions: on(form, 'reactions'),
      presence: on(form, 'presence'),
      oddsBridge: on(form, 'oddsBridge'),
      miniPlayer: on(form, 'miniPlayer'),
      goalBot: {
        enabled: goalBotEnabled,
        targetIds,
        template: String(form.get('template') ?? ''),
        topOnly: on(form, 'topOnly'),
        push: on(form, 'push'),
      },
      chests: { enabled: on(form, 'chestsEnabled'), tiers: parseTiers(String(form.get('chestTiers') ?? '')) },
      flash: { enabled: on(form, 'flashEnabled'), seconds: num(form, 'flashSeconds'), multiplier: num(form, 'flashMultiplier') },
      goalChest: {
        enabled: on(form, 'goalChestEnabled'),
        min: num(form, 'goalChestMin'),
        max: num(form, 'goalChestMax'),
        dailyLimit: num(form, 'goalChestLimit'),
        topOnly: on(form, 'goalChestTopOnly'),
      },
      kickoffPush: on(form, 'kickoffPush'),
      weekly: {
        enabled: on(form, 'weeklyEnabled'),
        prizes: String(form.get('weeklyPrizes') ?? '').split(/[,\s]+/).map(Number).filter((n) => n > 0),
      },
      streak: { enabled: on(form, 'streakEnabled'), days: num(form, 'streakDays'), minMinutes: num(form, 'streakMinutes'), coin: num(form, 'streakCoin') },
      halftime: { enabled: on(form, 'halftimeEnabled'), min: num(form, 'halftimeMin'), max: num(form, 'halftimeMax') },
    })
    refresh()
    return { ok: true, message: 'KankaTV ayarları kaydedildi.' }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function testGoalBotAction(_: ActionState): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const sent = await testGoalBot()
    refresh()
    return sent ? { ok: true, message: `Test mesajı ${sent} hedefe gönderildi.` } : { message: 'Hiçbir hedefe gönderilemedi. Botun grupta yönetici olduğunu kontrol et.' }
  } catch (error) {
    refresh()
    return { message: errorText(error) }
  }
}

export async function runScanAction(_: ActionState): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const cfg = await getTvConfig()
    const [scan, settled] = await Promise.all([scanGoals(true), settlePredictions({ limit: 200 })])
    refresh()
    if (!scan.ran && !cfg.goalBot.enabled && !cfg.goalBot.push) return { ok: true, message: `Gol botu ve bildirimler kapalı. ${settled} tahmin sonuçlandı.` }
    if (scan.error) return { message: `Tarama yapıldı ama hata var: ${scan.error}` }
    return { ok: true, message: `${scan.goals} yeni gol bulundu, ${scan.sent} mesaj gitti, ${settled} tahmin sonuçlandı.` }
  } catch (error) {
    return { message: errorText(error) }
  }
}
