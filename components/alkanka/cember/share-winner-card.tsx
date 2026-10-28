'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Download, Loader2, Share2, X } from 'lucide-react'

type CardState = { status: 'loading' } | { status: 'ready'; file: File; preview: string } | { status: 'error' }

export function ShareWinnerCard({
  slot,
  index,
  mine,
  name,
  onOpenChange,
}: {
  slot: string
  index: number
  mine: boolean
  name: string
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpenState] = useState(false)
  const setOpen = (v: boolean) => {
    setOpenState(v)
    onOpenChange?.(v)
  }
  const [card, setCard] = useState<CardState>({ status: 'loading' })
  const [copied, setCopied] = useState(false)
  const url = `/api/cember/kart?slot=${encodeURIComponent(slot)}&i=${index}`
  const fileName = `alkanka-${name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.png`
  const text = mine ? 'Alkanka arenasından ödülle çıktım kanka!' : `${name} Alkanka arenasından ödülle çıktı!`

  useEffect(() => {
    if (!open) return
    let preview = ''
    let cancelled = false
    setCard({ status: 'loading' })
    fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        if (cancelled) return
        preview = URL.createObjectURL(blob)
        setCard({ status: 'ready', file: new File([blob], fileName, { type: 'image/png' }), preview })
      })
      .catch(() => !cancelled && setCard({ status: 'error' }))
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      cancelled = true
      window.removeEventListener('keydown', onKey)
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [open, url, fileName])

  const ready = card.status === 'ready' ? card : null
  const canNativeShare = !!ready && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [ready.file] })

  const nativeShare = async () => {
    if (!ready) return
    await navigator.share({ files: [ready.file], title: 'AL KANKA', text }).catch(() => null)
  }

  const download = () => {
    if (!ready) return
    const a = document.createElement('a')
    a.href = ready.preview
    a.download = fileName
    a.click()
  }

  const copyImage = async () => {
    if (!ready || typeof ClipboardItem === 'undefined') return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': ready.file })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      download()
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-sm font-bold text-gold-foreground shadow-lg hover:brightness-110"
      >
        <Share2 className="size-4" aria-hidden />
        {mine ? 'Kartımı paylaş' : 'Kazanan kartı'}
      </button>

      {open &&
        createPortal(
          <div
            className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Kazanan kartı"
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-full w-full max-w-sm flex-col gap-4 rounded-3xl border border-gold/40 bg-popover p-4 text-popover-foreground shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold">{mine ? 'Kazanan kartın hazır' : `${name} kartı`}</h2>
                <button type="button" onClick={() => setOpen(false)} aria-label="Kapat" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex aspect-[4/5] min-h-0 w-full items-center justify-center overflow-hidden rounded-2xl bg-muted">
                {ready ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ready.preview} alt={`${name} kazanan kartı`} className="size-full object-contain" />
                ) : card.status === 'error' ? (
                  <p className="px-6 text-center text-sm text-muted-foreground">Kart oluşturulamadı kanka, biraz sonra tekrar dene.</p>
                ) : (
                  <Loader2 className="size-6 animate-spin text-gold" aria-label="Kart hazırlanıyor" />
                )}
              </div>

              <div className="flex flex-col gap-2">
                {canNativeShare && (
                  <button type="button" onClick={nativeShare} className="flex items-center justify-center gap-2 rounded-full bg-gold py-2.5 text-sm font-bold text-gold-foreground hover:brightness-110">
                    <Share2 className="size-4" aria-hidden />
                    Paylaş
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={download}
                    disabled={!ready}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold disabled:opacity-50 ${canNativeShare ? 'border border-border hover:bg-muted' : 'bg-gold text-gold-foreground hover:brightness-110'}`}
                  >
                    <Download className="size-4" aria-hidden />
                    İndir
                  </button>
                  <button type="button" onClick={copyImage} disabled={!ready} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-bold hover:bg-muted disabled:opacity-50">
                    {copied ? <Check className="size-4 text-gold" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                    {copied ? 'Kopyalandı' : 'Kopyala'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
