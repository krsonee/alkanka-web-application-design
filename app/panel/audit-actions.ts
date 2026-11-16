'use server'

import { revalidatePath } from 'next/cache'
import { isPanelOwner } from '@/lib/admin-auth'
import { deleteContent, setContent } from '@/lib/content'
import { historyEntry, listContentHistory } from '@/lib/content-history'
import { exportAudit, logPanel, searchAudit } from '@/lib/panel-log'
import { areaLabel, type AuditPage, type AuditQuery, type HistoryPage } from '@/lib/panel-log-shared'

const DENIED = 'Bu ekranı sadece ana yönetici kullanabilir.'

export async function searchAuditAction(query: AuditQuery): Promise<AuditPage | null> {
  if (!(await isPanelOwner())) return null
  return searchAudit(query)
}

// A value starting with one of these runs as a formula when the file is opened in a spreadsheet.
const cell = (v: string | null) => {
  const text = v ?? ''
  return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`
}

export async function exportAuditAction(query: AuditQuery): Promise<{ ok: true; csv: string; count: number } | { ok: false; error: string }> {
  if (!(await isPanelOwner())) return { ok: false, error: DENIED }
  const list = await exportAudit(query)
  const head = 'tarih,yonetici,bolum,islem,hedef,detay,adres'
  const lines = list.map((r) => [r.createdAt, r.actor, areaLabel(r.area), r.action, r.target, r.detail, r.ip].map(cell).join(','))
  await logPanel('history', 'İşlem logları dışa aktarıldı', null, `${list.length} kayıt`)
  return { ok: true, csv: [head, ...lines].join('\n'), count: list.length }
}

export async function listHistoryAction(page: number): Promise<HistoryPage | null> {
  if (!(await isPanelOwner())) return null
  return listContentHistory(page)
}

export async function restoreHistoryAction(id: number): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!(await isPanelOwner())) return { ok: false, error: DENIED }
  try {
    const entry = await historyEntry(Number(id))
    if (!entry) return { ok: false, error: 'Bu kayıt artık yok. Sayfayı yenileyip tekrar dene.' }
    if (entry.before === null || entry.before === undefined) await deleteContent(entry.key)
    else await setContent(entry.key, entry.before)
    const when = new Date(entry.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })
    await logPanel('history', 'Ayar eski haline döndürüldü', entry.label, `${when} öncesindeki hal`)
    revalidatePath('/', 'layout')
    return { ok: true, message: `"${entry.label}" ${when} öncesindeki haline döndü. Sitede hemen geçerli.` }
  } catch (error) {
    console.error('[history:restore]', error)
    return { ok: false, error: 'Geri alınamadı, hiçbir şey değişmedi.' }
  }
}
