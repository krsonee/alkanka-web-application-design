'use client'

import { useState } from 'react'
import { Bot, Copy, ExternalLink, FileText, Film, Gift, MessageSquareText, ThumbsUp, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CAPTION_LIMIT,
  DEFAULT_ALT,
  DEFAULT_JOINED,
  buttonText,
  hasButtons,
  mediaUrl,
  needsSplit,
  visibleLength,
  type PostButton,
  type PostButtonKind,
  type PostContent,
  type PostMedia,
} from '@/lib/tg-posts-shared'

/** How Telegram's formatting looks, shared by the writing area and the preview so both show the same thing. */
export const RICH =
  'whitespace-pre-wrap [overflow-wrap:anywhere] [&_a]:text-primary [&_a]:underline [&_b]:font-semibold [&_code]:rounded [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:font-mono [&_pre]:my-1 [&_pre]:rounded-md [&_pre]:bg-foreground/10 [&_pre]:p-2 [&_pre]:font-mono [&_blockquote]:my-1 [&_blockquote]:rounded-r-md [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:bg-primary/10 [&_blockquote]:px-2 [&_blockquote]:py-1 [&_.tg-spoiler]:rounded [&_.tg-spoiler]:bg-foreground/25 [&_tg-spoiler]:rounded [&_tg-spoiler]:bg-foreground/25'

export const BUTTON_ICON: Record<PostButtonKind, typeof Copy> = {
  link: ExternalLink,
  popup: MessageSquareText,
  copy: Copy,
  member: UserCheck,
  vote: ThumbsUp,
  raffle: Gift,
  bot: Bot,
}

export function MediaTile({ item, className }: { item: PostMedia; className?: string }) {
  if (item.kind === 'photo' || item.kind === 'gif') {
    // eslint-disable-next-line @next/next/no-img-element -- private panel media served by an authenticated route
    return <img src={mediaUrl(item.path)} alt={item.name} className={cn('size-full object-cover', className)} />
  }
  const Icon = item.kind === 'video' ? Film : FileText
  return (
    <div className={cn('flex size-full flex-col items-center justify-center gap-1 bg-foreground/5 p-2 text-center', className)}>
      <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      <span className="line-clamp-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.name}</span>
    </div>
  )
}

function MediaGrid({ media }: { media: PostMedia[] }) {
  if (!media.length) return null
  if (media.every((m) => m.kind === 'file')) {
    return (
      <ul className="flex flex-col gap-1 p-2">
        {media.map((m) => (
          <li key={m.path} className="flex items-center gap-2 rounded-lg bg-foreground/5 p-2 text-sm text-foreground">
            <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 truncate">{m.name}</span>
          </li>
        ))}
      </ul>
    )
  }
  const odd = media.length > 1 && media.length % 2 === 1
  return (
    <div className={cn('grid gap-0.5', media.length > 1 && 'grid-cols-2')}>
      {media.map((m, i) => (
        <div key={`${m.path}-${i}`} className={cn('overflow-hidden', media.length === 1 ? 'max-h-80' : 'aspect-square', odd && i === 0 && 'col-span-2 aspect-video')}>
          <MediaTile item={m} />
        </div>
      ))}
    </div>
  )
}

function Bubble({ media, text, children }: { media: PostMedia[]; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="overflow-hidden rounded-2xl rounded-bl-md border border-border bg-card">
        <MediaGrid media={media} />
        {text && (
          <div
            className={cn(RICH, 'px-3 py-2 text-sm leading-relaxed text-foreground')}
            // The text has already been reduced to Telegram's safe tag list by cleanTgHtml.
            dangerouslySetInnerHTML={{ __html: text }}
          />
        )}
      </div>
      {children}
    </div>
  )
}

