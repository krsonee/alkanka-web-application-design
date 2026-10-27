import { ParticleBurst } from './particle-burst'

/** Centered "+X KC" celebration shared by mini games. Remount with a new `key` to replay. */
export function WinFlash({ label, big = false }: { label: string; big?: boolean }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <span className="absolute size-32 rounded-full border-4 border-gold animate-win-ring" />
      {big && <span className="absolute size-32 rounded-full border-2 border-gold/60 animate-win-ring [animation-delay:200ms]" />}
      <ParticleBurst count={big ? 36 : 24} distance={big ? 180 : 130} />
      <span
        className="relative rounded-full bg-gold px-5 py-2 font-display text-2xl font-black tabular-nums text-gold-foreground shadow-[0_0_32px_var(--gold)] animate-win-flash sm:text-3xl"
      >
        {label}
      </span>
    </span>
  )
}
