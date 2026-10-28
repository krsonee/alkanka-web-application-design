'use client'

import { useSyncExternalStore } from 'react'

export type SoundName =
  | 'turn'
  | 'join'
  | 'leave'
  | 'start'
  | 'win'
  | 'lose'
  | 'message'
  | 'sent'
  | 'dice'
  | 'card'
  | 'tile'
  | 'cue'
  | 'pocket'
  | 'coin'
  | 'tick'
  | 'error'
  | 'chip'
  | 'spin'
  | 'ball'
  | 'goal'
  | 'move'
  | 'hit'
  | 'bearoff'
  | 'kick'
  | 'header'
  | 'bounce'
  | 'dribble'
  | 'post'
  | 'rim'
  | 'board'
  | 'net'
  | 'swish'
  | 'whistle'
  | 'whistleEnd'
  | 'cheer'

const MUTE_KEY = 'alkanka:sound-muted'
const listeners = new Set<() => void>()
let ctx: AudioContext | null = null
let master: GainNode | null = null
/** Bus for physical sounds: dry to master plus a short room reverb so knocks don't sound "in a vacuum". */
let room: GainNode | null = null
let muted = typeof window !== 'undefined' && window.localStorage?.getItem(MUTE_KEY) === '1'

function audio() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)

    room = ctx.createGain()
    room.connect(master)
    const irLen = Math.floor(ctx.sampleRate * 0.45)
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp((-i / irLen) * 7)
    }
    const verb = ctx.createConvolver()
    verb.buffer = ir
    const wet = ctx.createGain()
    wet.gain.value = 0.22
    room.connect(verb).connect(wet).connect(master)
    loadSamples(ctx)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Recorded CC0 / public-domain clips (Wikimedia Commons). Synth versions stay as fallback until they decode. */
const SAMPLE_URLS = {
  whistle: '/sounds/whistle.wav',
  cheer: '/sounds/cheer.ogg',
  applause: '/sounds/applause.wav',
} as const
type SampleName = keyof typeof SAMPLE_URLS
const samples = new Map<SampleName, AudioBuffer>()

function loadSamples(ac: AudioContext) {
  for (const [name, url] of Object.entries(SAMPLE_URLS) as [SampleName, string][]) {
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ac.decodeAudioData(data))
      .then((buf) => samples.set(name, buf))
      .catch(() => {
        // Browser can't decode this format: the synthesized version keeps playing instead.
      })
  }
}

/** Plays a recorded clip (or a slice of it). Returns false when it isn't available yet. */
function sample(name: SampleName, opts: { vol: number; at?: number; offset?: number; dur?: number; rate?: number }) {
  const ac = audio()
  const buf = samples.get(name)
  if (!ac || !master || !buf) return false
  const start = ac.currentTime + (opts.at ?? 0)
  const offset = opts.offset ?? 0
  const dur = Math.min(opts.dur ?? buf.duration - offset, buf.duration - offset)
  const src = ac.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = opts.rate ?? jitter(1, 0.03)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(opts.vol, start + 0.02)
  g.gain.setValueAtTime(opts.vol, start + Math.max(0.03, dur - 0.12))
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  src.connect(g).connect(master)
  src.start(start, offset, dur + 0.05)
  return true
}

// Browsers only allow audio after a user gesture; unlock on the first interaction so later event sounds play.
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

type Tone = { f: number; to?: number; at?: number; dur: number; type?: OscillatorType; vol?: number }

function tones(list: Tone[]) {
  const ac = audio()
  if (!ac || !master) return
  const now = ac.currentTime
  for (const t of list) {
    const start = now + (t.at ?? 0)
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = t.type ?? 'sine'
    osc.frequency.setValueAtTime(t.f, start)
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.dur)
    const v = t.vol ?? 0.3
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(v, start + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur)
    osc.connect(g).connect(master)
    osc.start(start)
    osc.stop(start + t.dur + 0.02)
  }
}

/** Short filtered noise burst — the base of clacks, shuffles and dice rattles. */
function noise(opts: { at?: number; dur: number; freq: number; q?: number; vol?: number; type?: BiquadFilterType }) {
  const ac = audio()
  if (!ac || !master) return
  const start = ac.currentTime + (opts.at ?? 0)
  const len = Math.max(1, Math.floor(ac.sampleRate * opts.dur))
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2
  const src = ac.createBufferSource()
  src.buffer = buf
  const filter = ac.createBiquadFilter()
  filter.type = opts.type ?? 'bandpass'
  filter.frequency.value = opts.freq
  filter.Q.value = opts.q ?? 1
  const g = ac.createGain()
  g.gain.value = opts.vol ?? 0.5
  src.connect(filter).connect(g).connect(master)
  src.start(start)
}

