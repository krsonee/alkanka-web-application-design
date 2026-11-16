import { PANEL_MODULES } from '@/lib/panel-modules'

export type AuditRow = {
  id: number
  actor: string
  area: string | null
  action: string
  target: string | null
  detail: string | null
  ip: string | null
  createdAt: string
}

export type AuditQuery = { q?: string; actor?: string; area?: string; from?: string; to?: string; page?: number }

export type AuditPage = { rows: AuditRow[]; total: number; page: number; pageSize: number; actors: string[]; areas: string[] }

export const AUDIT_PAGE_SIZE = 50
export const AUDIT_EXPORT_LIMIT = 5000

const EXTRA_AREAS: Record<string, string> = {
  auth: 'Giriş ve çıkış',
  staff: 'Personel & yetkiler',
  account: 'Hesabım & 2FA',
  history: 'Ayar geçmişi',
}

export function areaLabel(area: string | null) {
  if (!area) return 'Diğer'
  return EXTRA_AREAS[area] ?? PANEL_MODULES.find((m) => m.id === area)?.label ?? area
}

export type HistoryChange = { path: string; before: string; after: string }

export type HistoryRow = {
  id: number
  key: string
  label: string
  area: string | null
  actor: string
  createdAt: string
  changes: HistoryChange[]
  moreChanges: number
  /** False when the setting did not exist before this save; going back removes the override. */
  hadBefore: boolean
}

export type HistoryPage = { rows: HistoryRow[]; total: number; page: number; pageSize: number; areas: string[] }

export const HISTORY_PAGE_SIZE = 20

/** Settings whose every save is kept so the previous state can be brought back. A trailing colon matches a key family. */
const TRACKED: Array<[key: string, label: string, area: string]> = [
  ['slides:custom', 'Slider: eklenen slaytlar', 'slide'],
  ['slides:order', 'Slider sırası', 'slide'],
  ['slide:', 'Slider: hazır slayt', 'slide'],
  ['hero:', 'Sayfa başlığı', 'hero'],
  ['texts:site', 'Site yazıları', 'texts'],
  ['legal', 'Yasal metinler', 'texts'],
  ['site:branding', 'Logo & uygulama ikonu', 'branding'],
  ['share', 'Paylaşım görseli', 'logo'],
  ['ads:slots', 'Reklam alanları', 'logo'],
  ['logos:', 'Logolar', 'logo'],
  ['home-v2', 'Ana sayfa & Masa aç', 'logo'],
  ['tour:settings', 'Site turu', 'tour'],
  ['arena:settings', 'Oyun ayarları', 'games'],
  ['arena:house', 'Mini oyun kazanma oranı', 'games'],
  ['rewards:mini', 'Mini oyun ödülleri', 'rewards'],
  ['catalog:events', 'Etkinlikler', 'catalog'],
  ['catalog:predictions', 'Tahminler', 'catalog'],
  ['catalog:campaigns', 'Kampanyalar', 'catalog'],
  ['catalog:bonuses', 'Bonuslar', 'catalog'],
  ['catalog:order', 'Kategori sırası', 'catalog'],
  ['site:hidden', 'Gizlenen içerikler', 'catalog'],
  ['app_settings', 'Uygulama ödülleri', 'push'],
  ['referral_settings', 'Davet ödülleri', 'growth'],
  ['ambient_tables', 'Masa doluluğu', 'growth'],
  ['boosts:config', 'Kampanyalar ve çarpanlar', 'badges'],
  ['social:links', 'Sosyal medya hesapları', 'social'],
  ['auth:signup', 'Yeni üyelik kapısı', 'users'],
]

export function trackedSetting(key: string): { label: string; area: string } | null {
  for (const [match, label, area] of TRACKED) {
    if (match.endsWith(':') ? key.startsWith(match) : key === match) {
      return { label: match.endsWith(':') ? `${label} (${key.slice(match.length)})` : label, area }
    }
  }
  return null
}
