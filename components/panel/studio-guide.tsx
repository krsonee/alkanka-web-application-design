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
    body: '"Üret" sekmesinde türü (Banner, Sticker, GIF, Video) ve markayı seç, formatları işaretle, talimatı yaz, "Üret"e bas.',
    target: 'create',
  },
  {
    title: 'Revize et, hareketlendir, indir',
    body: 'Çıkan işin altındaki butonlarla değişiklik iste, banner\'ı GIF veya videoya çevir, "İndir" ile cihazına al.',
    target: 'create',
  },
]

const PRICES: [string, string, string][] = [
  ['Görsel / Banner', '~$0.06', '10-30 sn'],
  ['Sticker (şeffaf PNG)', '~$0.06', '10-30 sn'],
  ['Revize', '~$0.06', '10-30 sn'],
  ['Hareketli GIF', 'Banner + $0 (GIF ücretsiz)', '+3-5 sn'],
  ['Video 4 sn (sessiz)', 'Banner + ~$0.12', '1-2 dk'],
  ['Video 6 sn (sessiz)', 'Banner + ~$0.18', '1-2 dk'],
  ['Video 8 sn (sessiz)', 'Banner + ~$0.24', '1-3 dk'],
  ['Video + ses', 'saniye başı ~$0.05', '1-3 dk'],
]

const PROMPT_EXAMPLES = [
  {
    kind: 'Banner',
    text: 'Büyük başlık "%500 FREESPIN BONUSU", altında "HEMEN KATIL" butonu. Zeus karakteri şimşek tutuyor, arka planda altın paralar ve mor bulutlar.',
  },
  {
    kind: 'Banner',
    text: 'Derbi maçı için özel oran: başlık "FENERBAHÇE - GALATASARAY", altında "ORAN 3.50" büyük ve parlak. Stadyum ışıkları, futbol topu ön planda.',
  },
  {
    kind: 'Sticker',
    text: 'Sevimli altın aslan maskotu göz kırpıyor, elinde para torbası, üstünde "KOD GELİYOR!" yazısı.',
  },
  {
    kind: 'Video hareketi',
    text: 'Karakter yavaşça kılıcını kaldırıyor, arkadan altın paralar yağıyor, kamera hafifçe yaklaşıyor, parlamalar geçiyor.',
  },
]

