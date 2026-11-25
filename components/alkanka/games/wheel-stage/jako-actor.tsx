'use client'

/*
  Jako on a mini game's stage: one clip per state (waiting, the move, winning, losing), drawn with transparency.
  Each game brings its own cast: the wheel's Jako cheers the spin, the dice table's shakes a cup, the vault's holds
  a key. A game that cannot be lost has no losing clip; asking for it leaves him waiting.

  The clips are ordinary H.264 files that every browser plays, with the picture in the top half of the frame and its
  transparency in the bottom half; a small WebGL quad puts the two back together. Video with a real alpha channel
  would need two encodings (VP9 for Chrome, HEVC for Safari) and Safari's cannot be produced outside macOS.

  Every clip starts and ends on the same frame as the still picture, so the waiting loop repeats without a seam and a
  reaction hands back to waiting without a cut.

  A cast whose clips are built out-and-back (the same frames played forward, then in reverse) never cuts between two
  different poses either:
  - a move asked for in the middle of the waiting loop first runs that loop home: the loop is the same going out as
    coming back, so the player jumps to the matching frame of the way back and plays it fast, and the move starts
    from the stance;
  - a reaction asked for while another is on screen waits for that one's still moment, skips the rest of it and
    plays its way back fast, and starts from the stance too.
  A cast without those marks is cross-faded over a few frames instead, as is anything that takes too long.

  The still alone is shown under reduced motion, with data saver on, when WebGL is missing and whenever the browser
  refuses to autoplay (iOS Low Power Mode). Clips pause while the stage is off-screen or the tab is hidden.
*/

import { useEffect, useRef, useState } from 'react'
import { pacedFrames } from '@/lib/paced-frames'
import { useInView, usePageHidden, usePrefersReducedMotion } from '@/lib/use-motion'
import { cn } from '@/lib/utils'

export type ActorState = 'idle' | 'spin' | 'win' | 'lose'

export type ActorCast = {
  /** The first frame of the waiting clip, as a picture. */
  still: string
  clips: { idle: string } & Partial<Record<ActorState, string>>
  /** The clips' picture size: half the height of the stacked video frame. */
  frame: { width: number; height: number }
  /** The waiting clip is played out and back over the same frames: its second half mirrors its first. */
  mirrored?: boolean
  /**
   * A reaction's still moment, in seconds: `hold` is when it stops moving, `back` when it starts for the stance
   * again. Nothing moves between the two, so the player may skip from anywhere in between to `back`.
   */
  beats?: Partial<Record<ActorState, { hold: number; back: number }>>
}

/** What is on screen right now, for a stage that moves things in step with a clip. */
export type ActorClock = { clip: ActorState | null; time: number }

const WHEEL_CAST: ActorCast = {
  still: '/images/wheel/jako.webp',
  clips: {
    idle: '/video/wheel/jako-idle.mp4',
    spin: '/video/wheel/jako-spin.mp4',
    win: '/video/wheel/jako-win.mp4',
    lose: '/video/wheel/jako-lose.mp4',
  },
  frame: { width: 936, height: 816 },
}

const FADE_MS = 160
/** The waiting loop is run home in about this long, and never for longer than HOME_LIMIT_MS. */
const HOME_MS = 260
const HOME_LIMIT_MS = 650
const HOME_MAX_RATE = 8
/** How fast a reaction's way back is played when another reaction is waiting for it. */
const BACK_RATE = 2.5
/** Closer than this to either end, the waiting loop counts as standing in the stance. */
const STANCE_S = 0.09

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

