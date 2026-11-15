'use client'

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Bold, Code, EyeOff, Italic, Link2, Quote, RemoveFormatting, Strikethrough, Underline } from 'lucide-react'
import { cn } from '@/lib/utils'
import { btn, btnGhost, input } from '@/components/panel/tg-hub-ui'
import { RICH } from '@/components/panel/tg-post-preview'
import { cleanTgHtml, escapeText, safeLink } from '@/lib/tg-posts-shared'

/** Telegram HTML as the browser needs it to be editable: real line breaks, and room for the caret below a closing block. */
function toEditorHtml(html: string) {
  const body = html.replace(/<tg-spoiler>/g, '<span class="tg-spoiler">').replace(/<\/tg-spoiler>/g, '</span>').replace(/\n/g, '<br>')
  return /<\/(blockquote|pre)>$/.test(body) ? `${body}<br>` : body
}

type Wrap = 'code' | 'blockquote' | 'spoiler'
const WRAP: Record<Wrap, { tag: string; selector: string; className?: string }> = {
  code: { tag: 'code', selector: 'code' },
  blockquote: { tag: 'blockquote', selector: 'blockquote' },
  spoiler: { tag: 'span', selector: 'span.tg-spoiler', className: 'tg-spoiler' },
}

const toolButton = 'inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-secondary focus-visible:bg-secondary'

/**
 * Writing area that shows the formatting as it is typed. `initial` is read once; give the component a new `key`
 * to load different text. `onChange` always receives Telegram-safe HTML.
 */
export function PostEditor({ initial, onChange, label }: { initial: string; onChange: (html: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const saved = useRef<Range | null>(null)
  const [html] = useState(() => ({ __html: toEditorHtml(initial) }))
  const [empty, setEmpty] = useState(!initial)
  const [linking, setLinking] = useState(false)
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState('')

  const emit = () => {
    const el = ref.current
    if (!el) return
    const clean = cleanTgHtml(el.innerHTML)
    setEmpty(!clean)
    onChange(clean)
  }

  const selection = () => {
    const sel = window.getSelection()
    if (!sel?.rangeCount || !ref.current) return null
    const range = sel.getRangeAt(0)
    return ref.current.contains(range.commonAncestorContainer) ? range : null
  }

  const exec = (command: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand(command, false, arg)
    emit()
  }

  const hostOf = (range: Range, selector: string) => {
    const node = range.commonAncestorContainer
    const host = (node instanceof Element ? node : node.parentElement)?.closest(selector)
    return host && ref.current?.contains(host) && host !== ref.current ? host : null
  }

  /** Wraps the selection, or unwraps when the caret is already inside the same kind of block. */
  const toggle = (kind: Wrap) => {
    const range = selection()
    if (!range) return
    const { tag, selector, className } = WRAP[kind]
    const host = hostOf(range, selector)
    if (host) host.replaceWith(...Array.from(host.childNodes))
    else if (!range.collapsed) {
      const el = document.createElement(tag)
      if (className) el.className = className
      // Telegram allows no other formatting inside code, so the selection goes in as plain text.
      if (kind === 'code') {
        el.textContent = range.toString()
        range.deleteContents()
      } else el.appendChild(range.extractContents())
      range.insertNode(el)
      // Without a line after a closing quote the caret could never leave it.
      if (kind === 'blockquote' && !el.nextSibling) el.after(document.createElement('br'))
      window.getSelection()?.selectAllChildren(el)
    } else return
    emit()
  }

  const openLink = () => {
    const range = selection()
    saved.current = range ? range.cloneRange() : null
    const current = range ? hostOf(range, 'a') : null
    setUrl(current?.getAttribute('href') ?? '')
    setUrlError('')
    setLinking(true)
  }

  const restore = () => {
    ref.current?.focus()
    if (!saved.current) return
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(saved.current)
  }

  const applyLink = () => {
    const link = safeLink(url)
    if (!link) return setUrlError('Adres geçersiz. https:// ile başlayan tam adresi yaz.')
    restore()
    const range = selection()
    if (range && !range.collapsed) exec('createLink', link)
    else exec('insertHTML', `<a href="${escapeText(link).replace(/"/g, '&quot;')}">${escapeText(link)}</a>`)
    setLinking(false)
  }

  const removeLink = () => {
    restore()
    exec('unlink')
    setLinking(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Enter confirms an IME composition (Chinese, Japanese, Korean); it must not break the line then.
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    exec('insertLineBreak')
  }

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    exec('insertText', e.clipboardData.getData('text/plain'))
  }

  const clearFormat = () => {
    const range = selection()
    if (range && !range.collapsed) exec('insertText', range.toString())
  }

  const tools: { label: string; icon: typeof Bold; run: () => void }[] = [
    { label: 'Kalın (Ctrl+B)', icon: Bold, run: () => exec('bold') },
    { label: 'İtalik (Ctrl+I)', icon: Italic, run: () => exec('italic') },
    { label: 'Altı çizili (Ctrl+U)', icon: Underline, run: () => exec('underline') },
    { label: 'Üstü çizili', icon: Strikethrough, run: () => exec('strikeThrough') },
    { label: 'Gizli yazı (dokununca açılır)', icon: EyeOff, run: () => toggle('spoiler') },
    { label: 'Alıntı', icon: Quote, run: () => toggle('blockquote') },
    { label: 'Kod', icon: Code, run: () => toggle('code') },
    { label: 'Link', icon: Link2, run: openLink },
    { label: 'Seçili yazının biçimini temizle', icon: RemoveFormatting, run: clearFormat },
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-border bg-background focus-within:border-primary">
        <div role="toolbar" aria-label="Yazı biçimi" className="flex flex-wrap gap-0.5 border-b border-border p-1">
          {tools.map((t) => (
            <button
              key={t.label}
              type="button"
              title={t.label}
              aria-label={t.label}
              className={toolButton}
              // Keeps the text selection in the writing area while the button is pressed.
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.run}
            >
              <t.icon className="size-4" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          data-placeholder="Postun yazısı. Biçim vermek için yazıyı seçip üstteki düğmelere bas."
          className={cn(
            RICH,
            'min-h-40 px-3 py-2 text-sm leading-relaxed text-foreground outline-none',
            // The placeholder floats with no height so the caret still starts at the top-left corner.
            empty && 'before:pointer-events-none before:float-left before:h-0 before:text-muted-foreground before:content-[attr(data-placeholder)]',
          )}
          onInput={emit}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          dangerouslySetInnerHTML={html}
        />
      </div>
      {linking && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Link adresi
            <input
              className={input}
              type="url"
              inputMode="url"
              autoFocus
              value={url}
              placeholder="https://…"
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
                e.preventDefault()
                applyLink()
              }}
            />
          </label>
          {urlError && (
            <p role="alert" className="text-xs text-destructive">
              {urlError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={applyLink}>
              Linki uygula
            </button>
            <button type="button" className={btnGhost} onClick={removeLink}>
              Linki kaldır
            </button>
            <button type="button" className={btnGhost} onClick={() => setLinking(false)}>
              Vazgeç
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Yazı seçiliyse link ona bağlanır; seçili yazı yoksa adresin kendisi eklenir.</p>
        </div>
      )}
    </div>
  )
}
