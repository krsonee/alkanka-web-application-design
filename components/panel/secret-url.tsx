'use client'

import { useState } from 'react'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'

const btn = 'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary'

const mask = (url: string) => url.replace(/([?&]key=)[^&]+/, '$1••••••••')

/** A URL carrying a secret key: masked until asked for, so it never ends up in a screenshot or screen recording. */
export function SecretUrl({ url, label = 'Gizli adres' }: { url: string; label?: string }) {
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused (embedded preview, old browser); showing the address lets it be copied by hand.
      setShown(true)
    }
  }

  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <code aria-label={label} className="min-w-0 flex-1 basis-48 break-all rounded-lg bg-background p-2 font-mono text-xs text-foreground">
        {shown ? url : mask(url)}
      </code>
      <button type="button" className={btn} aria-pressed={shown} onClick={() => setShown((s) => !s)}>
        {shown ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
        {shown ? 'Gizle' : 'Göster'}
      </button>
      <button type="button" className={btn} onClick={copy}>
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copied ? 'Kopyalandı' : 'Kopyala'}
      </button>
      <span role="status" className="sr-only">
        {copied ? 'Adres kopyalandı' : ''}
      </span>
    </span>
  )
}
