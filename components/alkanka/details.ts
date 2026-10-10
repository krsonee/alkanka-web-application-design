import { Eye, Send, ShieldCheck, UserPlus, type LucideIcon } from 'lucide-react'
import { TELEGRAM_URL, type FaqItem } from './data'

export type InfoRow = { label: string; value: string }
export type PrizeRow = { place: string; reward: string }

export type EventDetail = {
  about: string
  schedule: InfoRow[]
  steps: string[]
  rules: string[]
  prizes: PrizeRow[]
  faq: FaqItem[]
  maxPerUser: number
  ticketed: boolean
}

export const EVENT_DETAILS: Record<string, EventDetail> = {
  e1: {
    about:
      'Her hafta pazar 21:00’de Telegram canlı yayınında yapılan AlkaCoin çekilişi. Aldığın her bilet çekilişe ayrı bir kayıt olarak girer; ne kadar çok bilet, o kadar yüksek şans.',
    schedule: [
      { label: 'Çekiliş', value: 'Pazar 21:00' },
      { label: 'Yayın', value: 'Telegram canlı' },
      { label: 'Bilet fiyatı', value: '50 AC' },
      { label: 'Kişi başı limit', value: '20 bilet' },
    ],
    steps: [
      'AL KANKA hesabına giriş yap. Çekilişe katılmak için hesabının doğrulanmış olması gerekir.',
      'Bilet adedini seç. Kişi başı en fazla 20 bilet alabilirsin.',
      'AlkaCoin ile ödemeyi onayla. Biletlerin anında hesabına tanımlanır ve numaraları profilinde görünür.',
      'Pazar 21:00’deki canlı çekilişi Telegram kanalından takip et. Kazananlar yayında ve kanalda duyurulur.',
    ],
    rules: [
      'Bilet satışı çekilişten 15 dakika önce, pazar 20:45’te kapanır.',
      'Satın alınan biletler iade edilmez ve başka bir hesaba devredilemez.',
      'Her bilet tek bir ödül kazanabilir; aynı kullanıcı farklı biletlerle birden fazla ödül alabilir.',
      'Kazananlar rastgele sayı üreticisiyle seçilir; çekiliş kaydı yayından sonra kanalda paylaşılır.',
      'Ödüller çekilişten sonraki 24 saat içinde AlkaCoin bakiyene otomatik eklenir.',
      'Birden fazla hesap açtığı tespit edilen kullanıcıların tüm biletleri iptal edilir.',
      'AlkaCoin nakde çevrilemez; ödüller yalnızca puan marketinde kullanılabilir.',
    ],
    prizes: [
      { place: '1.', reward: '50.000 AC' },
      { place: '2.', reward: '30.000 AC' },
      { place: '3.', reward: '20.000 AC' },
      { place: '4. – 10.', reward: '7.500 AC' },
      { place: '11. – 50.', reward: '2.000 AC' },
      { place: '51. – 100.', reward: '350 AC' },
    ],
    faq: [
      { q: 'Çekilişe kaç kişi katılabilir?', a: 'Katılımcı sınırı yok. Ödül havuzu toplam bilet sayısından bağımsız olarak 250.000 AC sabittir.' },
      { q: 'Yayını kaçırırsam ödülümü alabilir miyim?', a: 'Evet. Yayını izlemen gerekmez, ödüller otomatik olarak hesabına eklenir.' },
      { q: 'Biletlerimi nereden görürüm?', a: 'Satın aldığın biletler bu sayfada ve profilindeki Biletlerim bölümünde listelenir.' },
    ],
    maxPerUser: 20,
    ticketed: true,
  },
  e2: {
    about:
      'Günlük zar turnuvası. Gün içinde 10 zar atışı yaparsın; en yüksek toplamı yapan 100 kişi ödül alır. Katılım ücretsiz.',
    schedule: [
      { label: 'Başlangıç', value: 'Her gün 00:00' },
      { label: 'Bitiş', value: 'Her gün 23:59' },
      { label: 'Atış hakkı', value: '10 atış' },
      { label: 'Katılım', value: 'Ücretsiz' },
    ],
    steps: [
      'Ücretsiz katıl butonuna bas, turnuva kaydın açılsın.',
      'Oyunlar bölümündeki zar oyununda 10 atış hakkını kullan.',
      '10 atışının toplamı canlı olarak sıralamaya yazılır.',
      'Gün sonunda ilk 100’e girersen ödülün otomatik olarak eklenir.',
    ],
    rules: [
      'Her kullanıcı günde bir kez turnuvaya kaydolabilir.',
      'Turnuva atışları normal zar haklarından ayrıdır; marketten alınan ekstra zar hakları turnuvada geçersizdir.',
      'Eşit puan durumunda toplama önce ulaşan kullanıcı üstte yer alır.',
      'Sıralama 23:59’da kesinleşir, ödüller 00:15’e kadar dağıtılır.',
      'Otomasyon veya bot kullanımı tespit edilirse kullanıcı turnuvadan diskalifiye edilir.',
    ],
    prizes: [
      { place: '1. – 3.', reward: '500 AC + Altın Kanka Rozeti' },
      { place: '4. – 100.', reward: '500 AC' },
    ],
    faq: [
      { q: 'Turnuvaya geç katılırsam ne olur?', a: 'Gün bitmeden katıldığın sürece 10 atış hakkının tamamını kullanabilirsin.' },
      { q: 'Zar sonucu nasıl belirleniyor?', a: 'Her atış bağımsız ve rastgeledir. Önceki atışlar sonraki sonucu etkilemez.' },
    ],
    maxPerUser: 1,
    ticketed: false,
  },
  e3: {
    about:
      'Ay boyunca en çok çark çeviren kullanıcılar ödül havuzunu paylaşır. Her çevirme maraton puanına 1 puan, VIP Geçiş çıkan çevirmeler 5 puan ekler.',
    schedule: [
      { label: 'Başlangıç', value: 'Ayın 1’i 00:00' },
      { label: 'Bitiş', value: 'Ayın son günü 23:59' },
      { label: 'Katılım', value: '100 AC' },
      { label: 'Ödüllü kişi', value: '300 kişi' },
    ],
    steps: [
      '100 AC ile maratona kaydol.',
      'Ay boyunca çarkı çevir; ücretsiz ve ekstra hakların hepsi sayılır.',
      'Maraton puanın sıralamada canlı olarak güncellenir.',
      'Ay sonunda ilk 300’e girersen ödülün hesabına eklenir.',
    ],
    rules: [
      'Katılım ücreti tek seferliktir ve ay sonuna kadar geçerlidir.',
      'Kayıttan önce yapılan çevirmeler maraton puanına sayılmaz.',
      'Günde en fazla 30 çevirme maraton puanına eklenir.',
      'Marketten alınan ekstra çark hakları maratonda geçerlidir.',
      'Ödüller ay bitiminden sonraki ilk 48 saat içinde dağıtılır.',
    ],
    prizes: [
      { place: '1.', reward: '25.000 AC + 30 gün VIP' },
      { place: '2. – 10.', reward: '5.000 AC' },
      { place: '11. – 50.', reward: '1.500 AC' },
      { place: '51. – 300.', reward: '500 AC' },
    ],
    faq: [
      { q: 'Ay ortasında katılabilir miyim?', a: 'Evet, ama yalnızca kayıttan sonraki çevirmeler puana sayılır.' },
      { q: 'Maraton puanımı nereden görürüm?', a: 'Sıralama sayfasında Çark Maratonu sekmesinde canlı olarak görünür.' },
    ],
    maxPerUser: 1,
    ticketed: false,
  },
}

