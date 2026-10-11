import type { Metadata } from 'next'
import Image from 'next/image'
import { Download } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sosyal Medya Postları | AL KANKA',
  robots: { index: false, follow: false },
}

const posts = [
  { file: '01-kayit.png', title: 'Kayıt Ol Puanı' },
  { file: '02-giris.png', title: 'Her Girişte Puan' },
  { file: '03-gorevler.png', title: 'Görevler' },
  { file: '04-davet.png', title: 'Arkadaş Davet' },
  { file: '05-market.png', title: 'Market' },
  { file: '06-sandik.png', title: 'Sandık' },
  { file: '07-cark.png', title: 'Çark' },
  { file: '08-zar.png', title: 'Zar' },
  { file: '09-tahmin.png', title: 'Tahminler' },
  { file: '10-siralama.png', title: 'Sıralama' },
  { file: '11-bilet.png', title: 'Bilet' },
  { file: '12-oran.png', title: 'Özel Oranlar' },
  { file: '13-baslangic.png', title: 'İlk Gün Paketi' },
  { file: '14-rutin.png', title: '3 Dakikalık Rutin' },
  { file: '15-hafta.png', title: '7 Gün Giriş Serisi' },
  { file: '16-mac.png', title: 'Maç Günü Çift Kazanç' },
  { file: '17-sans.png', title: 'Şans Üçlüsü' },
  { file: '18-hediye.png', title: 'Gizemli Hediye Kutusu' },
  { file: '19-kalkan.png', title: 'Seri Kalkanı' },
  { file: '20-telegram.png', title: 'Kanala Katıl' },
  { file: '21-zirve.png', title: 'Kupayı Kaldır' },
  { file: '22-kasa.png', title: 'Kanka Coin Nasıl Çalışır' },
  { file: '23-duses.png', title: 'Düşeş' },
  { file: '24-el.png', title: 'Kanka Kankayı Bırakmaz' },
  { file: '25-hesap.png', title: 'Haftalık Hesap' },
  { file: '26-hedef.png', title: 'Hedefini Seç' },
  { file: '27-pazar.png', title: 'Pazar 21:00 Çekiliş' },
  { file: '28-nedir.png', title: 'AL KANKA Nedir' },
  { file: '29-ikili.png', title: 'İki Kanka 750 KC' },
  { file: '30-altin.png', title: 'Altın Sandık 500 KC' },
  { file: '31-rulet.png', title: 'Rulet Açıldı' },
  { file: '32-kirmizi-siyah.png', title: 'Kırmızı mı Siyah mı?' },
  { file: '33-blackjack.png', title: "Blackjack: 21'i Yakala" },
  { file: '34-kankana-karsi.png', title: 'Blackjack Masa Aç' },
  { file: '35-kafa-topu.png', title: 'Kafa Topu Açıldı' },
  { file: '36-rovans.png', title: 'Kafa Topu Rövanş' },
  { file: '37-kafa-basket.png', title: 'Kafa Basketbolu Açıldı' },
  { file: '38-smac.png', title: 'Smaç Senden' },
  { file: '39-oyunlar.png', title: '4 Yeni Oyun' },
  { file: '40-masa-ac.png', title: 'Masayı Sen Kur' },
]

export default function PostlarPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div className="flex flex-col gap-2">
            <h1 className="text-balance text-3xl font-bold tracking-tight">Sosyal Medya Postları</h1>
            <p className="text-pretty leading-relaxed text-muted-foreground">
              {'12 post · 1080×1350 (Instagram / Telegram dikey). Tek tek veya hepsini birden indir.'}
            </p>
          </div>
          <a
            href="/postlar/alkanka-postlar.zip"
            download
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Download className="size-5" aria-hidden="true" />
            Hepsini indir (ZIP)
          </a>
        </header>

        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {posts.map((post) => (
            <li key={post.file} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
              <a href={`/postlar/${post.file}`} target="_blank" rel="noreferrer" className="block">
                <Image
                  src={`/postlar/${post.file}`}
                  alt={`${post.title} post görseli`}
                  width={1080}
                  height={1350}
                  className="h-auto w-full"
                />
              </a>
              <div className="flex items-center justify-between gap-2 p-3">
                <span className="text-sm font-medium text-card-foreground">{post.title}</span>
                <a
                  href={`/postlar/${post.file}`}
                  download
                  aria-label={`${post.title} görselini indir`}
                  className="inline-flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Download className="size-4" aria-hidden="true" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
