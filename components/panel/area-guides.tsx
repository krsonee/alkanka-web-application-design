import { FeatureGuide, guideCode as code, type GuideStep } from '@/components/panel/feature-guide'

const ol = 'flex list-decimal flex-col gap-1.5 pl-5'

const TASK_STEPS: GuideStep[] = [
  {
    title: 'Yeni görev nasıl eklenir?',
    body: (
      <ol className={ol}>
        <li><b>Yeni görev</b> butonuna bas ya da üstteki <b>Hazır oyun görevleri</b> listesinden birine tıkla; form kendiliğinden dolar.</li>
        <li><b>Görev adı</b> üyenin göreceği başlıktır (ör. “3 Tavla maçı tamamla”). <b>Kısa açıklama</b> altında küçük yazıyla görünür.</li>
        <li><b>Bağlantı</b> doluysa üye görev butonuna basınca o sayfa açılır (ör. <span className={code}>/oyunlar/tavla</span> ya da Telegram kanalı).</li>
        <li><b>Puan</b> görev bitince üyeye yazılan Kanka Puan’dır. <b>Sıra</b> küçükten büyüğe dizilir, 0 en üsttedir.</li>
      </ol>
    ),
  },
  {
    title: 'Otomatik ve onaylı görevler',
    body: (
      <ol className={ol}>
        <li><b>Görev türü</b> “Oyun oyna”, “Oyun kazan”, “Sponsor siteye git”, “Arkadaş davet et” gibi seçilirse site ilerlemeyi kendisi sayar, senin onayına gerek kalmaz.</li>
        <li><b>Serbest</b> türde üye butona basar. <b>Onay beklesin</b> açıksa talep aşağıdaki <b>Bekleyen talepler</b> listesine düşer; onaylayınca puan yazılır, reddedersen yazılmaz.</li>
        <li>Sosyal medya, Telegram ve sponsor hesabı bağlama görevleri, ilgili hesap panelde doğrulanınca tamamlanır.</li>
      </ol>
    ),
  },
  {
    title: 'Tekrar, tarih ve yayından kaldırma',
    body: (
      <ol className={ol}>
        <li><b>Tekrar</b>: Tek seferlik bir kez yapılır. Günlük her gece, haftalık her pazartesi, aylık her ayın 1’inde (Türkiye saati) sıfırlanır.</li>
        <li><b>Başlangıç</b> ve <b>Bitiş</b> boşsa görev hemen başlar ve süresiz kalır. Tarih girersen sadece o aralıkta görünür.</li>
        <li>Görevler silinmez, geçmiş puanlar bozulmasın diye. Yayından kaldırmak için <b>Aktif</b> kutusunu kapat ya da satırdaki <b>Gizle</b> butonunu kullan.</li>
        <li>Görevi tamamlayan üyenin adı sitedeki kazananlar şeridinde görünür.</li>
      </ol>
    ),
  },
]

const LIMIT_STEPS: GuideStep[] = [
  {
    title: 'Gizli kısıtlama ne işe yarar?',
    body: (
      <ol className={ol}>
        <li>Şüpheli, bonus avcısı ya da aşırı kazanan bir üyeyi banlamadan yavaşlatmak için kullanılır.</li>
        <li>Üye kısıtlandığını <b>hiçbir yerde görmez</b>. Sınıra gelince sadece “Şu an yeni oyun açılamıyor, biraz sonra tekrar dene” gibi genel bir mesaj alır.</li>
        <li>Her kısıtlama İşlem Loglarına senin adınla yazılır.</li>
      </ol>
    ),
  },
  {
    title: 'Alanlar ne anlama geliyor?',
    body: (
      <ol className={ol}>
        <li><b>Günlük max net kazanç</b>: Üyenin gün içindeki kazancı (kazandığı eksi yatırdığı) bu sayıya ulaşınca ödemesi bu sayıda kesilir. Kaybetmesine engel olmaz.</li>
        <li><b>Günlük max oyun sayısı</b>: Gün içinde açabileceği oyun/masa sayısı. Dolunca yeni masa açamaz ama oturduğu oyunu bitirebilir.</li>
        <li><b>Günlük max market harcaması</b>: Marketten bir günde harcayabileceği en fazla Kanka Coin.</li>
        <li><b>Marketten hiç alışveriş yapamasın</b>: Market tamamen kapanır, harcama sınırı devre dışı kalır.</li>
        <li>Boş bırakılan alan <b>sınırsız</b> demektir. Sayaçlar her gece 00:00’da (Türkiye saati) sıfırlanır.</li>
      </ol>
    ),
  },
  {
    title: 'Kısıtlamayı kaldırma',
    body: (
      <ol className={ol}>
        <li>Sağdaki listeden üyenin yanındaki çöp kutusuna bas; kısıtlama anında kalkar.</li>
        <li>Kalem ikonuyla sınırları düzenleyebilirsin. <b>Not</b> alanı sadece panelde görünür, neden kısıtladığını yazman sonra işine yarar.</li>
        <li>Hesabı tamamen kapatmak istersen Tüm Üyeler’den <b>Dondur</b> ya da <b>Kalıcı ban</b> kullan; bu sayfa ban değildir.</li>
      </ol>
    ),
  },
]

