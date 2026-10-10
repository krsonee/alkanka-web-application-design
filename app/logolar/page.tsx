import Image from "next/image"
import Link from "next/link"

const logos = [
  { file: "lion", name: "Aslan" },
  { file: "wolf", name: "Kurt" },
  { file: "tiger", name: "Kaplan" },
  { file: "eagle", name: "Kartal" },
  { file: "horse", name: "At" },
  { file: "crown", name: "Taç" },
  { file: "coin", name: "Altın Para" },
  { file: "diamond", name: "Elmas" },
  { file: "shield", name: "Kalkan" },
  { file: "bolt", name: "Şimşek" },
  { file: "laurel", name: "Defne" },
  { file: "fist", name: "Yumruk" },
]

export const metadata = {
  title: "Logo Seçenekleri | Alkanka",
}

export default function LogolarPage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Link href="/" className="text-sm text-primary">
            {"← Ana sayfaya dön"}
          </Link>
          <h1 className="font-sans text-2xl font-bold">Logo Seçenekleri</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            12 amblem. Beğendiğinin adını yazman yeterli, siteye o yerleşir.
          </p>
        </header>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {logos.map((logo, i) => (
            <li
              key={logo.file}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="relative aspect-square overflow-hidden rounded-lg">
                <Image
                  src={`/images/logos/${logo.file}.png`}
                  alt={`${logo.name} logosu`}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover"
                  priority={i < 4}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{logo.name}</span>
                <span className="text-xs text-muted-foreground">{`#${i + 1}`}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
