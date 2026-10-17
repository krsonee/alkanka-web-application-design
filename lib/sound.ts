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

const MUTE_KEY = 'alkanka:sound-muted'
const listeners = new Set<() => void>()
let ctx: AudioContext | null = null
let master: GainNode | null = null
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
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
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

const SOUNDS: Record<SoundName, () => void> = {
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
  move: () => {
    noise({ dur: 0.05, freq: 900, q: 2, vol: 0.55 })
    tones([{ f: 320, dur: 0.06, type: 'triangle', vol: 0.12 }])
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
  dice: () => {
    for (let i = 0; i < 6; i++) noise({ at: i * 0.05 + Math.random() * 0.02, dur: 0.04, freq: 2200 + Math.random() * 1500, q: 4, vol: 0.6 })
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

export function playSound(name: SoundName) {
  if (muted || typeof window === 'undefined') return
  // Collapse bursts (e.g. several state updates arriving in one poll) into one sound.
  const now = performance.now()
  if (now - (lastPlayed.get(name) ?? 0) < 120) return
  lastPlayed.set(name, now)
  try {
    SOUNDS[name]()
  } catch {
    // Audio is a nicety; never let it break gameplay.
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
