import type { Metadata } from 'next'
import { LiveLobby } from '@/components/alkanka/arena/live-lobby'

export const metadata: Metadata = {
  title: 'Canlı masalar | AL KANKA',
  description: 'Okey, tavla, bilardo ve diğer çok oyunculu masaları canlı izle.',
}

export default function LiveTablesPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-3 py-6 sm:px-6">
      <p className="text-sm text-muted-foreground">Aktif çok oyunculu masalara izleyici olarak katıl. İzleyiciler oyuncuların taşlarını görmez.</p>
      <LiveLobby />
    </div>
  )
}
