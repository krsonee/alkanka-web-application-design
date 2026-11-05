'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Minimize2, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TableBrand } from './table-brand'
import type { DuelLink } from './duel-link'
import { playSound, startCrowdAmbience } from '@/lib/sound'
import {
  CHARACTERS,
  FOOT,
  GOAL_DEPTH,
  GROUND,
  H,
  HEAD_R,
  METER_MAX,
  POWERS,
  STEP_MS,
  TEAM,
  W,
  campRule,
  charAt,
  clamp,
  newWorld,
  noKeys,
  refereeCheck,
  separatePlayers,
  stepPlayer,
  stepWorld,
  type Ball,
  type Keys,
  type NetEvent,
  type Player,
  type Sport,
} from './head/engine'
import { botInput, newBotMemory } from './head/bot'
import { ARENA_FILL, Fx, drawBall, drawBanner, drawCountdown, drawFlash, drawGoalOrHoop, drawHud, drawPlayer, drawSlowMo, paintBackground } from './head/render'
import { ControlSettings, OverlayControls, PHONE_PORTRAIT, RotatePrompt, charIndex, enterFullscreen, playEvents, readPrefs, useMedia, usePrefs } from './head/controls'
import { CharacterSelect } from './head/character-select'

export type { Sport }
/** `bot`: solo vs AI. `host`: seat 0 runs physics and streams it. `guest`: seat 1 sends keys and renders the host's stream. */
export type HeadMode = 'bot' | 'host' | 'guest'
export type HeadScore = { for: number; against: number }

const RIVAL_HOLD_STEPS = 15 * 60
const SLOW_MO_SCALE = 0.32
type RemoteMe = Pick<Player, 'x' | 'y' | 'vx' | 'vy' | 'face' | 'kick' | 'power'> & { kn: number }

function blendPlayer(out: Player, a: Player, b: Player, t: number) {
  Object.assign(out, b)
  if (Math.hypot(b.x - a.x, b.y - a.y) > 150) return
  out.x = a.x + (b.x - a.x) * t
  out.y = a.y + (b.y - a.y) * t
}

function blendBall(out: Ball, a: Ball, b: Ball, t: number) {
  Object.assign(out, b)
  if (Math.hypot(b.x - a.x, b.y - a.y) > 150) return
  out.x = a.x + (b.x - a.x) * t
  out.y = a.y + (b.y - a.y) * t
  out.rot = a.rot + (b.rot - a.rot) * t
}

const validCh = (v: unknown) => Math.round(clamp(v, 0, CHARACTERS.length - 1))

