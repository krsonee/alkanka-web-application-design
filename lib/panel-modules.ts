export const PANEL_GROUPS = [
  {
    id: 'site',
    label: 'Site',
    modules: [
      { id: 'slide', label: 'Slider' },
      { id: 'hero', label: 'Sayfa başlıkları' },
      { id: 'texts', label: 'Site yazıları' },
      { id: 'branding', label: 'Logo & uygulama ikonu' },
      { id: 'logo', label: 'Paylaşım, reklam, logolar' },
      { id: 'seo', label: 'SEO & Rehber' },
      { id: 'faqs', label: 'SSS' },
    ],
  },
  {
    id: 'sponsors',
    label: 'Sponsorlar',
    modules: [
      { id: 'sponsors', label: 'Sponsor siteler' },
      { id: 'growth', label: 'Büyüme & trafik' },
    ],
  },
  {
    id: 'members',
    label: 'Üyeler',
    modules: [
      { id: 'users', label: 'Tüm üyeler' },
      { id: 'community', label: 'Topluluk' },
      { id: 'badges', label: 'Rozetler & puan' },
      { id: 'roles', label: 'Görevli rozetleri (Moderatör, Sponsor Destek)' },
      { id: 'tasks', label: 'Görevler' },
      { id: 'market', label: 'Market' },
      { id: 'social', label: 'Sosyal medya' },
      { id: 'limits', label: 'Gizli kısıtlamalar' },
    ],
  },
  {
    id: 'games',
    label: 'Oyunlar',
    modules: [
      { id: 'games', label: 'Oyun ayarları' },
      { id: 'rewards', label: 'Çark, zar, sandık ödülleri' },
      { id: 'catalog', label: 'Etkinlik, bilet, tahmin, kampanya, bonus' },
      { id: 'tournaments', label: 'Turnuvalar' },
      { id: 'cember', label: 'Jako Çemberi' },
    ],
  },
  {
    id: 'telegram',
    label: 'Telegram',
    modules: [
      { id: 'telegram', label: 'Telegram botları' },
      { id: 'push', label: 'Bildirimler' },
      { id: 'messages', label: 'Site içi mesajlar' },
    ],
  },
  {
    id: 'tools',
    label: 'Araçlar',
    modules: [{ id: 'studio', label: 'Stüdyo' }],
  },
] as const

export type PanelModule = (typeof PANEL_GROUPS)[number]['modules'][number]['id']

export const PANEL_MODULES: { id: PanelModule; label: string; group: string }[] = PANEL_GROUPS.flatMap((g) =>
  g.modules.map((m) => ({ id: m.id as PanelModule, label: m.label, group: g.label })),
)

export const MODULE_IDS = new Set<string>(PANEL_MODULES.map((m) => m.id))

export function cleanPermissions(input: unknown): PanelModule[] {
  if (!Array.isArray(input)) return []
  return [...new Set(input.map(String).filter((id) => MODULE_IDS.has(id)))] as PanelModule[]
}
