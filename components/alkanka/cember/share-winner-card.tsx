'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'

export function ShareWinnerCard({ slot, index, mine, name }: { slot: string; index: number; mine: boolean; name: string }) {
  const [busy, setBusy] = useState(false)
  const url = `/api/cember/kart?slot=${encodeURIComponent(slot)}&i=${index}`

  const share = async () => {
    if (busy) return
    setBusy(true)
    try {
      const blob = await fetch(url).then((r) => (r.ok ? r.blob() : Promise.reject()))
      const file = new File([blob], `alkanka-${name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'AL KANKA', text: mine ? 'Alkanka arenasından ödülle çıktım kanka!' : `${name} Alkanka arenasından ödülle çıktı!` })
      } else {
        window.open(url, '_blank', 'noopener')
      }
    } catch {
      // The user closed the share sheet or the card failed; nothing to recover.
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={busy}
      className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-sm font-bold text-gold-foreground shadow-lg hover:brightness-110 disabled:opacity-60"
    >
      <Share2 className="size-4" aria-hidden />
      {busy ? 'Kart hazırlanıyor...' : mine ? 'Kartımı paylaş' : 'Kazanan kartı'}
    </button>
  )
}
