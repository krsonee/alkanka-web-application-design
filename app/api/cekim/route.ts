import { put } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { getMember } from '@/lib/member'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'
import { checkWithdrawShare, IMAGE_TYPES, insertWithdrawShare } from '@/lib/withdrawals'

export async function POST(request: NextRequest) {
  const member = await getMember()
  if (!member) return NextResponse.json({ error: 'Çekim paylaşmak için giriş yapmalısın.' }, { status: 401 })
  if (await hitRateLimit(`cekim:${member.id}`, 6, 600)) return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!form || !(file instanceof File)) return NextResponse.json({ error: 'Çekim sayfasının ekran görüntüsünü ekle.' }, { status: 400 })

  try {
    const bytes = await file.arrayBuffer()
    const { checked, hash } = await checkWithdrawShare(
      member,
      {
        siteId: String(form.get('siteId') ?? ''),
        siteUsername: String(form.get('siteUsername') ?? ''),
        amount: Number(String(form.get('amount') ?? '').replace(',', '.')),
        paidAt: String(form.get('paidAt') ?? ''),
        consent: form.get('consent') === 'on',
      },
      { bytes, type: file.type, size: file.size },
    )
    const blob = await put(`cekim/${checked.siteId}-${Date.now()}.${IMAGE_TYPES[file.type]}`, Buffer.from(bytes), {
      access: 'private',
      addRandomSuffix: true,
      contentType: file.type,
    })
    try {
      await insertWithdrawShare(member, checked, blob.pathname, hash)
    } catch (error) {
      const { del } = await import('@vercel/blob')
      await del(blob.pathname).catch(() => {})
      throw error
    }
    revalidatePath('/panel')
    return NextResponse.json({ ok: true, message: 'Paylaşımın onaya gönderildi. Onaylanınca ödülün hesabına eklenir.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Yükleme başarısız oldu.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
