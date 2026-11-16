import { FeatureGuide, guideCode as code, type GuideStep } from '@/components/panel/feature-guide'
import type { TelegramAccess } from '@/lib/panel-modules'
import { TG_GUIDE_URL as GUIDE_URL } from '@/lib/tg-hub-shared'

const ol = 'flex list-decimal flex-col gap-1.5 pl-5'
const ul = 'flex list-disc flex-col gap-1.5 pl-5'
const link = 'font-semibold text-primary underline underline-offset-2'

const LAYOUT: GuideStep = {
  title: 'Ekran nasıl düzenli, ışıklar ne demek?',
  body: (
    <ul className={ul}>
      <li>
        Üstteki düğmeler gruplardır: <b>Postlar</b>, <b>Durum</b>, <b>Botlar</b>, <b>Otomasyonlar</b>, <b>Kanallar</b>. Birine basınca altında o grubun sekmeleri açılır. Sadece iznin olan
        grupları görürsün.
      </li>
      <li>
        Sekmenin yanındaki ışık: <b>yeşil</b> çalışıyor, <b>kırmızı</b> açık ama hata var, <b>gri</b> kapalı ya da kurulmadı. Gri hata değildir; kullanmadığın bölüm gri kalır.
      </li>
      <li>Yeni gelen her koruma ve özellik kapalı başlar. Sen açıp kaydetmeden hiçbiri çalışmaz.</li>
      <li>
        Zamanlı işler dakikası dakikasına çalışmaz: sitede dakikalık zamanlayıcı yok. Zamanlı post ya da duyuru, saat geldikten sonraki ilk site ziyaretinde ya da bota gelen ilk Telegram
        bildiriminde çıkar; genelde birkaç dakika gecikir.
      </li>
      <li>Telegram kuralı: bot 48 saatten eski bir mesajı silemez, ama düzenleyebilir.</li>
    </ul>
  ),
}

