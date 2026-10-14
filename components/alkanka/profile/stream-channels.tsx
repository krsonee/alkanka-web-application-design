'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Radio, X } from 'lucide-react'
import { linkStreamAction, unlinkStreamAction } from '@/app/actions/streams'
import { StatusLine, useAction } from '@/components/alkanka/community/use-action'
import {
  STREAM_LABEL,
  STREAM_PLACEHOLDER,
  STREAM_PLATFORMS,
  channelUrl,
  type MemberStream,
  type StreamPlatform,
} from '@/lib/member-streams-shared'
import { cn } from '@/lib/utils'

export function StreamChannelsCard({ streams }: { streams: MemberStream[] }) {
  const { pending, status, run } = useAction()
  const [platform, setPlatform] = useState<StreamPlatform>('kick')
  const [input, setInput] = useState('')
  const linked = new Map(streams.map((s) => [s.platform, s.channel]))

  return (
    <section id="yayin-kanallarim" className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <header className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-live/15 text-live">
          <Radio className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold text-foreground">Yayın kanallarım</h2>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Kick, Twitch ya da YouTube kanalını bağla; yayına geçtiğinde{' '}
            <Link href="/kankatv" className="font-semibold text-primary underline-offset-2 hover:underline">
              KankaTV
            </Link>{' '}
            &quot;Kanka yayıncılar&quot; bölümünde otomatik görünürsün. Telegram grubunda ya da kanalında başlattığın canlı yayınlar da botumuz oradaysa
            kendiliğinden listelenir.
          </p>
        </div>
      </header>

      {streams.length > 0 && (
        <ul className="flex flex-col gap-2">
          {streams.map((s) => (
            <li key={s.platform} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
              <span className="w-16 shrink-0 text-xs font-bold uppercase text-muted-foreground">{STREAM_LABEL[s.platform]}</span>
              <a
                href={channelUrl(s.platform, s.channel)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-1 truncate text-sm font-semibold text-foreground hover:text-primary"
              >
                <span className="truncate">{s.channel.replace(/^channel\//, '')}</span>
                <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
              </a>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => unlinkStreamAction(s.platform))}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
                aria-label={`${STREAM_LABEL[s.platform]} bağlantısını kaldır`}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!input.trim()) return
          run(() => linkStreamAction(platform, input), () => setInput(''))
        }}
      >
        <div role="radiogroup" aria-label="Platform" className="grid grid-cols-3 gap-2">
          {STREAM_PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={platform === p}
              onClick={() => setPlatform(p)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-bold transition-colors',
                platform === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted',
              )}
            >
              {STREAM_LABEL[p]}
              {linked.has(p) && <span className="sr-only"> (bağlı)</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label htmlFor="stream-channel" className="sr-only">
            {STREAM_LABEL[platform]} kanal adı ya da linki
          </label>
          <input
            id="stream-channel"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={STREAM_PLACEHOLDER[platform]}
            maxLength={120}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {linked.has(platform) ? 'Güncelle' : 'Bağla'}
          </button>
        </div>
        <StatusLine status={status} />
      </form>
    </section>
  )
}
