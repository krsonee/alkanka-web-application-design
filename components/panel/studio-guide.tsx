'use client'

import { BookOpen, Clapperboard, Film, ImagePlus, Lightbulb, Palette, RefreshCw, Sticker, TriangleAlert, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'

type Section = 'guide' | 'create' | 'brands' | 'library'

const QUICK_START: { title: string; body: string; target: Section }[] = [
  {
    title: 'Marka kitini oluştur',
    body: '"Marka kitleri" sekmesinde sitenin güncel domainini yaz, "Siteden çek" de. Logo, renkler ve font otomatik gelir. Kontrol et, gerekirse düzelt, kaydet.',
    target: 'brands',
  },
  {
    title: 'Sağlayıcı görsellerini ekle (opsiyonel)',
    body: '"Sağlayıcı kütüphanesi" sekmesinde sağlayıcı ve oyun adını yaz, portallardan aldığın karakter ve arka plan görsellerini yükle ya da linklerini yapıştır.',
    target: 'library',
  },
  {
    title: 'Üret',
    body: '"Üret" sekmesinde işi (Banner, Hareketli GIF, Video, Sticker) ve markayı seç, formu doldur ya da hazır bir tarif seç, "Üret"e bas. Her markanın üretimleri kendi alanında durur: üstteki "Marka alanları" şeridinden markaya basınca form da liste de o markaya geçer.',
    target: 'create',
  },
  {
    title: 'Revize et, hareketlendir, indir',
    body: 'Çıkan işin altındaki butonlarla değişiklik iste, banner\'ı GIF veya videoya çevir, "İndir" ile cihazına al.',
    target: 'create',
  },
]

const PRICES: [string, string, string][] = [
  ['Görsel / Banner (2048 px)', '~$0.10', '15-40 sn'],
  ['Görsel / Banner (1024 px)', '~$0.07', '10-30 sn'],
  ['Sticker (şeffaf PNG)', '~$0.07', '10-30 sn'],
  ['Revize', 'Görsel ücreti kadar', '10-40 sn'],
  ['Sadece yazı değişikliği', 'Ücretsiz', '2-5 sn'],
  ['İsteği geliştir', 'Kuruşun altında (tavana yazılmaz)', '3-10 sn'],
  ['Hareketli GIF, gerçek hareket (4 sn, standart)', 'Banner + ~$0.12', '1-2 dk'],
  ['Hareketli GIF, gerçek hareket (6 sn, yüksek)', 'Banner + ~$0.30', '1-3 dk'],
  ['Işık efektli GIF (görsel durur)', 'Banner + $0', '+3-5 sn'],
  ['Video 4 sn (standart 720p, sessiz)', 'Banner + ~$0.12', '1-2 dk'],
  ['Video 6 sn (yüksek 1080p, sessiz)', 'Banner + ~$0.30', '1-3 dk'],
  ['Video 8 sn (yüksek 1080p, sessiz)', 'Banner + ~$0.40', '1-3 dk'],
  ['Video + ses', 'saniye başı ~$0.05 (standart) / ~$0.08 (yüksek)', '1-3 dk'],
  ['Hareketli sticker, gerçek hareket', 'Sticker + ~$0.12', '1-2 dk'],
  ['Sallanan sticker, paket ikonu', 'Ücretsiz', '5-20 sn'],
]

const PROMPT_EXAMPLES = [
  {
    kind: 'Banner',
    text: 'Yazılar: Başlık "%500 FREESPIN BONUSU", Buton "HEMEN KATIL". Konu: freespin kampanyası. Karakter: şimşek tutan Zeus. Sahne: altın paralar ve mor bulutlar. Stil: 3D.',
  },
  {
    kind: 'Banner',
    text: 'Yazılar: Başlık "FENERBAHÇE - GALATASARAY", Alt yazı "ORAN 3.50". Konu: derbi için özel oran. Sahne: stadyum ışıkları, ön planda futbol topu. Stil: Gerçekçi.',
  },
  {
    kind: 'Sticker',
    text: 'Konu: kod geliyor haberi. Karakter: göz kırpan sevimli altın aslan, elinde para torbası. Sticker üstü yazı: KOD GELİYOR!',
  },
  {
    kind: 'Hareket (GIF, video, sticker)',
    text: 'Ne hareket etsin: karakter yavaşça kılıcını kaldırıyor, arkadan altın paralar yağıyor. Kamera: yavaşça yaklaşır.',
  },
]

const HINTS: Record<Exclude<Section, 'guide'>, { title: string; body: string }> = {
  create: {
    title: 'Nasıl üretilir?',
    body: 'İşi ve markayı seç, format(lar)ı işaretle, başlık ve buton yazısını kendi alanlarına yaz; konu, sahne, karakter ve stil alanlarında sadece görseli anlat. Hazır tarif seçersen alanlar dolar, "İsteği geliştir" kısa yazdığını ayrıntılandırır. Logo ve yazılar yapay zekaya çizdirilmez; orijinal logo ve gerçek fontla birebir basılır.',
  },
  brands: {
    title: 'Marka kiti nedir?',
    body: 'Her bahis sitesi için ayrı kit. Domain yazıp "Siteden çek" dersen logo, renk ve font otomatik gelir. Her üretim seçilen kitin kimliğiyle çıkar, siteler birbirine karışmaz.',
  },
  library: {
    title: 'Kütüphane ne işe yarar?',
    body: 'Sağlayıcı portallarından aldığın oyun klasörleri burada durur. Her görselin türü eklenirken belirlenir; üretimde oyunun adını yazdığında en iyi karakter, logo ve arka plan kendiliğinden seçilir.',
  },
}

export function StudioHint({ section, onOpenGuide }: { section: Section; onOpenGuide: () => void }) {
  if (section === 'guide') return null
  const hint = HINTS[section]
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
      <Lightbulb className="size-5 shrink-0 text-primary" aria-hidden />
      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
        <strong className="text-foreground">{hint.title}</strong> {hint.body}
      </p>
      <button
        type="button"
        onClick={onOpenGuide}
        className="flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary sm:self-auto"
      >
        <BookOpen className="size-3.5" aria-hidden /> Detaylı rehber
      </button>
    </div>
  )
}

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <h3 className="font-display text-lg font-bold uppercase text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {i + 1}
          </span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  )
}