function Keyboard({ rows, counts, onPress }: { rows: PostButton[][]; counts: Record<string, number>; onPress: (b: PostButton) => void }) {
  return (
    <div className="flex flex-col gap-1">
      {rows
        .filter((row) => row.length > 0)
        .map((row, r) => (
          <div key={r} className="flex gap-1">
            {row.map((b) => {
              const Icon = BUTTON_ICON[b.kind]
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onPress(b)}
                  className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-foreground/10 px-2 py-2 text-sm font-medium text-foreground hover:bg-foreground/15"
                >
                  <span className="truncate">{b.label ? buttonText(b, counts) : 'Adsız buton'}</span>
                  <Icon className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                </button>
              )
            })}
          </div>
        ))}
    </div>
  )
}

/** What happens in Telegram when the button is pressed, in words. */
function pressLines(b: PostButton): { label: string; value: string }[] {
  switch (b.kind) {
    case 'link':
      return [{ label: b.track ? 'Bu adres açılır (tıklama sayılır)' : 'Bu adres açılır', value: b.value }]
    case 'popup':
      return [{ label: 'Ekranda bu pencere açılır', value: b.value }]
    case 'copy':
      return [{ label: 'Panoya bu kopyalanır', value: b.value }]
    case 'member':
      return [
        { label: 'Üye olan bu pencereyi görür', value: b.value },
        { label: 'Üye olmayan bunu görür', value: b.alt || DEFAULT_ALT },
      ]
    case 'vote':
      return [{ label: 'Oy sayılır', value: 'Butondaki sayı artar. Kişi başı tek oy; başka seçeneğe basan oyunu taşır.' }]
    case 'raffle':
      return [{ label: b.gate ? 'Üyeyse çekilişe katılır ve bu pencereyi görür' : 'Çekilişe katılır ve bu pencereyi görür', value: b.value || DEFAULT_JOINED }]
    case 'bot':
      return [{ label: 'Bu botla özel sohbet açılır', value: b.value }]
  }
}

export function PostPreview({ content, text, sender, counts = {} }: { content: PostContent; text: string; sender: string; counts?: Record<string, number> }) {
  const [pressed, setPressed] = useState<PostButton | null>(null)
  const withButtons = hasButtons(content)
  const length = visibleLength(text)
  const split = needsSplit(content.media.length, length, withButtons)
  const empty = !text && !content.media.length
  const keyboard = withButtons ? <Keyboard rows={content.buttons} counts={counts} onPress={setPressed} /> : null

  return (
    <aside aria-label="Post önizlemesi" className="flex flex-col gap-2">
      <div
        className="flex flex-col gap-2 rounded-xl bg-muted p-3"
        // Links inside the preview must not navigate away from the panel.
        onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest('a')) e.preventDefault()
        }}
      >
        <span className="text-xs font-semibold text-primary">{sender}</span>
        {empty ? (
          <p className="text-sm leading-relaxed text-muted-foreground">Yazı ya da medya ekleyince post burada görünür.</p>
        ) : split ? (
          <>
            <Bubble media={content.media} text="" />
            <Bubble media={[]} text={text}>
              {keyboard}
            </Bubble>
          </>
        ) : (
          <Bubble media={content.media} text={text}>
            {keyboard}
          </Bubble>
        )}
      </div>
      {split && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {length > CAPTION_LIMIT
            ? `Telegram medyanın altına en fazla ${CAPTION_LIMIT} karakter alıyor. Bu yüzden medya önce, yazı ve butonlar ayrı bir mesaj olarak gider.`
            : 'Telegram albümün altına buton koymuyor. Bu yüzden albüm önce, yazı ve butonlar ayrı bir mesaj olarak gider.'}
        </p>
      )}
      {pressed && (
        <div role="status" className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          <span className="font-semibold text-foreground">{`"${pressed.label || 'Adsız buton'}" butonuna basınca:`}</span>
          {pressLines(pressed).map((line) => (
            <p key={line.label}>
              {`${line.label} → `}
              <span className="whitespace-pre-wrap text-foreground">{line.value || '(boş)'}</span>
            </p>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Telegram’daki görünüm cihaza göre biraz değişir. Emin olmak için “Önce bana gönder”i kullan.</p>
    </aside>
  )
}
