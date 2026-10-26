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
  {
    title: 'Sözlük: SEO terimleri',
    body: (
      <ul className={ul}>
        <li><b>Dizine ekleme (indeks)</b>: Google’ın sayfanı kaydetmesi. Dizinde olmayan sayfa aramada hiç çıkmaz.</li>
        <li><b>SERP</b>: Google’ın arama sonuç sayfası.</li>
        <li><b>Odak kelime</b>: Bir yazının sıralanmasını istediğin ana arama ifadesi. Her yazının bir tane olur.</li>
        <li><b>Uzun kuyruk</b>: 3 ve daha fazla kelimeli, az aranan ama kolay sıralanan aramalar.</li>
        <li><b>Meta başlık / Meta açıklama</b>: Google’da görünen mavi başlık ve altındaki gri yazı. Paneldeki “Başlık” ve “Özet” alanları.</li>
        <li><b>Slug / Adres</b>: Yazının linkindeki son kısım, örneğin <span className={code}>/rehber/cevrim-sarti-nedir</span>.</li>
        <li><b>Backlink</b>: Başka bir sitenin sana verdiği link. Otoritenin ana kaynağı.</li>
        <li><b>İç link</b>: Kendi sitenin bir sayfasından diğerine verdiğin link.</li>
        <li><b>Canonical</b>: “Bu sayfanın asıl adresi bu” etiketi. Sitede otomatik.</li>
        <li><b>301 yönlendirme</b>: Kalıcı taşıma. Eski adresin sırasını yeni adrese aktarır. Panelde Yönlendirmeler kartından yapılır.</li>
        <li><b>404</b>: Bulunamayan sayfa. Panelde kaydı tutulur, bunları ilgili sayfaya 301 ile yönlendir.</li>
        <li><b>Yapılandırılmış veri (Schema)</b>: Google’a “bu bir makale / SSS / inceleme” diyen gizli kod. Sitede otomatik, SSS bloğu da buna dahil.</li>
        <li><b>E-E-A-T</b>: Deneyim, uzmanlık, otorite, güven. Google’ın içerik kalitesini değerlendirme ölçütleri.</li>
      </ul>
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

const MARKETING_STEPS: GuideStep[] = [
  {
    title: 'Bu bölüm ne işe yarar? (önce bunu oku)',
    body: (
      <>
        <p className="mb-2">Bu alanda üç iş yapıyoruz, üçü birbirine bağlı:</p>
        <ol className={ol}>
          <li><b>Kampanya linkleri</b>: Her paylaşım yeri için ayrı link açarsın. Hangisinin ziyaret, üye ve sponsor tıklaması getirdiğini görürsün.</li>
          <li><b>Affiliate linkleri</b> (Büyüme bölümünde): Sponsorun verdiği linki kendi adresimizin arkasına saklarız. Sponsora giden her tıklama bizde sayılır.</li>
          <li><b>Hakediş</b>: Her ay sponsorun panelindeki kazancı buraya girersin. Bizim tıklama sayımızla karşılaştırırsın ve tek tuşla talep mesajı hazırlarsın.</li>
        </ol>
        <p className={note}>Akış: Kampanya linki → sitemiz → sponsor butonu (/git) → sponsorun affiliate linki → hakediş. Her adım sayılıyor.</p>
      </>
    ),
  },
  {
    title: 'Başlamadan önce: hesap kontrol listesi ve doğru sıra',
    body: (
      <>
        <p className="mb-2">Hesapları bu sırayla aç. Her adım bir sonrakinin şartı:</p>
        <ol className={ol}>
          <li><b>İş için ayrı bir Gmail aç</b> (ör. alkanka.reklam@gmail.com). Kişisel hesabınla karıştırma. <b>İki adımlı doğrulamayı</b> hemen aç: myaccount.google.com → Güvenlik → 2 Adımlı Doğrulama.</li>
          <li><b>Google Search Console</b>: SEO rehberindeki kurulum adımı, zaten yaptın.</li>
          <li><b>Google Analytics 4</b>: Aşağıdaki “GA4 sıfırdan kurulum” adımı.</li>
          <li><b>Meta İşletme hesabı</b> + alan adı doğrulama + Pixel.</li>
          <li><b>Google Ads hesabı</b> + dönüşüm etiketleri.</li>
          <li>Ancak bunlar bittikten sonra ilk reklamı aç.</li>
        </ol>
        <p className="mt-3 mb-1 font-semibold">Hazırda tutman gerekenler:</p>
        <ul className={ul}>
          <li>Kimlik kartının ön ve arka fotoğrafı (reklamveren doğrulaması için).</li>
          <li>Şirket varsa vergi levhası ve faaliyet belgesi. Yoksa bireysel hesapla başlanır.</li>
          <li>Banka ya da kredi kartı (sanal kart da olur, limitini düşük tut).</li>
          <li>Telefon numarası (SMS onayları için).</li>
        </ul>
        <p className={note}>Bütün şifreleri ve kodları bir şifre yöneticisine kaydet. Hesabı kaybetmek, reklam hesabının kapanmasından daha zor düzelir.</p>
      </>
    ),
  },
  {
    title: 'Google Analytics 4: sıfırdan kurulum',
    body: (
      <>
        <ol className={ol}>
          <li><span className={code}>analytics.google.com</span> adresine iş Gmail’inle gir ve <b>Ölçüme başla</b>’ya bas.</li>
          <li><b>Hesap adı</b>: “Alkanka”. Veri paylaşım kutularını olduğu gibi bırak, <b>İleri</b>.</li>
          <li><b>Mülk oluştur</b>: Ad “alkanka.com”, saat dilimi <b>Türkiye</b>, para birimi <b>Türk Lirası</b>. <b>İleri</b>.</li>
          <li>İşletme bilgisi ve hedefler sorulur: sektör “Oyun”, boyut “Küçük”, hedef olarak “Potansiyel müşteri oluşturma” ve “Kullanıcı davranışını anlama”yı seç. Şartları kabul et.</li>
          <li>Platform olarak <b>Web</b>’i seç. Site adresini yaz (https:// olmadan), akış adı “Site”. <b>Geliştirilmiş ölçüm</b> açık kalsın. <b>Akış oluştur</b>.</li>
          <li>Ekranda <span className={code}>G-XXXXXXX</span> ile başlayan <b>Ölçüm kimliği</b> çıkar. Kopyala, bu paneldeki <b>Ölçüm etiketleri</b> sekmesine yapıştır ve kaydet. Kod eklemene gerek yok, site kendisi ekler.</li>
          <li><b>Veri saklama süresini uzat</b>: Yönetici → Veri toplama ve değiştirme → Veri saklama → <b>14 ay</b> → Kaydet. Varsayılan 2 ay, sonra geçmişi göremezsin.</li>
          <li><b>Search Console’u bağla</b>: Yönetici → Ürün bağlantıları → Search Console bağlantıları → Bağla. Böylece Google arama verisi de Analytics’te görünür.</li>
          <li><b>Üyeliği önemli olay yap</b>: Bir gün sonra Yönetici → Etkinlikler ekranında <span className={code}>sign_up</span> görünür. Yanındaki yıldıza bas (önemli olay olarak işaretle). Sponsor tıklaması için <span className={code}>sponsor_click</span> olayına da aynısını yap.</li>
        </ol>
        <p className={note}>Kontrol: Siteyi telefonundan aç, Analytics’te Raporlar → Gerçek zamanlı ekranında 1 kullanıcı görmelisin. Görmüyorsan reklam engelleyicini kapatıp tekrar dene.</p>
      </>
    ),
  },
  {
    title: 'Meta: İşletme hesabı, alan adı doğrulama ve reklam hesabı onayı',
    body: (
      <>
        <p className="mb-1 font-semibold">1. Önce kişisel Facebook profilin hazır olsun</p>
        <ul className={ul}>
          <li>Meta, reklam hesabını senin kişisel profiline bağlar. Profil <b>gerçek isimli</b>, fotoğraflı ve mümkünse eski olmalı. Yeni açılmış boş profiller genelde hemen kısıtlanır.</li>
          <li>Profilde iki adımlı doğrulamayı aç: Ayarlar → Hesaplar Merkezi → Şifre ve güvenlik → İki faktörlü kimlik doğrulama. İşletme yöneticileri için bu zorunludur.</li>
        </ul>
        <p className="mt-3 mb-1 font-semibold">2. İşletme portföyü aç</p>
        <ol className={ol}>
          <li><span className={code}>business.facebook.com</span> → <b>Hesap oluştur</b>. İşletme adı “Alkanka”, adın ve iş e-postan. E-postana gelen onay linkine tıkla.</li>
          <li>Bir <b>Facebook sayfası</b> aç (ya da var olanı ekle): İşletme ayarları → Hesaplar → Sayfalar → Ekle.</li>
          <li><b>Instagram hesabını</b> bağla: İşletme ayarları → Hesaplar → Instagram hesapları → Ekle. Instagram hesabının “Profesyonel hesap” olması gerekir (Instagram → Ayarlar → Hesap türü).</li>
        </ol>
        <p className="mt-3 mb-1 font-semibold">3. Alan adını doğrula (önemli)</p>
        <ol className={ol}>
          <li>İşletme ayarları → <b>Marka güvenliği</b> → <b>Alan adları</b> → Ekle → <span className={code}>alkanka.com</span> yaz.</li>
          <li>Yöntem olarak <b>Meta etiketi</b>ni seç. <span className={code}>{'<meta name="facebook-domain-verification" content="…">'}</span> satırını kopyala.</li>
          <li>SEO bölümündeki <b>Google kaydı</b> kartında <b>Meta (Facebook) alan adı doğrulama kodu</b> kutusuna yapıştır ve kaydet.</li>
          <li>Meta’ya dönüp <b>Alan adını doğrula</b>’ya bas. Yeşil tik görünmeli. Görünmüyorsa 10 dakika bekleyip tekrar dene.</li>
        </ol>
        <p className="mt-3 mb-1 font-semibold">4. Reklam hesabı ve Pixel</p>
        <ol className={ol}>
          <li>İşletme ayarları → Hesaplar → <b>Reklam hesapları</b> → Ekle → Yeni reklam hesabı oluştur. Saat dilimi <b>İstanbul</b>, para birimi <b>TRY</b>. Bunlar sonradan <b>değiştirilemez</b>, dikkat et.</li>
          <li>Kendini reklam hesabına “Tam kontrol” ile ata.</li>
          <li><b>Ödeme yöntemi</b>: Faturalandırma ve ödemeler → Ödeme yöntemi ekle. Kartın adı profil adınla aynı olsun, farklı isim kısıtlamaya sebep olabilir.</li>
          <li><b>Pixel</b>: Etkinlik Yöneticisi → Veri kaynağı bağla → Web → ad ver → site adresini yaz. 15 haneli numarayı Ölçüm etiketleri sekmesine yapıştır. Sonra Pixel’i İşletme ayarları → Veri kaynakları → Pixel’ler bölümünden reklam hesabına bağla.</li>
        </ol>
        <p className="mt-3 mb-1 font-semibold">5. İşletme doğrulaması (isteğe bağlı ama faydalı)</p>
        <ul className={ul}>
          <li>İşletme ayarları → <b>Güvenlik merkezi</b> → Doğrulamayı başlat. Şirket adı, adres, telefon ve vergi levhası istenir. Onay birkaç gün sürer.</li>
          <li>Doğrulanmış işletmenin harcama limitleri daha hızlı açılır ve hesabı daha zor kapanır. Şirketin yoksa bu adımı atla, reklam yine verilebilir.</li>
        </ul>
        <p className={note}>Yeni reklam hesaplarının ilk günlerde günlük harcama limiti düşük olur, bu normal. İlk hafta düşük bütçeyle başla, ödemeler sorunsuz geçtikçe limit kendiliğinden yükselir.</p>
      </>
    ),
  },
  {
    title: 'Google Ads: hesap açma, fatura ve reklamveren doğrulaması',
    body: (
      <>
        <p className="mb-1 font-semibold">1. Hesabı aç</p>
        <ol className={ol}>
          <li><span className={code}>ads.google.com</span> → <b>Hemen başlayın</b>, iş Gmail’inle gir.</li>
          <li>Sihirbaz seni hemen kampanya kurmaya yönlendirir. En alttaki <b>“Uzman moduna geç”</b> linkine bas, sonra <b>“Kampanya olmadan hesap oluştur”</b>u seç. Yoksa bilmeden para harcayan bir reklam açılabilir.</li>
          <li>Ülke <b>Türkiye</b>, saat dilimi <b>İstanbul</b>, para birimi <b>TRY</b>. Bunlar da sonradan değişmez.</li>
        </ol>
        <p className="mt-3 mb-1 font-semibold">2. Faturalandırma</p>
        <ol className={ol}>
          <li>Faturalandırma → Ayarlar. Ödeme profili türü: şirketin varsa <b>Kurumsal</b> (vergi no gerekir), yoksa <b>Bireysel</b>.</li>
          <li>Ödeme yöntemi olarak kart ekle ve <b>otomatik ödeme</b>yi seç.</li>
        </ol>
        <p className="mt-3 mb-1 font-semibold">3. Reklamveren doğrulaması</p>
        <ul className={ul}>
          <li>Google, hesap açıldıktan sonra bir noktada <b>“Reklamveren doğrulamasını tamamlayın”</b> uyarısı gösterir. Bu uyarı hesabın üst kısmında ve e-postada çıkar.</li>
          <li>Ödeme profili adınla aynı isimli kimlik belgesini (kimlik kartı ya da pasaport) yüklersin. Kurumsal hesapta şirket belgeleri istenir.</li>
          <li>Verilen süre içinde (genelde 30 gün) tamamlamazsan reklamların durur. Uyarıyı görünce hemen yap.</li>
        </ul>
        <p className="mt-3 mb-1 font-semibold">4. Bağlantılar ve dönüşümler</p>
        <ol className={ol}>
          <li><b>GA4’ü bağla</b>: Araçlar → Veri yöneticisi → Bağlı ürünler → Google Analytics (GA4) → Bağla.</li>
          <li><b>Dönüşüm aç</b>: Hedefler → Dönüşümler → Özet → Yeni dönüşüm işlemi → Web sitesi → site adresini gir → “Dönüşüm işlemini manuel olarak kodla oluştur”. Kategori “Kaydolma”, ad “Üyelik”. Kaydet.</li>
          <li>Etiket ayarlarında <b>“Google etiketini kendim kuracağım”</b>ı seç. <span className={code}>AW-</span> ile başlayan kimliği ve <span className={code}>/</span>’den sonraki dönüşüm etiketini Ölçüm etiketleri sekmesine yapıştır.</li>
          <li>Birkaç saat ve ilk üyelikten sonra dönüşümün durumu <b>“Etkin”</b> olur.</li>
        </ol>
        <p className={note}>Google Ads bazen ilk kartla yaklaşık 100–500 TL’lik bir ön çekim yapıp geri iade eder. Bu bir doğrulama işlemidir, korkma.</p>
      </>
    ),
  },
  {
    title: 'Reklam reddedildi ya da hesap kısıtlandı: ne yapmalı?',
    body: (
      <>
        <p className="mb-1 font-semibold">Tek bir reklam reddedildiyse (normal, sık olur)</p>
        <ol className={ol}>
          <li>Reklamın yanındaki <b>“Reddedildi”</b> yazısına tıkla, sebebi oku.</li>
          <li>Metinden ve görselden sebebi kaldır: para, kazanç, bonus, bahis, casino kelimeleri ve sponsor logoları. Hedef sayfanın <span className={code}>/oyna/…</span> olduğundan emin ol.</li>
          <li>Düzeltip kaydet, reklam yeniden incelenir. Aynı reklamı değiştirmeden tekrar tekrar gönderme.</li>
        </ol>
        <p className="mt-3 mb-1 font-semibold">Hesap kısıtlandıysa ya da askıya alındıysa (ciddi durum)</p>
        <ul className={ul}>
          <li><b>Meta</b>: <span className={code}>facebook.com/accountquality</span> (Hesap kalitesi) sayfasına gir, kısıtlamanın sebebini gör ve <b>İnceleme iste</b>’ye bas. Kısa ve kibar bir açıklama yaz: “Sitemiz ücretsiz tavla, okey ve bilardo oyun topluluğudur; reklamlarımızda bahis veya kumar yoktur.”</li>
          <li><b>Google</b>: Hesabın üstündeki askıya alma uyarısından <b>İtiraz et</b>’e bas ve aynı açıklamayı yaz. Önce Politika yöneticisindeki bütün reddedilmiş reklamları düzelt ya da sil.</li>
          <li>İtirazı <b>bir kez ve dikkatli</b> yap. Sonuç genelde 1–7 gün sürer.</li>
          <li><b>Asla</b> aynı kişi, kart ya da cihazla yeni hesap açarak kısıtlamayı aşmaya çalışma. Bu “sistemi atlatma” sayılır ve bütün hesaplarına ömür boyu yasak gelir.</li>
        </ul>
        <p className={note}>En iyi koruma: Reklam hesabında sadece oyun ve topluluk tanıt, sponsor işlerini Telegram, influencer ve SEO tarafında yürüt. Ölçüm etiketleri reklam hesabı kapansa bile çalışmaya devam eder.</p>
      </>
    ),
  },
  {
    title: 'Sponsor linkini aynalamak: engellenmeyi önleme',
    body: (
      <>
        <ul className={ul}>
          <li>Sponsor sana affiliate panelinden bir link verir. Bunu <b>Büyüme → Trafik & hesaplar → Affiliate linkleri</b> bölümüne yapıştır.</li>
          <li>Paylaşırken <b>asla sponsorun linkini doğrudan verme</b>. Her zaman <span className={code}>alkanka.com/r/kod</span> ya da <span className={code}>alkanka.com/git/sponsor</span> adresini kullan.</li>
          <li>Sponsorun adresi BTK tarafından kapatılırsa sadece paneldeki linki yenisiyle değiştirirsin. Telegram'daki, videolardaki ve eski postlardaki bütün linkler kendiliğinden yeni adrese gider.</li>
          <li>Ana domain'in güvende kalsın diye: Sponsor içeriğini sitemizde <b>kopyalayıp gösterme</b>, sadece yönlendir. Yönlendirme sayfaları Google'a kapalı.</li>
        </ul>
        <p className={note}>Daha da güvenli yöntem: Reklam ve influencer paylaşımları için ayrı, ucuz bir yedek domain al ve o domaini de bu siteye bağla. Kapatılırsa yenisini bağlarsın, ana domain hiç zarar görmez.</p>
      </>
    ),
  },
  {
    title: 'Kampanya linki oluşturma (adım adım)',
    body: (
      <>
        <ol className={ol}>
          <li><b>Kampanya linkleri</b> sekmesinde bir ad yaz, örneğin “Ekim Telegram duyurusu”. Kod otomatik oluşur.</li>
          <li><b>Kanal</b> seç: Telegram, X, influencer vb. Google Analytics'te kaynak olarak bu görünür.</li>
          <li><b>Hedef</b> seç: Sitemizin bir sayfası ya da doğrudan bir sponsor. Yeni üye kazanmak istiyorsan sitemizi seç. Sadece sponsor tıklaması istiyorsan sponsoru seç.</li>
          <li>Reklama para verdiysen <b>bütçe</b> gir. Üye başı maliyet otomatik hesaplanır.</li>
          <li>Linki kopyala ve sadece o yerde paylaş. Her yer için ayrı link aç, örneğin her yayıncıya ayrı bir link.</li>
        </ol>
        <p className={note}>Telegram, WhatsApp ve Facebook önizleme robotları sayılmaz. Gördüğün ziyaret sayısı gerçek insan tıklamasıdır.</p>
      </>
    ),
  },
  {
    title: 'Rakamları okumak: hangi kampanya iyi?',
    body: (
      <ul className={ul}>
        <li><b>Ziyaret / Tekil kişi</b>: Linke kaç kez ve kaç farklı kişi tıkladı.</li>
        <li><b>Yeni üye</b>: Bu linkle gelip ilk kez üye olanlar. Eski üyeler sayılmaz.</li>
        <li><b>Dönüşüm %</b>: Tekil kişilerin yüzde kaçı üye oldu. %5 ve üstü iyi, %1'in altı zayıf. Ya hedef sayfa yanlış ya da kitle uygun değil.</li>
        <li><b>Sponsor tık.</b>: Bu kampanyadan gelenlerin sponsor butonlarına tıklaması. Paranın kazanıldığı yer burası.</li>
        <li><b>Üye başı maliyet</b>: Bütçe ÷ yeni üye. Bunu sponsorun FTD başına ödediği tutarla karşılaştır. Maliyet düşükse kampanyayı büyüt, yüksekse durdur.</li>
      </ul>
    ),
  },
  {
    title: 'Google Analytics, Google Ads ve Meta Pixel bağlama',
    body: (
      <>
        <ol className={ol}>
          <li><b>Google Analytics 4</b>: analytics.google.com → Yönetici → Veri akışları → Web → <span className={code}>G-</span> ile başlayan kimliği kopyala.</li>
          <li><b>Google Ads</b>: ads.google.com → Hedefler → Dönüşümler → Yeni dönüşüm → Web sitesi → “Kodu manuel ekle”. <span className={code}>AW-</span> kimliğini ve dönüşüm etiketini al. Biri “Üyelik”, biri “Sponsor tıklaması” olmak üzere iki dönüşüm aç.</li>
          <li><b>Meta Pixel</b>: business.facebook.com → Etkinlik Yöneticisi → Veri kaynağı bağla → Web → Pixel. 15 haneli numarayı kopyala.</li>
          <li>Hepsini <b>Ölçüm etiketleri</b> sekmesine yapıştır ve kaydet. Gerisi otomatik: üyelik ve sponsor tıklaması olayları gönderilir.</li>
        </ol>
        <p className={note}>Kontrol: Kendi telefonundan siteyi aç ve GA4'te Raporlar → Gerçek zamanlı ekranına bak, ziyaretini görmelisin. Meta için Chrome'a “Meta Pixel Helper” eklentisini kur.</p>
      </>
    ),
  },
  {
    title: 'Reklamlar hakkında önemli uyarı (mutlaka oku)',
    body: (
      <>
        <ul className={ul}>
          <li>Google ve Meta, Türkiye'de <b>lisanssız bahis ve kumar reklamına izin vermez</b>. Sponsor adı, bonus ya da bahis geçen reklam reddedilir. Tekrar edersen hesabın kalıcı olarak kapanır.</li>
          <li>Reklamda sadece izin verilen konuyu tanıt: Ücretsiz oyunlar, turnuvalar, topluluk, KankaTV gibi. Hedef sayfa olarak bahis içermeyen sayfaları seç (Oyunlar, Turnuvalar).</li>
          <li>Ölçüm etiketleri reklam vermesen de işe yarar. GA4 tüm trafiğini ücretsiz ölçer.</li>
          <li>Ücretli trafik için en güvenli yol: Telegram kanal reklamları, yayıncı ve influencer iş birlikleri. Bunları kampanya linkleriyle ölç.</li>
          <li>KVKK gereği sitende çerez bildirimi ve gizlilik metni bulunmalı.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Hazır reklam sayfaları (/oyna)',
    body: (
      <>
        <p className="mb-2">Reklamları ana sayfaya değil, sadece oyun ve topluluk anlatan, bahis içermeyen bu sayfalara yönlendir:</p>
        <ul className={ul}>
          <li><span className={code}>/oyna/tavla</span>, <span className={code}>/oyna/okey</span>, <span className={code}>/oyna/bilardo</span>, <span className={code}>/oyna/turnuva</span>, <span className={code}>/oyna/kankatv</span></li>
          <li>Her sayfada tek bir hedef var: <b>“Ücretsiz üye ol”</b>. Butona basınca kayıt penceresi açılır, üyelik olayı Meta ve Google'a otomatik gider.</li>
          <li>Reklam linkini doğrudan vermek yerine Kampanya linkleri sekmesinde hedef olarak bu sayfayı seçip <span className={code}>/k/kod</span> linkini kullan. Böylece hem reklam paneli hem bizim panel sayar.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Meta (Facebook / Instagram) reklamı adım adım',
    body: (
      <>
        <ol className={ol}>
          <li><b>Hesap kurulumu:</b> business.facebook.com üzerinden İşletme hesabı aç, bir Facebook sayfası ve Instagram hesabı bağla, ödeme yöntemi ekle.</li>
          <li><b>Pixel:</b> Ölçüm etiketleri sekmesine Pixel numarasını gir. Etkinlik Yöneticisi'nde 24 saat içinde “PageView” ve “CompleteRegistration” olaylarını görmelisin.</li>
          <li><b>Kampanya hedefi:</b> Reklam Yöneticisi → Oluştur → <b>Potansiyel Müşteriler</b> ya da <b>Satışlar</b> değil, başlangıçta <b>Trafik</b> seç. 50 üyelik olayı biriktikten sonra hedefi <b>Dönüşüm (CompleteRegistration)</b> olarak değiştir.</li>
          <li><b>Hedef kitle:</b> Türkiye, 18–45 yaş. İlgi alanı: tavla, okey, mobil oyunlar, bilardo. Başlangıçta “Advantage+ kitle” açık kalabilir.</li>
          <li><b>Yerleşim:</b> Otomatik bırak. Reels ve Story genelde en ucuz tıklamayı getirir.</li>
          <li><b>Reklam görseli:</b> Kısa oyun videosu (5–15 sn) ya da oyun ekran görüntüsü. Metin: “Gerçek rakiplerle ücretsiz tavla. Haftalık turnuvalar.” Sponsor, bonus, bahis, para kelimesi <b>kullanma</b>.</li>
          <li><b>Bütçe:</b> Günlük 150–300 TL ile 3 farklı görsel dene. 3 gün sonra en ucuz üyelik getireni bırak, diğerlerini kapat.</li>
        </ol>
        <p className={note}>Reklam reddedilirse itiraz etme, metni ve görseli değiştir. Arka arkaya ret hesabın kapanmasına yol açar.</p>
      </>
    ),
  },
  {
    title: 'Google Ads reklamı adım adım',
    body: (
      <>
        <ol className={ol}>
          <li><b>Hesap:</b> ads.google.com → “Uzman moduna geç” (akıllı kampanya sihirbazını atla) → ödeme bilgisi gir.</li>
          <li><b>Dönüşüm:</b> AW- kimliğini ve “Üyelik” dönüşüm etiketini Ölçüm etiketleri sekmesine gir. Hedefler → Dönüşümler ekranında durum birkaç saat sonra “Etkin” olmalı.</li>
          <li><b>Kampanya türü:</b> <b>Arama</b> kampanyası seç. Görüntülü Reklam Ağı ve arama iş ortaklarının tikini kaldır, sadece Google aramada çıksın.</li>
          <li><b>Anahtar kelimeler:</b> Tırnak içinde yaz, örneğin <span className={code}>&quot;online tavla oyna&quot;</span>, <span className={code}>&quot;101 okey oyna&quot;</span>, <span className={code}>[ücretsiz bilardo]</span>. Her oyun için ayrı reklam grubu aç ve kendi /oyna sayfasına yönlendir.</li>
          <li><b>Negatif kelimeler:</b> bahis, casino, para, indir, apk, hile. Bunlar boşa para harcatır ve politikaya takılır.</li>
          <li><b>Teklif:</b> İlk 2 hafta “Tıklamaları en üst düzeye çıkar” (TBM üst sınırı 3–5 TL). 30 dönüşüm sonrası “Dönüşümleri en üst düzeye çıkar”.</li>
          <li><b>Reklam metni:</b> Başlıkta oyun adı geçsin: “Online Tavla Oyna”, “Gerçek Rakipler, Ücretsiz”, “Haftalık Turnuvalar”.</li>
        </ol>
        <p className={note}>Her hafta Anahtar kelimeler → Arama terimleri ekranına bak. Alakasız aramaları negatif listeye ekle, bu tek iş bütçenin %20–30'unu kurtarır.</p>
      </>
    ),
  },
  {
    title: 'Reklam bütçesini doğru yönetmek',
    body: (
      <ul className={ul}>
        <li>Her reklam kampanyası için Kampanya linkleri sekmesinde bir kayıt aç ve <b>harcanan bütçeyi</b> güncel tut. Üye başı maliyeti panel hesaplar.</li>
        <li>Kural: Üye başı maliyet, bir üyenin sana ortalama getirdiğinden (sponsor hakedişi ÷ toplam üye) düşük olmalı.</li>
        <li>Yeni reklamı en az 3 gün çalıştırmadan yargılama. Reklam platformları ilk günlerde “öğrenme” aşamasındadır.</li>
        <li>Kazanan reklamın bütçesini birden ikiye katlama. Her 2–3 günde %20 artır.</li>
      </ul>
    ),
  },
  {
    title: 'Hakediş takibi ve para talebi',
    body: (
      <>
        <ol className={ol}>
          <li>Her ayın 1–5'i arasında sponsorun affiliate paneline gir ve önceki ayın FTD sayısını ve kazancını not al.</li>
          <li><b>Hakediş</b> sekmesinde sponsoru, ayı, modeli (CPA, RevShare) ve tutarı gir.</li>
          <li><b>Bizden giden tıklama</b> rakamına bak. Biz 1.000 tıklama göndermişken sponsor 2 FTD gösteriyorsa sorgula, bu durum eksik sayıma işaret edebilir.</li>
          <li><b>Talep mesajını kopyala</b> butonuna bas ve mesajı sponsorun affiliate yöneticisine gönder. Durumu “Talep edildi” yap.</li>
          <li>Para geldiğinde durumu “Ödendi” yap. Üstteki özet, bekleyen ve tahsil edilen parayı ayrı ayrı gösterir.</li>
        </ol>
        <p className={note}>Tık başı kazanç (EPC) en önemli rakamdır. Hangi sponsor tıklama başına daha çok kazandırıyorsa sitede onu öne çıkar.</p>
      </>
    ),
  },
  {
    title: 'Haftalık rutin',
    body: (
      <ul className={ul}>
        <li><b>Pazartesi</b>: Kampanya listesine bak. Üye başı maliyeti yüksek olanları durdur, iyi gidenlerin bütçesini artır.</li>
        <li><b>Çarşamba</b>: Affiliate linklerinde “Kontrol et” butonuna bas. Kapanan sponsor adresi varsa yenisini gir.</li>
        <li><b>Her gün</b>: Yeni paylaşım için yeni kampanya linki aç. Aynı linki her yerde kullanma.</li>
        <li><b>Ay başı</b>: Hakedişleri gir ve talep mesajlarını gönder.</li>
      </ul>
    ),
  },
  {
    title: 'Sözlük: reklam ve affiliate terimleri',
    body: (
      <ul className={ul}>
        <li><b>Gösterim</b>: Reklamın ekranda kaç kez göründüğü.</li>
        <li><b>TO / CTR</b>: Tıklama oranı. Reklamı görenlerin yüzde kaçı tıkladı. Meta’da %1, Google aramada %5 ve üstü iyidir.</li>
        <li><b>TBM / CPC</b>: Tıklama başı maliyet. Bir tıklamaya ödediğin para.</li>
        <li><b>BGBM / CPM</b>: Bin gösterim başı maliyet.</li>
        <li><b>Dönüşüm</b>: İstediğin hareketi yapan kişi. Bizde “üye oldu” ya da “sponsora tıkladı”.</li>
        <li><b>EBM / CPA</b>: Edinme başı maliyet. Bir üye için harcadığın toplam para.</li>
        <li><b>ROAS</b>: Harcadığın her 1 TL’nin kaç TL geri getirdiği. 1’in üstü kardasın demek.</li>
        <li><b>Pixel / Etiket</b>: Sitede çalışan küçük kod. Reklam platformuna kimin geldiğini ve üye olduğunu bildirir. Bizde panelden otomatik ekleniyor.</li>
        <li><b>UTM</b>: Linkin sonundaki <span className={code}>?utm_source=…</span> eki. Analytics trafiğin nereden geldiğini bununla anlar. Kampanya linkleri bunu kendisi ekler.</li>
        <li><b>FTD</b>: İlk para yatırma (first time deposit). Sponsorlar genelde bunun başına öder.</li>
        <li><b>CPA (affiliate)</b>: Her FTD için sabit ödeme. <b>RevShare</b>: Getirdiğin oyuncuların kaybından yüzde pay. <b>Hibrit</b>: İkisi birden.</li>
        <li><b>EPC</b>: Tık başı kazanç. Sponsorun bir tıklamamıza ortalama ne ödediği.</li>
        <li><b>Öğrenme aşaması</b>: Yeni reklamın ilk 3–7 günü. Bu sürede sonuçlar dengesizdir, reklama dokunma.</li>
      </ul>
    ),
  },
]

export function MarketingGuide() {
  return (
    <FeatureGuide
      id="pazarlama-rehber"
      title="Pazarlama eğitimi: kampanya, reklam ölçümü ve hakediş"
      subtitle="Link aynalama, kampanya takibi, Google/Meta etiketleri ve affiliate parası talep etme"
      steps={MARKETING_STEPS}
    />
  )
}

export function SeoGuide() {
  return (
    <FeatureGuide
      id="seo-rehber"
      title="SEO eğitimi: sıfırdan Google’da yükselmek"
      subtitle="Hiç bilmeyen biri için adım adım: kurulum, kelime bulma, yazı yazma, link, ölçüm ve haftalık rutin"
      steps={SEO_STEPS}
    />
  )
}
