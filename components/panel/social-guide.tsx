import { FeatureGuide, guideCode as code, type GuideStep } from '@/components/panel/feature-guide'

const ol = 'flex list-decimal flex-col gap-1.5 pl-5'

const STEPS: GuideStep[] = [
  {
    title: 'Resmi hesaplarını ekle (Instagram, X, YouTube)',
    body: (
      <ol className={ol}>
        <li>
          <b>Resmi hesaplarımız</b> kartında her platformun profil linkini tam olarak yapıştır (ör. <span className={code}>https://instagram.com/alkanka</span>) ve <b>Kaydet</b>’e bas.
        </li>
        <li>Kaydedilen hesaplar sol menüde “Siteyi keşfet” altında logolarıyla görünür ve üyeler tek tıkla takip eder.</li>
        <li>Boş bıraktığın platform sitede gizlenir. Hesap adın değişirse sadece linki güncellemen yeter.</li>
      </ol>
    ),
  },
  {
    title: 'Üye hesabı doğrulama',
    body: (
      <ol className={ol}>
        <li>
          Üye, profilindeki <b>Sosyal medya</b> sekmesinden platform seçip kullanıcı adını girer. Sistem ona özel bir doğrulama kodu verir (ör. <span className={code}>KANKA-7F3A1C</span>).
        </li>
        <li>Üye bu kodu kendi hesabının açıklamasına (bio) yazar. Kayıt buraya “bekliyor” olarak düşer.</li>
        <li>
          Listede <b>@kullanıcıadı</b> linkine tıklayıp profili aç. Bio’da kod var mı, hesap gerçek mi (gönderi, takipçi, eski hesap) kontrol et.
        </li>
        <li>Uygunsa <b>Onayla</b>. Kod yoksa ya da hesap yeni açılmış boş bir hesapsa ret nedenini yazıp <b>Reddet</b>. Üye nedeni profilinde görür ve tekrar deneyebilir.</li>
        <li>Onaydan sonra üye kodu bio’sundan silebilir. Üye kullanıcı adını değiştirirse yeni kod üretilir ve hesap tekrar onaya düşer.</li>
      </ol>
    ),
  },
  {
    title: 'Etkinlik oluştur: takip et, yorum yap, KP kazan',
    body: (
      <ol className={ol}>
        <li>Önce resmi hesabında bir etkinlik gönderisi paylaş ve linkini kopyala.</li>
        <li>
          <b>Yeni sosyal medya etkinliği</b> formunda platformu seç, kısa bir başlık yaz (ör. “Takip et + yorum yap, 50 KP kazan”).
        </li>
        <li>Açıklamaya kuralları yaz: hesabı takip et, gönderiye en az 3 kelimelik yorum yap, arkadaşını etiketle vb.</li>
        <li>Gönderi linkini, KP ödülünü ve istersen bitiş tarihini gir, <b>Yayınla</b>’ya bas.</li>
        <li>Etkinlik üyelerin profilindeki <b>Sosyal medya</b> sekmesinde görünür. Sadece hesabı doğrulanmış üyeler katılabilir, her üye bir kez.</li>
      </ol>
    ),
  },
  {
    title: 'Etkinlikleri yönet',
    body: (
      <ol className={ol}>
        <li>
          <b>Etkinlikler</b> listesinde her etkinliğin platformu, ödülü ve katılım sayısı görünür.
        </li>
        <li>
          <b>Kapat</b> ile katılımı durdurursun, <b>Aç</b> ile tekrar açarsın. Bitiş tarihi geçen etkinlik kendiliğinden kapanır.
        </li>
        <li>Çöp kutusu etkinliği ve tüm katılımlarını siler. Daha önce verilen KP geri alınmaz.</li>
      </ol>
    ),
  },
  {
    title: 'Katılım onayı ve ödül',
    body: (
      <ol className={ol}>
        <li>Üye gönderiye yorum yapar, yorumunun linkini profilinden gönderir. Kayıt <b>Katılım onayı</b> listesine düşer.</li>
        <li>
          <b>Yorumu aç</b> ile kontrol et: yorum üyenin doğrulanmış hesabından mı, hesabı takip ediyor mu, yorum anlamlı mı (spam, tek emoji değil)?
        </li>
        <li>Uygunsa <b>Onayla</b>. Ödül KP üyenin bakiyesine otomatik yazılır ve profilinde görünür.</li>
        <li>Kurallara uymuyorsa <b>Reddet</b>. Üye “Kurallara uymuyor” notunu görür.</li>
      </ol>
    ),
  },
]

export function SocialGuide() {
  return (
    <FeatureGuide
      title="Sosyal medya rehberi"
      subtitle="Resmi hesaplar, üye hesap doğrulama ve takip et / yorum yap etkinlikleri nasıl çalışır"
      steps={STEPS}
    />
  )
}
