import { ImageResponse } from 'next/og'
import { NextResponse, type NextRequest } from 'next/server'
import { getMember } from '@/lib/member'
import { getKpStatus } from '@/lib/kanka-puan'
import { coverById, getLookState, teamById } from '@/lib/avatars'
import { imageDataUrl } from '@/lib/image-source'

export const runtime = 'nodejs'

const W = 1200
const H = 630
const GOLD = '#e8b931'
const INK = '#0b0f14'

export async function GET(req: NextRequest) {
  const member = await getMember()
  if (!member) return NextResponse.json({ error: 'Giriş yapmalısın.' }, { status: 401 })
  const [kp, look] = await Promise.all([getKpStatus(member.id), getLookState(member.id)])
  const avatar = look.avatars.find((a) => a.id === look.avatarId)
  const team = teamById(look.team)
  const [avatarData, coverData] = await Promise.all([
    avatar ? imageDataUrl(avatar.src, req.nextUrl.origin) : Promise.resolve(null),
    imageDataUrl(coverById(look.coverId).src, req.nextUrl.origin),
  ])
  const lv = kp.level.index + 1

  const image = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: INK, color: '#fff', fontFamily: 'sans-serif' }}>
        {coverData && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverData} alt="" width={W} height={H} style={{ position: 'absolute', inset: 0, width: W, height: H, objectFit: 'cover', opacity: 0.45 }} />
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', background: 'linear-gradient(90deg, rgba(11,15,20,0.95) 35%, rgba(11,15,20,0.55))' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 56, padding: '0 72px', width: '100%' }}>
          <div style={{ display: 'flex', width: 340, height: 340, borderRadius: 999, padding: 10, background: GOLD, flexShrink: 0 }}>
            {avatarData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarData} alt="" width={320} height={320} style={{ width: 320, height: 320, borderRadius: 999, objectFit: 'cover' }} />
            ) : (
              <div style={{ display: 'flex', width: 320, height: 320, borderRadius: 999, background: INK, alignItems: 'center', justifyContent: 'center', fontSize: 150, fontWeight: 800, color: GOLD }}>
                {member.name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <div style={{ display: 'flex', fontSize: 26, letterSpacing: 8, color: GOLD, fontWeight: 700 }}>AL KANKA ÜYE KARTI</div>
            <div style={{ display: 'flex', fontSize: 76, fontWeight: 800, lineHeight: 1 }}>{member.name.slice(0, 18)}</div>
            <div style={{ display: 'flex', gap: 14, fontSize: 30 }}>
              <span style={{ display: 'flex', padding: '8px 20px', borderRadius: 999, background: GOLD, color: INK, fontWeight: 800 }}>Seviye {lv}</span>
              <span style={{ display: 'flex', padding: '8px 20px', borderRadius: 999, border: `2px solid ${GOLD}`, color: GOLD, fontWeight: 700 }}>{kp.level.name}</span>
            </div>
            <div style={{ display: 'flex', gap: 40, fontSize: 28, color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>
              <span style={{ display: 'flex' }}>{kp.kp.toLocaleString('tr-TR')} KP</span>
              <span style={{ display: 'flex' }}>{kp.rank ? `#${kp.rank} sırada` : 'Yükselişte'}</span>
              <span style={{ display: 'flex' }}>{kp.badges.length} rozet</span>
            </div>
            {team && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 26, color: 'rgba(255,255,255,0.85)' }}>
                <span style={{ display: 'flex', width: 34, height: 34, borderRadius: 999, background: `linear-gradient(90deg, ${team.colors[0]} 50%, ${team.colors[1]} 50%)` }} />
                Taraftar: {team.name}
              </div>
            )}
          </div>
        </div>
        <div style={{ position: 'absolute', right: 40, bottom: 30, display: 'flex', fontSize: 22, letterSpacing: 4, color: 'rgba(255,255,255,0.6)' }}>alkanka · AL KANKA</div>
      </div>
    ),
    { width: W, height: H },
  )
  const headers = new Headers(image.headers)
  headers.set('Content-Disposition', 'attachment; filename="alkanka-profil-kartim.png"')
  headers.set('Cache-Control', 'private, no-store')
  return new Response(image.body, { status: 200, headers })
}
