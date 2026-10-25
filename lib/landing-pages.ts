export type LandingPage = {
  slug: string
  title: string
  description: string
  kicker: string
  heading: string
  lead: string
  image: string
  playHref: string
  features: { title: string; text: string }[]
  steps: string[]
  faqs: { q: string; a: string }[]
  keywords: string[]
}

const COMMON_FAQ = [
  { q: 'Üyelik ücretli mi?', a: 'Hayır. Üyelik ve oyunlar tamamen ücretsizdir. Oyunlarda gerçek para kullanılmaz, sadece site içi Kanka Coin ile oynanır.' },
  { q: 'Telefondan oynayabilir miyim?', a: 'Evet. Site mobil uyumludur, ayrıca ana ekrana ekleyip uygulama gibi kullanabilirsin.' },
]

export const LANDING_PAGES: LandingPage[] = [
  {
    slug: 'tavla',
    title: 'Online Tavla Oyna - Ücretsiz ve Canlı Rakiplerle',
    description: 'Gerçek rakiplerle ücretsiz online tavla oyna. Turnuvalara katıl, sıralamada yüksel, ödüller kazan. Üyelik 30 saniye.',
    kicker: 'Ücretsiz online tavla',
    heading: 'Tavla masası seni bekliyor',
    lead: 'Gerçek oyuncularla canlı tavla oyna, haftalık turnuvalarda sıralamaya gir ve rozet topla. İndirme yok, kurulum yok.',
    image: '/images/games/tavla.png',
    playHref: '/oyunlar/tavla',
    features: [
      { title: 'Canlı rakipler', text: 'Bilgisayara karşı değil, gerçek oyunculara karşı oynarsın.' },
      { title: 'Haftalık turnuvalar', text: 'Eleme usulü turnuvalarda kupa ve Kanka Coin ödülleri.' },
      { title: 'Sıralama ve rozetler', text: 'Her galibiyet puan kazandırır, en iyiler şampiyonlar listesine girer.' },
    ],
    steps: ['Ücretsiz üye ol', 'Tavla masasına otur', 'Kazan, sıralamada yüksel'],
    faqs: [{ q: 'Tavla kuralları klasik mi?', a: 'Evet, klasik Türk tavlası kurallarıyla oynanır. Kapı, kırma ve mars kuralları geçerlidir.' }, ...COMMON_FAQ],
    keywords: ['online tavla', 'tavla oyna', 'ücretsiz tavla', 'canlı tavla'],
  },
  {
    slug: 'okey',
    title: 'Online Okey Oyna - 101 Okey ve Klasik Okey Ücretsiz',
    description: 'Klasik okey ve 101 okey masalarında gerçek oyuncularla ücretsiz oyna. Turnuvalar, sıralama ve günlük ödüller.',
    kicker: 'Ücretsiz online okey',
    heading: 'Okey ve 101 masaları dolu',
    lead: 'Dört kişilik canlı masalarda okey ya da 101 oyna. Günlük görevleri tamamla, Kanka Coin topla, marketten ödül al.',
    image: '/images/games/okey.png',
    playHref: '/oyunlar/okey101',
    features: [
      { title: 'İki mod', text: 'Klasik okey ve 101 okey aynı yerde, istediğin masayı seç.' },
      { title: 'Hızlı eşleşme', text: 'Masa dolmazsa bekleme yok, oyun hemen başlar.' },
      { title: 'Günlük ödüller', text: 'Her gün giriş yap, görevleri bitir, ekstra Coin kazan.' },
    ],
    steps: ['Ücretsiz üye ol', 'Okey ya da 101 seç', 'Masaya otur ve oyna'],
    faqs: [{ q: '101 okey ile klasik okey arasındaki fark ne?', a: '101 okeyde el açmak için en az 101 puanlık per gerekir ve puanlar tur sonunda toplanır. Klasik okeyde eli ilk bitiren kazanır.' }, ...COMMON_FAQ],
    keywords: ['online okey', '101 okey oyna', 'okey oyna', 'ücretsiz okey'],
  },
  {
    slug: 'bilardo',
    title: 'Online Bilardo Oyna - Ücretsiz 8 Top Bilardo',
    description: 'Tarayıcıdan ücretsiz online bilardo oyna. Gerçek rakiplerle 8 top maçları, turnuvalar ve sıralama.',
    kicker: 'Ücretsiz online bilardo',
    heading: 'Istakanı al, masa hazır',
    lead: 'Gerçekçi fizikle 8 top bilardo oyna. Arkadaşına meydan oku ya da turnuvaya katılıp ödül havuzunu kap.',
    image: '/images/games/bilardo.png',
    playHref: '/oyunlar/bilardo',
    features: [
      { title: 'Gerçekçi fizik', text: 'Falso, güç ve açı tam kontrolünde.' },
      { title: 'Rakibine meydan oku', text: 'Arkadaşını davet et, bire bir maç yap.' },
      { title: 'Turnuva ödülleri', text: 'Her hafta bilardo turnuvasında Kanka Coin ödülü.' },
    ],
    steps: ['Ücretsiz üye ol', 'Bilardo masasını aç', 'Topları sırayla deliğe gönder'],
    faqs: [{ q: 'Bilardo için uygulama indirmem gerekir mi?', a: 'Hayır. Bilardo doğrudan tarayıcıda çalışır, telefonda da bilgisayarda da oynanır.' }, ...COMMON_FAQ],
    keywords: ['online bilardo', 'bilardo oyna', '8 top bilardo', 'ücretsiz bilardo'],
  },
  {
    slug: 'turnuva',
    title: 'Ödüllü Online Turnuvalar - Tavla, Okey ve Bilardo',
    description: 'Tavla, okey ve bilardo turnuvalarına ücretsiz katıl. Eleme usulü maçlar, kupa ve Kanka Coin ödülleri.',
    kicker: 'Ödüllü turnuvalar',
    heading: 'Her hafta yeni turnuva, yeni şampiyon',
    lead: 'Ücretsiz kayıt ol, turnuva tablosuna yerini al ve rakiplerini tek tek ele. Final kazananı şampiyonlar listesine yazılır.',
    image: '/images/heroes/turnuvalar.png',
    playHref: '/turnuvalar',
    features: [
      { title: 'Ücretsiz katılım', text: 'Turnuvaya girmek için ödeme yok.' },
      { title: 'Eleme tablosu', text: 'Canlı takip edilen tablo, her tur yeni rakip.' },
      { title: 'Şampiyonlar duvarı', text: 'Kazananlar sitede kalıcı olarak listelenir.' },
    ],
    steps: ['Ücretsiz üye ol', 'Açık turnuvaya kaydol', 'Maç saatinde masaya otur'],
    faqs: [{ q: 'Turnuvalar ne zaman başlıyor?', a: 'Takvim turnuvalar sayfasında yayınlanır. Kayıt olduğun turnuva başlamadan önce bildirim gelir.' }, ...COMMON_FAQ],
    keywords: ['online turnuva', 'tavla turnuvası', 'okey turnuvası', 'ödüllü turnuva'],
  },
  {
    slug: 'kankatv',
    title: 'KankaTV - Canlı Yayınlar ve İzle Kazan',
    description: 'KankaTV canlı yayınlarını izle, sohbete katıl ve izledikçe Kanka Coin kazan. Ücretsiz üyelikle hemen başla.',
    kicker: 'Canlı yayın',
    heading: 'İzle, sohbet et, kazan',
    lead: 'Topluluğun canlı yayınlarını izle, yayın içi etkinliklere katıl ve izleme süren boyunca Kanka Coin topla.',
    image: '/images/heroes/kankatv.png',
    playHref: '/kankatv',
    features: [
      { title: 'Canlı sohbet', text: 'Yayıncıyla ve toplulukla anlık konuş.' },
      { title: 'İzle kazan', text: 'Yayında geçirdiğin her dakika Coin kazandırır.' },
      { title: 'Yayın etkinlikleri', text: 'Anket, çekiliş ve mini oyunlar yayın sırasında.' },
    ],
    steps: ['Ücretsiz üye ol', 'Canlı yayını aç', 'İzledikçe Coin topla'],
    faqs: [{ q: 'Yayınları üye olmadan izleyebilir miyim?', a: 'İzleyebilirsin, ancak sohbet ve Coin kazanmak için ücretsiz üyelik gerekir.' }, ...COMMON_FAQ],
    keywords: ['canlı yayın', 'izle kazan', 'kankatv'],
  },
]

export function getLandingPage(slug: string) {
  return LANDING_PAGES.find((p) => p.slug === slug) ?? null
}