export type TaskKind = 'link' | 'visit' | 'invite' | 'verify'

export type TaskItem = {
  id: string
  slug: string
  icon: LucideIcon
  title: string
  detail: string
  reward: number
  kind: TaskKind
  href?: string
  frequency: 'Tek seferlik' | 'Günlük' | 'Haftalık'
  duration: string
  about: string
  steps: string[]
  rules: string[]
}

export const VISIT_TARGET = 3
export const REFERRAL_LINK = 'https://alkanka.com/r/kanka-4821'

export const TASKS: TaskItem[] = [
  {
    id: 'tg',
    slug: 'telegram-katil',
    icon: Send,
    title: 'Telegram kanalına katıl',
    detail: '@AlkankaOfficial',
    reward: 150,
    kind: 'link',
    href: TELEGRAM_URL,
    frequency: 'Tek seferlik',
    duration: '1 dk',
    about:
      'Promo kodlar, anlık drop’lar ve çekiliş yayınları önce Telegram kanalımıza düşer. Kanala katıl, tek seferlik 150 AC kazan.',
    steps: [
      'Kanala katıl butonuna bas; Telegram açılır.',
      '@AlkankaOfficial kanalında Katıl’a dokun.',
      'AL KANKA sayfasına geri dön; ödülün otomatik eklenir.',
    ],
    rules: [
      'Ödül hesap başına bir kez verilir.',
      'Kanaldan 7 gün içinde ayrılırsan ödül bakiyenden geri düşülür.',
      'Telegram hesabın AL KANKA hesabına bağlı olmalıdır.',
    ],
  },
  {
    id: 'visit',
    slug: 'partner-ziyaret',
    icon: Eye,
    title: '3 partner siteyi ziyaret et',
    detail: 'Günlük görev',
    reward: 90,
    kind: 'visit',
    frequency: 'Günlük',
    duration: '3 dk',
    about:
      'Her gün listedeki partner sitelerden 3’ünü ziyaret et, günlük 90 AC kazan. Ziyaretler yalnızca AL KANKA linkiyle yapıldığında sayılır.',
    steps: [
      'Listeden bir partner site seç ve Ziyaret et’e bas.',
      'Açılan sayfada en az 30 saniye kal.',
      '3 ziyareti tamamlayınca Ödülü al butonu aktif olur.',
    ],
    rules: [
      'Görev her gün 00:00’da sıfırlanır.',
      'Aynı site gün içinde yalnızca bir kez sayılır.',
      'Reklam engelleyici açıksa ziyaret doğrulanmayabilir.',
      'VPN veya otomatik tıklama ile yapılan ziyaretler geçersizdir.',
    ],
  },
  {
    id: 'invite',
    slug: 'arkadas-davet',
    icon: UserPlus,
    title: 'Bir arkadaşını davet et',
    detail: 'Davet linkini paylaş',
    reward: 250,
    kind: 'invite',
    frequency: 'Haftalık',
    duration: '2 dk',
    about:
      'Davet linkini paylaş. Arkadaşın kayıt olup hesabını doğruladığında sen 250 AC, o da 100 AC hoş geldin bonusu kazanır.',
    steps: [
      'Davet linkini kopyala.',
      'Linki Telegram, WhatsApp veya dilediğin yerde paylaş.',
      'Arkadaşın linkle kayıt olup hesabını doğrulasın.',
      'Doğrulama tamamlanınca ödülün hesabına eklenir.',
    ],
    rules: [
      'Haftada en fazla 10 davet ödüllendirilir.',
      'Davet edilen kişi 18 yaşından büyük ve yeni bir kullanıcı olmalıdır.',
      'Kendi ikinci hesabını davet etmek tüm davet ödüllerinin iptal edilmesine neden olur.',
      'Ödül, arkadaşın doğrulamayı 14 gün içinde tamamlarsa verilir.',
    ],
  },
  {
    id: 'verify',
    slug: 'hesap-dogrula',
    icon: ShieldCheck,
    title: 'Hesabını doğrula',
    detail: 'Mavi tik al, turnuvalara katıl',
    reward: 200,
    kind: 'verify',
    frequency: 'Tek seferlik',
    duration: '3 dk',
    about:
      'Doğrulanmış hesaplar bilet çekilişlerine ve turnuvalara katılabilir, marketteki VIP ürünleri alabilir. Doğrulamadan sonra profilinde mavi tik görünür.',
    steps: [
      'Telefon numaranı gir ve SMS kodunu onayla.',
      'Doğum tarihini gir (18 yaş ve üzeri).',
      'Telegram hesabını bağla.',
    ],
    rules: [
      'Bir telefon numarası yalnızca bir hesapta kullanılabilir.',
      'Bilgilerin üçüncü taraflarla paylaşılmaz.',
      'Yanlış bilgi verildiği tespit edilirse hesap askıya alınır.',
    ],
  },
]

