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

const BPM = 108
const STEP = 60 / BPM / 4
// A minor: Am – F – C – G, one bar each. Roots in Hz (octave 2) and pad voicings (octave 3-4).
const BARS = [
  { root: 55, pad: [220, 261.63, 329.63, 493.88] },
  { root: 43.65, pad: [174.61, 220, 261.63, 392] },
  { root: 65.41, pad: [196, 261.63, 329.63, 392] },
  { root: 49, pad: [196, 246.94, 293.66, 440] },
]

let musicOn = false
let intensity = 0
let step = 0
let nextAt = 0
let timer: ReturnType<typeof setInterval> | null = null
let duck: GainNode | null = null
let padFilter: BiquadFilterNode | null = null

function kick(t: number) {
  if (!ctx || !musicBus || !duck) return
  sine(musicBus, t, 150, 42, 0.32, 0.5, 0.002)
  hiss(musicBus, t, 0.02, 0.08, 'lowpass', 1800)
  // Pumps the pad and bass down under every kick, which is what gives modern tracks their drive.
  duck.gain.cancelScheduledValues(t)
  duck.gain.setValueAtTime(0.35, t)
  duck.gain.linearRampToValueAtTime(1, t + STEP * 3)
}

function bass(t: number, f: number) {
  if (!ctx || !duck) return
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = f
  const sub = ctx.createOscillator()
  sub.frequency.value = f
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(260 + intensity * 160, t)
  lp.frequency.exponentialRampToValueAtTime(110, t + STEP * 1.6)
  lp.Q.value = 3
  const g = ctx.createGain()
  env(g, t, 0.22, 0.006, STEP * 1.8)
  const sg = ctx.createGain()
  env(sg, t, 0.28, 0.006, STEP * 1.8)
  o.connect(lp).connect(g).connect(duck)
  sub.connect(sg).connect(duck)
  for (const n of [o, sub]) {
    n.start(t)
    n.stop(t + STEP * 2)
  }
}

function pad(t: number, notes: number[]) {
  if (!ctx || !padFilter) return
  const len = STEP * 16
  for (const f of notes) {
    for (const det of [-7, 6]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = det
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.022, t + 0.5)
      g.gain.setValueAtTime(0.022, t + len - 0.3)
      g.gain.linearRampToValueAtTime(0.0001, t + len + 0.4)
      o.connect(g).connect(padFilter)
      o.start(t)
      o.stop(t + len + 0.5)
    }
  }
}

function schedule() {
  if (!ctx || !musicBus || !verb) return
  while (nextAt < ctx.currentTime + 0.15) {
    const t = nextAt
    const s = step % 16
    const bar = BARS[Math.floor(step / 16) % BARS.length]

    if (s === 0) pad(t, bar.pad)
    if (padFilter) padFilter.frequency.setTargetAtTime(intensity >= 2 ? 2600 : intensity >= 1 ? 1300 : 650, t, 1.2)

    if (intensity >= 1 ? s % 4 === 0 : s === 0 || s === 8) kick(t)
    if (s % 4 === 2) bass(t, bar.root)
    if (intensity >= 1 && (s === 7 || s === 15)) bass(t, bar.root * 2)

    if (intensity >= 1) {
      if (s % 4 === 2) hiss(musicBus, t, 0.05, 0.05, 'highpass', 8000)
      if (intensity >= 2 && s % 2 === 1) hiss(musicBus, t, 0.025, 0.025, 'highpass', 9500)
      if (s === 4 || s === 12) {
        hiss(musicBus, t, 0.14, intensity >= 2 ? 0.16 : 0.1, 'bandpass', 1700, 1700, 0.9)
        hiss(verb, t, 0.18, 0.07, 'bandpass', 2200, 2200, 0.7)
      }
    }
    // Low tom fill into every fourth bar keeps long rounds from feeling like a loop.
    if (intensity >= 1 && step % 64 >= 61) sine(musicBus, t, 120 - (step % 64 - 61) * 18, 60, 0.18, 0.18)

    nextAt += STEP
    step++
  }
}

const music = {
  start() {
    const ac = ensure()
    if (!ac || !musicBus || !verb || musicOn) return
    musicOn = true
    intensity = 0
    step = 0
    nextAt = ac.currentTime + 0.1
    duck = ac.createGain()
    duck.connect(musicBus)
    padFilter = ac.createBiquadFilter()
    padFilter.type = 'lowpass'
    padFilter.frequency.value = 650
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
