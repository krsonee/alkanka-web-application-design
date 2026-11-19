'use server'

import { revalidatePath } from 'next/cache'
import { canPanelAny } from '@/lib/admin-auth'
import type { PanelModule } from '@/lib/panel-modules'
import { logPanel } from '@/lib/panel-log'
import { hasNumericId, isRecordKind, type RecordKind } from '@/lib/record-links'
import { recordShortLink } from '@/lib/record-short'

type Result = { ok: true; url: string; created: boolean } | { ok: false; error: string }

/** Whoever manages the record can give it a short link; so can whoever manages the links. */
const MODULE: Record<RecordKind, PanelModule> = { turnuva: 'tournaments', tahmin: 'community', market: 'market', kampanya: 'catalog' }

export async function makeRecordShortLink(kind: string, id: string, name: string): Promise<Result> {
  if (!isRecordKind(kind)) return { ok: false, error: 'Bu kayıt türü için kısa link üretilemiyor.' }
  if (!(await canPanelAny([MODULE[kind], 'marketing', 'growth']))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  const key = String(id ?? '').trim()
  if (!key || key.length > 80 || (hasNumericId(kind) && !/^[1-9]\d{0,9}$/.test(key))) return { ok: false, error: 'Kayıt bulunamadı.' }
  try {
    const link = await recordShortLink(kind, key, String(name ?? ''))
    if (link.created) {
      await logPanel(MODULE[kind], 'Kısa link üretildi', String(name ?? '').slice(0, 80) || key, link.url)
      revalidatePath('/panel')
    }
    return { ok: true, url: link.url, created: link.created }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Kısa link üretilemedi.' }
  }
}
