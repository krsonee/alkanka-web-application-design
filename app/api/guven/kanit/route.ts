import { del, put } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { getMember } from '@/lib/member'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/withdrawals'

export async function POST(request: NextRequest) {
  const member = await getMember()
  if (!member) return NextResponse.json({ error: 'Kanıt eklemek için giriş yapmalısın.' }, { status: 401 })
  if (await hitRateLimit(`kanit:${member.id}`, 6, 600)) return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  const siteId = String(form?.get('siteId') ?? '')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Ekran görüntüsünü seç.' }, { status: 400 })
  if (!/^\d+$/.test(siteId)) return NextResponse.json({ error: 'Site bulunamadı.' }, { status: 400 })
  if (!IMAGE_TYPES[file.type]) return NextResponse.json({ error: 'Yalnızca PNG, JPG veya WEBP yükleyebilirsin.' }, { status: 400 })
  if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Görsel en fazla 5 MB olabilir.' }, { status: 400 })

  const blob = await put(`kanit/${siteId}-${Date.now()}.${IMAGE_TYPES[file.type]}`, Buffer.from(await file.arrayBuffer()), {
    access: 'private',
    addRandomSuffix: true,
    contentType: file.type,
  })
  try {
    const { attachReviewProof } = await import('@/lib/trust-extra')
    const { previous } = await attachReviewProof(member.id, siteId, blob.pathname)
    if (previous) await del(previous).catch(() => {})
    const { notifyApproval } = await import('@/lib/telegram-bots')
    await notifyApproval('complaint', { uye: member.name, detay: 'Yorum kanıtı onay bekliyor' }).catch(() => {})
  } catch (error) {
    await del(blob.pathname).catch(() => {})
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Kanıt kaydedilemedi.' }, { status: 400 })
  }
  revalidatePath('/panel')
  return NextResponse.json({ ok: true, message: 'Kanıtın onaya gönderildi. Onaylanınca yorumuna "Doğrulanmış" rozeti eklenir.' })
}
