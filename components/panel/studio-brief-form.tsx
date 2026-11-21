'use client'

import { useState, useTransition } from 'react'
import { Loader2, Wand2 } from 'lucide-react'
import { improveBriefAction } from '@/app/panel/studio-actions'
import {
  CAMERA_MOVES,
  RECIPES,
  STUDIO_STYLES,
  briefProblem,
  type Brief,
  type Motion,
  type Recipe,
  type StudioFlow,
} from '@/lib/studio-brief'
import { GIF_DURATIONS, MOTION_QUALITIES, VIDEO_DURATIONS, gifCost, usd, videoCost, type MotionQuality } from '@/lib/studio-types'
import { cn } from '@/lib/utils'

const input =
  'rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none'
const label = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'
const chip = (on: boolean) =>
  cn(
    'rounded-lg border px-3 py-1.5 text-xs font-bold',
    on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
  )

const PLACEHOLDERS: Record<StudioFlow, { subject: string; character: string }> = {
  banner: { subject: 'Örn: Hafta sonuna özel freespin kampanyası', character: 'Örn: Elinde şimşek tutan Zeus, kendinden emin bakıyor' },
  gif: { subject: 'Örn: Hafta sonuna özel freespin kampanyası', character: 'Örn: Elinde şimşek tutan Zeus, kendinden emin bakıyor' },
  video: { subject: 'Örn: Derbi için özel oran duyurusu', character: 'Örn: Topa vurmak üzere olan bir futbolcu' },
  sticker: { subject: 'Örn: Promosyon kodu geldi haberi', character: 'Örn: Elinde megafon tutan heyecanlı bir karakter' },
}