const jitter = (v: number, amt = 0.06) => v * (1 + (Math.random() * 2 - 1) * amt)

/**
 * Modal impact: a tiny noise click excites a few damped resonances, which is how a real
 * object (wood, ivory, plastic) rings when struck. Partials decay faster the higher they are.
 */
function knock(opts: { at?: number; modes: number[]; decay: number; vol: number; click?: number; body?: number }) {
  const ac = audio()
  if (!ac || !room) return
  const start = ac.currentTime + (opts.at ?? 0)
  const vol = jitter(opts.vol, 0.15)

  opts.modes.forEach((f, i) => {
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.frequency.value = jitter(f, 0.04)
    const d = opts.decay / (1 + i * 0.6)
    const v = vol / (1 + i * 0.8)
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(v, start + 0.0015)
    g.gain.exponentialRampToValueAtTime(0.0001, start + d)
    osc.connect(g).connect(room!)
    osc.start(start)
    osc.stop(start + d + 0.02)
  })

  const len = Math.floor(ac.sampleRate * 0.006)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
  const src = ac.createBufferSource()
  src.buffer = buf
  const hp = ac.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = opts.click ?? 2500
  const cg = ac.createGain()
  cg.gain.value = vol * 1.6
  src.connect(hp).connect(cg).connect(room)
  src.start(start)

  if (opts.body) {
    const th = ac.createOscillator()
    const tg = ac.createGain()
    th.frequency.setValueAtTime(opts.body, start)
    th.frequency.exponentialRampToValueAtTime(opts.body * 0.6, start + 0.08)
    tg.gain.setValueAtTime(0.0001, start)
    tg.gain.exponentialRampToValueAtTime(vol * 0.9, start + 0.003)
    tg.gain.exponentialRampToValueAtTime(0.0001, start + 0.09)
    th.connect(tg).connect(room)
    th.start(start)
    th.stop(start + 0.12)
  }
}

/** Short sliding friction, e.g. a checker dragged across the felt before it lands. */
function slide(at: number, dur: number, vol: number) {
  const ac = audio()
  if (!ac || !room) return
  const start = ac.currentTime + at
  const len = Math.floor(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len)
  const src = ac.createBufferSource()
  src.buffer = buf
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1400
  bp.Q.value = 0.7
  const g = ac.createGain()
  g.gain.value = vol
  src.connect(bp).connect(g).connect(room)
  src.start(start)
}

/** Pea whistle: a high tone warbled by the pea rattling inside, plus breath noise. */
function whistle(at: number, dur: number, vol: number) {
  const ac = audio()
  if (!ac || !room) return
  const start = ac.currentTime + at
  const osc = ac.createOscillator()
  osc.frequency.value = jitter(2950, 0.02)
  const lfo = ac.createOscillator()
  lfo.type = 'square'
  lfo.frequency.value = 28
  const depth = ac.createGain()
  depth.gain.value = 140
  lfo.connect(depth).connect(osc.frequency)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(vol, start + 0.03)
  g.gain.setValueAtTime(vol, start + dur - 0.06)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(g).connect(room)
  for (const node of [osc, lfo]) {
    node.start(start)
    node.stop(start + dur + 0.02)
  }
  noise({ at, dur, freq: 3400, q: 0.8, vol: vol * 0.25, type: 'highpass' })
}