export type MarketDetail = { about: string; usage: string[]; delivery: string; validity: string }

export const MARKET_DETAILS: Record<string, MarketDetail> = {
  m1: {
    about: 'Profilinde ve sıralamada adının yanında görünen altın rozet. Topluluğun en aktif kankalarını gösterir.',
    usage: ['Rozet satın alındığı anda profiline eklenir.', 'Profil ayarlarından göstermeyi veya gizlemeyi seçebilirsin.'],
    delivery: 'Anında',
    validity: 'Süresiz',
  },
  m2: {
    about: '+3 ekstra çark hakkı. Ücretsiz 6 saatlik hakkını beklemeden çarkı çevir.',
    usage: ['Haklar oyunlar bölümündeki çarka otomatik tanımlanır.', 'Önce ücretsiz hakkın, sonra ekstra hakların kullanılır.'],
    delivery: 'Anında',
    validity: '30 gün',
  },
  m3: {
    about: '+5 ekstra zar hakkı. Normal zar oyununda kullanılır.',
    usage: ['Haklar zar oyununa otomatik tanımlanır.', 'Günlük zar turnuvasında geçersizdir.'],
    delivery: 'Anında',
    validity: '30 gün',
  },
  m4: {
    about: 'Bir günü kaçırdığında giriş serinin sıfırlanmasını engeller. 7 gün boyunca aktif kalır.',
    usage: [
      'Kalkan satın alındığı anda aktifleşir.',
      'Kaçırılan gün otomatik olarak korunur; elle bir şey yapman gerekmez.',
      'Aynı anda yalnızca bir kalkan aktif olabilir.',
    ],
    delivery: 'Anında',
    validity: '7 gün',
  },
  m5: {
    about: 'Yalnızca davetle girilen VIP Telegram kanalı: erken kodlar, özel oranlar ve VIP çekilişler.',
    usage: [
      'Satın aldıktan sonra Telegram hesabına özel davet linki gönderilir.',
      'Referans özel: en az 1 doğrulanmış davetin olmalıdır.',
    ],
    delivery: 'Telegram, 10 dk içinde',
    validity: '30 gün',
  },
  m6: {
    about: 'İçinden rastgele rozet, ekstra hak veya 500 – 5.000 AC arası bakiye çıkan sürpriz kutu.',
    usage: ['Kutu profilindeki envanterde açılır.', 'İçerik oranları kutu açılış ekranında listelenir.'],
    delivery: 'Anında',
    validity: 'Süresiz',
  },
  m7: {
    about: '5 adet haftalık bilet çekilişi bileti. Tek tek almaktan 250 AC daha avantajlı.',
    usage: ['Biletler bir sonraki pazar çekilişine tanımlanır.', 'Kişi başı 20 bilet limitine dahildir.'],
    delivery: 'Anında',
    validity: 'Sonraki çekiliş',
  },
  m8: {
    about: 'Profil fotoğrafının etrafında görünen altın-siyah özel çerçeve.',
    usage: ['Profil ayarlarından aktif edilir.', 'Başka çerçevelerle değiştirilebilir.'],
    delivery: 'Anında',
    validity: 'Süresiz',
  },
}

export const MARKET_RULES = [
  'Satın alınan ürünler iade edilmez ve AlkaCoin’e geri çevrilmez.',
  'Kişi başı satın alma limiti her ürünün sayfasında yazar.',
  'Stok tükendiğinde yeni stok Telegram kanalında duyurulur.',
  'Market ürünleri nakde çevrilemez ve başka hesaba devredilemez.',
]
