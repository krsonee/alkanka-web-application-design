'use server'

import { getPanelSession } from '@/lib/admin-auth'
import { rows, sql } from '@/lib/db'
import { listMembers } from '@/lib/members-admin'
import { listSites } from '@/lib/sites'
import { listPosts } from '@/lib/blog'
import { rowPermission, tabHome, type MovedTab, type PanelModule, type PanelView } from '@/lib/panel-modules'
import { STATUS_LABEL } from '@/lib/tournaments-shared'

export type SearchKind = 'setting' | 'member' | 'sponsor' | 'post' | 'task' | 'product' | 'tournament' | 'faq'

export type SearchHit = {
  kind: SearchKind
  id: string
  title: string
  detail: string
  /** Menu row the hit opens. */
  tab: string
  href: string
}

const LIMIT = 5
const SETTING_LIMIT = 6

type Row = PanelModule | PanelView | 'account' | 'audit' | 'staff'

/**
 * Screens and settings that sit inside a section, so the menu filter alone cannot find them.
 * `words` are what people type when they look for one; a `moved` tab opens wherever this account sees it.
 */
const SETTINGS: ({ title: string; words?: string; query?: string } & ({ row: Row } | { moved: MovedTab }))[] = [
  { title: 'Yasal metinler', words: 'kvkk gizlilik kullanım şartları çerez sözleşme', row: 'texts', query: 's=legal' },
  { title: 'Paylaşım görseli', words: 'whatsapp önizleme og sosyal kart', row: 'logo', query: 's=share' },
  { title: 'Sponsor logoları', row: 'logo', query: 's=sponsor-logos' },
  { title: 'Takım logoları', words: 'maç tahmin özel oran', row: 'logo', query: 's=team-logos' },
  { title: 'Reklam alanları', words: 'banner sponsor reklam', query: 's=ads', moved: 'ads' },
  { title: 'Masa açma sihirbazı', words: 'masa aç oyun kurulum', row: 'home' },
  { title: 'Günlük kutular', words: 'ana sayfa kısayol', row: 'home' },
  { title: 'Yönlendirmeler', words: 'redirect 301 eski adres', row: 'seo' },
  { title: '404 kayıtları', words: 'bulunamayan sayfa kırık link', row: 'seo' },
  { title: 'Arama motoru doğrulaması', words: 'google bing yandex search console', row: 'seo' },
  { title: 'Stüdyo aylık tavanı', words: 'harcama bütçe limit', row: 'studio' },
  { title: 'Stüdyo görselini slider\'a ekle', words: 'banner slayt gönder aktar', row: 'studio' },
  { title: 'Slayt telefon görseli', words: 'mobil dikey görsel slider telefon', row: 'slide' },
  { title: 'Rehber yazısını ileri tarihe zamanla', words: 'yayın zamanı tarih saat zamanla blog yazı', row: 'seo' },
  { title: 'Turnuva şablonları', words: 'şablon kalıp tekrar aç haftalık kupa', row: 'tournaments' },
  { title: 'Turnuva sıralama ödülleri', words: 'sıralama ödülü ikinci üçüncü ödül havuzu kontenjan kişi sayısı kazanan sıra ekle kazanan sayısı', row: 'tournaments' },
  { title: 'Turnuva bitiş saati ve maça giriş süresi', words: 'bitiş saati süre hükmen gelmeyen oyuncu maça giriş dakika otomatik başlat hamle süresi pes', row: 'tournaments' },
  { title: 'Turnuva maç uzunluğu (tavla, okey)', words: 'maç uzunluğu tek el 3 puanlık 5 puanlık mars puandan düşüş puanlı okey kaç el', row: 'tournaments' },
  { title: 'Turnuva maç listesi ve oyuncu durumu', words: 'maçlar maç listesi açık maç kim geldi masaya girdi hükmen nasıl bitti oyuncu durumu istatistik galibiyet mağlubiyet kazanan seç elle sonuç', row: 'tournaments' },
  { title: 'Turnuva oyunları: birebir ve 4 kişilik ortak masa', words: 'ortak masa 4 kişilik birebir 101 okey batak pişti jakopoly monopoly tur atlama bot masa birincisi', row: 'tournaments' },
  { title: 'İçerik takvimi görünümü', words: 'takvim ay tarih kampanya maç süresi geçen', row: 'catalog', query: 's=calendar' },
  { title: 'Sponsor özeti', words: 'sponsor tıklama yorum şikayet hakediş özet sıralama sürükle', row: 'sponsors' },
  { title: 'Kampanya linkleri', words: 'utm takip linki', row: 'marketing', query: 's=campaigns' },
  { title: 'Affiliate hakediş', words: 'komisyon ödeme vade', row: 'marketing', query: 's=earnings' },
  { title: 'Ölçüm etiketleri', words: 'piksel analytics gtm meta tiktok', row: 'marketing', query: 's=tracking' },
  { title: 'Trafik & hesaplar', words: 'sponsor hesabı eşleştirme tıklama', row: 'growth', query: 's=traffic' },
  { title: 'Davet sistemi', words: 'referans arkadaşını getir davet ödülü', row: 'referral' },
  { title: 'Sponsor anlaşma tarihi ve bedeli', words: 'anlaşma bitiş sözleşme süre aylık bedel ücret kayıt başı maliyet', row: 'sponsors' },
  { title: 'Sponsor linklerini kontrol et', words: 'link kontrol kırık adres açılmıyor sağlık', row: 'sponsors' },
  { title: 'Sponsorları toplu yayına al / çıkar', words: 'toplu gizle göster aç kapat yayın', row: 'sponsors' },
  { title: 'Hakediş hatırlatmaları', words: 'hatırlatma eksik dönem ödenmedi talep', row: 'marketing', query: 's=earnings' },
  { title: 'Masa doluluğu', words: 'doluluk canlı masa görünümü kalabalık', query: 's=ambient', moved: 'ambient' },
  { title: 'Üyelik kapısı', words: 'yeni kayıt kapat aç kayıt olma', row: 'users' },
  { title: 'Toplu üye işlemi', words: 'toplu mesaj hediye dondur çoklu seçim', row: 'users' },
  { title: 'Personel notları', words: 'üye notu not düş', row: 'users' },
  { title: 'Coin dökümü', words: 'coin hareket bakiye geçmiş döküm ekstre nereden geldi nereye gitti', row: 'users' },
  { title: 'Süreli kısıtlama', words: 'geçici kısıt bitiş tarihi süre kendiliğinden kalkar', row: 'limits' },
  { title: 'Görev kopyala / arşivle', words: 'görev kopya çoğalt arşiv eski görev kaldır', row: 'tasks' },
  { title: 'Market stok uyarıları', words: 'stok azaldı bitti tükendi uyarı', row: 'market', query: 's=products&v=urunler' },
  { title: 'Hazır cevaplar', words: 'hazır cevap red sebebi kalıp yorum şikayet', row: 'community', query: 's=reviews' },
  { title: 'Mini oyun beklenen günlük çıkış', words: 'beklenen coin çıkış tahmin günlük maliyet çark zar sandık', row: 'rewards' },
  { title: 'Personelin 2FA kaydını yenilet', words: '2fa yenile yeni barkod yeni yedek kod personel', row: 'staff' },
  { title: 'Yorum onayı', row: 'community', query: 's=reviews' },
  { title: 'Kanıt & karne', words: 'ekran görüntüsü kanıtlı yorum', row: 'community', query: 's=kanit' },
  { title: 'Şikâyetler', words: 'şikayet', row: 'community', query: 's=complaints' },
  { title: 'Skor tahmin ligi', words: 'tahmin ligi maç skor katılımcı tahmin yapanlar', query: 's=league', moved: 'league' },
  { title: 'Çekim ödülleri', words: 'çekim paylaşımı coin puan', row: 'withdrawals', query: 'v=rewards' },
  { title: 'Çekim kuralları ve engeller', words: 'sahte paylaşım engel', row: 'withdrawals', query: 'v=rules' },
  { title: 'Seviyeler', words: 'kanka puan kp seviye', row: 'badges', query: 's=levels' },
  { title: 'Puan kuralları', words: 'kanka puan kp', row: 'badges', query: 's=rules' },
  { title: 'Değerli rozetler', words: 'özel rozet', row: 'badges', query: 's=badges' },
  { title: 'Rozet ver', row: 'badges', query: 's=award' },
  { title: 'Haftalık görev', row: 'badges', query: 's=quest' },
  { title: 'KP sıralaması', words: 'liderlik tablosu', row: 'badges', query: 's=board' },
  { title: 'Online ödülleri', words: 'çevrim içi süre ödülü', row: 'badges', query: 's=online' },
  { title: 'Kazananlar şeridi', words: 'kayan yazı ticker', row: 'badges', query: 's=ticker' },
  { title: 'Market ürünleri', words: 'ürün ekle stok fiyat', row: 'market', query: 's=products&v=urunler' },
  { title: 'Market talepleri', words: 'sipariş teslim', row: 'market', query: 's=products&v=talepler' },
  { title: 'Avatarlar & kapaklar', words: 'profil resmi kapak', row: 'market', query: 's=avatars' },
  { title: 'Masa temaları', words: 'tema fiyatı masa görünümü', query: 's=themes', moved: 'themes' },
  { title: 'Kasa oranı', words: 'kazanma oranı bot zorluğu', row: 'games' },
  { title: 'Açık masalar', words: 'takılı masa kapat bahis iade', row: 'games' },
  { title: 'Etkinlikler', words: 'bilet etkinlik sıralaması otomatik ödül çekiliş başlangıç bitiş tarihi sonuçlandır katılımcı', row: 'catalog', query: 's=events' },
  { title: 'Tahminler', words: 'seçenekli tahmin katılımcı tahmin yapanlar', row: 'catalog', query: 's=predictions' },
  { title: 'Kampanyalar', row: 'catalog', query: 's=campaigns' },
  { title: 'Bonuslar', row: 'catalog', query: 's=bonuses' },
  { title: 'Mobil uygulama kullanımı', words: 'uygulama yükleyen bildirim açan', row: 'push', query: 's=mobile' },
  { title: 'Uygulama ödülleri', words: 'uygulama yükleme ödülü', row: 'push', query: 's=app-rewards' },
  { title: 'Zamanlanmış bildirimler', words: 'ileri tarih zamanla deneme gönderimi önce bana gönder', row: 'push', query: 's=send' },
  { title: 'Zamanlanmış mesajlar', words: 'ileri tarih zamanla okunma oranı', row: 'messages' },
  { title: 'Mesaj şablonları', words: 'hazır şablon', row: 'messages' },
  { title: 'Ayar geçmişi', words: 'geri al eski hali', row: 'audit', query: 's=history' },
  { title: 'Şifre değiştir', words: 'parola', row: 'account' },
  { title: 'İki adımlı doğrulama', words: '2fa yedek kodlar authenticator', row: 'account' },
]