const HINTS: Record<Exclude<Section, 'guide'>, { title: string; body: string }> = {
  create: {
    title: 'Nasıl üretilir?',
    body: 'Tür ve markayı seç, format(lar)ı işaretle, yazıları tırnak içinde yazarak talimat ver. Logo yapay zekaya çizdirilmez, kitteki orijinal logo birebir basılır.',
  },
  brands: {
    title: 'Marka kiti nedir?',
    body: 'Her bahis sitesi için ayrı kit. Domain yazıp "Siteden çek" dersen logo, renk ve font otomatik gelir. Her üretim seçilen kitin kimliğiyle çıkar, siteler birbirine karışmaz.',
  },
  library: {
    title: 'Kütüphane ne işe yarar?',
    body: 'Sağlayıcı portallarından aldığın oyun karakterleri ve arka planlar burada durur. Üretirken en fazla 3 tanesini referans seçersen yapay zeka o tarza yakın üretir.',
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
              <>İstersen {b('Oyun')} adını da yaz (örn. Gates of Olympus). Bulması kolaylaşır.</>,
              <>{b('Dosya seç')} ile tek seferde 20 görsele kadar yükle, ya da portaldaki görsellerin linklerini kopyalayıp {b('Linklerden ekle')} kutusuna her satıra bir link gelecek şekilde yapıştır.</>,
              <>Üretim ekranında {b('Referans görsel seç')} bölümünden en fazla 3 tanesini işaretle. Yapay zeka karakteri ve tarzı bunlara göre çizer.</>,
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
              <>{b('Talimat')} yaz. Görselde çıkmasını istediğin yazıları mutlaka {b('tırnak içinde')} yaz: "%500 FREESPIN".</>,
              <>{b('Üret')} butonuna bas. Butonda tahmini maliyet yazar. 10-30 saniyede sağ tarafta çıkar.</>,
            ]}
          />
        </Block>

        <Block icon={<Sticker className="size-5" aria-hidden />} title="4. Sticker üretimi">
          <Steps
            items={[
              <>{b('Sticker')} türünü seç ve markayı belirle.</>,
              <>Talimata maskotu, ifadesini ve üstündeki kısa yazıyı tırnakla yaz: "KOD GELİYOR!".</>,
              <>Sticker şeffaf arka planlı PNG olarak çıkar, arkası damalı görünür, bu normaldir.</>,
              <>{b('İndir')} ile al. Telegram&apos;da @Stickers botuna gönderip paketine ekleyebilirsin.</>,
            ]}
          />
        </Block>

        <Block icon={<Film className="size-5" aria-hidden />} title="5. Hareketli GIF">
          <Steps
            items={[
              <>Yöntem A: {b('Hareketli GIF')} türünü seçip üret. Önce banner yapılır, ardından otomatik GIF&apos;e çevrilir.</>,
              <>Yöntem B: Daha önce ürettiğin bir banner&apos;ın altındaki {b('Hareketlendir')} butonuna bas, açılan panelde {b('GIF yap')} de.</>,
              <>GIF&apos;te üstten parlama geçer ve görsel hafifçe nefes alır. Döngülüdür. Logo ve yazılar asla bozulmaz.</>,
              <>GIF adımı {b('ücretsizdir')}, sadece banner&apos;ın üretim ücreti ödenir.</>,
            ]}
          />
        </Block>

        <Block icon={<Clapperboard className="size-5" aria-hidden />} title="6. Video üretimi">
          <Steps
            items={[
              <>{b('Video')} türünü seç ya da hazır bir banner&apos;da {b('Hareketlendir')} butonuna bas.</>,
              <>{b('Hareket talimatı')}na ne olacağını yaz: "karakter kılıcını kaldırıyor, paralar yağıyor". Boş bırakırsan hafif sinematik hareket yapılır.</>,
              <>{b('Süre')}: 4, 6 veya 8 saniye. {b('Ses / müzik')} kutusunu istersen işaretle (biraz daha pahalı).</>,
              <>{b('Video üret')}. 1-3 dakika sürer, bu sürede sayfayı kapatma. Bitince kartın içinde oynatılır.</>,
              <>1:1 banner videoya çevrilirken 9:16 dikey video yapılır, kenarlar bulanık arka planla doldurulur.</>,
            ]}
          />
          <p className="flex gap-2 rounded-xl bg-secondary p-3 text-xs leading-relaxed text-muted-foreground">
            <TriangleAlert className="size-4 shrink-0 text-primary" aria-hidden />
            Videoda yazı ve logo sabit kalsın diye talimat verilir ama model nadiren küçük kaymalar yapabilir. Önemli kampanyalarda GIF en güvenli seçenektir.
          </p>
        </Block>

        <Block icon={<RefreshCw className="size-5" aria-hidden />} title="7. Revize, indirme, silme">
          <Steps
            items={[
              <>{b('Revize')}: kartın altındaki butona bas, değişikliği yaz ("%100 yerine %500 yazsın, karakter erkek olsun"), {b('Revizeyi üret')} de. Aynı düzen korunur, logo yeniden temiz basılır.</>,
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
        </Block>
      </div>

      <Block icon={<Lightbulb className="size-5" aria-hidden />} title="İyi talimat örnekleri">
        <div className="grid gap-3 md:grid-cols-2">
          {PROMPT_EXAMPLES.map((ex) => (
            <div key={ex.text} className="flex flex-col gap-1.5 rounded-xl border border-border bg-background p-4">
              <span className="text-xs font-bold uppercase text-primary">{ex.kind}</span>
              <p className="text-sm leading-relaxed text-foreground">{ex.text}</p>
            </div>
          ))}
        </div>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
          <li>{b('Yazıları tırnakla ver.')} Tırnaksız yazılar yapay zekaya fikir olarak gider, birebir basılmaz.</li>
          <li>{b('Kısa başlık kullan.')} 2-5 kelimelik başlıklar en net sonucu verir.</li>
          <li>{b('Renk söyleme.')} Renkler marka kitinden gelir. Sadece istisna varsa yaz.</li>
          <li>{b('Logo isteme.')} Logo zaten otomatik ve kusursuz basılır. Talimata logo yazarsan ikinci, bozuk bir logo çıkabilir.</li>
          <li>{b('Gerçek sağlayıcı karakterleri')} birebir kopyalamak telif riski taşır. Kendi maskotlarınız uzun vadede en güvenlisi.</li>
        </ul>
      </Block>
    </div>
  )
}