const MARKET_STEPS: GuideStep[] = [
  {
    title: 'Ürün ve sponsor bonusu ekleme',
    body: (
      <ol className={ol}>
        <li><b>Ürünler</b> sekmesinde <b>Yeni ürün / sponsor bonusu</b> butonuna bas. <b>Tür</b> sponsor bonusuysa bir <b>Sponsor site</b> seç; ürün o sitenin logosuyla görünür.</li>
        <li><b>Fiyat (KC)</b> üyenin ödeyeceği Kanka Coin’dir. <b>Toplam stok</b> başta kaç adet olduğunu, <b>Kalan stok</b> şu an kaç adet kaldığını gösterir. Kalan 0 olunca ürün “tükendi” olur.</li>
        <li><b>Kişi başı limit</b> bir üyenin aynı üründen kaç kez alabileceğidir.</li>
        <li><b>Görsel URL</b> alanına link yapıştır ya da yükle; boşsa varsayılan market görseli çıkar.</li>
      </ol>
    ),
  },
  {
    title: 'Teslimat ve kurallar',
    body: (
      <ol className={ol}>
        <li><b>Teslimat notu</b> üye satın alınca ona gösterilen bilgidir (ör. “24 saat içinde hesabına yüklenir”).</li>
        <li><b>Kurallar</b> alanında her satır ayrı bir madde olur (ör. çevrim şartı, son kullanma).</li>
        <li><b>Kullanıcı adı sor</b> açıksa üye satın alırken sponsor sitedeki kullanıcı adını yazmak zorunda kalır, teslimatı ona göre yaparsın.</li>
        <li><b>Markette göster</b> kapalıysa ürün kayıtlı kalır ama sitede görünmez.</li>
      </ol>
    ),
  },
  {
    title: 'Talepleri onaylama',
    body: (
      <ol className={ol}>
        <li>Üye satın aldığında coin hemen düşer ve talep <b>Talepler</b> sekmesine gelir.</li>
        <li>Teslim ettiysen <b>Onayla</b>; teslim edemiyorsan <b>Reddet</b>. Reddedilen talebin coini üyeye otomatik iade edilir.</li>
      </ol>
    ),
  },
]

const TOURNAMENT_STEPS: GuideStep[] = [
  {
    title: 'Turnuva oluşturma',
    body: (
      <ol className={ol}>
        <li><b>Oyun</b>, <b>ad</b>, <b>başlangıç saati</b>, <b>kontenjan</b> ve <b>giriş ücreti</b> (KC, 0 = ücretsiz) gir. Ödül havuzu giriş ücretlerinden ve senin eklediğin ödülden oluşur.</li>
        <li><b>Format</b>: <b>Eleme</b> usulünde kaybeden çıkar, tur tur final oynanır. <b>Lig</b> usulünde herkes herkesle oynar, puan tablosu çıkar.</li>
        <li>Kaydettiğin turnuva hemen <span className={code}>/turnuvalar</span> sayfasında kayda açılır.</li>
      </ol>
    ),
  },
  {
    title: 'Başlatma ve kazanan seçme',
    body: (
      <ol className={ol}>
        <li>Kayıt dolunca ya da saat gelince <b>Başlat</b> de. Eşleşmeler kura ile çekilir: tavla ve bilardo birebir, okey 4 kişilik masadır.</li>
        <li>Maçlar sitede oynanınca kazanan kendiliğinden ilerler. Bir maç takılırsa kazananı elle seçebilirsin.</li>
        <li>Gelmeyen oyuncuyu başlamadan önce kayıt listesinden çıkarabilirsin. Turnuvayı iptal edersen tüm giriş ücretleri iade edilir.</li>
        <li>Şampiyona ödül ve şampiyon rozeti otomatik verilir, adı kazananlar şeridinde çıkar.</li>
      </ol>
    ),
  },
]

