'use client'

type Wave = OscillatorType

let ctx: AudioContext | null = null
let muted = false
let lastHit = 0

function tone(type: Wave, f0: number, f1: number, dur: number, vol: number, delay = 0) {
  if (!ctx || muted) return
  const t = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + dur + 0.03)
}

/** Tiny synthesized sound kit: no audio files to download, so it never delays the round. */
export const kdSound = {
  /** Must run inside a user gesture (the start button) or browsers keep the context suspended. */
  unlock() {
    if (typeof window === 'undefined') return
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctor) ctx = new Ctor()
    }
    void ctx?.resume()
  },
  setMuted(value: boolean) {
    muted = value
  },
  hit(strength: number) {
    const now = performance.now()
    if (now - lastHit < 70) return
    lastHit = now
    tone('triangle', 480 + Math.min(1, strength) * 320, 300, 0.06, 0.035)
  },
  out() {
    tone('sine', 460, 55, 0.5, 0.14)
    tone('triangle', 920, 120, 0.35, 0.03)
  },
  beat() {
    tone('sine', 72, 50, 0.11, 0.28)
    tone('sine', 66, 46, 0.11, 0.2, 0.17)
  },
  warn() {
    tone('square', 880, 880, 0.07, 0.025)
  },
  final() {
    tone('sawtooth', 98, 196, 0.7, 0.06)
    tone('sine', 196, 392, 0.7, 0.08)
  },
  win() {
    ;[523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.32, 0.09, i * 0.12))
  },
}