const POST_STEPS: GuideStep[] = [
  {
    title: 'Post hazırla ve gönder',
    body: (
      <ol className={ol}>
        <li>
          <b>Postlar → Yeni post</b>. Yazıyı yaz; biçim vermek için yazıyı seçip üstteki düğmelere bas. Yanda Telegram’da nasıl görüneceğini görürsün.
        </li>
        <li>İstersen medya ekle (en çok 10; fotoğraf 10 MB, video, GIF ve dosya 49 MB). Birden çok fotoğraf ya da video albüm olarak gider; albüme buton konmaz.</li>
        <li>
          <b>Nereye gidecek</b> kartında botu ve hedef kanal ya da grupları seç. Listede olmayan sohbeti <span className={code}>@adı</span> ya da <span className={code}>-100…</span> ID’siyle
          oradan eklersin.
        </li>
        <li>
          <b>Seçenekler</b>: sessiz gönder, iletmeyi kapat, sabitle, belli süre sonra sabitten kaldır, kendiliğinden sil (en çok 47 saat), link önizlemesi, sponsor imzası.
        </li>
        <li>
          Göndermeden önce <b>Gönder</b> kartındaki deneme sohbetine at ve Telegram’da kontrol et. Sonra <b>Şimdi</b> ya da <b>İleri bir zamanda</b> ile gönder.
        </li>
      </ol>
    ),
  },
  {
    title: 'Buton türleri',
    body: (
      <ul className={ul}>
        <li>
          <b>Link</b>: adres açar. “Tıklamayı say” açıksa kaç kişinin bastığı Gönderilenler’de yazar. Telegram linklerinde (<span className={code}>t.me</span>) kapat, yoksa link tarayıcıda
          açılır.
        </li>
        <li>
          <b>Açılır yazı</b>: basınca ekranda pencere açılır (kod, kural). <b>Kodu kopyala</b>: kod kişinin panosuna kopyalanır.
        </li>
        <li>
          <b>Üyeye özel</b>: basan kişi kanala üyeyse içerik, değilse “önce katıl” yazısı çıkar.
        </li>
        <li>
          <b>Oy</b>: butonun üstünde oy sayısı görünür, kişi başı tek oy. <b>Çekilişe katıl</b>: katılan sayısı görünür, kazananı sonra seçersin.
        </li>
        <li>
          <b>Bota git</b>: seçtiğin botla özel sohbet açar; üyeyi Destek ya da Sohbet botuna yönlendirmek için.
        </li>
        <li>
          Açılır yazı, Üyeye özel, Oy ve Çekiliş; postu atan bot Telegram bildirimlerini dinliyorsa çalışır. Dinlemiyorsa formda kırmızı uyarı ve <b>Dinlemeyi aç</b> düğmesi çıkar.
        </li>
      </ul>
    ),
  },
  {
    title: 'Zamanla, taslak ve şablon kullan',
    body: (
      <ul className={ul}>
        <li>
          <b>İleri bir zamanda</b>’yı seç, tarih ve saati gir (Türkiye saati). Tekrar: bir kez, her gün ya da her hafta.
        </li>
        <li>
          <b>Saatinde çıkamazsa ne kadar geç gidebilir</b> sınırını seç. Gecikme sınırı aşarsa post gönderilmez ve “Kaçırıldı” yazar. Gece çıkacak postta “ne kadar geç olursa olsun gönder”i
          seç.
        </li>
        <li>
          <b>Zamanlı postlar</b> sekmesinde takvimi görür; postu şimdi gönderir, zamanını değiştirir, taslağa alır ya da silersin.
        </li>
        <li>
          <b>Taslak</b> yarım kalan postu saklar, gönderilince listeden çıkar. <b>Şablon</b> her kullanımda yerinde kalır.
        </li>
        <li>
          Şablonda <span className={code}>{'{sponsor}'}</span>, <span className={code}>{'{kod}'}</span> ve <span className={code}>{'{link}'}</span> yazdığın yerler, şablonu her açışında
          sorulur.
        </li>
      </ul>
    ),
  },
  {
    title: 'Gönderilen postu düzenle, çekiliş yap',
    body: (
      <ul className={ul}>
        <li>
          <b>Gönderilenler</b>’de panelden, otomasyonlardan ve telefondan (“Panel dışı”) atılan postlar durur. Altında buton tıklamaları, oylar ve çekiliş katılımı yazar.
        </li>
        <li>
          <b>Düzenle</b> yazıyı ve butonları Telegram’daki tüm kopyalarda değiştirir. <b>Başka hedefe ya da tekrar gönder</b> aynı postu başka sohbete atar.
        </li>
        <li>
          Her sohbet satırında <b>Sabitle</b> ve ilk 48 saat içinde <b>Telegram’dan sil</b> var.
        </li>
        <li>
          Çekiliş: postun altındaki kutuda “Kaç kazanan” yaz → <b>Kazanan seç</b>. Ulaşılamazsa <b>Yedek kazanan seç</b>. Sonuç Telegram’a ancak <b>Kazananları duyur</b>’a basınca yazılır.
        </li>
        <li>Oy ya da çekiliş butonunu silersen sayıları da görünmez olur; yazısını değiştirmek sayıları etkilemez.</li>
      </ul>
    ),
  },
  {
    title: 'Telefondan atılan posta imza ve buton ekle',
    body: (
      <ul className={ul}>
        <li>
          <b>Elle atılan postlar</b> sekmesinde kanal için bir kural kur: imza yazısı, sponsor imzası ve her posta eklenecek butonlar.
        </li>
        <li>Kural, post atıldıktan yaklaşık yarım dakika sonra uygulanır. Bir kanal için tek kural olur.</li>
        <li>Sadece kanallarda çalışır. Bot kanalda yönetici olmalı, “Mesajları düzenle” yetkisi açık olmalı ve bot bildirimleri dinliyor olmalı.</li>
        <li>Albüm postlara sadece imza eklenir; Telegram albüme buton koydurmaz.</li>
      </ul>
    ),
  },
  {
    title: 'Üyelere özelden duyuru at (DM duyuru)',
    body: (
      <ul className={ul}>
        <li>Duyuru, Telegram hesabını siteye bağlamış üyelere Canlı Sohbet botundan özel mesaj olarak gider. Tek görsel ve en çok 6 link butonu ekleyebilirsin.</li>
        <li>
          <b>Kime gitsin</b>: herkes, yeni bağlananlar, grupta yazanlar, sitede aktif olanlar ya da 30 gündür uzak kalanlar. Her kitlenin yanında kişi sayısı yazar.
        </li>
        <li>
          Önce <b>Önce bana gönder</b> ile kendine at, sonra gönder ya da ileri bir saate zamanla.
        </li>
        <li>Sonuç kartında ulaşan, botu engellemiş ve başarısız sayıları yazar. Süren gönderimi durdurabilirsin; o ana kadar gidenler geri alınamaz.</li>
        <li>Haftada 1-2 duyurudan fazlası şikâyete ve botun engellenmesine yol açar.</li>
      </ul>
    ),
  },
]