/** `cast` must be a constant: a new object would rebuild the player. `clock` is written to on every frame drawn. */
export function JakoActor({
  state,
  armed,
  className,
  cast = WHEEL_CAST,
  clock,
}: {
  state: ActorState
  armed: boolean
  className?: string
  cast?: ActorCast
  clock?: { current: ActorClock }
}) {
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
    /** The reaction that starts once what is on screen has come back to the stance. */
    let queued: ActorState | null = null
    /** The waiting loop is being run home, or a reaction's way back is being played fast. */
    let homing = false
    let homeTimer: ReturnType<typeof setTimeout> | undefined
    let running = false
    let on = true
    let lastTime = -1
    let fresh = false

    const tell = (video: HTMLVideoElement | null | undefined) => {
      if (clock) clock.current = { clip: video ? top : null, time: video ? video.currentTime : 0 }
    }

    const draw = (now: number) => {
      const video = top ? videos.get(top) : null
      if (video && video.readyState >= 2 && (video.currentTime !== lastTime || painter.fading(now))) {
        painter.paint(video, fresh, now)
        fresh = false
        lastTime = video.currentTime
        setLive(true)
      }
      tell(video)
      /* a reaction that another one is waiting for skips the rest of its still moment */
      if (video && top && queued && !homing) {
        const beats = cast.beats?.[top]
        if (beats && video.currentTime >= beats.hold) leave(video, beats.back)
      }
      if (running) frames.request(draw)
    }
    const loop = (go: boolean) => {
      if (go === running) return
      running = go
      if (go) frames.request(draw)
      else frames.cancel()
    }

    const settleHome = () => {
      homing = false
      clearTimeout(homeTimer)
      const idle = videos.get('idle')
      if (idle) {
        idle.loop = true
        idle.playbackRate = 1
      }
    }

    const start = (s: ActorState) => {
      const video = videos.get(s)
      if (!video || !on) return
      if (top === s && !video.paused && !video.ended && !homing) return
      settleHome()
      video.playbackRate = 1
      video.currentTime = 0
      void video.play().catch(() => {})
    }
    const request = (asked: ActorState) => {
      const s = cast.clips[asked] ? asked : 'idle'
      wanted = s
      queued = null
      warm(s)
      start(s)
    }

    /** Plays what is left of the clip on screen fast, from `at` if given; whatever is queued starts when it ends. */
    function leave(video: HTMLVideoElement, at?: number) {
      homing = true
      if (at !== undefined && video.currentTime < at) video.currentTime = at
      video.playbackRate = BACK_RATE
      clearTimeout(homeTimer)
      homeTimer = setTimeout(arrive, HOME_LIMIT_MS + 600)
    }

    /** The clip on screen is back in the stance (or took too long): what was asked for starts. */
    function arrive() {
      if (!homing) return
      const next = queued ?? 'idle'
      settleHome()
      request(next)
    }

    /** Runs the waiting loop home: to the matching frame of its way back, then fast to its end. */
    function runHome(idle: HTMLVideoElement) {
      const length = idle.duration
      const at = idle.currentTime
      if (!Number.isFinite(length) || at < STANCE_S || length - at < STANCE_S) return false
      homing = true
      idle.loop = false
      const back = at < length / 2 ? length - at : at
      if (back !== at) idle.currentTime = back
      idle.playbackRate = Math.min(HOME_MAX_RATE, Math.max(1, ((length - back) * 1000) / HOME_MS))
      clearTimeout(homeTimer)
      homeTimer = setTimeout(arrive, HOME_LIMIT_MS)
      return true
    }

    /** A new state was asked for by the stage: decides whether it can start now or has to wait for the stance. */
    function ask(asked: ActorState) {
      const s = cast.clips[asked] ? asked : 'idle'
      const video = top ? videos.get(top) : null
      const playing = Boolean(video && !video.paused && !video.ended)
      if (s === 'idle') {
        /* a reaction on screen plays to its end and hands back to waiting by itself */
        queued = null
        wanted = 'idle'
        if (top && top !== 'idle' && playing) return
        if (top === 'idle' && playing) return
        request('idle')
        return
      }
      warm(s)
      if (!video || !playing || !top) {
        request(s)
        return
      }
      if (homing) {
        queued = s
        return
      }
      if (top === 'idle') {
        queued = s
        if (cast.mirrored && runHome(video)) return
        request(s)
        return
      }
      const beats = cast.beats?.[top]
      if (!beats) {
        request(s)
        return
      }
      if (s === top && video.currentTime < beats.hold) return
      queued = s
      if (video.currentTime >= beats.hold) leave(video, beats.back)
    }

    function warm(s: ActorState) {
      const src = cast.clips[s]
      if (!src || videos.has(s)) return
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
        if (wanted !== s && !(homing && top === s)) {
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
        if (top !== s) return
        if (homing) arrive()
        else request(queued ?? 'idle')
      })
      video.src = src
      layer?.appendChild(video)
      videos.set(s, video)
    }

    const lost = () => {
      loop(false)
      setLive(false)
    }
    canvas.addEventListener('webglcontextlost', lost)

    control.current = {
      request: ask,
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
      clearTimeout(homeTimer)
      if (clock) clock.current = { clip: null, time: 0 }
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
  }, [reduced, cast, clock])

  useEffect(() => {
    control.current?.setActive(active)
  }, [active, reduced, cast])

  // The move's clip loads once a move is possible, the endings once one has started.
  useEffect(() => {
    if (armed || state !== 'idle') control.current?.warm('spin')
    if (state !== 'idle') for (const s of Object.keys(cast.clips) as ActorState[]) control.current?.warm(s)
    if (lastState.current === state) return
    lastState.current = state
    control.current?.request(state)
  }, [state, armed, reduced, cast])

  return (
    <div ref={layerRef} aria-hidden="true" className={cn('pointer-events-none isolate', className)}>
      <img
        src={cast.still}
        alt=""
        draggable={false}
        className={cn('absolute inset-0 size-full transition-opacity duration-150', live && 'opacity-0')}
      />
      <canvas ref={canvasRef} width={cast.frame.width} height={cast.frame.height} className="absolute inset-0 size-full" />
    </div>
  )
}
