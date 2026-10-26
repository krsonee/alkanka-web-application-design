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
      { id: 'growth', label: 'Sponsor performansı', hint: 'Sponsor bazında tıklama, kayıt, hesap eşleştirme ve davet sistemi' },
      { id: 'marketing', label: 'Kampanya, reklam & hakediş', hint: 'Kampanya linkleri, reklam alanları, affiliate hakediş ve ölçüm etiketleri' },
    ],
  },
  {
    id: 'members',
    label: 'Üyeler',
    modules: [
      { id: 'users', label: 'Tüm üyeler', hint: 'Üye ara, dondur, banla, coin ekle veya düş' },
      { id: 'community', label: 'Yorum, şikayet & kanıt', hint: 'Yorum onayı, şikayetler, tahmin ligi ve çekim kanıtları' },
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
      { id: 'games', label: 'Oyun ayarları & masalar', hint: 'Masa kuralları, kasa oranı, son 7 günün masa istatistiği ve masa doluluğu' },
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
    modules: [{ id: 'telegram', label: 'Telegram botları', hint: 'Botlar, otomasyonlar ve kanallar' }],
  },
] as const

/** Moderation is a combined queue; anyone who may open one of these modules sees it. */
export const MODERATION_SOURCES = ['community', 'tasks', 'market'] as const

export type PanelModule = (typeof PANEL_GROUPS)[number]['modules'][number]['id']

export const PANEL_MODULES: { id: PanelModule; label: string; group: string }[] = PANEL_GROUPS.flatMap((g) =>
  g.modules.map((m) => ({ id: m.id as PanelModule, label: m.label, group: g.label })),
)

export const MODULE_IDS = new Set<string>(PANEL_MODULES.map((m) => m.id))

export function cleanPermissions(input: unknown): PanelModule[] {
  if (!Array.isArray(input)) return []
  return [...new Set(input.map(String).filter((id) => MODULE_IDS.has(id)))] as PanelModule[]
}