const MOD_STEPS: GuideStep[] = [
  {
    title: 'Bir şey çalışmıyor mu? Önce Durum ekranı',
    body: (
      <ul className={ul}>
        <li>
          <b>Durum → Durum</b>: hatalı her bölüm nedeniyle listelenir; <b>Bölümü aç</b> doğrudan oraya götürür.
        </li>
        <li>
          <b>Botlar</b> listesinde her botun hangi işi yaptığı ve bildirimlerin siteye ulaşıp ulaşmadığı, <b>Gruplar ve kanallar</b> listesinde botun yönetici olup olmadığı ve eksik
          yetkiler yazar.
        </li>
        <li>
          <b>Yeniden kontrol et</b> Telegram’a yeniden sorar. <b>Kontrol et ve onar</b> bozuk bağlantıları düzeltir (kurulum izni ister).
        </li>
      </ul>
    ),
  },
  {
    title: 'Kayıtlar ve üye kartı',
    body: (
      <ul className={ul}>
        <li>
          <b>Telegram Merkezi → Kayıtlar</b>: Bekçi’nin ve panelin yaptığı her işlem. İşlem türü, grup, kişi ve tarihe göre ara; <b>CSV indir</b> ile dışarı al.
        </li>
        <li>
          <b>Geri al</b> uyarıyı siler, susturmayı ya da banı kaldırır ve düşen güven puanını geri verir. Silinen mesaj geri gelmez.
        </li>
        <li>Bir kişinin adına basınca üye kartı açılır: güven puanı, uyarılar, mesaj sayısı, bağlı site hesabı ve geçmişi.</li>
        <li>Karttan: güvenilir yap, 24 saat sustur, susturmayı kaldır, uyarıları sıfırla, son 48 saatteki mesajlarını sil, tüm gruplardan banla.</li>
        <li>
          Gizli güven puanı 50 ile başlar; 30’un altındaki biri yabancı link atarsa doğrudan banlanır. Tüm gruplardan yasağı sadece ana yönetici kaldırabilir.
        </li>
      </ul>
    ),
  },
  {
    title: 'Destek biletlerini cevapla',
    body: (
      <ul className={ul}>
        <li>
          <b>Telegram Merkezi → Destek</b>. Açık ve kapalı biletler ayrı durur; bilet numarası, isim, sponsor ya da metinle arayabilirsin.
        </li>
        <li>
          “Hazır cevap ekle…” listesinden seçtiğin cevap kutuya yazılır; düzeltip <b>Çözüldü olarak gönder</b> ya da <b>Reddet</b>. Cevap üyeye özelden gider.
        </li>
        <li>Kırmızı “Cevapsız” etiketi, biletin belirlenen süreden uzun süredir üstlenilmediğini gösterir.</li>
        <li>Biletleri Telegram’daki yetkili grubundan, bilete yanıt vererek de cevaplayabilirsin.</li>
      </ul>
    ),
  },
  {
    title: 'Baskın ya da spam varsa',
    body: (
      <ol className={ol}>
        <li>
          Grupta <span className={code}>/kilit</span> yaz; grup hemen kilitlenir. Açmak için <span className={code}>/kilitac</span>.
        </li>
        <li>
          <b>Telegram Merkezi → Koruma → Son 30 dakikada girenleri çıkar</b>: son gelenler 10 dakikalığına çıkarılır, kalıcı ban olmaz.
        </li>
        <li>
          <b>Şüphelileri tara</b> toplu üretilmiş isimleri ve birlikte giren hesapları listeler. Bunlar ipucudur; kararı sen verirsin.
        </li>
        <li>
          <b>Temizlik</b> sekmesi: bir kişinin son 48 saatteki mesajlarını sil, silinmiş hesapları çıkar.
        </li>
        <li>
          Grup komutları (yanıt vererek): <span className={code}>/uyar</span> <span className={code}>/sustur 60</span> <span className={code}>/ac</span>{' '}
          <span className={code}>/ban</span> <span className={code}>/gban</span> <span className={code}>/sil</span> <span className={code}>/temizle 50</span>{' '}
          <span className={code}>/guvenilir</span>
        </li>
      </ol>
    ),
  },
  {
    title: 'Kanal kapanırsa ve istatistik',
    body: (
      <ul className={ul}>
        <li>
          <b>Durum → Dayanıklılık → Güncel kanal adresi</b>: sitedeki tüm Telegram linkleri ve botların yazıları bu tek adresi kullanır. Yeni adresi yazınca hepsi birden döner (değiştirmek
          kurulum izni ister).
        </li>
        <li>
          <b>Üye köprüsü</b>: Telegram’ını siteye bağlamış ve özelden yazılabilen üye sayısı. Kanal giderse yeni adresi onlara DM duyuruyla ulaştırırsın.
        </li>
        <li>
          <b>Kampanya davet linkleri</b>: her reklama ayrı link aç, hangi linkten kaç kişi geldiğini gör. Saldırı bir linkten geliyorsa sadece onu iptal et.
        </li>
        <li>
          <b>Durum → İstatistik</b>: son 7 ya da 30 günde mesaj, yazan kişi, giriş, çıkış ve en yoğun saatler. Telegram görüntülenme sayısını botlara vermez.
        </li>
      </ul>
    ),
  },
]

