'use client'

/*
  Jako on the wheel stage: one clip per state (waiting, cheering the spin, winning, losing), drawn with transparency.

  The clips are ordinary H.264 files that every browser plays, with the picture in the top half of the frame and its
  transparency in the bottom half; a small WebGL quad puts the two back together. Video with a real alpha channel
  would need two encodings (VP9 for Chrome, HEVC for Safari) and Safari's cannot be produced outside macOS.

  Every clip starts and ends on the same frame as the still picture, so the waiting loop repeats without a seam and a
  reaction hands back to waiting without a cut. Cutting into a reaction from the middle of the waiting loop is
  cross-faded over a few frames instead.

  The still alone is shown under reduced motion, with data saver on, when WebGL is missing and whenever the browser
  refuses to autoplay (iOS Low Power Mode). Clips pause while the stage is off-screen or the tab is hidden.
*/

import { useEffect, useRef, useState } from 'react'
import { pacedFrames } from '@/lib/paced-frames'
import { useInView, usePageHidden, usePrefersReducedMotion } from '@/lib/use-motion'
import { cn } from '@/lib/utils'

export type ActorState = 'idle' | 'spin' | 'win' | 'lose'

const STILL = '/images/wheel/jako.webp'
const CLIPS: Record<ActorState, string> = {
  idle: '/video/wheel/jako-idle.mp4',
  spin: '/video/wheel/jako-spin.mp4',
  win: '/video/wheel/jako-win.mp4',
  lose: '/video/wheel/jako-lose.mp4',
}
const STATES = Object.keys(CLIPS) as ActorState[]

/** The clips' picture size: half the height of the stacked video frame. */
const FRAME = { width: 936, height: 816 }
const FADE_MS = 160

const VERTEX = `
attribute vec2 corner;
varying vec2 at;
void main() {
  at = corner * 0.5 + 0.5;
  gl_Position = vec4(corner, 0.0, 1.0);
}`

// Colour is stored already multiplied by its transparency, which is what a premultiplied canvas expects.
// The small margins keep one half of the frame from bleeding into the other and drop compression noise.
const FRAGMENT = `
precision mediump float;
uniform sampler2D now;
uniform sampler2D before;
uniform float fade;
varying vec2 at;
vec4 cut(sampler2D clip) {
  vec3 colour = texture2D(clip, vec2(at.x, 0.5 + 0.001 + at.y * 0.498)).rgb;
  float alpha = texture2D(clip, vec2(at.x, 0.001 + at.y * 0.498)).g;
  alpha = clamp((alpha - 0.03) / 0.94, 0.0, 1.0);
  return vec4(min(colour, vec3(alpha)), alpha);
}
void main() {
  vec4 current = cut(now);
  gl_FragColor = fade < 1.0 ? mix(cut(before), current, fade) : current;
}`

type Painter = {
  /** Draws the clip's current frame; `fresh` starts a cross-fade from whatever was on screen. */
  paint: (video: HTMLVideoElement, fresh: boolean, time: number) => void
  /** true while a cross-fade still has frames to draw. */
  fading: (time: number) => boolean
  dispose: () => void
}

function createPainter(canvas: HTMLCanvasElement): Painter | null {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  })
  if (!gl) return null

  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)
    if (!s) return null
    gl.shaderSource(s, source)
    gl.compileShader(s)
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
  }
  const vertex = shader(gl.VERTEX_SHADER, VERTEX)
  const fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
  gl.useProgram(program)

  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const corner = gl.getAttribLocation(program, 'corner')
  gl.enableVertexAttribArray(corner)
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0)

  const texture = (unit: number) => {
    const t = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
    return t
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  // Two textures that swap roles: one holds the running clip, the other the frame it is fading away from.
  const textures = [texture(0), texture(1)]
  let front = 0
  let fadeStart = -Infinity
  let drawn = false

  const nowAt = gl.getUniformLocation(program, 'now')
  const beforeAt = gl.getUniformLocation(program, 'before')
  const fadeAt = gl.getUniformLocation(program, 'fade')
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clearColor(0, 0, 0, 0)

  return {
    paint(video, fresh, time) {
      if (fresh && drawn) {
        front = 1 - front
        fadeStart = time
      }
      gl.activeTexture(gl.TEXTURE0 + front)
      gl.bindTexture(gl.TEXTURE_2D, textures[front])
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      gl.uniform1i(nowAt, front)
      gl.uniform1i(beforeAt, 1 - front)
      gl.uniform1f(fadeAt, Math.min(1, (time - fadeStart) / FADE_MS))
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      drawn = true
    },
    fading: (time) => time - fadeStart < FADE_MS,
    // The context belongs to the canvas and is handed out again on the next mount, so only what was made here goes.
    dispose() {
      for (const t of textures) gl.deleteTexture(t)
      gl.deleteBuffer(quad)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
      gl.clear(gl.COLOR_BUFFER_BIT)
    },
  }
}

