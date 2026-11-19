export const PANEL_GROUPS = [
  {
    id: 'site',
    label: 'Site',
    modules: [
      { id: 'slide', label: 'Slider', hint: 'Ana sayfadaki kayan bannerlar' },
      { id: 'hero', label: 'Sayfa başlıkları', hint: 'Her sayfanın üst başlığı ve görseli' },
      { id: 'texts', label: 'Site yazıları', hint: 'Site genelindeki yazılar ve yasal metinler' },
      { id: 'branding', label: 'Logo & uygulama ikonu', hint: 'Site logosu ve telefona eklenen uygulama ikonu' },
      { id: 'logo', label: 'Paylaşım & logolar', hint: 'Paylaşım görseli, sponsor ve takım logoları' },
      { id: 'seo', label: 'SEO & Rehber', hint: 'Blog yazıları, fırsatlar ve arama motoru doğrulaması' },
      { id: 'faqs', label: 'SSS', hint: 'Sık sorulan sorular' },
      { id: 'tour', label: 'Site turu', hint: 'Yeni üyeye gösterilen tanıtım turu ve ödülü' },
      { id: 'studio', label: 'Stüdyo', hint: 'Görsel ve marka içeriği üretimi' },
    ],
  },
  {
    id: 'sponsors',
    label: 'Sponsorlar',
    modules: [
      { id: 'sponsors', label: 'Sponsor siteler', hint: 'Sponsor listesi, bonuslar ve yönlendirme linkleri' },
      { id: 'growth', label: 'Sponsor performansı', hint: 'Sponsor bazında tıklama, kayıt, kaynak raporu ve hesap eşleştirme' },
      { id: 'marketing', label: 'Kampanya, reklam & hakediş', hint: 'Kampanya linkleri, reklam alanları, affiliate hakediş ve ölçüm etiketleri' },
    ],
  },
  {
    id: 'members',
    label: 'Üyeler',
    modules: [
      { id: 'users', label: 'Tüm üyeler', hint: 'Üye ara, dondur, banla, coin ekle veya düş' },
      { id: 'community', label: 'Yorum, şikayet & kanıt', hint: 'Yorum onayı, yorum kanıtları ve şikayetler' },
      { id: 'badges', label: 'Rozetler & puan', hint: 'Seviyeler, puan kuralları ve özel rozetler' },
      { id: 'roles', label: 'Görevliler', hint: 'Moderatör ve Sponsor Destek rozetleri' },
      { id: 'tasks', label: 'Görevler', hint: 'Görev tanımları ve onay bekleyen görevler' },
      { id: 'market', label: 'Market', hint: 'Ürünler, avatarlar ve market talepleri' },
      { id: 'social', label: 'Sosyal medya', hint: 'Sosyal hesaplar ve sosyal medya etkinlikleri' },
      { id: 'limits', label: 'Gizli kısıtlamalar', hint: 'Belirli üyelere görünmeyen kısıtlama koy' },
    ],
  },
  {
    id: 'games',
    label: 'Oyunlar',
    modules: [
      { id: 'games', label: 'Oyun ayarları & masalar', hint: 'Masa kuralları, kasa oranı, masa istatistiği, açık masalar, masa doluluğu ve masa temaları' },
      { id: 'rewards', label: 'Mini oyun ödülleri', hint: 'Çark, zar ve sandık ödül oranları' },
      { id: 'catalog', label: 'İçerik takvimi', hint: 'Etkinlik, bilet, tahmin, kampanya ve bonus içerikleri' },
      { id: 'tournaments', label: 'Turnuvalar', hint: 'Turnuva oluştur, kayıtları ve eşleşmeleri yönet' },
      { id: 'cember', label: 'Jako Çemberi', hint: 'Jako Çemberi ayarları' },
    ],
  },
  {
    id: 'comms',
    label: 'İletişim',
    modules: [
      { id: 'push', label: 'Bildirimler', hint: 'Uygulama bildirimi gönder, uygulama ödüllerini ayarla' },
      { id: 'messages', label: 'Site içi mesajlar', hint: 'Üyelerin gelen kutusuna mesaj gönder' },
    ],
  },
  {
    id: 'telegram',
    label: 'Telegram',
    modules: [
      { id: 'tg_posts', label: 'Telegram postları', hint: 'Post hazırlama, gönderme, zamanlama ve DM duyuru' },
      { id: 'tg_mod', label: 'Telegram moderasyon', hint: 'Kayıtlar, üye kartı, şüpheliler, biletler ve temizlik' },
      { id: 'telegram', label: 'Telegram kurulum', hint: 'Botlar, koruma ayarları ve otomasyonlar. Post ve moderasyonu da kapsar' },
    ],
  },
] as const

export type TelegramArea = 'posts' | 'mod' | 'setup'
export type TelegramAccess = Record<TelegramArea, boolean> & { owner: boolean }

