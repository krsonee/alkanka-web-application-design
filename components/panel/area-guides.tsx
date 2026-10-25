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

const ul = 'flex list-disc flex-col gap-1.5 pl-5'
const note = 'mt-3 rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground'

const SEO_STEPS: GuideStep[] = [
  {
    title: 'SEO nedir, Google nasıl çalışır? (önce bunu oku)',
    body: (
      <>
        <p className="mb-2">SEO, Google’da biri bir şey aradığında senin sayfanın üst sıralarda çıkması için yapılan işlerin hepsidir. Google üç adımda çalışır:</p>
        <ol className={ol}>
          <li><b>Tarama</b>: Google’ın robotu sitendeki linkleri takip ederek sayfaları bulur. <span className={code}>/sitemap.xml</span> ona sayfaların listesini verir, bu kısım hazır.</li>
          <li><b>Dizine ekleme</b>: Robot sayfayı okur ve “bu sayfa ne anlatıyor” diye kaydeder. Sayfa kısa, kopya ya da boşsa kaydetmeyebilir.</li>
          <li><b>Sıralama</b>: Biri arama yaptığında Google, kayıtlı sayfalar arasından en iyi cevabı vereni üste koyar.</li>
        </ol>
        <p className="mt-2">Sıralamayı üç şey belirler:</p>
        <ul className={ul}>
          <li><b>İçerik</b>: Arayanın sorusuna en net ve detaylı cevabı veriyor musun?</li>
          <li><b>Otorite</b>: Başka siteler sana link veriyor mu, marka adın aranıyor mu?</li>
          <li><b>Teknik</b>: Site hızlı mı, mobilde düzgün mü, hatasız mı? Bu kısım sende zaten iyi durumda.</li>
        </ul>
        <p className={note}>Özet: Teknik altyapı hazır. Senin işin düzenli ve kaliteli yazı yazmak ve markayı büyütmek.</p>
      </>
    ),
  },
  {
    title: 'İlk kurulum: Google Search Console (bir kere yapılır)',
    body: (
      <>
        <ol className={ol}>
          <li><span className={code}>search.google.com/search-console</span> adresine Gmail hesabınla gir. <b>Mülk ekle</b> deyip <b>URL ön eki</b>ni seç ve site adresini yaz.</li>
          <li>Doğrulama yöntemi olarak <b>HTML etiketi</b>ni seç. Çıkan <span className={code}>{'<meta …>'}</span> satırını kopyala ve aşağıdaki <b>Search Console</b> kartındaki Google kutusuna yapıştırıp kaydet. Sonra Google’da <b>Doğrula</b>’ya bas.</li>
          <li>Sol menüden <b>Site haritaları</b>na gir, <span className={code}>sitemap.xml</span> yaz ve <b>Gönder</b>’e bas.</li>
          <li>Aynısını isteğe bağlı olarak <b>Bing Webmaster Tools</b> ve <b>Yandex Webmaster</b> için de yap. Bing, Search Console hesabını içe aktarabilir.</li>
        </ol>
        <p className={note}>Yeni bir yazı yayınlayınca Search Console’un en üstündeki arama kutusuna yazının adresini yapıştır ve <b>Dizine eklenmesini iste</b>’ye bas. Google sayfayı birkaç gün yerine birkaç saatte görür.</p>
      </>
    ),
  },
  {
    title: 'Kelime araştırması: insanlar ne arıyor? (ücretsiz)',
    body: (
      <>
        <p className="mb-2">Kimsenin aramadığı bir konuyu yazarsan trafik gelmez. Önce insanların gerçekten neyi aradığını bul:</p>
        <ol className={ol}>
          <li><b>Google otomatik tamamlama</b>: Gizli sekmede Google’a “deneme bonusu” yaz ama Enter’a basma. Altta çıkan önerilerin hepsi gerçek aramalardır, not al. Sonra “deneme bonusu a”, “deneme bonusu b” diye harf ekleyerek devam et.</li>
          <li><b>Kullanıcılar bunları da sordu</b>: Arama sonucunda çıkan soru kutusundaki soruların her biri bir ara başlık ya da SSS sorusu olabilir.</li>
          <li><b>Sayfa sonundaki ilgili aramalar</b>: Sonuç sayfasının en altındaki öneriler de yeni yazı fikirleridir.</li>
          <li><b>Google Trends</b> (<span className={code}>trends.google.com</span>): İki kelimeden hangisinin daha çok arandığını ve hangi aylarda arttığını gösterir.</li>
          <li><b>Search Console</b> (2–3 hafta veri toplandıktan sonra): <b>Performans</b> bölümünde sitene hangi kelimelerden gelindiğini görürsün. En değerli kaynak budur.</li>
        </ol>
        <p className="mt-3 mb-1 font-semibold">Kelimeleri üç gruba ayır:</p>
        <ul className={ul}>
          <li><b>Genel (zor)</b>: “deneme bonusu”. Çok aranır ama ilk sayfa doludur. Şimdilik hedefleme.</li>
          <li><b>Orta</b>: “çevrimsiz deneme bonusu veren siteler”.</li>
          <li><b>Uzun kuyruk (kolay, buradan başla)</b>: “[site adı] bonus çevrim şartı”, “freespin nasıl çevrilir”. Az aranır ama rakip azdır, hızlı sıralanırsın. Çok sayıda küçük kelime toplanınca büyük trafik eder.</li>
        </ul>
        <p className={note}>Bulduğun kelimeleri bir tabloya yaz: kelime, tahmini zorluk, yazıldı mı, yazının adresi. Bu tablo senin içerik takvimin olur.</p>
      </>
    ),
  },
  {
    title: 'İçerik planı: hangi yazıları, hangi sırayla yazmalıyım?',
    body: (
      <>
        <p className="mb-2">Google, bir konuyu her yönüyle anlatan siteyi “uzman” kabul eder. Bu yüzden rastgele yazmak yerine <b>konu kümeleri</b> kur:</p>
        <ol className={ol}>
          <li><b>Ana rehber</b>: Geniş bir konuyu baştan sona anlatan uzun bir yazı (2000+ kelime). Örnek: “Deneme Bonusu Rehberi 2026”.</li>
          <li><b>Destek yazıları</b>: Ana rehberdeki her alt başlığı ayrıntılı anlatan 8–15 kısa yazı. Örnek: “Çevrim şartı nedir?”, “Freespin nasıl kullanılır?”, “Bonus neden iptal edilir?”.</li>
          <li>Her destek yazısı ana rehbere, ana rehber de her destek yazısına link verir. Böylece Google bütün kümeyi birbirine bağlı görür.</li>
        </ol>
        <p className="mt-3 mb-1 font-semibold">Önerilen başlangıç kümeleri:</p>
        <ul className={ul}>
          <li>Bonuslar: deneme bonusu, kayıt bonusu, kayıp bonusu, freespin, çevrim şartları.</li>
          <li>Sponsor incelemeleri: her sponsor için “[Site] inceleme ve bonusları” sayfası (artı/eksi, bonus tablosu, ödeme yöntemleri).</li>
          <li>Oyun rehberleri: tavla, okey ve bilardo kuralları ve taktikleri. Sitende bu oyunlar var, bu alan hem kolay hem güvenli trafik getirir.</li>
          <li>Nasıl yapılır yazıları: “Telegram’dan bonus nasıl takip edilir”, “Kanka Puan nasıl kazanılır”.</li>
        </ul>
        <p className={note}>Hedef: ilk 3 ay haftada 3 yazı. Düzenli yazmak, ayda bir 10 yazı yazmaktan daha iyidir.</p>
      </>
    ),
  },
  {
    title: 'Panelde yazı yazma, adım adım',
    body: (
      <ol className={ol}>
        <li>Aşağıdaki <b>Rehber yazıları</b> kartında <b>Yeni yazı</b>’ya bas.</li>
        <li><b>Anahtar kelimeler</b> kutusuna ilk olarak <b>odak kelimeyi</b> yaz (ör. <span className={code}>çevrim şartı nedir</span>), virgülle yan kelimeleri ekle. Sağdaki <b>SEO puanı</b> bu kelimeye göre çalışır.</li>
        <li><b>Başlık</b>: Odak kelime başta olsun, 30–60 karakter arası kalsın. Örnek: “Çevrim Şartı Nedir? Bonus Çevirme Rehberi 2026”.</li>
        <li><b>Adres</b>: Boş bırakırsan başlıktan üretilir. Kısa olsun ve odak kelimeyi içersin. Yayından sonra değiştirme, değişirse Google’daki sıranı kaybedersin.</li>
        <li><b>Özet</b>: Google’da başlığın altında çıkan 110–160 karakterlik yazı. Odak kelimeyi geçir ve tıklamaya teşvik et.</li>
        <li><b>İçerik</b>: <b>Şablonu ekle</b> ile hazır iskeleti çağır, sonra araç çubuğunu kullan: ara başlık (H2/H3), kalın, link, madde, alıntı ve <b>SSS</b>. SSS bloğu <span className={code}>S: soru</span> ve <span className={code}>C: cevap</span> satırlarından oluşur.</li>
        <li><b>Kapak görseli</b> ekle. Paylaşımda ve Google Görseller’de kullanılır.</li>
        <li><b>Önizleme</b> sekmesinden sitede nasıl görüneceğine bak. Sağdaki kontrol listesinin çoğu yeşil olunca kaydet.</li>
        <li>Yayınladıktan sonra adresi Search Console’da <b>Dizine eklenmesini iste</b> ile gönder.</li>
      </ol>
    ),
  },
  {
    title: 'İyi yazı nasıl yazılır? (Google’ın en çok önem verdiği kısım)',
    body: (
      <>
        <ol className={ol}>
          <li><b>Cevabı en başta ver</b>: İlk 2–3 cümlede sorunun kısa cevabını yaz, sonra detaya gir. Okuyucu aradığını hemen bulursa sayfada kalır.</li>
          <li><b>Kendi tecrübeni kat</b>: “Biz test ettik, 3 sitede denedik, Telegram grubumuzda en çok sorulan şu” gibi bilgiler başka sitelerde yoktur. Google buna <b>deneyim</b> der ve çok önemser.</li>
          <li><b>Somut ol</b>: Tablolar, rakamlar, örnek hesaplar ver. “Çevrim şartı yüksektir” yerine “100 TL bonusa 10x çevrim = 1000 TL oyun” yaz.</li>
          <li><b>Kısa paragraflar</b>: 2–4 cümle. Her 200–300 kelimede bir ara başlık koy. Telefonda okunduğunu düşün.</li>
          <li><b>Güncel tut</b>: Yazıları 2–3 ayda bir kontrol et, eskiyen bilgiyi düzelt ve kaydet. Güncelleme tarihi Google’a yansır.</li>
          <li><b>Güven sinyalleri</b>: +18 ve sorumlu oyun uyarısı ekle, abartılı vaatlerden kaçın (“kesin kazanç” gibi).</li>
        </ol>
        <p className={note}>Yapay zekaya yazdırmak serbest, ama olduğu gibi kopyalayıp yapıştırma. Taslak olarak kullan, üstüne kendi bilgini, örneklerini ve tecrübeni ekle. Google, değer katmayan toplu içeriği cezalandırır.</p>
      </>
    ),
  },
  {
    title: 'Linkler: iç link ve dış link (otorite)',
    body: (
      <>
        <p className="mb-1 font-semibold">İç link (tamamen senin elinde)</p>
        <ul className={ul}>
          <li>Her yazıda sitenin başka sayfalarına en az 2–3 link ver: ilgili rehber yazısı, sponsor sayfası <span className={code}>/siteler/…</span>, oyun sayfası <span className={code}>/oyunlar/…</span>.</li>
          <li>Link yazısı anlamlı olsun: “buraya tıkla” yerine “çevrim şartı rehberimiz”.</li>
          <li>Yeni bir yazı yayınlayınca eski ve ilgili yazılara dönüp ona link ekle.</li>
        </ul>
        <p className="mt-3 mb-1 font-semibold">Dış link (başka sitelerin sana link vermesi)</p>
        <ul className={ul}>
          <li><b>Sponsorlar</b>: Her sponsordan kendi sitesinde “partnerimiz Alkanka” linki iste.</li>
          <li><b>Özgün veri</b>: “Bu ayın en çok kazandıran bonusları” ya da “1000 üyeyle bonus anketi” gibi kimsede olmayan raporlar yayınla. İnsanlar bunlara kendiliğinden link verir.</li>
          <li><b>Sosyal profiller</b>: Telegram, YouTube, X, Instagram ve KankaTV açıklamalarına site linkini koy. Doğrudan sıra kazandırmaz ama Google markayı tanır.</li>
          <li><b>Forumlar</b>: Gerçekten yardımcı cevaplar yaz, uygun olduğunda yazına link ver. Spam yapma.</li>
        </ul>
        <p className={note}>Link satın alma, paravan site ağı (PBN) kurma ve toplu link servisleri Google kurallarına aykırıdır. Yakalanırsa ceza sadece o sitelere değil, alkanka.com’a da gelir. Yavaş ama güvenli yol her zaman daha karlıdır.</p>
      </>
    ),
  },
  {
    title: 'Sonuçları okuma: Search Console’da neye bakacağım?',
    body: (
      <>
        <ol className={ol}>
          <li><b>Performans</b> bölümünde dört sayı görürsün: <b>Tıklama</b> (sitene gelen kişi), <b>Gösterim</b> (Google’da kaç kez göründün), <b>TO</b> (görenlerin yüzde kaçı tıkladı) ve <b>Ortalama konum</b>.</li>
          <li><b>Sorgular</b> sekmesi hangi kelimelerden göründüğünü listeler. Bunu ortalama konuma göre sırala.</li>
          <li><b>Altın fırsat</b>: Konumu 8 ile 20 arasında olan kelimeler. İkinci sayfadasın ve az bir çabayla ilk sayfaya çıkarsın. O yazıyı aç; kelimeyi başlığa ve ara başlığa ekle, içeriği genişlet, SSS ekle, başka yazılardan link ver.</li>
          <li><b>Gösterimi çok ama TO düşük</b> olan sayfa: Google seni gösteriyor ama kimse tıklamıyor. Başlığı ve özeti daha çekici yaz (yıl, rakam, soru ekle).</li>
          <li><b>Sayfalar → Dizine ekleme</b> raporu: “Tarandı ama dizine eklenmedi” uyarısı alan sayfalar genelde fazla kısa ya da birbirine çok benziyor demektir. Bu sayfaları genişlet ya da birleştir.</li>
        </ol>
        <p className={note}>İlk 2–3 hafta veri az olur, bu normal. Günlük değil haftalık bak; günlük oynamalar yanıltıcıdır.</p>
      </>
    ),
  },
  {
    title: 'Haftalık rutin (bunu uygulaman yeterli)',
    body: (
      <ul className={ul}>
        <li><b>Pazartesi (30 dk)</b>: Search Console’a bak. Konumu 8–20 arasındaki 2–3 kelimeyi seç ve bu hafta hangi yazıları güncelleyeceğini not al.</li>
        <li><b>Salı, Perşembe, Cumartesi</b>: Kelime tablondan birer yeni yazı yayınla ve her birini Search Console’da dizine eklenmesi için gönder.</li>
        <li><b>Çarşamba</b>: Bir eski yazıyı güncelle; bilgileri tazele, SSS ekle, yeni yazılara link ver.</li>
        <li><b>Cuma</b>: Yeni yazıları Telegram, X ve Instagram’da paylaş. İlk ziyaretçiler Google’a “bu sayfa ilgi görüyor” sinyali verir.</li>
        <li><b>Ayda bir</b>: Bir özgün veri raporu yayınla, sponsorlardan link iste ve Dizine ekleme raporundaki hataları temizle.</li>
      </ul>
    ),
  },
  {
    title: 'Kesinlikle yapma listesi',
    body: (
      <ul className={ul}>
        <li>Başka sitelerden metin kopyalama. Google kopyayı anlar ve sayfayı dizine eklemez.</li>
        <li>Kelimeyi doldurma (“deneme bonusu deneme bonusu veren deneme bonusu siteleri”). Sağdaki yoğunluk kontrolü bu yüzden var, %0,5–2,5 arasında kal.</li>
        <li>Yayınlanmış bir yazının adresini değiştirme.</li>
        <li>Aynı konuyu iki ayrı yazıda anlatma. Yazılar birbirinin sırasını yer; tek ve güçlü bir yazıda birleştir.</li>
        <li>Link satın alma, PBN kurma, sahte yorum ve “7 günde ilk sıra” vaat eden servisler.</li>
        <li>Gizli yazı ve beyaz zeminde beyaz kelime gibi eski hileler. Anında ceza sebebidir.</li>
      </ul>
    ),
  },
  {
    title: 'Ne zaman sonuç alırım? (gerçekçi beklenti)',
    body: (
      <>
        <ul className={ul}>
          <li><b>1. ay</b>: Google yazıları keşfeder, gösterimler başlar, tıklama azdır. Moral bozma, bu dönem herkes için böyledir.</li>
          <li><b>2.–3. ay</b>: Uzun kuyruk kelimelerde ilk sayfaya çıkmaya başlarsın, günlük ziyaretçi düzenli gelir.</li>
          <li><b>4.–6. ay</b>: 40–60 yazı ve birkaç kaliteli link olunca orta kelimelerde yükselirsin. Trafik katlanarak artmaya başlar.</li>
          <li><b>6. ay ve sonrası</b>: Genel kelimeler için yarışabilecek otoriteye ulaşırsın.</li>
        </ul>
        <p className={note}>SEO kar topu gibidir: başta yavaştır, sonra her yazı bir öncekini güçlendirir. Bırakmayanlar kazanır. En sık yapılan hata, 2. ayda sonuç görmeyip yazmayı bırakmaktır.</p>
      </>
    ),
  },
  {
    title: 'Telegram fırsat sayfaları ve Telegram aktarımı',
    body: (
      <ol className={ol}>
        <li>Aşağıdaki kartta Telegram aktarımı açıksa botun paylaştığı özel oran ve fırsat postları <span className={code}>/ozel-oranlar</span> sayfasına düşer ve site haritasına eklenir.</li>
        <li>Bu postlar kısa olduğu için Google’dan tek başına çok trafik getirmez. Asıl görevleri siteyi canlı ve güncel göstermektir.</li>
        <li>Önemli bir fırsatı Google’da öne çıkarmak istiyorsan onu kısa post olarak bırakma; uzun bir rehber yazısına çevir (nasıl alınır, şartları, adım adım).</li>
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
  return (
    <FeatureGuide
      title="SEO eğitimi: sıfırdan Google’da yükselmek"
      subtitle="Hiç bilmeyen biri için adım adım: kurulum, kelime bulma, yazı yazma, link, ölçüm ve haftalık rutin"
      steps={SEO_STEPS}
    />
  )
}
