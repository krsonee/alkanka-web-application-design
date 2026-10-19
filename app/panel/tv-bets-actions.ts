'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { saveBetsConfig, setMarketLock, setMarketOdds, settleMarket, syncBets, testBetsBot, voidMarket } from '@/lib/tv-bets'
import { BET_KINDS } from '@/lib/tv-bets-shared'
import type { ActionState } from './actions'

const EXPIRED = { message: 'Oturum süresi doldu, tekrar giriş yap.' }
const errorText = (error: unknown) => String((error as Error).message ?? error)
const on = (form: FormData, key: string) => form.get(key) === 'on'
const num = (form: FormData, key: string) => Number(form.get(key))
const ACTOR = 'panel'

function refresh() {
  revalidatePath('/panel')
  revalidatePath('/kankatv')
}

export async function saveBetsAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const targetIds = form.getAll('betTargetIds').map(Number).filter((n) => Number.isInteger(n) && n > 0)
    const botEnabled = on(form, 'botEnabled')
    if (botEnabled && !targetIds.length) return { message: 'Etkinlik botunu açmak için en az bir hedef grup/kanal seç.' }
    await saveBetsConfig(
      {
        enabled: on(form, 'enabled'),
        pre: on(form, 'pre'),
        live: on(form, 'live'),
        kinds: Object.fromEntries(BET_KINDS.map((k) => [k, on(form, `kind_${k}`)])),
        rake: num(form, 'rake'),
        minStake: num(form, 'minStake'),
        maxStake: num(form, 'maxStake'),
        dailyCap: num(form, 'dailyCap'),
        minActive: num(form, 'minActive'),
        closeMinute: num(form, 'closeMinute'),
        suspendSeconds: num(form, 'suspendSeconds'),
        lateWindow: num(form, 'lateWindow'),
        goalLine: num(form, 'goalLine'),
        cornerLine: num(form, 'cornerLine'),
        fixedExposure: num(form, 'fixedExposure'),
        bot: {
          enabled: botEnabled,
          targetIds,
          announceOpen: on(form, 'announceOpen'),
          announceSettle: on(form, 'announceSettle'),
          openTemplate: String(form.get('openTemplate') ?? ''),
          settleTemplate: String(form.get('settleTemplate') ?? ''),
        },
      },
      ACTOR,
    )
    refresh()
    return { ok: true, message: 'Canlı etkinlik ayarları kaydedildi.' }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function syncBetsAction(_: ActionState): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const r = await syncBets(true)
    refresh()
    if (r.error) return { message: `Tarama yapıldı ama hata var: ${r.error}` }
    if (!r.ran) return { ok: true, message: 'Sistem kapalı, tarama yapılmadı.' }
    return {
      ok: true,
      message: `${r.games} maç tarandı · ${r.opened} etkinlik açıldı · ${r.settled} sonuçlandı · ${r.voided} iptal · ${r.refundedLate} geç bahis iade · ${r.sent} bot mesajı`,
    }
  } catch (error) {
    return { message: errorText(error) }
  }
}

export async function testBetsBotAction(_: ActionState): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  try {
    const sent = await testBetsBot()
    refresh()
    return sent ? { ok: true, message: `Test mesajı ${sent} hedefe gönderildi.` } : { message: 'Hiçbir hedefe gönderilemedi. Botun grupta yönetici olduğunu kontrol et.' }
  } catch (error) {
    refresh()
    return { message: errorText(error) }
  }
}

export async function marketAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return EXPIRED
  const id = num(form, 'marketId')
  const op = String(form.get('op') ?? '')
  if (!Number.isInteger(id) || id <= 0) return { message: 'Geçersiz etkinlik.' }
  try {
    if (op === 'lock') await setMarketLock(id, true, ACTOR)
    else if (op === 'unlock') await setMarketLock(id, false, ACTOR)
    else if (op === 'void') await voidMarket(id, ACTOR, 'Panelden iptal')
    else if (op === 'settle') {
      const result = String(form.get('result') ?? '')
      if (!result) return { message: 'Sonuç seçmelisin.' }
      await settleMarket(id, result, ACTOR)
    } else if (op === 'odds') {
      const raw = String(form.get('odds') ?? '').trim()
      if (!raw) await setMarketOdds(id, null, ACTOR)
      else {
        const odds: Record<string, number> = {}
        for (const part of raw.split(',')) {
          const [k, v] = part.split('=').map((s) => s.trim())
          const n = Number(v)
          if (!k || !Number.isFinite(n) || n < 1.01 || n > 100) return { message: `Geçersiz oran: ${part}` }
          odds[k] = n
        }
        await setMarketOdds(id, odds, ACTOR)
      }
    } else return { message: 'Bilinmeyen işlem.' }
    refresh()
    return { ok: true, message: 'Etkinlik güncellendi.' }
  } catch (error) {
    return { message: errorText(error) }
  }
}
