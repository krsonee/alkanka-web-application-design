import Image from 'next/image'
import { ArrowRight, Dices, Gift, RotateCw, Sparkles } from 'lucide-react'

const HIGHLIGHTS = [
  { icon: Gift, label: 'Daily reward drops' },
  { icon: Sparkles, label: 'Exclusive traffic campaigns' },
  { icon: Dices, label: 'Interactive bonus games' },
]

export function Hero() {
  return (
    <section id="home" className="relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid-bg" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 animate-glow"
        style={{
          background:
            'radial-gradient(600px 380px at 15% 20%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 70%), radial-gradient(640px 420px at 85% 40%, color-mix(in oklch, var(--accent) 22%, transparent), transparent 70%)',
        }}
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-2 lg:pt-20 lg:pb-24">
        <div className="flex flex-col items-start gap-7">
          <span className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-foreground animate-rise">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-live" />
            </span>
            {"Today's reward pool is live"}
          </span>

          <h1
            className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance text-foreground animate-rise sm:text-5xl lg:text-6xl"
            style={{ animationDelay: '80ms' }}
          >
            Play. Unlock. <span className="text-neon">Get rewarded</span> every single day.
          </h1>

          <p
            className="max-w-xl text-base leading-relaxed text-pretty text-muted-foreground animate-rise sm:text-lg"
            style={{ animationDelay: '160ms' }}
          >
            Alkanka is your premium hub for daily reward drops, exclusive partner campaigns and skill-free bonus
            mini-games — powered by a 14K+ strong Telegram community.
          </p>

          <div className="flex w-full flex-col gap-3 animate-rise sm:w-auto sm:flex-row" style={{ animationDelay: '240ms' }}>
            <a
              href="#games"
              className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03] glow-cyan"
            >
              <RotateCw className="size-4" aria-hidden="true" />
              Spin the Wheel
            </a>
            <a
              href="#campaigns"
              className="glass group flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-foreground transition-colors hover:border-accent/60"
            >
              Explore Campaigns
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </a>
          </div>

          <ul className="flex flex-wrap gap-x-6 gap-y-3 animate-rise" style={{ animationDelay: '320ms' }}>
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4 text-gold" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="relative aspect-square animate-float">
            <div aria-hidden="true" className="absolute inset-8 rounded-full bg-accent/25 blur-3xl" />
            <Image
              src="/images/hero-chest.png"
              alt="Glowing Alkanka mystery reward chest with coins and dice"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 90vw"
              className="relative rounded-3xl object-cover [mask-image:radial-gradient(circle_at_center,black_55%,transparent_75%)]"
            />
          </div>

          <div className="glass absolute top-6 left-0 rounded-2xl px-4 py-3 animate-pop sm:-left-4" style={{ animationDelay: '500ms' }}>
            <p className="text-xs text-muted-foreground">Rewards claimed today</p>
            <p className="font-display text-xl font-bold text-foreground tabular-nums">38,412</p>
          </div>
          <div className="glass absolute right-0 bottom-8 rounded-2xl px-4 py-3 glow-gold animate-pop sm:-right-4" style={{ animationDelay: '700ms' }}>
            <p className="text-xs text-muted-foreground">Next drop in</p>
            <p className="font-display text-xl font-bold text-gold tabular-nums">02:14:09</p>
          </div>
        </div>
      </div>
    </section>
  )
}
