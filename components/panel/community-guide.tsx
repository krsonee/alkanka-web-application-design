import { BookOpen, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

export type CommunityTab = 'reviews' | 'kanit' | 'complaints' | 'league'

type Step = { title: string; body: ReactNode }

const code = 'rounded bg-background px-1.5 py-0.5 font-mono text-xs text-foreground'

const STEPS: Step[] = [
  {
    title: 'Yorum onayı: üye yorumlarını yayınla',
    body: (
      <ol className="flex list-decimal flex-col gap-1.5 pl-5">
        <li>
          Üyeler <span className={code}>/guven</span> sayfasından bir siteye 1-5 yıldız ve yorum bırakır. Yorumlar sitede hemen görünmez, önce buraya düşer.
        </li>
        <li>
          <b>Yorum onayı</b> sekmesinde her yorumu oku. Uygunsa <b>Yayınla</b>, küfür, reklam ya da asılsız iddia varsa <b>Reddet</b>.
        </li>
        <li>Yayınlanan yorumlar sitenin ortalama puanına eklenir ve üyeye “Güvenilir ses” rozeti kazandırır.</li>
      </ol>
    ),
  },
  {
    title: 'Şikâyet merkezi: sorunu takip et ve çöz',
    body: (
      <ol className="flex list-decimal flex-col gap-1.5 pl-5">
        <li>
          Üyeler <span className={code}>/guven</span> sayfasından site seçip şikâyet açar (aynı anda en fazla 3 açık şikâyet).
        </li>
        <li>
          Şikâyeti oku, durumunu seç: <b>İnceleniyor</b> → <b>Siteye iletildi</b> → <b>Çözüldü</b> ya da <b>Reddedildi</b>.
        </li>
        <li>Yanıt kutusuna üyeye görünecek açıklamayı yaz ve kaydet. Üye bunu profilinde görür.</li>
        <li>Çözülen şikâyet sayısı sitenin güven kartında “çözüm oranı” olarak gösterilir. Partner sitelerle konuşurken bunu koz olarak kullanabilirsin.</li>
      </ol>
    ),
  },
  {
    title: 'Tahmin ligi: soruları seç, maç ekle, sonuçlandır, ödülü teslim et',
    body: (
      <ol className="flex list-decimal flex-col gap-1.5 pl-5">
        <li>
          <b>Sorular ve puanlama</b> sekmesinde yeni maçların hangi sorularla açılacağını seç: maç sonucu (taraf), tam skor, toplam gol alt/üst, karşılıklı gol, ilk yarı sonucu, korner alt/üst, kart alt/üst. Tek soru, birkaç soru ya da hepsi açılabilir.
          Her sorunun lig puanını ve ödülünü (Kanka Coin ya da Kanka Puan) ayrı gir; birden çok soru varsa <b>Hepsini bilene ek ödül</b> de tanımlayabilirsin.
        </li>
        <li>
          <b>Maçlar</b> sekmesinde takvimden maç seçip yayınla ya da takvimde olmayan maçı elle ekle. Elle eklerken o maça özel soru seti seçebilirsin. Yayındaki bir maçın soruları, ona ilk tahmin gelene kadar <b>Soruları değiştir</b> ile
          değiştirilebilir.
        </li>
        <li>
          Maç <span className={code}>/tahminler</span> sayfasında açılır. Üye maçın bütün sorularını cevaplayıp bir kez kaydeder; tahmin maç saatinde (ya da girdiğin bitiş saatinde) kilitlenir.
        </li>
        <li>
          Maç başlayınca <b>Sonuç bekleyen</b> listesine düşer. Skoru ve maçın sorduğu diğer rakamları (ilk yarı skoru, korner, kart) gir, <b>Sonucu gir ve puanla</b>’ya bas. Rakamı boş bırakılan soru iptal edilir, kimseye puan yazmaz. Uzatmalı
          maçlarda 90 dakikanın skoru girilir.
        </li>
        <li>
          <b>Otomatik puanlama</b> açıksa takvimden eklenen maçlar bitince kendiliğinden puanlanır. Korner, kart ya da ilk yarı verisi kaynakta yoksa maç elle girilmeyi bekler.
        </li>
        <li>
          <b>Lig ödülleri</b> sekmesinde haftalık ve aylık sıra ödüllerini tanımla: Kanka Coin, Kanka Puan, market ürünü ya da sponsor sitenin ödeyeceği nakit. Dönem bitince ilk sıralara kendiliğinden dağıtılır.
        </li>
        <li>
          Sponsor nakit ödülü ve elle teslim edilen market ürünü kazanan üye, sitedeki kullanıcı adını Tahminler sayfasına yazar. Ödül <b>Ödül teslimi</b> sekmesinde bekler; teslim edince <b>Teslim edildi</b>’ye bas, üyeye mesaj gider.
        </li>
        <li>Yanlış eklenen ya da ertelenen maçı, sonuçlanmadan önce çöp kutusu ile silebilirsin; tahminleri de silinir ve ödül yazılmaz.</li>
      </ol>
    ),
  },
  {
    title: 'Oran alarmı: tamamen otomatik çalışır',
    body: (
      <ol className="flex list-decimal flex-col gap-1.5 pl-5">
        <li>Bu özellik için panelde işlem yapman gerekmez. Üyeler profil sayfasında takım ya da lig adı yazarak (ör. Galatasaray, Premier Lig) en fazla 10 alarm kurar.</li>
        <li>
          Telegram aynası bir kanaldan <b>özel oran</b> postu çektiğinde, post <span className={code}>/ozel-oranlar</span> sayfasına düşer ve içindeki maçlar alarm kelimeleriyle karşılaştırılır.
        </li>
        <li>Eşleşme varsa, hesabını Telegram’a bağlamış üyeye botun üzerinden özel mesaj gider. Bağlamamış üye eşleşmeleri profilinde görür.</li>
        <li>
          <b>Çalışması için:</b> Telegram sekmesinde bot ve kaynak kanal ekli olsun. İçinde “oran, boost, odds, artırılmış, yükseltilmiş” geçen postlar otomatik olarak özel oran sayılır.
        </li>
      </ol>
    ),
  },
  {
    title: 'Seviye, rozet ve arkadaşını getir: otomatik',
    body: (
      <ol className="flex list-decimal flex-col gap-1.5 pl-5">
        <li>Üyeler oyun oynadıkça, yorum yazdıkça, tahmin tuttukça ve arkadaş getirdikçe XP kazanır; seviye ve rozetler profilde kendiliğinden açılır.</li>
        <li>
          Her üyenin profilinde kendi davet linki vardır (<span className={code}>/davet/KOD</span>). Gelen arkadaş {'en az 3 oyun'} oynayınca davet “tamamlandı” sayılır ve davet edene rozet/XP yazılır.
        </li>
        <li>Sahte hesapları engellemek için sadece son 48 saatte açılmış yeni hesaplar davet olarak sayılır. Panelden onay gerekmez.</li>
      </ol>
    ),
  },
]

const HINTS: Record<CommunityTab, string> = {
  reviews: 'Üyelerin site yorumları burada onay bekler. Yayınladıkların /guven sayfasında puana eklenir.',
  complaints: 'Durumu güncelle ve yanıt yaz; üye profilinde görür. Çözülenler sitenin güven kartına yansır.',
  kanit: 'Üyelerin yorumlarına eklediği ekran görüntülerini kontrol et. Onaylanan yorum Kanıtlı rozeti alır, yazarı 30 KP kazanır.',
  league: 'Soruları ve ödülleri seç, maç ekle, bitince sonucu gir. Lig ödülleri ve teslim bekleyen ödüller de burada.',
}

export function CommunityHint({ tab }: { tab: CommunityTab }) {
  return <p className="rounded-lg bg-secondary px-3 py-2 text-xs leading-relaxed text-secondary-foreground">{HINTS[tab]}</p>
}

export function CommunityGuide() {
  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary" aria-hidden />
          <span className="flex flex-col">
            <span className="font-display text-lg font-bold uppercase text-foreground">Topluluk rehberi</span>
            <span className="text-xs text-muted-foreground">Yorumlar, şikâyetler, tahmin ligi, oran alarmı ve davet sistemi nasıl çalışır</span>
          </span>
        </span>
        <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ol className="flex flex-col gap-2 px-5 pb-5">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <details className="group/step rounded-xl bg-secondary">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                <span className="flex-1 text-sm font-semibold text-foreground">{step.title}</span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open/step:rotate-180" aria-hidden />
              </summary>
              <div className="px-3 pb-4 pl-13 text-sm leading-relaxed text-foreground">{step.body}</div>
            </details>
          </li>
        ))}
      </ol>
    </details>
  )
}