const KP_STEPS: GuideStep[] = [
  {
    title: 'Seviyeler, kurallar ve rozetler',
    body: (
      <ol className={ol}>
        <li><b>Seviyeler</b>: Her seviyenin adı ve ulaşmak için gereken toplam Kanka Puan (KP) değeri. Üye puanı geçince otomatik seviye atlar.</li>
        <li><b>Kurallar</b>: Hangi hareketin kaç KP kazandırdığı (oyun oynama, kazanma, sohbet mesajı, görev, giriş) ve günlük üst sınırı.</li>
        <li><b>Rozetler</b>: Değerli rozetleri üyeye elle verirsin ya da bir yarışmanın ilk sıralarına tek tıkla dağıtırsın.</li>
        <li><b>Puan düzelt</b> ile bir üyenin KP’sini artırıp azaltabilirsin; gerekçe İşlem Loglarına yazılır.</li>
      </ol>
    ),
  },
  {
    title: 'Online kalma ödülleri',
    body: (
      <ol className={ol}>
        <li>Üye sitede <b>kesintisiz</b> açık kaldıkça her basamakta Kanka Coin ve/veya Kanka Puan kazanır (ör. 1. saat 10 KC, 2. saat 50 KP).</li>
        <li><b>Saat</b> basamağın kaçıncı saatte açılacağı, <b>Coin</b> ve <b>KP</b> o basamakta verilen miktardır. Basamak ekleyip silebilirsin.</li>
        <li>Sekme kapanır ya da sitede 5 dakikadan uzun ara verilirse seri sıfırlanır ve saat baştan sayılır. Her basamak bir seride bir kez ödenir.</li>
        <li>Ödül kazanılınca üyeye küçük bir bildirim çıkar.</li>
      </ol>
    ),
  },
  {
    title: 'Kazananlar şeridi',
    body: (
      <ol className={ol}>
        <li>Sitenin üstünde kayan ince şerittir. Görev tamamlayan, rozet alan ve online ödül kazanan üyelerin adları burada akar.</li>
        <li>Hangi tür kazançların görüneceğini kutularla seç. Şeridi tamamen kapatabilirsin.</li>
        <li><b>Duyuru</b> ekleyerek şeride kendi yazını koyabilirsin (ör. “Bu akşam 21:00’de Tavla turnuvası”).</li>
      </ol>
    ),
  },
]

const SEO_STEPS: GuideStep[] = [
  {
    title: 'Arama motoru doğrulama',
    body: (
      <ol className={ol}>
        <li>Google Search Console, Bing ve Yandex sana bir <span className={code}>{'<meta name=… content=…>'}</span> etiketi verir. Etiketin tamamını ya da sadece content değerini ilgili kutuya yapıştır ve kaydet.</li>
        <li>Sonra o servisin panelinde <b>Doğrula</b>’ya bas. Site haritası adresi: <span className={code}>/sitemap.xml</span>.</li>
      </ol>
    ),
  },
  {
    title: 'Rehber yazıları ve fırsat sayfaları',
    body: (
      <ol className={ol}>
        <li>Her rehber yazısı Google’da ayrı bir sayfa olarak çıkar. <b>Başlık</b>a aranan kelimeyi koy (ör. “Deneme bonusu veren siteler 2026”).</li>
        <li><b>Adres</b> boşsa başlıktan üretilir. <b>Özet</b> Google sonucunda başlığın altında görünür, 200 karakteri geçmesin.</li>
        <li>İçerikte <span className={code}>## </span> ile ara başlık, <span className={code}>- </span> ile madde açarsın.</li>
        <li><b>Fırsat sayfaları</b>: Kutu açıksa Telegram botunun paylaştığı her post <span className={code}>/firsatlar</span> altında ayrı sayfa olur, Google siteyi daha sık tarar.</li>
      </ol>
    ),
  },
]

export function TasksGuide() {
  return <FeatureGuide title="Görevler rehberi" subtitle="Görev ekleme, otomatik sayılan görevler, onay, tekrar ve tarih ayarları nasıl çalışır" steps={TASK_STEPS} />
}

export function LimitsGuide() {
  return <FeatureGuide title="Gizli kısıtlamalar rehberi" subtitle="Üyeyi banlamadan sınırlamak: kazanç, oyun ve market sınırları nasıl çalışır" steps={LIMIT_STEPS} />
}

export function MarketGuide() {
  return <FeatureGuide title="Market rehberi" subtitle="Ürün ve sponsor bonusu ekleme, stok, teslimat ve talep onayı nasıl çalışır" steps={MARKET_STEPS} />
}

export function TournamentGuide() {
  return <FeatureGuide title="Turnuva rehberi" subtitle="Turnuva oluşturma, eleme ve lig formatı, başlatma ve kazanan seçme nasıl çalışır" steps={TOURNAMENT_STEPS} />
}

export function KpGuide() {
  return <FeatureGuide title="Kanka Puan rehberi" subtitle="Seviyeler, rozetler, online kalma ödülleri ve kazananlar şeridi nasıl çalışır" steps={KP_STEPS} />
}

export function SeoGuide() {
  return <FeatureGuide title="SEO rehberi" subtitle="Arama motoru doğrulama, rehber yazıları ve fırsat sayfaları nasıl çalışır" steps={SEO_STEPS} />
}
