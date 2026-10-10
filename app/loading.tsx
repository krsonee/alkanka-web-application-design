import { JakoAvatar } from '@/components/alkanka/jako'

export default function Loading() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground"
      aria-busy="true"
    >
      <JakoAvatar pose="dusunen" size="lg" className="size-28 animate-pulse rounded-3xl" alt="" />
      <p className="text-sm font-semibold text-muted-foreground" role="status">
        Jako hazırlıyor kanka...
      </p>
    </main>
  )
}