export function HeadGame({
  sport,
  mode,
  onEnd,
  names = ['Sen', 'Bot'],
  link,
}: {
  sport: Sport
  mode: HeadMode
  onEnd: (score: HeadScore) => void
  names?: [string, string]
  link?: DuelLink
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const linkRef = useRef(link)
  linkRef.current = link
  const linkReady = mode === 'bot' || link?.status === 'open'
  const linkLost = mode !== 'bot' && link?.status === 'lost'
  const k1 = useRef<Keys>(noKeys())
  const powerPresses = useRef(0)
  const [announce, setAnnounce] = useState('0 - 0')
  const endRef = useRef(onEnd)
  endRef.current = onEnd
  const namesRef = useRef(names)
  namesRef.current = names
  const prefs = usePrefs()

  const touch = useMedia('(pointer: coarse)')
  const portrait = useMedia('(orientation: portrait)')
  // Solo matches open on the lineup screen; online matches use the saved character.
  const [myCh, setMyCh] = useState<number | null>(null)
  const picked = mode !== 'bot' || myCh !== null
  const [started, setStarted] = useState(false)
  const [over, setOver] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rivalHold, setRivalHold] = useState(false)
  const [powerReady, setPowerReady] = useState(false)
  const needRotate = touch && portrait && !over && picked
  const fullLandscape = touch && !portrait && started && !over && !minimized
  const pausedRef = useRef(false)
  pausedRef.current = needRotate || (mode === 'bot' && settingsOpen)
  const myChar = charAt(myCh ?? charIndex(prefs.char))

  useEffect(() => {
    if (picked && linkReady && !needRotate && !window.matchMedia(PHONE_PORTRAIT).matches) setStarted(true)
  }, [needRotate, linkReady, picked])

  useEffect(() => {
    if (!over) return
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }, [over])

  // A held thumb outside the buttons used to trigger Android text selection and the Google "tap to define" sheet mid-match.
  useEffect(() => {
    if (!touch || !started || over) return
    const s = document.documentElement.style as CSSStyleDeclaration & { webkitUserSelect: string; webkitTouchCallout: string }
    const prev = [s.userSelect, s.webkitUserSelect, s.webkitTouchCallout]
    s.userSelect = 'none'
    s.webkitUserSelect = 'none'
    s.webkitTouchCallout = 'none'
    const block = (e: Event) => e.preventDefault()
    document.addEventListener('contextmenu', block)
    document.addEventListener('selectstart', block)
    window.getSelection()?.removeAllRanges()
    return () => {
      ;[s.userSelect, s.webkitUserSelect, s.webkitTouchCallout] = prev
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('selectstart', block)
    }
  }, [touch, started, over])

  useEffect(() => {
    if (!started) return
    const map: Record<string, keyof Keys> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'jump',
      ArrowDown: 'kick',
      KeyA: 'left',
      KeyD: 'right',
      KeyW: 'jump',
      KeyS: 'kick',
      Space: 'kick',
    }
    const powerKeys = new Set(['KeyE', 'KeyQ', 'ShiftLeft', 'ShiftRight'])
    const kd = (e: KeyboardEvent) => {
      if (powerKeys.has(e.code)) {
        if (!e.repeat) powerPresses.current++
        e.preventDefault()
      } else if (map[e.code]) {
        k1.current[map[e.code]] = true
        e.preventDefault()
      }
    }
    const ku = (e: KeyboardEvent) => {
      if (map[e.code]) k1.current[map[e.code]] = false
    }
    const blur = () => {
      k1.current = noKeys()
    }
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('blur', blur)
    }
  }, [started])

  useEffect(() => {
    if (!started) return
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const bg = paintBackground(sport)
    const imgs = CHARACTERS.map((c) => {
      const i = new Image()
      i.crossOrigin = 'anonymous'
      i.src = `${c.img}.webp`
      return i
    })
    const seat: 0 | 1 = mode === 'guest' ? 1 : 0
    const mine = myCh ?? charIndex(readPrefs().char)
    // The bot never mirrors your pick, so every solo match is a real matchup.
    const botCh = (mine + 1 + Math.floor(Math.random() * (CHARACTERS.length - 1))) % CHARACTERS.length
    const w = newWorld(sport, seat === 0 ? mine : 0, seat === 0 ? (mode === 'bot' ? botCh : 1) : mine)
    const [p1, p2] = w.p
    const fx = new Fx()
    const botMem = newBotMemory()
    const displayNames = (): [string, string] => {
      const n = namesRef.current
      return mode === 'bot' && n[1] === 'Bot' ? [n[0], `${charAt(p2.ch).name} Bot`] : n
    }

    let raf = 0
    let last = performance.now()
    let acc = 0
    let ended = false
    let remoteKeys: Keys = noKeys()
    let remotePaused = false
    let rivalHoldSteps = 0
    let shownHold = false
    let shownReady = false
    let lastScore = '0 - 0'
    let consumedPower = powerPresses.current
    // Host: the guest moves its own player locally and reports the result, so their controls never wait on the network.
    let remoteMe: RemoteMe | null = null
    let remoteQ = -1
    let hostKn = 0
    let hostPn = 0
    let remotePower = false
    // Guest: jitter buffer of host frames, rendered a short adaptive delay behind the host clock.
    const buf: { ht: number; p1: Player; b: Ball }[] = []
    let clockOffset: number | null = null
    let jitter = 0
    let lastHt = -Infinity
    let guestResets = -1
    let hostFrozen = false
    let hostPause = false
    let kickNo = 0
    let sendQ = 0
    let crowdOn = true
    const stopCrowd = startCrowdAmbience(sport === 'futbol' ? 0.05 : 0.035)
    const quietCrowd = () => {
      if (!crowdOn) return
      crowdOn = false
      stopCrowd()
    }
    const showHold = (v: boolean) => {
      if (v === shownHold) return
      shownHold = v
      setRivalHold(v)
    }
    const finish = (score: HeadScore) => {
      ended = true
      quietCrowd()
      playSound('whistleEnd')
      setOver(true)
      endRef.current(score)
    }
    const handleEvents = (list: NetEvent[]) => {
      playEvents(list, seat)
      for (const ev of list) fx.handle(ev)
    }

    if (mode !== 'bot' && linkRef.current) {
      linkRef.current.onMessage.current = (raw) => {
        const msg = raw as { t: string; [k: string]: unknown }
        if (mode === 'host' && msg.t === 'k') {
          const q = typeof msg.q === 'number' ? msg.q : -1
          // Relay requests can overlap; drop key packets older than the newest one (a reloaded guest restarts at 0).
          if (q >= 0 && q <= remoteQ && remoteQ - q < 600) return
          remoteQ = q
          remoteKeys = { ...noKeys(), ...(msg.k as Partial<Keys>), power: false }
          remotePaused = !!msg.pz
          if (typeof msg.ch === 'number') p2.ch = validCh(msg.ch)
          const pn = Number(msg.pn) || 0
          if (pn !== hostPn) {
            hostPn = pn
            remotePower = true
          }
          if (msg.me && msg.rs === w.resets) remoteMe = msg.me as RemoteMe
        }
        if (mode !== 'guest') return
        if (msg.t === 's') {
          const now = performance.now()
          const ht = Number(msg.ht) || 0
          const sample = now - ht
          if (clockOffset === null || sample < clockOffset) clockOffset = sample
          else clockOffset += (sample - clockOffset) * 0.002
          jitter = Math.max(sample - clockOffset, jitter * 0.98)
          const entry = { ht, p1: msg.p1 as Player, b: msg.b as Ball }
          let i = buf.length
          while (i > 0 && buf[i - 1].ht > ht) i--
          buf.splice(i, 0, entry)
          if (buf.length > 40) buf.splice(0, buf.length - 40)
          if (ht < lastHt) return
          lastHt = ht
          hostFrozen = !!msg.hz
          hostPause = !!msg.pa
          const hostMe = msg.p2 as Player
          // After a goal, a knockback or any reset the host's word wins; otherwise only a large drift snaps the local player back.
          if (msg.rs !== guestResets || Math.hypot(hostMe.x - p2.x, hostMe.y - p2.y) > 260) {
            guestResets = msg.rs as number
            Object.assign(p2, hostMe, { ch: mine })
          }
          // Power state is the host's call (a rival freeze, a shrink); it is copied without touching the local movement.
          p2.meter = hostMe.meter
          p2.armed = hostMe.armed
          p2.frozen = hostMe.frozen
          p2.stun = hostMe.stun
          p2.grow = hostMe.grow
          p2.shrink = hostMe.shrink
          p2.shield = hostMe.shield
          const next = msg.sc as [number, number]
          w.sc[0] = next[0]
          w.sc[1] = next[1]
          w.elapsed = Number(msg.el) || 0
          w.overtime = !!msg.ot
          w.flash = String(msg.f ?? '')
          w.flashT = Number(msg.ft) || 0
          w.countdown = Number(msg.cd) || 0
          w.slow = Number(msg.sl) || 0
          w.banner = String(msg.bn ?? '')
          w.bannerT = Number(msg.bt) || 0
          w.bannerSeat = Number(msg.bs ?? -1)
          if (Array.isArray(msg.ns)) w.netShake = msg.ns as [number, number]
          handleEvents((msg.ev as NetEvent[] | undefined) ?? [])
          showHold(!!msg.pz)
        } else if (msg.t === 'end' && !ended) {
          const fin = msg.sc as [number, number]
          finish({ for: fin[1], against: fin[0] })
        }
      }
    }

    function hostStep() {
      let k2now: Keys
      let power1 = false
      if (mode === 'host' && linkRef.current?.status === 'open') {
        // Kicks arrive as a counter in the guest's own state, so a quick tap lost between packets still lands.
        k2now = { ...remoteKeys, kick: false }
        p2.charge = 0
        power1 = remotePower
        remotePower = false
        const me = remoteMe
        const live = w.pause <= 0 && w.countdown <= 0 && !w.celebrate && p2.frozen <= 0 && p2.stun <= 0
        if (me && live) {
          remoteMe = null
          const margin = sport === 'futbol' ? GOAL_DEPTH * 0.55 : 24
          p2.x = clamp(me.x, HEAD_R + margin, W - HEAD_R - margin)
          p2.y = clamp(me.y, -400, GROUND - FOOT)
          p2.vx = clamp(me.vx, -7.5, 7.5)
          p2.vy = clamp(me.vy, -15, 30)
          p2.face = me.face === -1 ? -1 : 1
          if (me.kn !== hostKn) {
            hostKn = me.kn
            p2.kick = clamp(me.kick, 8, 16)
            p2.power = clamp(me.power, 1, 1.35)
          }
        }
      } else {
        const r = botInput(w, 1, readPrefs().bot, botMem)
        k2now = r.keys
        power1 = r.power
      }
      const power0 = consumedPower !== powerPresses.current
      consumedPower = powerPresses.current
      stepWorld(w, k1.current, k2now, power0, power1)
    }

    function frame(now: number) {
      const dt = Math.min(80, now - last)
      last = now
      const net = linkRef.current
      // A rival who turns their phone upright freezes the match on both screens, for at most 15 s.
      let rivalPaused = false
      if (mode === 'host') {
        const online = net?.status === 'open'
        rivalPaused = online && remotePaused && rivalHoldSteps < RIVAL_HOLD_STEPS
        rivalHoldSteps = online && remotePaused ? rivalHoldSteps + 1 : 0
        showHold(rivalPaused)
      }
      if (mode === 'guest') {
        acc += dt
        // Own player: simulated right here with zero input lag; the host takes this state as the truth.
        if (pausedRef.current || hostFrozen) acc = 0
        if (pausedRef.current) k1.current = noKeys()
        let steps = 0
        while (acc >= STEP_MS && steps < 5) {
          const before = p2.kick
          stepPlayer(p2, hostPause ? noKeys() : k1.current, sport)
          campRule(p2, 1, sport, () => {})
          if (before <= 0 && p2.kick > 0) kickNo++
          acc -= STEP_MS
          steps++
        }
        if (steps === 5) acc = 0
        net?.send({
          t: 'k',
          q: sendQ++,
          k: k1.current,
          pz: pausedRef.current,
          rs: guestResets,
          ch: mine,
          pn: powerPresses.current,
          me: { x: p2.x, y: p2.y, vx: p2.vx, vy: p2.vy, face: p2.face, kick: p2.kick, power: p2.power, kn: kickNo },
        })
        // Rival and ball: replayed from the jitter buffer a little behind the host clock, so bursty packets still look smooth.
        if (buf.length && clockOffset !== null) {
          const delay = Math.min(350, Math.max(45, jitter + 20))
          const target = now - clockOffset - delay
          while (buf.length > 2 && buf[1].ht <= target) buf.shift()
          const a = buf[0]
          const b = buf[1] ?? a
          const t = b.ht > a.ht ? Math.max(0, Math.min(1, (target - a.ht) / (b.ht - a.ht))) : 1
          blendPlayer(p1, a.p1, b.p1, t)
          blendBall(w.ball, a.b, b.b, t)
        }
        const ghost = { ...p1 }
        separatePlayers(ghost, p2)
      } else {
        // Goal replays run in slow motion on the host clock; the guest simply receives slower frames.
        acc += dt * (w.slow > 0 ? SLOW_MO_SCALE : 1)
        if (pausedRef.current || rivalPaused) {
          acc = 0
          if (pausedRef.current) k1.current = noKeys()
        }
        let steps = 0
        while (acc >= STEP_MS && steps < 5) {
          hostStep()
          acc -= STEP_MS
          steps++
        }
        if (steps === 5) acc = 0
        const out = w.events
        w.events = []
        handleEvents(out)
        if (mode === 'host')
          net?.send({
            t: 's',
            ht: now,
            rs: w.resets,
            pa: w.pause > 0 || w.countdown > 0 || !!w.celebrate,
            hz: pausedRef.current || rivalPaused,
            p1,
            p2,
            b: w.ball,
            sc: w.sc,
            el: w.elapsed,
            ot: w.overtime,
            f: w.flash,
            ft: w.flashT,
            cd: w.countdown,
            sl: w.slow,
            bn: w.banner,
            bt: w.bannerT,
            bs: w.bannerSeat,
            ns: w.netShake,
            ev: out,
            pz: pausedRef.current,
          })
      }

      const score = `${w.sc[0]} - ${w.sc[1]}`
      if (score !== lastScore) {
        lastScore = score
        setAnnounce(score)
      }
      const me = w.p[seat]
      const ready = me.meter >= METER_MAX && !me.armed
      if (ready !== shownReady) {
        shownReady = ready
        setPowerReady(ready)
      }

      fx.update(w.ball, w.p)
      const c = ctx!
      const n = displayNames()
      const [ox, oy] = fx.offset()
      c.drawImage(bg, 0, 0)
      c.save()
      if (ox || oy) {
        c.translate(ox, oy)
        c.drawImage(bg, 0, 0)
      }
      drawGoalOrHoop(c, w, false, sendQ + Math.floor(now / 16))
      drawPlayer(c, p1, TEAM.home, imgs[p1.ch], n[0], sport, fx.squash[0], Math.floor(now / 16))
      drawPlayer(c, p2, TEAM.away, imgs[p2.ch], n[1], sport, fx.squash[1], Math.floor(now / 16))
      drawBall(c, w.ball, sport, seat, Math.floor(now / 16))
      fx.draw(c)
      drawGoalOrHoop(c, w, true, Math.floor(now / 16))
      c.restore()
      drawSlowMo(c, w.slow)
      drawHud(c, w, n, imgs, Math.floor(now / 16))
      drawBanner(c, w)
      drawCountdown(c, w.countdown)
      if (w.flash) drawFlash(c, w.flash, w.flashT)

      if (mode !== 'guest' && !ended && refereeCheck(w)) {
        if (mode === 'host') for (let i = 0; i < 3; i++) net?.send({ t: 'end', sc: w.sc })
        finish({ for: w.sc[0], against: w.sc[1] })
        return
      }
      if (ended) return
      raf = requestAnimationFrame(frame)
    }
    const onVis = () => {
      last = performance.now()
      k1.current = noKeys()
    }
    document.addEventListener('visibilitychange', onVis)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      quietCrowd()
      document.removeEventListener('visibilitychange', onVis)
    }
    // myCh is fixed once the match starts, so it is read once here rather than restarting the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, mode, started])

  if (!picked) return <CharacterSelect sport={sport} onStart={(ch) => setMyCh(ch)} />

  const power = POWERS[myChar.power]
  return (
    <div className="flex flex-col gap-3">
      <p className="sr-only" aria-live="polite">
        Skor {announce}
      </p>
      {needRotate && <RotatePrompt sport={sport} paused={started} />}
      <div
        className={cn(
          needRotate && 'hidden',
          fullLandscape &&
            'fixed inset-0 z-[70] flex items-center justify-center bg-background pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
        )}
        // On phones wider than 16:9 the side bars continue the arena (stands above, floor below) instead of showing black.
        style={fullLandscape ? { background: ARENA_FILL[sport] } : undefined}
      >
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border border-primary/30 bg-background shadow-xl',
            fullLandscape && 'aspect-video h-full max-w-full rounded-none border-0',
          )}
        >
          <canvas
            ref={canvas}
            width={W}
            height={H}
            className={cn('block aspect-video w-full touch-none select-none', fullLandscape && 'h-full')}
            aria-label={sport === 'futbol' ? 'Kafa topu sahası' : 'Kafa basketbolu sahası'}
          />
          {!fullLandscape && (
            <OverlayControls
              k1={k1}
              onPower={() => powerPresses.current++}
              powerReady={powerReady}
              powerColor={power.color}
            />
          )}
          <TableBrand center={false} corners={false} jako={false} plaque="bottom" />
          {mode !== 'bot' && !over && (!started || linkLost) && (
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-2 text-center',
                touch && !portrait && !started ? 'fixed inset-0 z-[80] bg-background' : 'absolute inset-0 bg-background/80 backdrop-blur-sm',
              )}
            >
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
              <p className="font-semibold text-foreground">{linkLost ? 'Bağlantı koptu, yeniden bağlanılıyor…' : 'Rakibine bağlanılıyor…'}</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {mode === 'host' && linkLost ? 'Bağlantı dönene kadar rakibinin yerine bot oynuyor.' : 'İkiniz de masadayken maç otomatik başlar.'}
              </p>
            </div>
          )}
          {fullLandscape && (
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="absolute left-2 top-2 z-20 flex size-9 items-center justify-center rounded-full border border-foreground/30 bg-background/40 text-foreground backdrop-blur-sm"
              aria-label="Tam ekrandan çık"
            >
              <Minimize2 className="size-4" aria-hidden="true" />
            </button>
          )}
          {!over && (
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-expanded={settingsOpen}
              aria-label="Kontrol ayarları"
              className={cn(
                'absolute top-2 z-20 flex size-9 items-center justify-center rounded-full border border-foreground/30 bg-background/40 text-foreground backdrop-blur-sm',
                fullLandscape ? 'left-13' : 'left-2',
              )}
            >
              <Settings2 className="size-4" aria-hidden="true" />
            </button>
          )}
          {settingsOpen && !over && <ControlSettings pauses={mode === 'bot'} onClose={() => setSettingsOpen(false)} />}
          {rivalHold && !over && (
            <div role="status" className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center px-4">
              <p className="text-pretty rounded-full bg-background/85 px-4 py-2 text-center text-xs font-bold text-foreground shadow-md backdrop-blur-sm">
                Rakibin telefonu dik çevirdi, maç bekliyor. 15 sn içinde dönmezse maç devam eder.
              </p>
            </div>
          )}
        </div>
        {fullLandscape && (
          <OverlayControls
            k1={k1}
            full
            onPress={enterFullscreen}
            onPower={() => powerPresses.current++}
            powerReady={powerReady}
            powerColor={power.color}
          />
        )}
      </div>
      <p className="hidden text-center text-xs text-muted-foreground lg:block">
        A / D veya oklar: hareket · W / yukarı: zıpla · S / boşluk: şut (basılı tut, güçlü şut) · E / Shift: süper güç ({power.name})
      </p>
    </div>
  )
}
