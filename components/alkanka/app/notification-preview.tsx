import Image from 'next/image'

const SAMPLES = [
  { title: 'Okey turnuvası 10 dk sonra', body: '5.000 KC ödül havuzu. Yerini şimdi ayırt kanka.', time: 'şimdi' },
  { title: 'Yeni promo kodu düştü', body: 'Sadece ilk 100 kankaya geçerli, kaçırma.', time: '2 dk' },
  { title: 'Çark hakkın yenilendi', body: 'Ücretsiz çevir, KC topla.', time: '1 sa' },
]

export function NotificationPreview() {
  return (
    <div
      aria-label="Bildirim örnekleri"
      role="img"
      className="relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-background p-3"
    >
      <div aria-hidden="true" className="flex items-baseline justify-between px-1 pb-1">
        <span className="font-display text-3xl font-bold tabular-nums text-foreground">20:59</span>
        <span className="text-xs font-medium text-muted-foreground">Kilit ekranı</span>
      </div>
      {SAMPLES.map((n, i) => (
        <div
          key={n.title}
          aria-hidden="true"
          style={{ animationDelay: `${200 + i * 350}ms` }}
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-3 motion-safe:fill-mode-both motion-safe:duration-500"
        >
          <Image src="/icon-192.png" alt="" width={36} height={36} className="size-9 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">AL KANKA</span>
              <span className="text-[11px] text-muted-foreground">{n.time}</span>
            </div>
            <span className="truncate text-sm font-bold text-foreground">{n.title}</span>
            <span className="truncate text-sm text-muted-foreground">{n.body}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