/** Crowd roar: two broad noise bands swell up and fade, sprinkled with claps. */
function crowd(at: number, dur: number, vol: number) {
  const ac = audio()
  if (!ac || !room) return
  const start = ac.currentTime + at
  const len = Math.floor(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  for (const [freq, q, share] of [[750, 0.7, 1], [2100, 1.2, 0.45]] as const) {
    const src = ac.createBufferSource()
    src.buffer = buf
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(freq * 0.8, start)
    bp.frequency.linearRampToValueAtTime(freq, start + 0.4)
    bp.Q.value = q
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(vol * share, start + 0.35)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    src.connect(bp).connect(g).connect(room)
    src.start(start)
  }
  for (let i = 0; i < 26; i++) {
    noise({ at: at + 0.2 + Math.random() * dur * 0.7, dur: 0.02, freq: 1400 + Math.random() * 1400, q: 1.4, vol: vol * 0.5 * Math.random() })
  }
}

const WOOD = [190, 470, 910, 1520]
const IVORY = [1850, 3050, 4400]
const DIE = [2600, 4100, 5900]
const STEEL = [620, 1710, 3120, 4400]
const lim = (v: number) => Math.max(0.15, Math.min(1, v))

const SOUNDS: Record<SoundName, (v: number) => void> = {
  // Boot through leather: a dull low thump with a short slap on top.
  kick: (v) => {
    knock({ modes: [92, 210, 470], decay: 0.1, vol: 0.55 * lim(v), click: 1600, body: 105 })
    noise({ dur: 0.035, freq: 950, q: 1, vol: 0.35 * lim(v) })
  },
  header: (v) => knock({ modes: [140, 330], decay: 0.07, vol: 0.4 * lim(v), click: 1200, body: 120 }),
  // Ball dropping on grass is soft and short.
  bounce: (v) => {
    knock({ modes: [118, 260], decay: 0.05, vol: 0.3 * lim(v), click: 900, body: 88 })
    noise({ dur: 0.03, freq: 500, q: 0.8, vol: 0.12 * lim(v), type: 'lowpass' })
  },
  // Basketball on hardwood: hollow rubber "pung" that rings a little.
  dribble: (v) => knock({ modes: [205, 415, 990], decay: 0.14, vol: 0.42 * lim(v), click: 2200, body: 150 }),
  post: (v) => knock({ modes: STEEL, decay: 0.7, vol: 0.26 * lim(v), click: 5200 }),
  rim: (v) => {
    knock({ modes: [440, 1180, 2350, 3600], decay: 0.5, vol: 0.24 * lim(v), click: 4200 })
    knock({ at: 0.05, modes: [470, 1250], decay: 0.2, vol: 0.08 * lim(v) })
  },
  board: (v) => knock({ modes: WOOD.map((f) => f * 0.75), decay: 0.12, vol: 0.32 * lim(v), click: 2000, body: 100 }),
  // Ball bulging the goal net: a muffled thud followed by the mesh rustle.
  net: () => {
    knock({ modes: [90, 180], decay: 0.08, vol: 0.3, body: 80 })
    slide(0.02, 0.38, 0.16)
    noise({ at: 0.04, dur: 0.3, freq: 700, q: 0.6, vol: 0.12, type: 'lowpass' })
  },
  swish: () => {
    noise({ dur: 0.22, freq: 2600, q: 0.5, vol: 0.22, type: 'highpass' })
    slide(0.05, 0.25, 0.08)
  },
  whistle: (v) => {
    if (!sample('whistle', { vol: 0.5 * lim(v), offset: 0.06, dur: 0.38 })) whistle(0, 0.32, 0.16 * lim(v))
  },
  whistleEnd: () => {
    const real =
      sample('whistle', { vol: 0.5, offset: 0.06, dur: 0.3 }) &&
      sample('whistle', { vol: 0.5, at: 0.42, offset: 0.06, dur: 0.3 }) &&
      sample('whistle', { vol: 0.55, at: 0.84, offset: 0.06, dur: 0.6, rate: 1 })
    if (real) return
    whistle(0, 0.28, 0.16)
    whistle(0.42, 0.28, 0.16)
    whistle(0.84, 0.9, 0.16)
  },
  cheer: (v) => {
    const vol = lim(v)
    const a = sample('applause', { vol: 0.55 * vol, offset: 1.4, dur: 3.6 })
    const b = sample('cheer', { vol: 0.6 * vol, at: 0.05 })
    if (!a && !b) crowd(0, 2.4, 0.3 * vol)
  },

  chip: () => {
    noise({ dur: 0.035, freq: 3200, q: 5, vol: 0.5 })
    noise({ at: 0.04, dur: 0.03, freq: 2800, q: 5, vol: 0.3 })
  },
  // The ball rattles around the wheel and slows down over a few seconds.
  spin: () => {
    let t = 0
    for (let i = 0; i < 34; i++) {
      t += 0.05 + (i / 34) ** 2 * 0.22
      noise({ at: t, dur: 0.03, freq: 2600 + Math.random() * 900, q: 6, vol: 0.32 })
    }
  },
  ball: () => {
    noise({ dur: 0.05, freq: 1900, q: 3, vol: 0.6 })
    noise({ at: 0.12, dur: 0.04, freq: 1700, q: 3, vol: 0.35 })
    noise({ at: 0.2, dur: 0.03, freq: 1600, q: 3, vol: 0.2 })
  },
  goal: () =>
    tones([
      { f: 784, dur: 0.12, type: 'square', vol: 0.08 },
      { f: 988, at: 0.1, dur: 0.12, type: 'square', vol: 0.08 },
      { f: 1175, at: 0.2, dur: 0.35, type: 'square', vol: 0.08 },
    ]),
  // Checker slides a little, then lands on the wooden board ("tak").
  move: () => {
    slide(0, 0.06, 0.05)
    knock({ at: 0.05, modes: WOOD, decay: 0.11, vol: 0.32, click: 3000, body: 140 })
  },
  // Two checkers clack together, then the hit one lands on the bar.
  hit: () => {
    slide(0, 0.05, 0.05)
    knock({ at: 0.045, modes: IVORY, decay: 0.07, vol: 0.3, click: 4200 })
    knock({ at: 0.05, modes: WOOD, decay: 0.1, vol: 0.26, body: 150 })
    knock({ at: 0.2, modes: WOOD.map((f) => f * 1.15), decay: 0.09, vol: 0.18, body: 120 })
  },
  // Dropped into the tray: a hollow thunk followed by a small clack on the pile.
  bearoff: () => {
    knock({ modes: [150, 380, 760], decay: 0.16, vol: 0.3, click: 1800, body: 110 })
    knock({ at: 0.07, modes: IVORY, decay: 0.05, vol: 0.12, click: 4500 })
  },
  turn: () => tones([{ f: 660, dur: 0.14, type: 'triangle' }, { f: 990, at: 0.12, dur: 0.22, type: 'triangle' }]),
  join: () => tones([{ f: 523, dur: 0.12 }, { f: 659, at: 0.09, dur: 0.12 }, { f: 784, at: 0.18, dur: 0.2 }]),
  leave: () => tones([{ f: 659, dur: 0.14 }, { f: 440, at: 0.12, dur: 0.24 }]),
  start: () =>
    tones([
      { f: 392, dur: 0.12, type: 'triangle' },
      { f: 523, at: 0.11, dur: 0.12, type: 'triangle' },
      { f: 659, at: 0.22, dur: 0.12, type: 'triangle' },
      { f: 784, at: 0.33, dur: 0.35, type: 'triangle', vol: 0.35 },
    ]),
  win: () =>
    tones([
      { f: 523, dur: 0.15, type: 'triangle' },
      { f: 659, at: 0.14, dur: 0.15, type: 'triangle' },
      { f: 784, at: 0.28, dur: 0.15, type: 'triangle' },
      { f: 1047, at: 0.42, dur: 0.5, type: 'triangle', vol: 0.35 },
      { f: 1319, at: 0.42, dur: 0.5, type: 'sine', vol: 0.15 },
    ]),
  lose: () =>
    tones([
      { f: 392, dur: 0.22, type: 'triangle' },
      { f: 349, at: 0.2, dur: 0.22, type: 'triangle' },
      { f: 262, at: 0.4, dur: 0.5, type: 'triangle' },
    ]),
  message: () => tones([{ f: 880, dur: 0.08, vol: 0.2 }, { f: 1320, at: 0.07, dur: 0.12, vol: 0.18 }]),
  sent: () => tones([{ f: 600, to: 1100, dur: 0.12, vol: 0.15 }]),
  // Two dice thrown onto wood: each bounces with shrinking gaps and force, then they clink and settle.
  dice: () => {
    for (let d = 0; d < 2; d++) {
      let t = d * 0.035 + Math.random() * 0.02
      let gap = 0.11 + Math.random() * 0.03
      let v = 0.34
      for (let b = 0; b < 6; b++) {
        knock({ at: t, modes: DIE, decay: 0.045, vol: v * 0.7, click: 3800 })
        knock({ at: t, modes: WOOD.map((f) => f * 1.3), decay: 0.06, vol: v * 0.55, body: b < 2 ? 170 : undefined })
        t += gap
        gap *= 0.68
        v *= 0.62
      }
    }
    knock({ at: 0.24, modes: DIE.map((f) => f * 1.1), decay: 0.04, vol: 0.1, click: 5000 })
  },
  card: () => noise({ dur: 0.06, freq: 1300, q: 0.9, vol: 0.14 }),
  tile: () => {
    noise({ dur: 0.05, freq: 1800, q: 6, vol: 0.7 })
    tones([{ f: 1400, dur: 0.05, type: 'square', vol: 0.05 }])
  },
  cue: () => {
    noise({ dur: 0.04, freq: 2500, q: 8, vol: 0.8 })
    tones([{ f: 1800, to: 900, dur: 0.06, vol: 0.12 }])
  },
  pocket: () => tones([{ f: 180, to: 80, dur: 0.25, vol: 0.4 }]),
  coin: () => tones([{ f: 1568, dur: 0.08, type: 'square', vol: 0.06 }, { f: 2093, at: 0.07, dur: 0.2, type: 'square', vol: 0.06 }]),
  tick: () => tones([{ f: 1000, dur: 0.04, type: 'square', vol: 0.05 }]),
  error: () => tones([{ f: 220, dur: 0.15, type: 'sawtooth', vol: 0.12 }, { f: 180, at: 0.12, dur: 0.2, type: 'sawtooth', vol: 0.12 }]),
}

const lastPlayed = new Map<SoundName, number>()

/** `intensity` (0-1) scales physical sounds like kicks and bounces by how hard the hit was. */
export function playSound(name: SoundName, intensity = 1) {
  if (muted || typeof window === 'undefined') return
  // Collapse bursts (e.g. several state updates arriving in one poll) into one sound.
  const now = performance.now()
  if (now - (lastPlayed.get(name) ?? 0) < 120) return
  lastPlayed.set(name, now)
  try {
    SOUNDS[name](intensity)
  } catch {
    // Audio is a nicety; never let it break gameplay.
  }
}

/** Looping stadium murmur under a match. Follows the mute switch; call the returned function to stop it. */
export function startCrowdAmbience(level = 0.05) {
  const ac = audio()
  if (!ac || !room) return () => {}
  const len = ac.sampleRate * 3
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buf
  src.loop = true
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 620
  bp.Q.value = 0.6
  const g = ac.createGain()
  g.gain.value = 0.0001
  const swell = ac.createOscillator()
  swell.frequency.value = 0.13
  const swellDepth = ac.createGain()
  swellDepth.gain.value = level * 0.35
  swell.connect(swellDepth).connect(g.gain)
  src.connect(bp).connect(g).connect(room)

  // A real recorded crowd, slowed and muffled into a distant stand murmur, laid under the synth bed.
  let bed: AudioBufferSourceNode | null = null
  let bedGain: GainNode | null = null
  const startBed = () => {
    const rec = samples.get('applause')
    if (bed || !rec || !master) return
    bed = ac.createBufferSource()
    bed.buffer = rec
    bed.loop = true
    bed.loopStart = 1.5
    bed.loopEnd = Math.min(rec.duration - 0.5, 5.5)
    bed.playbackRate.value = 0.72
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    bedGain = ac.createGain()
    bedGain.gain.value = 0.0001
    bed.connect(lp).connect(bedGain).connect(master)
    bed.start(ac.currentTime, 1.5)
    bedGain.gain.setTargetAtTime(muted ? 0.0001 : level * 2.2, ac.currentTime, 0.8)
  }
  const bedTry = setInterval(() => {
    startBed()
    if (bed) clearInterval(bedTry)
  }, 500)

  const apply = () => {
    g.gain.setTargetAtTime(muted ? 0.0001 : level, ac.currentTime, 0.4)
    bedGain?.gain.setTargetAtTime(muted ? 0.0001 : level * 2.2, ac.currentTime, 0.4)
  }
  apply()
  listeners.add(apply)
  src.start()
  swell.start()
  startBed()
  return () => {
    clearInterval(bedTry)
    listeners.delete(apply)
    g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3)
    bedGain?.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3)
    src.stop(ac.currentTime + 1.2)
    swell.stop(ac.currentTime + 1.2)
    bed?.stop(ac.currentTime + 1.2)
  }
}

export function isSoundMuted() {
  return muted
}

/** Lets other sound kits (e.g. the arena games) follow the site-wide mute switch. */
export function onSoundMuteChange(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setSoundMuted(value: boolean) {
  muted = value
  window.localStorage?.setItem(MUTE_KEY, value ? '1' : '0')
  listeners.forEach((l) => l())
  if (!value) playSound('tick')
}

export function useSoundMuted() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => muted,
    () => false,
  )
}
