'use client'

import { isSoundMuted, onSoundMuteChange } from '@/lib/sound'

/**
 * Arena sound kit shared by Kara Delik and Survival Arena.
 * Everything is synthesized (no downloads) but voiced like real instruments: filtered noise, sine
 * bodies and a room reverb — no square/pulse waves, so nothing sounds like an 8-bit arcade.
 */

let ctx: AudioContext | null = null
let out: GainNode | null = null
let sfx: GainNode | null = null
let verb: GainNode | null = null
let musicBus: GainNode | null = null
let localMuted = false
let lastHit = 0
let noiseBuf: AudioBuffer | null = null

const muted = () => localMuted || isSoundMuted()

function applyMute() {
  if (!ctx || !out) return
  out.gain.setTargetAtTime(muted() ? 0.0001 : 0.8, ctx.currentTime, 0.08)
}

function ensure() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()

    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.ratio.value = 3.5
    comp.attack.value = 0.004
    comp.release.value = 0.2
    comp.connect(ctx.destination)

    out = ctx.createGain()
    out.gain.value = muted() ? 0.0001 : 0.8
    out.connect(comp)

    sfx = ctx.createGain()
    sfx.gain.value = 1
    sfx.connect(out)

    musicBus = ctx.createGain()
    musicBus.gain.value = 0.42
    musicBus.connect(out)

    const irLen = Math.floor(ctx.sampleRate * 2.2)
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp((-i / irLen) * 5.5)
    }
    const conv = ctx.createConvolver()
    conv.buffer = ir
    verb = ctx.createGain()
    verb.gain.value = 0.28
    verb.connect(conv).connect(out)

    const len = ctx.sampleRate * 2
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1

    onSoundMuteChange(applyMute)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// Browsers only start audio after a gesture; any tap on the page unlocks the arena sounds.