const SETUP_STEPS: GuideStep[] = [
  {
    title: 'İlk kurulum sırası',
    body: (
      <ol className={ol}>
        <li>
          Telegram’da <span className={code}>@BotFather</span> → <span className={code}>/newbot</span> ile botu aç, token’ı al. Grupta çalışacak bot için{' '}
          <span className={code}>/setprivacy → Disable</span> yap.
        </li>
        <li>Botu çalışacağı grup ve kanallarda yönetici yap (mesaj silme, kullanıcı yasaklama, davet, sabitleme; kanalda mesaj gönderme ve düzenleme).</li>
        <li>
          <b>Otomasyonlar → Bağlantı &amp; Cron</b>: token’ı yapıştırıp botu bağla, hedef kanalları ekle, <b>Test</b>’e bas.
        </li>
        <li>
          <b>Botlar → Telegram Merkezi → Kurulum</b>: Bekçi, Destek ve Postçu rollerine bot ata, korunacak grupları ve gizli kayıt grubunu ekle.
        </li>
        <li>
          Oran, KankaTV ve Canlı Sohbet için ayrı bot kullan: bir bot tek bir dinleme adresine bağlanır, aynı botu iki ana işe veremezsin.
        </li>
        <li>
          Bitince <b>Durum → Durum</b>’da her şeyin yeşil olduğunu kontrol et.
        </li>
      </ol>
    ),
  },
  {
    title: 'Bekçi ve Koruma ayarları',
    body: (
      <ul className={ul}>
        <li>
          <b>Bekçi</b>: yasaklı kelimeler, uyarı ve susturma, flood, izinli linkler, iletilen mesajlar, yapay zekâ moderasyonu, yeni gelene doğrulama (tek buton, emoji ya da özelden).
        </li>
        <li>
          <b>Koruma</b>: baskın modu, toplu üye ekleme, yorum kalkanı, karantina, içerik türleri, koordineli spam, gizlenmiş reklam, isim nöbeti, sessiz saatler ve alarmlar. Hepsi kapalı
          başlar.
        </li>
        <li>
          Koruma’daki <b>Önerilen ayarları doldur</b> formu önerilen değerlerle doldurur; gözden geçirip kaydetmeden hiçbir şey değişmez.
        </li>
        <li>
          <b>Gruba özel ayar</b> ile sohbet grubunu ve yorum grubunu farklı sertlikte tutabilirsin.
        </li>
        <li>Yöneticilere ve güvenilir işaretli üyelere Bekçi dokunmaz; testi sıradan bir hesapla yap.</li>
      </ul>
    ),
  },
  {
    title: 'Oto cevap, karşılama ve sayaç',
    body: (
      <ul className={ul}>
        <li>
          <b>Oto Cevap</b>: grupta “site” ya da “sponsor” yazılınca bot butonlu cevap verir. Kendi kelime kurallarını da ekleyebilirsin (en fazla 30). Cevaplar 10 dakika sonra kendiliğinden
          silinir.
        </li>
        <li>
          <b>Karşılama mesajı</b>: yeni üyeye atılır; <span className={code}>{'{isim}'}</span> yazdığın yere üyenin adı gelir.
        </li>
        <li>
          <b>Sayaç</b>: haftanın en çok yazanlarını sayar, pazartesi listeyi gruba atar ve ödülleri yükler. Grupta <span className={code}>/liste</span> ve{' '}
          <span className={code}>/ben</span> çalışır.
        </li>
        <li>
          <b>Destek</b> ayarları: yetkili grubu, sponsor grupları, hazır cevaplar ve cevapsız bilet uyarısı.
        </li>
      </ul>
    ),
  },
  {
    title: 'Ayar geçmişi ve yedek',
    body: (
      <ul className={ul}>
        <li>
          <b>Telegram Merkezi → Ayar geçmişi</b>: kim neyi değiştirdi. <b>Bundan önceki hâle dön</b> yanlış kaydedilen ayarı geri alır.
        </li>
        <li>
          <b>Yedeği indir</b> tüm Bekçi, Koruma, Destek, Oto Cevap ve Sayaç ayarlarını tek dosyaya indirir; <b>Yedekten yükle</b> geri getirir. Bot ve sohbet bağlantılarına dokunmaz.
        </li>
        <li>Büyük bir değişiklikten önce bir yedek indir.</li>
      </ul>
    ),
  },
  {
    title: 'Maliyet: bunlar veritabanını uyandırır',
    body: (
      <ul className={ul}>
        <li>Veritabanı uyanık kaldığı her saat faturaya yazılır. Aşağıdakiler açıkken Telegram siteye çok daha sık bildirim gönderir.</li>
        <li>
          <b>Tepki (emoji) seli</b> (Koruma): en ağırı; hareketli grupta veritabanı neredeyse hiç uyumaz.
        </li>
        <li>
          <b>Kanal girişleri alarmı</b> ve <b>Yönetici ve bot yetkisi alarmı</b> (Koruma): her giriş ve çıkış bildirilir.
        </li>
        <li>
          <b>Açık kampanya davet linki</b> (Dayanıklılık): aynı giriş bildirimleri. Kampanya bitince linki iptal et.
        </li>
        <li>
          <b>Dış zamanlayıcı</b> (Bağlantı &amp; Cron): ne kadar sık çağırırsa o kadar pahalı; çoğu zaman gerekmez.
        </li>
      </ul>
    ),
  },
]

