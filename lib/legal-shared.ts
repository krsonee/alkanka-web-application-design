export const LEGAL_KEY = 'legal'

export type LegalSlug = 'kullanim-kosullari' | 'gizlilik' | 'kvkk' | 'cerez' | 'sorumlu-oyun'

export type LegalDoc = { slug: LegalSlug; title: string; summary: string; body: string }

export type LegalOverrides = Partial<Record<LegalSlug, { title?: string; body?: string }>>

export const LEGAL_MAX = 20000

const CONTACT = 'info@alkanka.com'

export const LEGAL_DEFAULTS: LegalDoc[] = [
  {
    slug: 'kullanim-kosullari',
    title: 'Kullanım Koşulları',
    summary: 'Siteyi kullanırken kabul ettiğin kurallar.',
    body: `## Genel
AL KANKA bağımsız bir tanıtım, topluluk ve ödül platformudur. Siteye üye olarak bu koşulları kabul etmiş sayılırsın.

## Üyelik
- Üye olmak için 18 yaşından büyük olmalısın.
- Her kişi yalnızca bir hesap açabilir. Aynı kişiye ait birden fazla hesap tespit edilirse hesaplar kapatılır ve kazanımlar silinir.
- Hesap bilgilerini güvende tutmak senin sorumluluğundur.

## Kanka Coin ve Kanka Puan
- Kanka Coin (KC) ve Kanka Puan (KP) site içi sanal değerlerdir, nakde çevrilemez ve başka hesaba devredilemez.
- Market ödülleri stok ve onaya bağlıdır. AL KANKA, kötüye kullanım şüphesinde ödül talebini reddetme hakkını saklı tutar.
- Hile, bot, otomasyon veya açık kullanarak elde edilen kazanımlar uyarı yapılmadan geri alınır.

## Oyunlar
Mini oyunlar eğlence amaçlıdır ve ücretsizdir. Oyunlarda gerçek para kazanılmaz veya kaybedilmez.

## Sponsor siteler
Sitede yer alan sponsor bağlantıları üçüncü taraf sitelere yönlendirir. Bu sitelerdeki işlemlerden AL KANKA sorumlu değildir. Üye olmadan önce ilgili sitenin kurallarını oku.

## Davranış kuralları
Sohbet ve masalarda hakaret, taciz, spam ve reklam yasaktır. Kurallara uymayan hesaplar kısıtlanabilir veya kapatılabilir.

## Değişiklikler
Bu koşullar güncellenebilir. Güncel metin her zaman bu sayfadadır.

## İletişim
${CONTACT}`,
  },
  {
    slug: 'gizlilik',
    title: 'Gizlilik Politikası',
    summary: 'Hangi bilgileri topladığımız ve nasıl kullandığımız.',
    body: `## Topladığımız bilgiler
- Hesap bilgileri: kullanıcı adı, e-posta, isteğe bağlı telefon.
- Bağladığın hesaplar: Telegram, sosyal medya ve sponsor kullanıcı adları.
- Kullanım bilgileri: oyun sonuçları, görev ilerlemesi, puan hareketleri, giriş zamanları ve güvenlik amaçlı IP adresi.

## Nasıl kullanıyoruz
- Hesabını açmak ve korumak
- Görev, puan ve ödülleri hesaplamak
- Çoklu hesap ve hile tespiti
- Duyuru ve bildirim göndermek (izin verdiysen)

## Paylaşım
Bilgilerini satmayız. Yalnızca barındırma ve e-posta gibi hizmet sağlayıcılarla, hizmetin çalışması için gerektiği kadar paylaşırız. Yasal zorunluluk hâlinde yetkili makamlara bilgi verilebilir.

## Saklama
Bilgiler hesabın açık olduğu sürece saklanır. Hesabını kapattığında kişisel bilgilerin silinir; güvenlik kayıtları yasal süre boyunca tutulabilir.

## Hakların
Bilgilerine erişme, düzeltme ve silinmesini isteme hakkın var. Talebini ${CONTACT} adresine yazabilirsin.`,
  },
  {
    slug: 'kvkk',
    title: 'KVKK Aydınlatma Metni',
    summary: '6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında aydınlatma.',
    body: `## Veri sorumlusu
AL KANKA (iletişim: ${CONTACT})

## İşlenen kişisel veriler
Kimlik (kullanıcı adı), iletişim (e-posta, telefon), işlem güvenliği (IP adresi, giriş kayıtları) ve platform kullanım verileri (oyun, görev, puan hareketleri).

## İşleme amaçları
Üyelik sözleşmesinin kurulması ve ifası, hesap güvenliğinin sağlanması, ödül ve görev süreçlerinin yürütülmesi, hukuki yükümlülüklerin yerine getirilmesi ve açık rıza verilmişse duyuru gönderilmesi.

## Hukuki sebepler
KVKK m.5/2-c (sözleşmenin kurulması ve ifası), m.5/2-ç (hukuki yükümlülük), m.5/2-f (meşru menfaat) ve gerektiğinde m.5/1 (açık rıza).

## Aktarım
Veriler; barındırma, veritabanı ve e-posta hizmeti sağlayıcılarına, yalnızca hizmetin sunulması amacıyla aktarılabilir. Bu sağlayıcıların bir kısmı yurt dışında bulunabilir.

## Toplama yöntemi
Veriler; kayıt formu, profil ayarları ve site kullanımı sırasında elektronik ortamda toplanır.

## Hakların (KVKK m.11)
Verilerinin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme, aktarıldığı kişileri öğrenme, itiraz etme ve zararın giderilmesini talep etme hakların vardır. Başvurularını ${CONTACT} adresine iletebilirsin; en geç 30 gün içinde yanıtlanır.`,
  },
  {
    slug: 'cerez',
    title: 'Çerez Politikası',
    summary: 'Sitede kullanılan çerezler ve amaçları.',
    body: `## Çerez nedir
Çerezler, tarayıcına kaydedilen küçük metin dosyalarıdır.

## Kullandığımız çerezler
- **Zorunlu çerezler:** Oturumunu açık tutar ve hesabını korur. Bunlar olmadan giriş yapılamaz.
- **Tercih çerezleri:** Dil, tema ve tanıtım turunun görülüp görülmediği gibi tercihlerini hatırlar.
- **Ölçüm:** Hangi sayfaların ve sponsorların ilgi gördüğünü anonim olarak sayarız.

Reklam amaçlı üçüncü taraf takip çerezi kullanmayız.

## Çerezleri yönetme
Tarayıcı ayarlarından çerezleri silebilir veya engelleyebilirsin. Zorunlu çerezleri engellersen giriş yapamazsın.`,
  },
  {
    slug: 'sorumlu-oyun',
    title: 'Sorumlu Oyun',
    summary: 'Eğlenceyi kontrol altında tutmak için öneriler.',
    body: `## AL KANKA'daki oyunlar
Sitedeki oyunlar ücretsizdir ve gerçek para içermez. Amaç eğlenmek ve toplulukla vakit geçirmektir.

## Sponsor siteler için
Yönlendirdiğimiz siteler gerçek para ile işlem yapar. Bu siteleri kullanıyorsan:
- Kaybetmeyi göze alabileceğin miktardan fazlasını yatırma.
- Kayıplarını telafi etmek için oynamaya devam etme.
- Oynama süreni ve bütçeni önceden belirle.
- Borç alarak oynama.

## Yardım
Kontrolü kaybettiğini düşünüyorsan ara ver ve yardım al. Yeşilay Danışmanlık Merkezi (YEDAM): **115**

18 yaşından küçükler bu siteyi kullanamaz.`,
  },
]

export const isLegalSlug = (v: string): v is LegalSlug => LEGAL_DEFAULTS.some((d) => d.slug === v)

export function mergeLegal(overrides: LegalOverrides | null | undefined): LegalDoc[] {
  return LEGAL_DEFAULTS.map((d) => {
    const o = overrides?.[d.slug]
    return { ...d, title: o?.title?.trim() || d.title, body: o?.body?.trim() || d.body }
  })
}