const savesData = () =>
  typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)

export function JakoActor({ state, armed, className }: { state: ActorState; armed: boolean; className?: string }) {
  const reduced = usePrefersReducedMotion()
  const hidden = usePageHidden()
  const layerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inView = useInView(layerRef, 0.15)
  const active = inView && !hidden
  /** The clips are on screen: the still has stepped aside. */
  const [live, setLive] = useState(false)

  const control = useRef<{ request: (s: ActorState) => void; setActive: (on: boolean) => void; warm: (s: ActorState) => void } | null>(
    null,
  )
  const lastState = useRef<ActorState>(state)

  useEffect(() => {
    const canvas = canvasRef.current
    const layer = layerRef.current
    if (reduced || !canvas || !layer || savesData()) return
    const painter = createPainter(canvas)
    if (!painter) return

    const videos = new Map<ActorState, HTMLVideoElement>()
    const frames = pacedFrames(30)
    let wanted: ActorState = 'idle'
    let top: ActorState | null = null
    let running = false
    let on = true
    let lastTime = -1
    let fresh = false

    const draw = (now: number) => {
      const video = top ? videos.get(top) : null
      if (video && video.readyState >= 2 && (video.currentTime !== lastTime || painter.fading(now))) {
        painter.paint(video, fresh, now)
        fresh = false
        lastTime = video.currentTime
        setLive(true)
      }
      if (running) frames.request(draw)
    }
    const loop = (go: boolean) => {
      if (go === running) return
      running = go
      if (go) frames.request(draw)
      else frames.cancel()
    }

    const start = (s: ActorState) => {
      const video = videos.get(s)
      if (!video || !on) return
      if (top === s && !video.paused && !video.ended) return
      video.currentTime = 0
      void video.play().catch(() => {})
    }
    const request = (s: ActorState) => {
      wanted = s
      warm(s)
      start(s)
    }

    function warm(s: ActorState) {
      if (videos.has(s)) return
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.preload = 'auto'
      video.loop = s === 'idle'
      video.disablePictureInPicture = true
      video.setAttribute('aria-hidden', 'true')
      video.tabIndex = -1
      // Kept in the page, one pixel large: some browsers only decode a clip that is attached to the document.
      video.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none'
      video.addEventListener('playing', () => {
        if (wanted !== s) {
          video.pause()
          return
        }
        if (top === s) return
        const previous = top ? videos.get(top) : null
        top = s
        lastTime = -1
        fresh = true
        previous?.pause()
        loop(true)
      })
      video.addEventListener('ended', () => {
        if (top === s) request('idle')
      })
      video.src = CLIPS[s]
      layer?.appendChild(video)
      videos.set(s, video)
    }

    const lost = () => {
      loop(false)
      setLive(false)
    }
    canvas.addEventListener('webglcontextlost', lost)

    control.current = {
      request(s) {
        // A reaction on screen plays to its end; it hands back to waiting by itself.
        const playing = top ? videos.get(top) : null
        if (s === 'idle' && top && top !== 'idle' && playing && !playing.ended) return
        request(s)
      },
      setActive(next) {
        on = next
        const video = top ? videos.get(top) : null
        if (!next) {
          video?.pause()
          loop(false)
          return
        }
        if (video && top === wanted && video.paused && !video.ended) {
          void video.play().catch(() => {})
          loop(true)
        } else start(wanted)
      },
      warm,
    }
    request('idle')

    return () => {
      control.current = null
      loop(false)
      canvas.removeEventListener('webglcontextlost', lost)
      for (const video of videos.values()) {
        video.pause()
        video.removeAttribute('src')
        video.load()
        video.remove()
      }
      painter.dispose()
      setLive(false)
    }
  }, [reduced])

  useEffect(() => {
    control.current?.setActive(active)
  }, [active, reduced])

  // The spin clip loads once a spin is possible, the two endings once one has started.
  useEffect(() => {
    if (armed || state !== 'idle') control.current?.warm('spin')
    if (state !== 'idle') for (const s of STATES) control.current?.warm(s)
    if (lastState.current === state) return
    lastState.current = state
    control.current?.request(state)
  }, [state, armed, reduced])

  return (
    <div ref={layerRef} aria-hidden="true" className={cn('pointer-events-none isolate', className)}>
      <img
        src={STILL}
        alt=""
        draggable={false}
        className={cn('absolute inset-0 size-full transition-opacity duration-150', live && 'opacity-0')}
      />
      <canvas ref={canvasRef} width={FRAME.width} height={FRAME.height} className="absolute inset-0 size-full" />
    </div>
  )
}
