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
