import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { getRound } from '@/lib/cember'
import { imageDataUrl } from '@/lib/image-source'
import { avatarMap } from '@/lib/avatars'

const FALLBACK_JAKO = '/images/profil-fotograflari/05-flat-ikon-jako.png'

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
  const origin = req.nextUrl.origin
  const picked = await avatarMap().catch(() => ({}) as Record<string, string>)
  const avatarSrc = (p: { id: string; image: string | null }) => picked[p.id] ?? p.image ?? FALLBACK_JAKO
  const art = await imageDataUrl(game.art, origin)
  const avatar = await imageDataUrl(avatarSrc(player), origin)
  const name = player.name.length > 16 ? `${player.name.slice(0, 15)}…` : player.name

  const mates = winners.filter((w) => w !== index)
  const shownMates = mates.slice(0, 6)
  const mateAvatars = await Promise.all(shownMates.map((w) => imageDataUrl(avatarSrc(round.participants[w]), origin)))
  const extraMates = mates.length - shownMates.length

  const image = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', position: 'relative', background: NAVY, color: INK }}>
        {art && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} width={W} height={H} alt="" style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover', opacity: 0.45 }} />
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', background: `linear-gradient(180deg, rgba(11,16,32,0.55) 0%, rgba(11,16,32,0.35) 35%, rgba(11,16,32,0.92) 62%, ${NAVY} 100%)` }} />

        <div style={{ position: 'absolute', top: 48, left: 56, right: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, letterSpacing: 6, color: GOLD }}>AL KANKA</div>
          <div style={{ display: 'flex', padding: '10px 22px', borderRadius: 999, border: `2px solid ${GOLD}`, fontSize: 24, fontWeight: 700, letterSpacing: 2, color: GOLD, background: 'rgba(11,16,32,0.6)' }}>
            {game.label.toUpperCase()}
          </div>
        </div>

        <div style={{ position: 'absolute', top: 140, left: 0, width: W, display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: 560,
              height: 560,
              display: 'flex',
              borderRadius: 56,
              border: `8px solid ${GOLD}`,
              overflow: 'hidden',
              background: '#1a2340',
              boxShadow: `0 0 90px rgba(233,185,73,0.55)`,
            }}
          >
            {avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} width={544} height={544} alt="" style={{ width: 544, height: 544, objectFit: 'cover' }} />
            )}
          </div>
        </div>
        <div style={{ position: 'absolute', top: 668, left: 0, width: W, display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', padding: '10px 30px', borderRadius: 999, background: GOLD, color: NAVY, fontSize: 30, fontWeight: 900, letterSpacing: 4 }}>
            {teamMode ? `${TEAM_NAMES[round.winningTeam] ?? 'Altın'} TAKIM`.toUpperCase() : 'KAZANAN'}
          </div>
        </div>

        <div style={{ position: 'absolute', top: 748, left: 0, width: W, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 88, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase' }}>{name}</div>
          <div style={{ display: 'flex', marginTop: 4, fontSize: 56, fontWeight: 900, fontStyle: 'italic', color: GOLD, textTransform: 'uppercase' }}>{verdict}</div>
          {round.prizeText && (
            <div style={{ display: 'flex', marginTop: 24, padding: '12px 30px', borderRadius: 999, border: `3px solid ${GOLD}`, color: GOLD, fontSize: 32, fontWeight: 800 }}>
              {round.prizeText}
            </div>
          )}
        </div>

        {shownMates.length > 0 && (
          <div style={{ position: 'absolute', top: 1090, left: 0, width: W, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, letterSpacing: 3, color: MUTED }}>BİRLİKTE KAZANDIK</div>
            <div style={{ display: 'flex', marginTop: 16, alignItems: 'center' }}>
              {shownMates.map((w, i) => (
                <div key={w} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 140 }}>
                  <div style={{ width: 96, height: 96, display: 'flex', borderRadius: 999, border: `4px solid ${GOLD}`, overflow: 'hidden', background: '#1a2340' }}>
                    {mateAvatars[i] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mateAvatars[i] as string} width={88} height={88} alt="" style={{ width: 88, height: 88, objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', marginTop: 8, fontSize: 20, fontWeight: 700, color: INK }}>
                    {round.participants[w].name.length > 10 ? `${round.participants[w].name.slice(0, 9)}…` : round.participants[w].name}
                  </div>
                </div>
              ))}
              {extraMates > 0 && (
                <div style={{ display: 'flex', width: 96, height: 96, borderRadius: 999, border: `4px solid ${GOLD}`, alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: GOLD, marginBottom: 30 }}>
                  {`+${extraMates}`}
                </div>
              )}
            </div>
          </div>
        )}

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