export function BriefFields({
  flow,
  brief,
  onBrief,
  motion,
  onMotion,
  onRecipe,
}: {
  flow: StudioFlow
  brief: Brief
  onBrief: (brief: Brief) => void
  motion: Motion
  onMotion: (motion: Motion) => void
  onRecipe: (recipe: Recipe) => void
}) {
  const [pending, start] = useTransition()
  const [note, setNote] = useState('')
  const set = (patch: Partial<Brief>) => onBrief({ ...brief, ...patch })
  const hint = PLACEHOLDERS[flow]

  function improve() {
    setNote('')
    start(async () => {
      const result = await improveBriefAction(flow, brief, motion)
      if (!result.ok || !result.improved) return setNote(result.message ?? 'İstek geliştirilemedi.')
      const { action, ...fields } = result.improved
      onBrief({ ...brief, ...fields })
      if (flow !== 'banner') onMotion({ ...motion, action })
      setNote('Alanlar daha ayrıntılı yazıldı. Beğenmediğin yeri elle düzelt, sonra üret.')
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <fieldset className={label}>
        <legend className="mb-1.5">Hazır tarifler (seçince alanlar dolar, sonra değiştirirsin)</legend>
        <div className="flex flex-wrap gap-1.5">
          {RECIPES[flow].map((recipe) => (
            <button key={recipe.id} type="button" onClick={() => onRecipe(recipe)} className={chip(false)}>
              {recipe.name}
            </button>
          ))}
        </div>
      </fieldset>

      <label className={label}>
        Konu (zorunlu)
        <textarea
          value={brief.subject}
          onChange={(e) => set({ subject: e.target.value })}
          rows={3}
          placeholder={hint.subject}
          className={cn(input, 'resize-y leading-relaxed')}
        />
      </label>
      {flow !== 'sticker' ? (
        <label className={label}>
          Sahne ve arka plan
          <textarea
            value={brief.scene}
            onChange={(e) => set({ scene: e.target.value })}
            rows={3}
            placeholder="Örn: Mor bulutların arasında altın paralar, sinematik ışık"
            className={cn(input, 'resize-y leading-relaxed')}
          />
        </label>
      ) : null}
      <label className={label}>
        Karakter ya da ana nesne
        <textarea
          value={brief.character}
          onChange={(e) => set({ character: e.target.value })}
          rows={3}
          placeholder={hint.character}
          className={cn(input, 'resize-y leading-relaxed')}
        />
      </label>

      <fieldset className={label}>
        <legend className="mb-1.5">Stil</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {STUDIO_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              aria-pressed={brief.style === style.id}
              title={style.hint}
              onClick={() => set({ style: style.id })}
              className={chip(brief.style === style.id)}
            >
              {style.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className={label}>
        Renkler (opsiyonel; marka renkleri zaten eklenir)
        <input
          value={brief.colors}
          onChange={(e) => set({ colors: e.target.value })}
          placeholder="Örn: altın ve mor"
          className={input}
        />
      </label>
      {flow === 'sticker' ? (
        <label className={label}>
          Sticker üstü yazı (opsiyonel, kısa)
          <input
            value={brief.caption}
            onChange={(e) => set({ caption: e.target.value })}
            placeholder="Örn: KOD GELDİ!"
            className={input}
          />
        </label>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={improve}
          disabled={pending || Boolean(briefProblem(brief))}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Wand2 className="size-3.5" aria-hidden />}
          {pending ? 'Yazılıyor...' : 'İsteği geliştir'}
        </button>
        <p role="status" className="text-xs leading-relaxed text-muted-foreground">
          {note || 'Kısa yazdıysan bu düğme alanları daha ayrıntılı hale getirir. Görsel üretmez; sonucu okuyup üretirsin.'}
        </p>
      </div>
    </div>
  )
}

export function MotionFields({
  flow,
  motion,
  onMotion,
  duration,
  setDuration,
  gifSeconds,
  setGifSeconds,
  audio,
  setAudio,
  quality,
  setQuality,
}: {
  flow: 'gif' | 'video' | 'sticker'
  motion: Motion
  onMotion: (motion: Motion) => void
  duration: number
  setDuration: (seconds: number) => void
  gifSeconds: number
  setGifSeconds: (seconds: number) => void
  audio: boolean
  setAudio: (on: boolean) => void
  quality: MotionQuality
  setQuality: (quality: MotionQuality) => void
}) {
  const seconds = flow === 'gif' ? gifSeconds : duration
  const priceOf = (q: MotionQuality) => (flow === 'gif' ? gifCost(gifSeconds, q) : videoCost(duration, audio, q === 'hd'))

  return (
    <div className="flex flex-col gap-3">
      <label className={label}>
        {flow === 'sticker' ? 'Ne hareket etsin (hareketli sticker için)' : 'Ne hareket etsin'}
        <textarea
          value={motion.action}
          onChange={(e) => onMotion({ ...motion, action: e.target.value })}
          rows={3}
          placeholder={
            flow === 'sticker'
              ? 'Örn: karakter megafonu sallıyor ve zıplıyor'
              : 'Örn: karakter kılıcını kaldırıyor, arkada altın paralar yağıyor'
          }
          className={cn(input, 'resize-y leading-relaxed')}
        />
      </label>

      {flow !== 'sticker' ? (
        <>
          <label className={label}>
            Kamera ne yapsın
            <select
              value={motion.camera}
              onChange={(e) => onMotion({ ...motion, camera: CAMERA_MOVES.find((c) => c.id === e.target.value)?.id ?? 'still' })}
              className={input}
            >
              {CAMERA_MOVES.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset className={label}>
            <legend className="mb-1.5">Süre</legend>
            <div className="flex flex-wrap gap-1.5">
              {(flow === 'gif' ? GIF_DURATIONS : VIDEO_DURATIONS).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={seconds === d}
                  onClick={() => (flow === 'gif' ? setGifSeconds(d) : setDuration(d))}
                  className={chip(seconds === d)}
                >
                  {d} sn
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={label}>
            <legend className="mb-1.5">Kalite</legend>
            <div className="grid grid-cols-2 gap-2">
              {MOTION_QUALITIES.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  aria-pressed={quality === q.id}
                  onClick={() => setQuality(q.id)}
                  className={cn(chip(quality === q.id), 'flex flex-col items-center')}
                >
                  <span>
                    {q.label} · {q.hint}
                  </span>
                  <span className="font-normal">~{usd(priceOf(q.id))}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {flow === 'video' ? (
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} className="size-4 accent-primary" />
              Ses / müzik ekle
            </label>
          ) : null}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Logo ve yazılar hareket bittikten sonra üstüne basılır, bu yüzden keskin kalır. Video çerçevesini tam doldurmayan formatlarda (ör. kare) kamera sabit durur.
          </p>
        </>
      ) : null}
    </div>
  )
}
