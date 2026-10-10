'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Megaphone, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

const MASCOTS = [
  {
    id: 'kurt',
    name: 'Kanka Kurt',
    role: 'Sürünün lideri',
    description: 'Siyah-altın kapüşonlu, altın zincirli. Logodaki kurtla birebir uyumlu, topluluk ruhunu taşır.',
    image: '/images/mascots/kurt.png',
  },
  {
    id: 'aslan',
    name: 'Aslan Abi',
    role: 'VIP patron',
    description: 'Ceketli, karizmatik abi figürü. VIP, turnuva ve büyük ödül duyuruları için ideal.',
    image: '/images/mascots/aslan.png',
  },
  {
    id: 'coin',
    name: 'Kanka Coin',
    role: 'Puanın kendisi',
    description: 'Canlı altın coin. Market, görev ve puan kazanma ekranlarında doğal bir yardımcı.',
    image: '/images/mascots/coin.png',
  },
  {
    id: 'tilki',
    name: 'Kurnaz Tilki',
    role: 'Telegram muhabiri',
    description: 'Şapkalı, telefonlu tilki. Telegram duyuruları, kodlar ve canlı akış için.',
    image: '/images/mascots/tilki.png',
  },
] as const

type MascotId = (typeof MASCOTS)[number]['id']
const STORAGE_KEY = 'alkanka-mascot'

export function MascotGallery() {
  const [selected, setSelected] = useState<MascotId>('kurt')

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as MascotId | null
    if (saved && MASCOTS.some((m) => m.id === saved)) setSelected(saved)
  }, [])

  function choose(id: MascotId) {
    setSelected(id)
    window.localStorage.setItem(STORAGE_KEY, id)
  }

  const current = MASCOTS.find((m) => m.id === selected) ?? MASCOTS[0]

  return (
    <main className="min-h-dvh bg-background px-4 pb-32 pt-8 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-sm text-primary hover:underline">
              {'← Ana sayfaya dön'}
            </Link>
            <Link
              href="/logolar"
              className="rounded-lg border border-primary/50 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              {'← Logo seçenekleri'}
            </Link>
          </div>
          <h1 className="font-display text-3xl font-bold text-balance">Maskot Seçenekleri</h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Sitenin her görselinde, banner&apos;da, kazanma ekranında ve Telegram duyurularında kullanılacak karakter. Birini seç.
          </p>
        </header>

        <section aria-labelledby="maskot-title" className="flex flex-col gap-4">
          <h2 id="maskot-title" className="sr-only">
            Maskotlar
          </h2>
          <div role="radiogroup" aria-labelledby="maskot-title" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {MASCOTS.map((m) => {
              const isSelected = m.id === selected
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => choose(m.id)}
                  className={cn(
                    'group flex flex-col overflow-hidden rounded-2xl border-2 bg-card text-left transition-all',
                    isSelected ? 'border-primary shadow-[0_0_32px_-8px_var(--primary)]' : 'border-border hover:border-primary/50',
                  )}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#000]">
                    <img
                      src={m.image}
                      alt={`${m.name} maskotu`}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {isSelected && (
                      <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                        <Check className="size-3.5" aria-hidden="true" />
                        Seçildi
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-lg font-bold">{m.name}</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">{m.role}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{m.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section aria-labelledby="kullanim-title" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="kullanim-title" className="font-display text-lg font-bold">
              Kullanım örnekleri
            </h2>
            <p className="text-sm text-muted-foreground">
              Kanka Kurt için farklı pozlar. Seçtiğin maskot için de aynı poz seti hazırlanır.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <article className="relative flex min-h-56 items-end overflow-hidden rounded-2xl border border-border bg-card lg:col-span-2">
              <img
                src="/images/mascots/kurt-duyuru.png"
                alt="Megafonla duyuru yapan Kanka Kurt"
                className="absolute inset-0 size-full object-cover object-right"
              />
              <div className="relative flex max-w-sm flex-col gap-2 bg-gradient-to-r from-background via-background/90 to-transparent p-6">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
                  <Megaphone className="size-3.5" aria-hidden="true" />
                  Banner / Duyuru
                </span>
                <p className="font-display text-2xl font-bold text-balance">Haftalık turnuva başladı!</p>
                <p className="text-sm text-muted-foreground">Ödül havuzu 50.000 Kanka Coin</p>
              </div>
            </article>

            <article className="flex flex-col overflow-hidden rounded-2xl border border-primary/40 bg-card">
              <div className="aspect-[16/10] overflow-hidden bg-[#000]">
                <img
                  src="/images/mascots/kurt-kazandi.png"
                  alt="Coin yağmuruyla kutlama yapan Kanka Kurt"
                  className="size-full object-cover"
                />
              </div>
              <div className="flex flex-col items-center gap-1 p-4 text-center">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
                  <Trophy className="size-3.5" aria-hidden="true" />
                  Kazanma ekranı
                </span>
                <p className="font-display text-xl font-bold">Tebrikler kanka!</p>
                <p className="text-sm text-muted-foreground">+250 Kanka Coin hesabına eklendi</p>
              </div>
            </article>
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={current.image} alt="" aria-hidden="true" className="size-10 rounded-lg object-cover" />
            <span className="truncate font-semibold">{current.name}</span>
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            {`${current.name} ile devam et`}
          </Link>
        </div>
      </div>
    </main>
  )
}
