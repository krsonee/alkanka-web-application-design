'use client'

import opentype, { type Font } from 'opentype.js'
import { Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import useSWRImmutable from 'swr/immutable'
import { drawBackdrop, drawFrame, type MotionKit, type Picture, type Reel } from '@/lib/motion/frame'
import { MOTION_FPS, type MotionFontId } from '@/lib/motion/spec'
import { pacedFrames } from '@/lib/paced-frames'

/** The tallest the preview is shown, so that a tower banner does not push the form off the screen. */
const MAX_HEIGHT = 420
/** Where a film that is not playing stands: late enough for the first message to be on screen. */
const STILL_AT = 1.6

async function loadFont([, id]: readonly [string, MotionFontId]): Promise<Font> {
  const res = await fetch(`/api/studio/motion/font?id=${id}`)
  if (!res.ok) throw new Error('Yazı tipi yüklenemedi')
  return opentype.parse(await res.arrayBuffer())
}

/**
 * The preview redraws the whole frame many times a second. A picture carried inside every frame as
 * text would be read again each time, so it is held once by the browser and the frames only name it.
 */
async function held(picture: Picture | null | undefined): Promise<Picture | null> {
  if (!picture) return null
  const blob = await (await fetch(picture.href)).blob()
  return { href: URL.createObjectURL(blob), ratio: picture.ratio }
}

async function loadPictures([, brandId, figure]: readonly [string, number | '', string]) {
  if (brandId === '' && !figure) return { logo: null, figure: null }
  const res = await fetch('/api/studio/motion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'kit', brandId, figure }),
  })
  if (!res.ok) throw new Error('Görseller yüklenemedi')
  const data = (await res.json()) as { logo: Picture | null; figure: Picture | null }
  return { logo: await held(data.logo), figure: await held(data.figure) }
}

/** The font, the logo and the character exactly as the server draws them, for the preview on screen. */
export function useMotionKit(fontId: MotionFontId, brandId: number | '', figure: string) {
  const font = useSWRImmutable(['motion-font', fontId] as const, loadFont)
  const pictures = useSWRImmutable(['motion-kit', brandId, figure] as const, loadPictures)
  const kit = useMemo<MotionKit | null>(
    () => (font.data ? { font: font.data, logo: pictures.data?.logo ?? null, figure: pictures.data?.figure ?? null } : null),
    [font.data, pictures.data],
  )
  return { kit, loading: font.isLoading || pictures.isLoading, failed: Boolean(font.error), picturesFailed: Boolean(pictures.error) }
}

export function MotionPreview({ reel, label }: { reel: Reel | null; label: string }) {
  const stage = useRef<HTMLDivElement>(null)
  const clock = useRef(STILL_AT)
  const [playing, setPlaying] = useState(() => typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const spec = reel?.spec
  const backdrop = useMemo(() => (spec ? `url("data:image/svg+xml,${encodeURIComponent(drawBackdrop(spec, 'pvb'))}")` : undefined), [spec])

  useEffect(() => {
    const el = stage.current
    if (!el || !reel) return
    if (!playing) {
      el.innerHTML = drawFrame(reel, clock.current, 'pv')
      return
    }
    const frames = pacedFrames(MOTION_FPS)
    const started = performance.now() - clock.current * 1000
    const tick = (now: number) => {
      clock.current = (now - started) / 1000
      el.innerHTML = drawFrame(reel, clock.current, 'pv')
      frames.request(tick)
    }
    frames.request(tick)
    return () => frames.cancel()
  }, [reel, playing])

  if (!reel || !spec) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl bg-secondary text-sm text-muted-foreground" role="status">
        Önizleme hazırlanıyor
      </div>
    )
  }
  const { width, height } = spec
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={stage}
        role="img"
        aria-label={label}
        className="overflow-hidden rounded-md shadow-lg [&>svg]:block [&>svg]:size-full"
        style={{
          aspectRatio: `${width} / ${height}`,
          width: `min(100%, ${width}px, ${Math.round((MAX_HEIGHT * width) / height)}px)`,
          backgroundImage: backdrop,
          backgroundSize: '100% 100%',
        }}
      />
      <button
        type="button"
        onClick={() => setPlaying((on) => !on)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
      >
        {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        {playing ? 'Durdur' : 'Oynat'}
      </button>
    </div>
  )
}