const FULL_GUIDE: GuideStep = {
  title: 'Tam kılavuz: her ekran, adım adım',
  body: (
    <div className="flex flex-col gap-2">
      <p>
        Buradaki başlıklar özet. BotFather adımları, yetki tablosu, bütün grup komutları, acil durum planı ve sorun giderme tablosu tam kılavuzda. Sadece panele giriş yapmış
        hesaplara açılır; sitede yayınlanmaz.
      </p>
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        <a className={link} href={GUIDE_URL} target="_blank" rel="noreferrer">
          Tam kılavuzu aç
          <span className="sr-only"> (yeni sekmede açılır)</span>
        </a>
        <a className={link} href={`${GUIDE_URL}?indir=1`} download="alkanka-telegram-kilavuz.html">
          Kılavuzu indir
        </a>
      </p>
    </div>
  ),
}

/** Each account is shown only the steps for the screens its permissions open. */
export function TgGuide({ access }: { access: TelegramAccess }) {
  const steps = [LAYOUT, ...(access.posts ? POST_STEPS : []), ...(access.mod ? MOD_STEPS : []), ...(access.setup ? SETUP_STEPS : []), FULL_GUIDE]
  return <FeatureGuide id="telegram-kilavuz" title="Telegram kullanım kılavuzu" subtitle="Post Merkezi, koruma, destek, DM duyuru ve kanal kapanırsa yapılacaklar" steps={steps} />
}
