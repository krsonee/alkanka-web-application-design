import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { getRound } from '@/lib/cember'
import { imageDataUrl } from '@/lib/image-source'

export const runtime = 'nodejs'

const W = 1080
const H = 1350
const NAVY = '#0b1020'
const GOLD = '#e9b949'
const INK = '#f5f1e6'
const MUTED = 'rgba(245,241,230,0.62)'
const TEAM_NAMES = ['Altın', 'Mavi', 'Yakut', 'Zümrüt', 'Gümüş']

const GAME = {
  survival: { art: '/images/arena/survival-arena.png', label: 'Survival Arena', verdict: 'HAYATTA KALDI' },
  karadelik: { art: '/images/arena/kara-delik.png', label: 'Kara Delik', verdict: 'SAĞ ÇIKTI' },
  cember: { art: '/images/arena/jako-cemberi.png', label: 'Jako Çemberi', verdict: 'KAZANDI' },
} as const

function formatSlot(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso))
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const slot = params.get('slot') ?? ''
  const index = Number(params.get('i'))
  const result = await getRound(slot).catch(() => null)
  const round = result?.state === 'ready' ? result.round : undefined
  if (!round) return Response.json({ error: 'Tur bulunamadı.' }, { status: 404 })

  const winners = round.winners.length ? round.winners : round.winner !== null ? [round.winner] : []
  if (!Number.isInteger(index) || !winners.includes(index)) {
    return Response.json({ error: 'Bu oyuncu bu turun kazananı değil.' }, { status: 403 })
  }

  const player = round.participants[index]
  const game = GAME[round.game as keyof typeof GAME] ?? GAME.cember
  const teamMode = round.game === 'survival' && (round.survival?.teams ?? 0) > 0 && round.winningTeam >= 0
  const verdict = teamMode ? `${TEAM_NAMES[round.winningTeam] ?? 'Altın'} Takım kazandı` : game.verdict
  const art = await imageDataUrl(game.art, req.nextUrl.origin)
  const avatar = player.image ? await imageDataUrl(player.image, req.nextUrl.origin) : null
  const name = player.name.length > 16 ? `${player.name.slice(0, 15)}…` : player.name

  const image = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', position: 'relative', background: NAVY, color: INK }}>
        {art && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} width={W} height={760} alt="" style={{ width: W, height: 760, objectFit: 'cover' }} />
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: 760, display: 'flex', background: `linear-gradient(180deg, rgba(11,16,32,0.15) 0%, rgba(11,16,32,0.35) 55%, ${NAVY} 100%)` }} />

        <div style={{ position: 'absolute', top: 48, left: 56, right: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, letterSpacing: 6, color: GOLD }}>AL KANKA</div>
          <div style={{ display: 'flex', padding: '10px 22px', borderRadius: 999, border: `2px solid ${GOLD}`, fontSize: 24, fontWeight: 700, letterSpacing: 2, color: GOLD, background: 'rgba(11,16,32,0.6)' }}>
            {game.label.toUpperCase()}
          </div>
        </div>

        <div style={{ position: 'absolute', top: 600, left: 0, width: W, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 220, height: 220, borderRadius: 999, border: `8px solid ${GOLD}`, display: 'flex', overflow: 'hidden', background: '#1a2340', alignItems: 'center', justifyContent: 'center', fontSize: 96, fontWeight: 800, color: GOLD }}>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} width={204} height={204} alt="" style={{ width: 204, height: 204, objectFit: 'cover' }} />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>
          <div style={{ display: 'flex', marginTop: 36, fontSize: 92, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase' }}>{name}</div>
          <div style={{ display: 'flex', marginTop: 8, fontSize: 64, fontWeight: 900, fontStyle: 'italic', color: GOLD, textTransform: 'uppercase' }}>{verdict}</div>
          {round.prizeText && (
            <div style={{ display: 'flex', marginTop: 36, padding: '14px 32px', borderRadius: 999, background: GOLD, color: NAVY, fontSize: 34, fontWeight: 800 }}>
              {round.prizeText}
            </div>
          )}
        </div>

        <div style={{ position: 'absolute', bottom: 52, left: 56, right: 56, display: 'flex', justifyContent: 'space-between', fontSize: 26, color: MUTED }}>
          <div style={{ display: 'flex' }}>{`${round.participants.length} kanka arasından · ${formatSlot(round.slot)}`}</div>
          <div style={{ display: 'flex' }}>alkanka</div>
        </div>
      </div>
    ),
    { width: W, height: H },
  )
  const headers = new Headers(image.headers)
  headers.set('Cache-Control', 'public, s-maxage=86400, immutable')
  return new Response(image.body, { status: 200, headers })
}