/** Modules that share the single "Telegram" entry in the panel menu instead of getting one each. */
export const TELEGRAM_MODULES: readonly string[] = ['telegram', 'tg_posts', 'tg_mod']

/**
 * Setup can add bot tokens and change every rule, so it already covers posting and moderation.
 * Accounts that held the single Telegram permission before it was split keep everything they had.
 */
export function telegramAccess(session: { isOwner: boolean; permissions: readonly string[] } | null): TelegramAccess {
  const has = (id: string) => Boolean(session?.permissions.includes(id))
  const setup = Boolean(session?.isOwner) || has('telegram')
  return { setup, posts: setup || has('tg_posts'), mod: setup || has('tg_mod'), owner: Boolean(session?.isOwner) }
}

/** Moderation is a combined queue; anyone who may open one of these modules sees it. */
export const MODERATION_SOURCES = ['community', 'tasks', 'market'] as const

export type PanelModule = (typeof PANEL_GROUPS)[number]['modules'][number]['id']

export const PANEL_MODULES: { id: PanelModule; label: string; group: string }[] = PANEL_GROUPS.flatMap((g) =>
  g.modules.map((m) => ({ id: m.id as PanelModule, label: m.label, group: g.label })),
)

export const MODULE_IDS = new Set<string>(PANEL_MODULES.map((m) => m.id))

type Can = (module: PanelModule) => boolean

/**
 * Screens with their own menu row that open with another module's permission, so pulling them out
 * of a crowded section adds no new permission to hand out. `was` is the tab they used to be.
 */
export const PANEL_VIEWS = [
  { id: 'home', group: 'site', after: 'hero', needs: 'logo', was: 'home-v2', label: 'Ana sayfa & Masa aç', hint: 'Ana sayfa düzeni, misafir ve üye bölümleri, masa açma sihirbazı' },
  { id: 'withdrawals', group: 'members', after: 'community', needs: 'community', was: 'cekim', label: 'Çekim paylaşımları', hint: 'Üyelerin çekim paylaşımları, ödülleri ve kuralları' },
  { id: 'referral', group: 'members', after: 'tasks', needs: 'growth', was: 'referral', label: 'Davet sistemi', hint: 'Arkadaşını getiren üyenin ödülü, davet kuralları ve sınırları' },
] as const satisfies readonly { id: string; group: string; after: PanelModule; needs: PanelModule; was: string; label: string; hint: string }[]

export type PanelView = (typeof PANEL_VIEWS)[number]['id']

/** The permission that opens a menu row: its own for a module, the borrowed one for a view. */
export function rowPermission(id: PanelModule | PanelView): PanelModule {
  return PANEL_VIEWS.find((v) => v.id === id)?.needs ?? (id as PanelModule)
}

/**
 * Tabs that moved to the section they belong to. Each keeps its old permission: it shows at the new
 * home for accounts that can open that section too and stays where it was for the rest, so the move
 * neither grants nor takes away access.
 */
export const MOVED_TABS = {
  ads: { needs: 'logo', home: 'marketing' },
  ambient: { needs: 'growth', home: 'games' },
  themes: { needs: 'market', home: 'games' },
  league: { needs: 'community', home: 'catalog' },
} as const satisfies Record<string, { needs: PanelModule; home: PanelModule }>

export type MovedTab = keyof typeof MOVED_TABS

export function tabHome(id: MovedTab, can: Can): PanelModule | null {
  const { needs, home } = MOVED_TABS[id]
  if (!can(needs)) return null
  return can(home) ? home : needs
}

/** Where an address saved before the menu was rearranged leads now; null when it is still right. */
export function movedAddress(b: string | undefined, s: string | undefined, can: Can): { b: string; s?: string } | null {
  const view = PANEL_VIEWS.find((v) => v.needs === b && v.was === s)
  if (view) return can(view.needs) ? { b: view.id } : null
  const id = (Object.keys(MOVED_TABS) as MovedTab[]).find((key) => key === s)
  if (!id || MOVED_TABS[id].needs !== b) return null
  const home = tabHome(id, can)
  return home && home !== b ? { b: home, s: id } : null
}

/** What a permission opens besides its own menu row, shown where permissions are handed out. */
export const PERMISSION_EXTRAS: Partial<Record<PanelModule, string>> = {
  logo: 'Ana sayfa & Masa aç ile Reklam alanlarını da açar.',
  community: 'Çekim paylaşımlarını ve Tahmin ligini de açar.',
  growth: 'Davet sistemini ve Masa doluluğunu da açar.',
  market: 'Masa temalarını da açar.',
}

export function cleanPermissions(input: unknown): PanelModule[] {
  if (!Array.isArray(input)) return []
  return [...new Set(input.map(String).filter((id) => MODULE_IDS.has(id)))] as PanelModule[]
}
