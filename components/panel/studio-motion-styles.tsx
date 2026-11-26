'use client'

import { Loader2, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { askConfirm, notify } from '@/components/panel/confirm-dialog'
import { sampleFrames } from '@/lib/motion/sample-frames'
import { EFFECTS, PACES, REVEALS, TEXTURES, TRANSITIONS, type MotionColors, type MotionLook } from '@/lib/motion/spec'
import type { MotionStyle } from '@/lib/motion/styles'
import { cn } from '@/lib/utils'

/** A file up to this size travels whole; a heavier one is sampled on the screen and only its frames are sent. */
const WHOLE_FILE_BYTES = 3.5 * 1024 * 1024

const input = 'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const field = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'
const ghostBtn =
  'flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50'

const named = (list: readonly { id: string; label: string }[], id: string) => list.find((item) => item.id === id)?.label ?? ''

/** What was taken from the example, in the panel's own words. */
export function lookSummary(look: MotionLook) {
  return [
    `Geçiş: ${named(TRANSITIONS, look.transition)}`,
    `Yazı: ${named(REVEALS, look.reveal)}`,
    `Hız: ${named(PACES, look.pace)}`,
    `Zemin: ${named(TEXTURES, look.texture)}`,
    look.effect === 'none' ? '' : `Efekt: ${named(EFFECTS, look.effect)}`,
    look.logoIntro ? 'Logo ile açılır' : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

type Props = {
  styles: MotionStyle[]
  onStyles: (styles: MotionStyle[]) => void
  /** The style whose manner the form is set to, if any. */
  active: number | null
  onApply: (style: MotionStyle, withColors: boolean) => void
}

export function MotionStyles({ styles, onStyles, active, onApply }: Props) {
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState('')
  const [name, setName] = useState('')
  const picker = useRef<HTMLInputElement>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    const file = picker.current?.files?.[0] ?? null
    if (!file && !link.trim()) {
      notify(false, 'Bir örnek dosya seç ya da linkini yapıştır.')
      return
    }
    setBusy(true)
    try {
      const form = new FormData()
      form.set('name', name)
      if (file && file.size > WHOLE_FILE_BYTES) {
        const sampled = await sampleFrames(file)
        if (!sampled) {
          notify(false, 'Bu dosya tarayıcıda açılamadı. 3,5 MB altında bir kopyasını yükle ya da dosyanın linkini yapıştır.')
          return
        }
        sampled.shots.forEach((shot, i) => form.append('shot', shot, `kare-${i}.jpg`))
        form.set('seconds', String(sampled.seconds))
        form.set('fileName', file.name)
      } else if (file) {
        form.set('file', file)
      } else {
        form.set('url', link.trim())
      }
      const res = await fetch('/api/studio/motion/style', { method: 'POST', body: form })
      const data = (await res.json().catch(() => null)) as { style?: MotionStyle; read?: boolean; error?: string } | null
      if (!res.ok || !data?.style) {
        notify(false, data?.error ?? 'Örnek incelenemedi.')
        return
      }
      onStyles([data.style, ...styles])
      onApply(data.style, false)
      notify(true, data.read ? 'Örnek incelendi ve tarzı forma uygulandı.' : 'Örneğin sadece renkleri ölçülebildi; geçiş ve hız ayarlarını elle seç.')
      setLink('')
      setName('')
      if (picker.current) picker.current.value = ''
    } catch {
      notify(false, 'Bağlantı koptu, tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(style: MotionStyle) {
    if (!(await askConfirm(`"${style.name}" tarzı silinsin mi? Bu tarzla daha önce üretilen GIF'ler durur.`))) return
    const res = await fetch(`/api/studio/motion/style?id=${style.id}`, { method: 'DELETE' })
    if (!res.ok) {
      notify(false, 'Tarz silinemedi.')
      return
    }
    onStyles(styles.filter((s) => s.id !== style.id))
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Beğendiğin bir banner GIF&apos;ini ekle. Sistem ondan sadece tarzı alır: mesajlar nasıl değişiyor, yazı nasıl geliyor, ne kadar hızlı, zemin nasıl, renkler
        ne. Yazıları, logosu ve görselleri alınmaz; senin mesajların ve senin markanla yeni bir banner kurulur.
      </p>

      {styles.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {styles.map((style) => (
            <li
              key={style.id}
              className={cn('flex flex-col overflow-hidden rounded-xl border bg-background', active === style.id ? 'border-primary' : 'border-border')}
            >
              <img src={style.sheetUrl || '/placeholder.svg'} alt={`${style.name} örneğinden kareler`} loading="lazy" className="h-28 w-full bg-secondary object-cover object-top" />
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="text-sm font-bold text-foreground">
                  {style.name}
                  {active === style.id ? <span className="ml-2 text-xs font-semibold text-primary">Formda bu tarz var</span> : null}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">{lookSummary(style.look)}</p>
                {style.note ? <p className="text-xs leading-relaxed text-muted-foreground">{style.note}</p> : null}
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                  <button type="button" onClick={() => onApply(style, false)} className={ghostBtn}>
                    Tarzı uygula
                  </button>
                  <button type="button" onClick={() => onApply(style, true)} className={ghostBtn}>
                    <span className="flex gap-0.5" aria-hidden>
                      {(['deep', 'mid', 'accent'] as (keyof MotionColors)[]).map((key) => (
                        <span key={key} className="size-3 rounded-full border border-border" style={{ backgroundColor: style.colors[key] }} />
                      ))}
                    </span>
                    Renkleriyle uygula
                  </button>
                  <button type="button" onClick={() => void remove(style)} className={cn(ghostBtn, 'ml-auto')} aria-label={`${style.name} tarzını sil`}>
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Henüz örnek eklenmedi. Örnek eklemeden de aşağıdaki ayarlarla üretebilirsin.
        </p>
      )}

      <form onSubmit={add} data-no-guard className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
        <p className="text-sm font-bold text-foreground">Örnek ekle</p>
        <div className="grid gap-3 md:grid-cols-3">
          <label className={field}>
            Dosya (GIF, PNG, JPG, WEBP)
            <input ref={picker} type="file" accept="image/gif,image/png,image/jpeg,image/webp" className={cn(input, 'py-2 file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-semibold file:text-foreground')} />
          </label>
          <label className={field}>
            ya da dosyanın linki
            <input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" placeholder="https://..." className={input} />
          </label>
          <label className={field}>
            Tarzın adı (boş bırakılabilir)
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Patlamalı mavi şerit" className={input} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {busy ? 'İnceleniyor' : 'Örneği incele'}
          </button>
          <p className="text-xs leading-relaxed text-muted-foreground">Aynı kampanyanın bütün boyutlarını eklemene gerek yok; tek bir boyut tarzı anlatmaya yeter.</p>
        </div>
      </form>
    </div>
  )
}