const b = (text: string) => <strong className="text-foreground">{text}</strong>

export function StudioGuide({ onNavigate }: { onNavigate: (section: Section) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="font-display text-2xl font-bold uppercase text-foreground">Stüdyo rehberi</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Anlaşmalı her bahis sitesi için o sitenin logosu ve renkleriyle banner, sticker, hareketli GIF ve video üretirsin. Üretimleri sadece sen yaparsın, her şey bu panelde kalır.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {QUICK_START.map((step, i) => (
            <button
              key={step.title}
              type="button"
              onClick={() => onNavigate(step.target)}
              className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4 text-left hover:border-primary"
            >
              <span className="text-xs font-bold uppercase text-primary">Adım {i + 1}</span>
              <span className="font-bold text-foreground">{step.title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{step.body}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block icon={<Palette className="size-5" aria-hidden />} title="1. Marka kiti kurulumu">
          <Steps
            items={[
              <>Üstten {b('Marka kitleri')} sekmesine geç.</>,
              <>{b('Domain')} kutusuna sitenin o anki güncel adresini yaz (örn. siteadi123.com). Site domain değiştirdiyse yenisini yaz.</>,
              <>{b('Siteden çek')} butonuna bas. Sistem siteye girip logoyu, ana renkleri ve fontu getirir.</>,
              <>Logo önizlemesini kontrol et. Yanlış veya bulanıksa {b('Logo yükle')} ile kendi PNG/SVG dosyanı yükle. Şeffaf arka planlı logo en temiz sonucu verir.</>,
              <>Logo görsele yapıştırılmaz, yerleştirilir: boş kenarı atılır, şekline göre boyutlanır (kare amblem ile uzun yazı logosu aynı ağırlıkta durur), altındaki görsel parlak ya da karışıksa üstten hafif bir karartma eklenir. Koyu renkli logo açık bir plakaya oturur; düz zeminli yüklenen logonun zemini kendiliğinden kesilir.</>,
              <>Renkleri kontrol et. Gerekirse renk kutucuğuna tıklayıp değiştir, {b('+ Renk')} ile ekle, {b('×')} ile sil. İlk renk ana renk sayılır.</>,
              <>{b('Marka notları')} alanına sabit tarzı yaz (örn. "koyu lacivert zemin, altın vurgular, aslan maskotu"). Her üretimde otomatik kullanılır.</>,
              <>{b('Kaydet')}. Her site için bunu bir kez yapman yeterli. Domain değişirse kiti {b('Düzenle')} ile açıp güncelle.</>,
            ]}
          />
        </Block>

        <Block icon={<ImagePlus className="size-5" aria-hidden />} title="2. Sağlayıcı kütüphanesi">
          <Steps
            items={[
              <>{b('Sağlayıcı kütüphanesi')} sekmesine geç.</>,
              <>{b('Sağlayıcı')} adını yaz (örn. Pragmatic Play). Daha önce yazdıkların listede çıkar.</>,
              <>{b('Oyun adı')}nı portaldaki gibi yaz (örn. Big Bass Halloween Splash 1000). Otomatik seçim bu adla çalışır; ad yazılmayan görseller sadece elle seçilir.</>,
              <>Oyunun klasörünü olduğu gibi ekle: {b('Dosyaları seç')} ile hepsini işaretle, {b('Klasör seç')} ile klasörü ver ya da görselleri kutuya sürükle. Sayı sınırı yok, parça parça yüklenir ve kaçıncı görselde olduğu yazar. Linkleri {b('Linklerden ekle')} kutusuna her satıra bir link gelecek şekilde de yapıştırabilirsin.</>,
              <>Her görsel eklenirken bir kez incelenir ve türü yazılır: {b('Karakter')}, {b('Oyun logosu')}, {b('Arka plan')}, {b('Sembol')}, {b('Nesne')}, {b('Diğer')}. Yanına 1-10 arası bir puan düşer; harf sembolleri, logonun beyaz kopyası ve boş çerçeveler düşük puan alır. Bu inceleme görsel başına 1 sentin altındadır ve aylık harcamaya eklenir.</>,
              <>Üstünde {b('Otomatik')} yazan görseller, o oyunun adı üretim formunda geçtiğinde kendiliğinden kullanılacak olanlardır: en iyi karakter, renkli logo ve arka plan. Tür yanlışsa listeden değiştir; başka bir görselin kullanılmasını istiyorsan yıldıza bas, yıldızlı görsel öne geçer.</>,
              <>Türü belirlenemeyen görsel olursa oyunun satırında {b('Etiketle')} düğmesi çıkar. Etiketsiz görsel otomatik seçilmez, elle seçilebilir.</>,
              <>Üretim formunda oyunun adını yazınca seçilen görseller formun içinde görünür. {b('Kendim seçeyim')} ile değiştirir, {b('Kullanma')} ile o üretimde hiç kullanmazsın. {b('Referans görseli elle seç')} bölümünden en fazla 3 görseli kendin de işaretleyebilirsin.</>,
            ]}
          />
          <p className="flex gap-2 rounded-xl bg-secondary p-3 text-xs leading-relaxed text-muted-foreground">
            <Lightbulb className="size-4 shrink-0 text-primary" aria-hidden />
            En iyi referanslar: arka planı temiz karakter görselleri ve oyunun key art görselleri. Ekran görüntüsü yerine orijinal dosyaları kullan.
          </p>
        </Block>

        <Block icon={<ImagePlus className="size-5" aria-hidden />} title="3. Banner üretimi">
          <Steps
            items={[
              <>{b('Üret')} sekmesinde {b('Görsel / Banner')} seç.</>,
              <>{b('Marka')} listesinden siteyi seç. Altında o sitenin logosu ve renkleri görünür, doğru site olduğunu kontrol et.</>,
              <>{b('Formatlar')}: 1:1 kare post, 9:16 hikâye/Reels, 16:9 site banner. Birden fazla işaretlersen hepsi aynı anda üretilir.</>,
              <>{b('Kategori')} seç (Casino, Spor Bahisi, Slot vb.).</>,
              <>{b('Kalite')}: Standart (1024 px) hızlı deneme için, Yüksek (2048 px) paylaşım için, En yüksek daha büyük modelle çizilir (ışık, doku ve ayrıntı daha iyi, görsel başına ücret daha yüksek).</>,
              <>Her üretimde yazdığın istek önce ayrıntılı bir sahne tarifine çevrilir; kısa ya da Türkçe harfsiz yazsan da (papagan, cay bardagi) ne istediğin anlaşılır. Bu adım görsel başına yaklaşık 1 sent tutar ve işin ücretine eklenir.</>,
              <>{b('Görsel üstü yazılar')}: başlık, alt yazı ve buton metnini kendi kutularına yaz. Bunlar gerçek fontla basılır, harf hatası olmaz. Türkçe harfsiz yazdıysan (HOS GELDIN) harfleri düzeltilir (HOŞ GELDİN); kelimelerin, rakamların ve marka adların değişmez.</>,
              <>Kutuları boş bırakıp konuya yazıyı yazarsan (&quot;üstünde büyük ödül seni bekliyor yazsın, buton: şimdi katıl&quot;) o yazı ayıklanır ve yine gerçek fontla basılır. İstekte geçmeyen hiçbir yazı basılmaz; yazı istemediysen görsel yazısız çıkar. Yapay zeka görsele artık kendi eliyle yazı çizmez.</>,
              <>Rakam ya da % içeren kelimeler vurgu rengiyle basılır; rakam yoksa başlığın son satırı vurgulanır. Basılan yazıyı beğenmezsen kartta {b('Revize')} deyip sadece yazıyı değiştir: {b('Yazıyı güncelle')} ücretsizdir.</>,
              <>Formu doldur: {b('Konu')} (zorunlu), {b('Sahne ve arka plan')}, {b('Karakter ya da ana nesne')}, {b('Stil')} (Otomatik, 3D, Çizgi, Gerçekçi) ve istersen {b('Renkler')}. Bu alanlara yazı yazma; yazılar kendi kutularına girer.</>,
              <>Sıfırdan yazmak istemezsen {b('Hazır tarifler')}den birine bas (freespin, maç günü, canlı casino, turnuva); alanlar dolar, sonra kendine göre değiştirirsin.</>,
              <>Kısa yazdıysan {b('İsteği geliştir')} düğmesi alanları daha ayrıntılı hale getirir. Görsel üretmez; sonucu okuyup düzeltirsin.</>,
              <>Formda kütüphanedeki bir oyunun adı geçiyorsa o oyunun en iyi karakteri, logosu ve arka planı kendiliğinden kullanılır; seçilenler formda görünür. Oyun logosu görsele olduğu gibi konur, karakter aynı kalır, sahne oyunun arka planında kurulur.</>,
              <>{b('Üret')} butonuna bas. Butonda tahmini maliyet yazar. 15-40 saniyede sağ tarafta çıkar.</>,
            ]}
          />
        </Block>

        <Block icon={<Sticker className="size-5" aria-hidden />} title="4. Sticker üretimi">
          <Steps
            items={[
              <>{b('Sticker')} türünü seç ve markayı belirle.</>,
              <>{b('Konu')} ve {b('Karakter')} alanlarını doldur ya da hazır tarif seç (Kod geldi, Kazandık, Bol şans, Az kaldı). Üstündeki kısa yazıyı {b('Sticker üstü yazı')} kutusuna yaz: KOD GELİYOR! Sticker yazısını yapay zeka çizer (yazı çizimin parçasıdır); Türkçe harfsiz yazdıysan harfleri düzeltilip modele harf harf verilir. Yine de uzun yazıda harf hatası çıkabilir, kısa tut.</>,
              <>{b('Beyaz kenar çizgisi ekle')} açıkken stickerın çevresine her yerde aynı kalınlıkta beyaz kenar basılır. Kutuyu kapatırsan beyaz kenar basılmaz, çizim olduğu gibi çıkar; bu durumda koyu renkli yazı Telegram&apos;ın koyu temasında zor okunur. Revizede stickerın kenarı neyse o kalır: kenarlı sticker kenarlı, kenarsız sticker kenarsız döner.</>,
              <>Sticker şeffaf arka planla, Telegram ölçüsünde (512 px) ve sıkıştırılmadan çıkar; arkası damalı görünür, bu normaldir. {b('İndir (Telegram)')} bu dosyayı verir; {b('HD indir (PNG)')} aynı stickerın 1024 px&apos;lik büyük halidir (afiş, site, sosyal medya için).</>,
              <>Model stickerı görselin kenarından taşırıp kesik çizerse sistem bunu fark eder ve aynı stickerı küçültüp tam haliyle bir kez daha çizdirir. Bu durumda o üretim iki görsel ücreti tutar ve kartta &quot;bir kez yeniden çizildi&quot; yazar.</>,
              <>{b('Revize')} sadece yazdığın şeyi değiştirir, geri kalan her şey olduğu gibi kalır. Sadece değişecek kısmı yaz: &quot;soru işareti kırmızı olsun&quot;.</>,
              <>{b('Hareketli sticker')}: {b('Ne hareket etsin')} alanını yaz, {b('Hareketlisini de üret')} kutusunu işaretle ya da hazır stickerın altındaki {b('Hareketlendir')} düğmesine bas. Karakter gerçekten hareket eder; çıktı Telegram&apos;ın kabul ettiği 3 saniyelik, şeffaf video stickerdır. 1-2 dakika sürer ve ücretlidir.</>,
              <>{b('Sallanma · ücretsiz')} düğmesi stickerı olduğu gibi hafifçe sallar; yapay zeka çalışmaz.</>,
              <>Hareketli stickerda sticker bütün olarak kalır: karakter, yanındaki nesneler ve yazı hareket ederken kesilmez; kol kaldırma, eğilme, sallanma gibi hareketleri rahatça isteyebilirsin. Modelin yeşil zemine ayrıca çizdiği, stickera değmeyen fazlalıklar (yazı, şimşek, kutu) kendiliğinden atılır. Stickera yapışık çizilen bir fazlalık kalabilir; öyle olursa bir kez daha hareketlendir.</>,
              <>Sticker boş kenarı atılarak hazırlanır: uzun kenarı tam 512 px olur ve hareketin kapladığı alan kareyi doldurur, böylece Telegram&apos;da küçük görünmez. Hareket ne kadar genişse karakter o kadar küçük görünür. Hareketli sticker, stickerın büyük halinden üretilir ve Telegram&apos;ın 256 KB sınırına sığan en yüksek kaliteyle verilir (sade hareket 30, yoğun hareket 24 kare/sn); kartın altında ölçüsü, süresi ve boyutu yazar.</>,
              <>{b('İndir')} ile al. Hareketli sticker bir .webm dosyasıdır ve Telegram&apos;a sadece @Stickers botuyla eklenir: botu aç, yeni paket için {b('/newvideo')} (hazır paketine eklemek için {b('/addsticker')}) yaz, dosyayı gönder, botun istediği emojiyi yolla, yeni pakette {b('/publish')} ile yayınla. Aynı adımlar hareketli stickerın kartında {b('Telegram\'a nasıl eklenir?')} başlığında da durur.</>,
              <>Telegram&apos;ın sticker panelindeki {b('+')} düğmesi (sticker düzenleyicisi) sadece fotoğraf alır; hareketli sticker oradan eklenmez.</>,
            ]}
          />
        </Block>

        <Block icon={<Film className="size-5" aria-hidden />} title="5. Hareketli GIF">
          <Steps
            items={[
              <>Yöntem A: {b('Hareketli GIF')} işini seçip üret. Önce banner yapılır, ardından otomatik GIF&apos;e çevrilir.</>,
              <>Yöntem B: Daha önce ürettiğin bir banner&apos;ın altındaki {b('Hareketlendir')} butonuna bas, açılan panelde {b('Hareketli GIF')} seç.</>,
              <>{b('Gerçek hareket')}: karakter ve sahne gerçekten oynar. {b('Ne hareket etsin')} ve {b('Kamera ne yapsın')} alanlarını doldur, süreyi (4 ya da 6 sn) ve kaliteyi (Standart / Yüksek) seç. Ücretlidir, 1-3 dakika sürer.</>,
              <>{b('Işık efekti')}: görsel durur, üstünden ışık geçer. {b('Ücretsizdir')}, birkaç saniyede biter.</>,
              <>İki yöntemde de logo ve yazılar hareket bittikten sonra üstüne basılır, bu yüzden bozulmaz.</>,
            ]}
          />
        </Block>

        <Block icon={<Clapperboard className="size-5" aria-hidden />} title="6. Video üretimi">
          <Steps
            items={[
              <>{b('Video')} türünü seç ya da hazır bir banner&apos;da {b('Hareketlendir')} butonuna bas.</>,
              <>{b('Ne hareket etsin')} alanına ne olacağını yaz: "karakter kılıcını kaldırıyor, paralar yağıyor". Boş bırakırsan hafif sinematik hareket yapılır. {b('Kamera ne yapsın')} listesinden kamerayı seç (sabit, yaklaşır, uzaklaşır, döner, yana kayar).</>,
              <>{b('Süre')}: 4, 6 veya 8 saniye. {b('Kalite')}: Standart (720p, ucuz) ya da Yüksek (1080p). {b('Ses / müzik')} kutusunu istersen işaretle (biraz daha pahalı).</>,
              <>{b('Video üret')}. 1-3 dakika sürer, bu sürede sayfayı kapatma. Bitince kartın içinde oynatılır.</>,
              <>Video banner&apos;ın formatında çıkar: 1:1 banner kare, 9:16 dikey, 16:9 yatay video olur.</>,
            ]}
          />
          <p className="flex gap-2 rounded-xl bg-secondary p-3 text-xs leading-relaxed text-muted-foreground">
            <TriangleAlert className="size-4 shrink-0 text-primary" aria-hidden />
            Video seçtiğin kalitede çıkar (yeni üretimlerde varsayılan Standart, 720p). Video çerçevesini tam doldurmayan formatlarda (ör. kare) kamera sabit durur. Model sadece yazısız ve logosuz görseli hareketlendirir; logo ve yazı kutularına yazdıkların video bittikten sonra üstüne basılır, bu yüzden eğilmez ve bozulmaz. Yazıyı talimatla yapay zekaya çizdirdiğin eski üretimlerde model yazıyı hâlâ kaydırabilir.
          </p>
        </Block>

        <Block icon={<RefreshCw className="size-5" aria-hidden />} title="7. Revize, indirme, silme">
          <Steps
            items={[
              <>{b('Revize')}: kartın altındaki butona bas, görseldeki değişikliği yaz ("karakter erkek olsun"), {b('Revizeyi üret')} de. Aynı düzen korunur, logo ve yazılar yeniden temiz basılır.</>,
              <>{b('Sadece yazı değişecekse')}: revize panelinde yazı kutularını düzelt, talimatı boş bırak, {b('Yazıyı güncelle')} de. Yapay zeka çalışmaz, ücretsizdir ve birkaç saniyede biter.</>,
              <>{b('İndir')}: dosya tam kalitede cihazına iner (banner PNG, GIF, video MP4).</>,
              <>{b('Sil')}: çöp kutusu ikonu. Silinen iş geri gelmez.</>,
              <>Üstteki sayaç bu ayki ve toplam harcamayı gösterir.</>,
            ]}
          />
        </Block>

        <Block icon={<Wallet className="size-5" aria-hidden />} title="Fiyat ve süre tablosu">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">İş</th>
                  <th className="py-2 pr-3 font-semibold">Adet ücreti</th>
                  <th className="py-2 font-semibold">Süre</th>
                </tr>
              </thead>
              <tbody>
                {PRICES.map(([name, price, time]) => (
                  <tr key={name} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 font-semibold text-foreground">{name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{price}</td>
                    <td className="py-2 text-muted-foreground">{time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Ücretler Vercel AI Gateway bakiyenden düşer. Üretim sunucuda yapıldığı için site ve panel kasmaz.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Aylık harcama tavanını ve harcanan tutarı sadece ana yönetici görür; tavanı ekranın sağ üstünden o koyar. Diğer hesaplara yalnızca
            tavan dolduğunda uyarı çıkar. Tavanın %80&apos;i dolunca uyarı çıkar, tavan dolunca ücretli üretim
            ay başına kadar kapanır; yazı güncelleme, ışık efektli GIF, sallanan sticker ve paket ikonu gibi ücretsiz işlemler çalışmaya devam eder. Sayaç liste
            fiyatlarından hesaplanan tahmindir, kesin tutar Vercel faturasında yazar.
          </p>
        </Block>
      </div>

      <Block icon={<Lightbulb className="size-5" aria-hidden />} title="İyi istek örnekleri">
        <div className="grid gap-3 md:grid-cols-2">
          {PROMPT_EXAMPLES.map((ex) => (
            <div key={ex.text} className="flex flex-col gap-1.5 rounded-xl border border-border bg-background p-4">
              <span className="text-xs font-bold uppercase text-primary">{ex.kind}</span>
              <p className="text-sm leading-relaxed text-foreground">{ex.text}</p>
            </div>
          ))}
        </div>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
          <li>{b('Yazıyı yazı kutusuna yaz.')} Başlık, alt yazı, buton ve sticker yazısı kendi kutularından birebir basılır. Konu ya da sahne alanına yazdığın yazı fikir olarak gider, birebir basılmaz.</li>
          <li>{b('Kısa başlık kullan.')} 2-5 kelimelik başlıklar en net sonucu verir.</li>
          <li>{b('Renk söyleme.')} Renkler marka kitinden gelir. Sadece istisna varsa yaz.</li>
          <li>{b('Logo isteme.')} Logo zaten otomatik ve kusursuz basılır. Talimata logo yazarsan ikinci, bozuk bir logo çıkabilir.</li>
          <li>{b('Gerçek sağlayıcı karakterleri')} birebir kopyalamak telif riski taşır. Kendi maskotlarınız uzun vadede en güvenlisi.</li>
        </ul>
      </Block>
    </div>
  )
}