const lower = (text: string) => text.toLocaleLowerCase('tr')

async function small<T extends Record<string, unknown>>(query: ReturnType<typeof sql>): Promise<T[]> {
  try {
    return await rows<T>(query)
  } catch {
    // The table is created the first time its section is opened.
    return []
  }
}

export async function panelSearchAction(raw: string): Promise<SearchHit[]> {
  const q = raw.trim().slice(0, 80)
  if (q.length < 2) return []
  const session = await getPanelSession()
  if (!session) return []
  const needle = lower(q)
  const has = (text: string) => lower(text).includes(needle)
  const can = (m: PanelModule) => session.isOwner || session.permissions.includes(m)
  const opens = (row: Row) => (row === 'account' ? true : row === 'audit' || row === 'staff' ? session.isOwner : can(rowPermission(row)))

  const hits: SearchHit[] = []
  for (const s of SETTINGS) {
    if (hits.length >= SETTING_LIMIT) break
    if (!has(`${s.title} ${s.words ?? ''}`)) continue
    const row = 'moved' in s ? tabHome(s.moved, can) : opens(s.row) ? s.row : null
    if (!row) continue
    hits.push({ kind: 'setting', id: s.title, title: s.title, detail: '', tab: row, href: `/panel?b=${row}${s.query ? `&${s.query}` : ''}` })
  }

  const [members, sites, posts, tasks, products, tournaments, faqs] = await Promise.all([
    can('users') ? listMembers({ q, status: 'tumu', page: 0 }).then((r) => r.members).catch(() => []) : [],
    can('sponsors') ? listSites().catch(() => []) : [],
    can('seo') ? listPosts({ includeDrafts: true }) : [],
    // Read straight from the tables: the list helpers behind these screens also seed defaults and start due tournaments.
    can('tasks') ? small<{ id: number; title: string; active: boolean }>(sql`SELECT id, title, active FROM tasks ORDER BY sort, id`) : [],
    can('market') ? small<{ id: string; name: string; price: number; active: boolean }>(sql`SELECT id, name, price, active FROM market_items ORDER BY sort, created_at`) : [],
    can('tournaments') ? small<{ id: number; title: string; status: keyof typeof STATUS_LABEL }>(sql`SELECT id, title, status FROM tournaments ORDER BY starts_at DESC`) : [],
    can('faqs') ? small<{ id: number; question: string; category: string; active: boolean }>(sql`SELECT id, question, category, active FROM faqs ORDER BY sort_order, id`) : [],
  ])

  for (const m of members.slice(0, LIMIT)) {
    hits.push({ kind: 'member', id: m.id, title: m.name || m.email, detail: m.email, tab: 'users', href: `/panel?b=users&q=${encodeURIComponent(m.email || m.name)}` })
  }
  for (const s of sites.filter((s) => has(`${s.name} ${s.domain}`)).slice(0, LIMIT)) {
    hits.push({ kind: 'sponsor', id: String(s.id), title: s.name, detail: s.domain || s.bonusText, tab: 'sponsors', href: `/panel?b=sponsors&f=sponsor-${s.id}` })
  }
  for (const p of posts.filter((p) => has(`${p.title} ${p.slug}`)).slice(0, LIMIT)) {
    hits.push({ kind: 'post', id: String(p.id), title: p.title, detail: !p.published ? 'Taslak' : p.scheduled ? 'Zamanlandı' : `/${p.slug}`, tab: 'seo', href: `/panel?b=seo&f=post-${p.id}` })
  }
  for (const t of tasks.filter((t) => has(t.title)).slice(0, LIMIT)) {
    hits.push({ kind: 'task', id: String(t.id), title: t.title, detail: t.active ? 'Yayında' : 'Gizli', tab: 'tasks', href: `/panel?b=tasks&f=task-${t.id}` })
  }
  for (const p of products.filter((p) => has(p.name)).slice(0, LIMIT)) {
    const detail = `${Number(p.price).toLocaleString('tr-TR')} coin${p.active ? '' : ' · Gizli'}`
    hits.push({ kind: 'product', id: String(p.id), title: p.name, detail, tab: 'market', href: `/panel?b=market&s=products&v=urunler&f=product-${p.id}` })
  }
  for (const t of tournaments.filter((t) => has(t.title)).slice(0, LIMIT)) {
    hits.push({ kind: 'tournament', id: String(t.id), title: t.title, detail: STATUS_LABEL[t.status] ?? '', tab: 'tournaments', href: `/panel?b=tournaments&f=tournament-${t.id}` })
  }
  for (const f of faqs.filter((f) => has(f.question)).slice(0, LIMIT)) {
    hits.push({ kind: 'faq', id: String(f.id), title: f.question, detail: `${f.category}${f.active ? '' : ' · Gizli'}`, tab: 'faqs', href: `/panel?b=faqs&f=faq-${f.id}` })
  }
  return hits
}
