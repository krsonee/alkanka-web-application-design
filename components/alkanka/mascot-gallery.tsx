'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Megaphone, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

  const MASCOTS = [
  {
  id: 'jako',
  name: 'Jako Kanka',
  role: 'Geveze muhabir',
  description: 'Gri tüylü, kırmızı kuyruklu, göz kırpan jako papağanı. Konuşan kuş olduğu için duyuru, kod ve Telegram bildirimlerinin doğal sesi.',
  image: '/images/mascots/jako.png',
  },
  {
  id: 'kapibara',
  name: 'Kapibara Usta',
  role: 'Sakin kafa',
  description: 'İpek gömlekli, elinde ince belli çay bardağı. Kaybetse de stres yapmayan kanka, sorumlu oyun mesajları için.',
  image: '/images/mascots/kapibara.png',
  },
  {
  id: 'rakun',
  name: 'Rakun Reis',
  role: 'Bonus avcısı',
  description: 'Bereli, kapüşonlu, omzunda coin çuvalı. Bonus kodu ve fırsat avı bölümlerinin yüzü.',
  image: '/images/mascots/rakun.png',
  },
  {
  id: 'ahtapot',
  name: 'Ahtapot Baba',
  role: 'Çok kollu oyuncu',
  description: 'Silindir şapka ve monokl; sekiz kolunda kart, çip, zar, kupa. Oyunlar ve etkinlik sayfaları için.',
  image: '/images/mascots/ahtapot.png',
  },
  {
  id: 'bukalemun',
  name: 'Bukalemun',
  role: 'Fırsat kokucu',
  description: 'Zümrütten altına geçen pulları, dönen gözleri. Özel oranlar ve değişen kampanyalar için.',
  image: '/images/mascots/bukalemun.png',
  },
  {
  id: 'goril',
  name: 'Goril Güvenlik',
  role: 'VIP koruma',
  description: 'Takım elbiseli, kulaklıklı silverback. Güvenilir site, doğrulama ve hesap güvenliği alanları için.',
  image: '/images/mascots/goril.png',
  },
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
  {
    id: 'ayi',
    name: 'Koca Ayı',
    role: 'Güvenilir abi',
    description: 'Kapüşonlu, snapback şapkalı, kollar kavuşturulmuş. Güvenilir sponsor ve destek alanları için.',
    image: '/images/mascots/ayi.png',
  },
  {
    id: 'kartal',
    name: 'Altın Kartal',
    role: 'Keskin göz',
    description: 'Bomber ceketli, pilot gözlüklü kartal. Özel oranlar ve tahmin etkinlikleri için.',
    image: '/images/mascots/kartal.png',
  },
  {
    id: 'panter',
    name: 'Kara Panter',
    role: 'Masa ustası',
    description: 'Kadife takım, elinde çip kulesi. Casino bonusları ve VIP sponsorlar için şık bir yüz.',
    image: '/images/mascots/panter.png',
  },
  {
    id: 'boga',
    name: 'Altın Boğa',
    role: 'Kazanç makinesi',
    description: 'Altın boynuzlu, zafer pozunda boğa. Büyük kazanç ve turnuva sonuçları için enerjik.',
    image: '/images/mascots/boga.png',
  },
  {
    id: 'baykus',
    name: 'Bilge Baykuş',
    role: 'Analist',
    description: 'Altın gözlüklü, yelekli baykuş. Kurallar, SSS ve rehber sayfalarında yol gösterir.',
    image: '/images/mascots/baykus.png',
  },
  {
    id: 'ejder',
    name: 'Hazine Ejderi',
    role: 'Sandık bekçisi',
    description: 'Taçlı minik ejder, coin yığınının üstünde. Sandık oyunu ve market için birebir.',
    image: '/images/mascots/ejder.png',
  },
] as const

type MascotId = (typeof MASCOTS)[number]['id']

const JAKO_POSES = [
  { src: '/images/mascots/jako-merhaba.png', label: 'Merhaba', where: 'Kayıt popup’ı' },
  { src: '/images/mascots/jako-duyuru.png', label: 'Duyuru', where: 'Ana banner, etkinlikler, kampanyalar' },
  { src: '/images/mascots/jako-kazandi.png', label: 'Kazandı', where: 'Sandık, zar, seri, sıralama' },
  { src: '/images/mascots/jako-sandik.png', label: 'Sandık', where: 'Gizemli Sandıklar oyunu' },
  { src: '/images/mascots/jako-zar.png', label: 'Zar', where: 'Zar oyunu' },
  { src: '/images/mascots/jako-market.png', label: 'Market', where: 'Puan market, bonus kodları' },
  { src: '/images/mascots/jako-dusunen.png', label: 'Düşünen', where: 'Kurallar, SSS, özel oranlar' },
  { src: '/images/mascots/jako-uzgun.png', label: 'Üzgün', where: 'Yetersiz coin, boş durumlar, 404' },
  { src: '/images/mascots/jako-telegram.png', label: 'Telegram', where: 'Sol menü, footer' },
  { src: '/images/mascots/jako.png', label: 'Klasik', where: 'Giriş popup’ı, sponsorlar' },
] as const
const STORAGE_KEY = 'alkanka-mascot'

export function MascotGallery() {
  const [selected, setSelected] = useState<MascotId>('jako')

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
              Jako Kanka&apos;nın sitede kullanılan tüm pozları ve nerede göründükleri.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {JAKO_POSES.map((p) => (
              <li key={p.src} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
                <img src={p.src || '/placeholder.svg'} alt={`Jako ${p.label} pozu`} className="aspect-square w-full object-cover" />
                <div className="flex flex-col gap-0.5 p-3">
                  <span className="text-sm font-semibold">{p.label}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{p.where}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <article className="relative flex min-h-56 items-end overflow-hidden rounded-2xl border border-border bg-card lg:col-span-2">
              <img
                src="/images/mascots/jako-duyuru.png"
                alt="Megafonla duyuru yapan Jako Kanka"
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
                  src="/images/mascots/jako-kazandi.png"
                  alt="Coin yağmuruyla kutlama yapan Jako Kanka"
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