if (typeof window !== 'undefined') {
  const unlock = () => {
    ensure()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

const jit = (v: number, amt = 0.05) => v * (1 + (Math.random() * 2 - 1) * amt)

function env(g: GainNode, t: number, vol: number, attack: number, dur: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
}

function sine(dest: AudioNode, t: number, f0: number, f1: number, dur: number, vol: number, attack = 0.004, type: OscillatorType = 'sine') {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  env(g, t, vol, attack, dur)
  o.connect(g).connect(dest)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function hiss(
  dest: AudioNode,
  t: number,
  dur: number,
  vol: number,
  filter: BiquadFilterType,
  f0: number,
  f1 = f0,
  q = 0.8,
  attack = 0.003,
) {
  if (!ctx || !noiseBuf) return
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  const bq = ctx.createBiquadFilter()
  bq.type = filter
  bq.Q.value = q
  bq.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) bq.frequency.exponentialRampToValueAtTime(f1, t + dur)
  const g = ctx.createGain()
  env(g, t, vol, attack, dur)
  src.connect(bq).connect(g).connect(dest)
  src.start(t, Math.random() * 1.5)
  src.stop(t + dur + 0.05)
}

/* ------------------------------------------------------------------ music */

export type TrackId = 'karadelik' | 'survival' | 'cember'

type Bar = { root: number; pad: number[]; arp: number[] }
type Track = {
  bpm: number
  padWave: OscillatorType
  padVol: number
  /** Pad lowpass cutoff per intensity level: calm, in play, final. */
  padCut: [number, number, number]
  bars: Bar[]
  play: (t: number, s: number, step: number, bar: Bar) => void
}

let musicOn = false
let intensity = 0
let step = 0
let nextAt = 0
let stepLen = 60 / 108 / 4
let track: Track | null = null
let timer: ReturnType<typeof setInterval> | null = null
let duck: GainNode | null = null
let padFilter: BiquadFilterNode | null = null

/* Instruments. Every voice is sine/triangle/filtered-noise based so nothing reads as chiptune. */

function kick(t: number, vol = 0.5, f0 = 150, f1 = 42, dur = 0.32) {
  if (!ctx || !musicBus || !duck) return
  sine(musicBus, t, f0, f1, dur, vol, 0.002)
  hiss(musicBus, t, 0.02, vol * 0.16, 'lowpass', 1800)
  // Pumps the pad and bass down under every kick, which is what gives modern tracks their drive.
  duck.gain.cancelScheduledValues(t)
  duck.gain.setValueAtTime(0.35, t)
  duck.gain.linearRampToValueAtTime(1, t + stepLen * 3)
}

function bass(t: number, f: number, steps = 1.8, vol = 0.22, wave: OscillatorType = 'sawtooth', cut = 260) {
  if (!ctx || !duck) return
  const len = stepLen * steps
  const o = ctx.createOscillator()
  o.type = wave
  o.frequency.value = f
  const sub = ctx.createOscillator()
  sub.frequency.value = f
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(cut + intensity * 160, t)
  lp.frequency.exponentialRampToValueAtTime(110, t + len * 0.9)
  lp.Q.value = 3
  const g = ctx.createGain()
  env(g, t, vol, 0.006, len)
  const sg = ctx.createGain()
  env(sg, t, vol * 1.25, 0.006, len)
  o.connect(lp).connect(g).connect(duck)
  sub.connect(sg).connect(duck)
  for (const n of [o, sub]) {
    n.start(t)
    n.stop(t + len + 0.05)
  }
}

function pad(t: number, notes: number[]) {
  if (!ctx || !padFilter || !track) return
  const len = stepLen * 16
  const vol = track.padVol
  for (const f of notes) {
    for (const det of [-7, 6]) {
      const o = ctx.createOscillator()
      o.type = track.padWave
      o.frequency.value = f
      o.detune.value = det
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(vol, t + 0.5)
      g.gain.setValueAtTime(vol, t + len - 0.3)
      g.gain.linearRampToValueAtTime(0.0001, t + len + 0.4)
      o.connect(g).connect(padFilter)
      o.start(t)
      o.stop(t + len + 0.5)
    }
  }
}

function hat(t: number, vol: number, len = 0.04) {
  if (musicBus) hiss(musicBus, t, len, vol, 'highpass', 8500)
}

function clap(t: number, vol: number) {
  if (!musicBus || !verb) return
  for (let k = 0; k < 3; k++) hiss(musicBus, t + k * 0.011, 0.05 + k * 0.03, vol, 'bandpass', 1500, 1500, 1.1)
  hiss(verb, t, 0.2, vol * 0.5, 'bandpass', 2000, 2000, 0.8)
}

/** Big cinematic snare that blooms into the reverb. */
function boomSnare(t: number, vol: number) {
  if (!musicBus || !verb) return
  hiss(musicBus, t, 0.22, vol, 'bandpass', 1800, 900, 0.7)
  sine(musicBus, t, 200, 150, 0.12, vol * 0.8, 0.002)
  hiss(verb, t, 0.9, vol * 0.7, 'lowpass', 4000, 600, 0.7, 0.01)
}

/** Glassy bell: a sine plus an inharmonic partial, mostly sent to the reverb. */
function bell(t: number, f: number, vol: number) {
  if (!musicBus || !verb) return
  sine(musicBus, t, f, f, 1.1, vol, 0.004)
  sine(musicBus, t, f * 2.76, f * 2.76, 0.4, vol * 0.25, 0.002)
  sine(verb, t, f, f, 1.6, vol * 0.8, 0.004)
}

/** Wooden marimba bar. */
function marimba(t: number, f: number, vol: number) {
  if (!musicBus || !verb) return
  sine(musicBus, t, f, f, 0.32, vol, 0.002)
  sine(musicBus, t, f * 4, f * 4, 0.06, vol * 0.3, 0.001)
  sine(verb, t, f, f, 0.4, vol * 0.25, 0.002)
}

function pluck(t: number, f: number, vol: number) {
  if (!musicBus || !verb) return
  sine(musicBus, t, f, f, 0.22, vol, 0.002, 'triangle')
  sine(verb, t, f * 2, f * 2, 0.3, vol * 0.3, 0.002)
}

function conga(t: number, f: number, vol: number) {
  if (!musicBus) return
  sine(musicBus, t, f * 1.15, f, 0.16, vol, 0.002)
  hiss(musicBus, t, 0.015, vol * 0.3, 'bandpass', 2500, 2500, 1)
}

function shaker(t: number, vol: number) {
  if (musicBus) hiss(musicBus, t, 0.045, vol, 'bandpass', 6500, 7500, 2.5, 0.012)
}

/* Tracks. Each game has its own key, tempo and groove so the three never blur together. */

const TRACKS: Record<TrackId, Track> = {
  // "Olay Ufku": slow, heavy half-time in D minor with glassy bells drifting over a sub drone.
  karadelik: {
    bpm: 88,
    padWave: 'sawtooth',
    padVol: 0.018,
    padCut: [480, 900, 1700],
    bars: [
      { root: 73.42, pad: [146.83, 174.61, 220, 293.66], arp: [293.66, 349.23, 440, 587.33] },
      { root: 58.27, pad: [146.83, 174.61, 233.08, 293.66], arp: [293.66, 349.23, 466.16, 587.33] },
      { root: 49, pad: [146.83, 196, 233.08, 293.66], arp: [293.66, 392, 466.16, 587.33] },
      { root: 55, pad: [138.59, 164.81, 220, 329.63], arp: [277.18, 329.63, 440, 554.37] },
    ],
    play(t, s, step, bar) {
      if (s === 0) bass(t, bar.root / 2, 15, 0.16, 'sine', 140)
      if (s === 0 || s === 10) kick(t, 0.55, 120, 34, 0.45)
      if (intensity >= 2 && s === 6) kick(t, 0.4, 120, 34, 0.35)
      if (intensity >= 1 && s === 8) boomSnare(t, 0.14)
      if (intensity >= 1 && s % 4 === 2) hat(t, 0.02, 0.03)
      if (intensity >= 2 && s % 2 === 1) hat(t, 0.015, 0.02)
      const arpEvery = intensity >= 2 ? 1 : 2
      if (intensity >= 1 && s % arpEvery === 0) bell(t, bar.arp[(step / arpEvery) % 4 | 0], intensity >= 2 ? 0.035 : 0.045)
      if (intensity === 0 && s === 0) bell(t, bar.arp[0], 0.04)
      // Reverse-air riser into every fourth bar.
      if (step % 64 === 56 && musicBus) hiss(musicBus, t, stepLen * 8, 0.05, 'lowpass', 200, 4000, 1, stepLen * 7.5)
    },
  },
  // "Arena": driving 124 BPM four-on-the-floor in E minor with a rolling offbeat bass.
  survival: {
    bpm: 124,
    padWave: 'sawtooth',
    padVol: 0.02,
    padCut: [650, 1400, 2800],
    bars: [
      { root: 82.41, pad: [164.81, 196, 246.94, 329.63], arp: [329.63, 392, 493.88] },
      { root: 65.41, pad: [164.81, 196, 261.63, 329.63], arp: [329.63, 392, 523.25] },
      { root: 98, pad: [196, 246.94, 293.66, 392], arp: [392, 493.88, 587.33] },
      { root: 73.42, pad: [185, 220, 293.66, 369.99], arp: [369.99, 440, 587.33] },
    ],
    play(t, s, step, bar) {
      if (intensity >= 1 ? s % 4 === 0 : s === 0 || s === 8) kick(t)
      if (s % 4 === 2) bass(t, bar.root)
      if (intensity >= 1 && s % 4 === 3) bass(t, bar.root, 0.9, 0.16)
      if (intensity >= 1 && s % 4 === 2) hat(t, 0.05, 0.09)
      if (intensity >= 2 && s % 2 === 1) hat(t, 0.025)
      if (intensity >= 1 && (s === 4 || s === 12)) clap(t, intensity >= 2 ? 0.15 : 0.1)
      if (intensity >= 1 && (s === 3 || s === 10)) for (const f of bar.arp) pluck(t, f, 0.03)
      if (intensity >= 1 && step % 64 >= 61) sine(musicBus!, t, 130 - (step % 64 - 61) * 20, 60, 0.18, 0.18)
    },
  },
  // "Saha": sunny 100 BPM dembow groove in G with congas, shaker and a marimba hook.
  cember: {
    bpm: 100,
    padWave: 'triangle',
    padVol: 0.03,
    padCut: [900, 1800, 3200],
    bars: [
      { root: 98, pad: [196, 246.94, 293.66, 392], arp: [392, 493.88, 587.33] },
      { root: 82.41, pad: [164.81, 196, 246.94, 329.63], arp: [329.63, 392, 493.88] },
      { root: 65.41, pad: [196, 261.63, 329.63, 392], arp: [392, 523.25, 659.25] },
      { root: 73.42, pad: [185, 220, 293.66, 369.99], arp: [369.99, 440, 587.33] },
    ],
    play(t, s, step, bar) {
      shaker(t, s % 2 === 0 ? 0.05 : 0.025)
      if (intensity >= 1 ? s % 4 === 0 : s === 0 || s === 8) kick(t, 0.48, 140, 45, 0.28)
      if (intensity >= 1 && (s === 3 || s === 6 || s === 11 || s === 14)) clap(t, 0.08)
      if (s === 0 || s === 6 || s === 10) bass(t, bar.root, 2.5, 0.2, 'triangle', 400)
      if (s === 5 || s === 13) conga(t, 330, 0.12)
      if (s === 2 || s === 10) conga(t, 220, 0.14)
      if (intensity >= 1) {
        const riff = [0, -1, 1, -1, 2, -1, 1, 0, -1, 2, -1, 1, 0, -1, 1, -1]
        const n = riff[s]
        if (n >= 0) marimba(t, bar.arp[n], 0.07)
      }
      // Stadium-style double clap on the downbeat once the final starts.
      if (intensity >= 2 && s === 0) {
        clap(t, 0.16)
        clap(t + stepLen * 2, 0.16)
      }
      if (intensity >= 2 && s % 2 === 1) hat(t, 0.02)
    },
  },
}

function schedule() {
  if (!ctx || !musicBus || !verb || !track) return
  while (nextAt < ctx.currentTime + 0.15) {
    const t = nextAt
    const s = step % 16
    const bar = track.bars[Math.floor(step / 16) % track.bars.length]

    if (s === 0) pad(t, bar.pad)
    if (padFilter) padFilter.frequency.setTargetAtTime(track.padCut[intensity], t, 1.2)
    track.play(t, s, step, bar)

    nextAt += stepLen
    step++
  }
}

const music = {
  start(id: TrackId) {
    const ac = ensure()
    if (!ac || !musicBus || !verb || musicOn) return
    musicOn = true
    track = TRACKS[id]
    stepLen = 60 / track.bpm / 4
    intensity = 0
    step = 0
    nextAt = ac.currentTime + 0.1
    duck = ac.createGain()
    duck.connect(musicBus)
    padFilter = ac.createBiquadFilter()
    padFilter.type = 'lowpass'
    padFilter.frequency.value = track.padCut[0]
    padFilter.Q.value = 0.7
    const padOut = ac.createGain()
    padOut.gain.value = 1
    padFilter.connect(padOut)
    padOut.connect(duck)
    padOut.connect(verb)
    musicBus.gain.cancelScheduledValues(ac.currentTime)
    musicBus.gain.setValueAtTime(0.0001, ac.currentTime)
    musicBus.gain.linearRampToValueAtTime(0.42, ac.currentTime + 2)
    timer = setInterval(schedule, 25)
    schedule()
  },
  /** 0 = calm intro, 1 = round in full swing, 2 = Final Savaşı. */
  setIntensity(level: number) {
    intensity = Math.max(0, Math.min(2, level))
  },
  stop(fade = 1.5) {
    if (!musicOn) return
    musicOn = false
    if (timer) clearInterval(timer)
    timer = null
    if (ctx && musicBus) {
      const now = ctx.currentTime
      musicBus.gain.cancelScheduledValues(now)
      musicBus.gain.setValueAtTime(musicBus.gain.value, now)
      musicBus.gain.linearRampToValueAtTime(0.0001, now + fade)
      const oldDuck = duck
      setTimeout(() => oldDuck?.disconnect(), (fade + 1) * 1000)
    }
    duck = null
    padFilter = null
  },
}

/* -------------------------------------------------------------- effects */

export const kdSound = {
  unlock() {
    ensure()
  },
  setMuted(value: boolean) {
    localMuted = value
    applyMute()
  },
  music,
  /** Two players bumping: a soft, dull "tok" instead of a beep. */
  hit(strength: number) {
    const ac = ensure()
    if (!ac || !sfx) return
    const now = performance.now()
    if (now - lastHit < 140) return
    lastHit = now
    const s = Math.max(0.2, Math.min(1, strength))
    const t = ac.currentTime
    sine(sfx, t, jit(210, 0.12), 120, 0.07, 0.07 * s, 0.002)
    hiss(sfx, t, 0.025, 0.05 * s, 'bandpass', jit(1100, 0.2), 900, 1.2)
  },
  /** Eliminated: an airy downward swoosh landing on a deep thud. */
  out() {
    const ac = ensure()
    if (!ac || !sfx || !verb) return
    const t = ac.currentTime
    hiss(sfx, t, 0.45, 0.22, 'lowpass', 3200, 260, 1.4, 0.04)
    hiss(verb, t, 0.4, 0.08, 'lowpass', 2600, 300, 1, 0.04)
    sine(sfx, t + 0.12, 95, 38, 0.5, 0.34, 0.004)
    sine(verb, t + 0.12, 95, 40, 0.4, 0.08, 0.004)
  },
  /** Kara Delik bump: a muffled body thump, no click on top. */
  bump(strength: number) {
    const ac = ensure()
    if (!ac || !sfx) return
    const now = performance.now()
    if (now - lastHit < 220) return
    lastHit = now
    const s = Math.max(0.2, Math.min(1, strength))
    const t = ac.currentTime
    sine(sfx, t, jit(130, 0.1), 70, 0.12, 0.06 * s, 0.008)
    hiss(sfx, t, 0.06, 0.025 * s, 'lowpass', 500, 250, 0.7, 0.008)
  },
  /** Swallowed by the black hole: a swirling suction that spirals down into a deep gulp. */
  fallIn() {
    const ac = ensure()
    if (!ac || !sfx || !verb || !noiseBuf) return
    const t = ac.currentTime
    const dur = 1.1

    const src = ac.createBufferSource()
    src.buffer = noiseBuf
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 3
    bp.frequency.setValueAtTime(2400, t)
    bp.frequency.exponentialRampToValueAtTime(120, t + dur)
    const swirl = ac.createGain()
    const lfo = ac.createOscillator()
    lfo.frequency.setValueAtTime(14, t)
    lfo.frequency.exponentialRampToValueAtTime(3, t + dur)
    const depth = ac.createGain()
    depth.gain.value = 0.5
    swirl.gain.value = 0.5
    lfo.connect(depth).connect(swirl.gain)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.15)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(bp).connect(swirl).connect(g)
    g.connect(sfx)
    g.connect(verb)
    src.start(t, Math.random())
    src.stop(t + dur + 0.05)
    lfo.start(t)
    lfo.stop(t + dur + 0.05)

    sine(sfx, t, 520, 45, dur, 0.09, 0.05)
    sine(sfx, t + dur * 0.75, 70, 28, 0.6, 0.32, 0.03)
    sine(verb, t + dur * 0.75, 70, 30, 0.5, 0.08, 0.03)
  },
  /** Black hole charging: a growing gravitational rumble that rises as the count runs down. */
  pull(count: number) {
    const ac = ensure()
    if (!ac || !sfx || !verb) return
    const t = ac.currentTime
    const k = Math.max(0, 4 - Math.min(3, Math.max(1, count)))
    sine(sfx, t, 38 + k * 6, 44 + k * 8, 0.95, 0.18 + k * 0.05, 0.25)
    hiss(sfx, t, 0.95, 0.04 + k * 0.02, 'lowpass', 150, 500 + k * 250, 1.5, 0.4)
    hiss(verb, t, 0.9, 0.03, 'bandpass', 300, 900 + k * 300, 1.2, 0.5)
  },
  /** Jako Çemberi drop: a soft muffled "puf", rate-limited because hundreds can fall at once. */
  drop() {
    const ac = ensure()
    if (!ac || !sfx) return
    const now = performance.now()
    if (now - lastHit < 110) return
    lastHit = now
    const t = ac.currentTime
    sine(sfx, t, jit(320, 0.15), 110, 0.16, 0.07, 0.004)
    hiss(sfx, t, 0.1, 0.04, 'lowpass', 1400, 300, 0.8, 0.004)
  },
  /** Heartbeat for the last ten seconds. */
  beat() {
    const ac = ensure()
    if (!ac || !sfx) return
    const t = ac.currentTime
    sine(sfx, t, 62, 42, 0.16, 0.36, 0.006)
    sine(sfx, t + 0.2, 58, 40, 0.14, 0.24, 0.006)
  },
  /** Black hole countdown: a muted clock tick. */
  warn() {
    const ac = ensure()
    if (!ac || !sfx || !verb) return
    const t = ac.currentTime
    hiss(sfx, t, 0.03, 0.16, 'bandpass', 2400, 2400, 4)
    sine(verb, t, 620, 600, 0.12, 0.03, 0.002)
  },
  /** Final Savaşı: a rising whoosh into a cinematic boom, and the music kicks up. */
  final() {
    const ac = ensure()
    if (!ac || !sfx || !verb) return
    const t = ac.currentTime
    hiss(sfx, t, 1.1, 0.16, 'bandpass', 300, 5000, 1.2, 0.9)
    const hit = t + 1
    sine(sfx, hit, 70, 28, 1.6, 0.55, 0.004)
    hiss(sfx, hit, 0.6, 0.2, 'lowpass', 1400, 120, 0.8)
    hiss(verb, hit, 1.2, 0.12, 'lowpass', 2000, 200, 0.8)
    music.setIntensity(2)
  },
  /** Winner: music fades out under a warm, wide major chord. */
  win() {
    const ac = ensure()
    if (!ac || !sfx || !verb) return
    music.stop(1.2)
    const t = ac.currentTime + 0.05
    sine(sfx, t, 65.41, 65.41, 3.5, 0.3, 0.02)
    for (const [f, d] of [
      [261.63, 0],
      [329.63, 0.06],
      [392, 0.12],
      [523.25, 0.18],
      [587.33, 0.24],
    ] as const) {
      sine(sfx, t + d, f, f, 3, 0.06, 0.12, 'triangle')
      sine(verb, t + d, f * 2, f * 2, 2.6, 0.025, 0.15)
    }
    hiss(verb, t, 1.6, 0.05, 'highpass', 6000, 9000, 0.5, 0.4)
  },
}
