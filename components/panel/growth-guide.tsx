import { FeatureGuide, guideCode as code, type GuideStep } from '@/components/panel/feature-guide'

const ol = 'flex list-decimal flex-col gap-1.5 pl-5'

const STEPS: GuideStep[] = [
  {
    title: 'Kampanya linki: hangi kanal üye getiriyor?',
    body: (
      <ol className={ol}>
        <li>
          <b>Kaynak etiketi</b> alanına kanalın adını yaz (ör. <span className={code}>sms-ekim</span>, <span className={code}>tg-kanal</span>, <span className={code}>mail-bulten</span>). Sadece harf, rakam, - ve _ kullanılır.
        </li>
        <li>
          <b>Sayfa</b> alanına ziyaretçinin açılacağı sayfayı yaz (ör. <span className={code}>/oyunlar/cark</span>). Boş bırakırsan ana sayfa açılır.
        </li>
        <li>
          <b>Kopyala</b> ile linki al ve SMS, mail ya da Telegram postunda kullan. Linkin sonunda <span className={code}>?src=etiket</span> olur.
        </li>
        <li>Link ile gelen ziyaretçi 30 gün boyunca o kaynağa yazılır. Bu sürede kayıt olursa ya da sponsor butonuna tıklarsa rapora o kaynak adıyla düşer.</li>
      </ol>
    ),
  },
  {
    title: 'Kaynak raporu: sonuçları oku',
    body: (
      <ol className={ol}>
        <li>Rapor son 30 günü gösterir. Her satırda kaynak, o kaynaktan gelen yeni üye, sponsor tıklaması ve tıklayan farklı üye sayısı vardır.</li>
        <li>
          Linksiz gelenler <span className={code}>direkt</span> olarak görünür. Altta site bazında toplam tıklama rozetleri yer alır.
        </li>
        <li>İpucu: Yeni üye sayısı yüksek ama tıklaması düşük kanal ilgi çekiyor ama satış getirmiyor demektir. Kampanyalarını buna göre ayarla.</li>
      </ol>
    ),
  },
  {
    title: 'Giriş adresleri ve adres alarmı',
    body: (
      <ol className={ol}>
        <li>Listede her sponsor sitenin güncel giriş adresini yapıştır ve <b>Kaydet</b>’e bas. Sitedeki tüm “Git” butonları otomatik bu adrese yönlenir ve her tıklama kaydedilir.</li>
        <li>
          Site adres değiştirdiğinde (kapanma, yeni domain) yalnızca yeni adresi yaz. <b>Adres değişince takipçilere bildir</b> işaretliyse, o siteyi takip eden üyelere push bildirimi ve Telegram özel mesajı gider.
        </li>
        <li>
          Üyeler bir siteyi <span className={code}>/siteler/[site]</span> sayfasındaki zil (adres alarmı) butonuyla takip eder. Takipçi sayısı her sitenin adının altında görünür.
        </li>
        <li>Adresi boş bırakırsan site, kayıtlı varsayılan affiliate linkini kullanmaya devam eder.</li>
      </ol>
    ),
  },
  {
    title: 'Sponsor hesap onayı',
    body: (
      <ol className={ol}>
        <li>Üye, profilindeki <b>Sponsor hesaplarım</b> kartından site seçip o sitedeki kullanıcı adını bağlar. Kayıt buraya “bekliyor” olarak düşer.</li>
        <li>Sponsorun affiliate panelinde bu kullanıcı adının senin referansınla kayıtlı olup olmadığını kontrol et.</li>
        <li>
          Kayıtlıysa <b>Onayla</b>. Değilse <b>Reddet</b> ve sebebini yaz (ör. “Referansımızla kayıtlı değil”). Üye sebebi profilinde görür.
        </li>
        <li>Sadece onaylı hesaplar aylık çevrim sıralamasına girer.</li>
      </ol>
    ),
  },
  {
    title: 'Çevrim verisi yükle ve aylık sıralama',
    body: (
      <ol className={ol}>
        <li>Sponsorun affiliate panelinden ilgili ayın oyuncu raporunu (Excel/CSV) indir.</li>
        <li>
          Kullanıcı adı ve çevrim tutarı sütunlarını kopyala, her satır <span className={code}>kullanıcıadı,tutar</span> olacak şekilde kutuya yapıştır. Ondalık için nokta kullan (ör. <span className={code}>8250.50</span>).
        </li>
        <li>
          Site ve dönemi (<span className={code}>YYYY-AA</span>, ör. <span className={code}>2026-10</span>) seç, <b>Yükle</b>’ye bas. Aynı site ve dönem için eski veri silinip yenisi yazılır, yani ay içinde istediğin kadar güncelleyebilirsin.
        </li>
        <li>
          Eşleşen onaylı üyeler <span className={code}>/siralama</span> sayfasındaki çevrim tablosunda anında görünür. Eşleşmeyen kullanıcı adları yok sayılır.
        </li>
        <li>Ay sonunda ilk sıralardaki üyelere ödülünü verip duyurusunu Telegram’dan yapabilirsin.</li>
      </ol>
    ),
  },
  {
    title: 'Çoklu hesap şüphesi: otomatik koruma',
    body: (
      <ol className={ol}>
        <li>Aynı ağdan (IP) 7 gün içinde 3. hesap açıldığında hesap otomatik işaretlenir ve bu listeye düşer.</li>
        <li>İşaretli üyenin davet ödülleri durur, aynı ağdan gelen davetler sayılmaz.</li>
        <li>Aynı evde yaşayan ya da kafe/iş yeri ağı kullanan gerçek kullanıcılar da düşebilir. Kontrol edip gerçekse <b>İşareti kaldır</b>.</li>
      </ol>
    ),
  },
  {
    title: 'Rütbe sistemi: Bronz, Gümüş, Altın, Plat',
    body: (
      <ol className={ol}>
        <li>Panelde ayar gerekmez. Rütbe üyenin seviyesine göre otomatik atanır: Bronz (başlangıç), Gümüş (seviye 4), Altın (seviye 7), Plat (seviye 10).</li>
        <li>Rütbe, üyenin profilinde, sıralamalarda ve arena masalarında adının yanında görünür.</li>
        <li>
          <b>Otomatik avantaj:</b> Davet ödülü rütbeye göre çarpılır (Gümüş x1.1, Altın x1.25, Plat x1.5).
        </li>
        <li>
          <b>Senin uyguladığın avantajlar:</b> Gümüş ve üstüne market öncelikli teslim, Altın ve üstüne özel çekiliş katılımı, Plat’a aynı gün market teslimi. Market siparişlerini onaylarken üyenin rütbesine bakarak sıralayabilirsin.
        </li>
      </ol>
    ),
  },
]

export function GrowthGuide() {
  return (
    <FeatureGuide
      title="Büyüme rehberi"
      subtitle="Kampanya linkleri, kaynak raporu, adres alarmı, sponsor hesapları, çevrim sıralaması ve rütbeler nasıl çalışır"
      steps={STEPS}
    />
  )
}
