import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { canPanelAny } from '@/lib/admin-auth'
import { rejectCrossSite } from '@/lib/same-origin'
import { MAX_GIF_BYTES, UPLOAD_MODULES } from '@/lib/upload-limits'

/** Issues a one-off token so a large GIF can go from the browser straight to Blob, past the function body limit. */
export async function POST(request: Request) {
  const crossSite = rejectCrossSite(request)
  if (crossSite) return crossSite
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null
  if (!body) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await canPanelAny(UPLOAD_MODULES))) throw new Error('Oturum süresi doldu, tekrar giriş yap.')
        if (!/^logos\/[a-z0-9-]{1,40}\.gif$/i.test(pathname)) throw new Error('Geçersiz dosya adı.')
        return { allowedContentTypes: ['image/gif'], maximumSizeInBytes: MAX_GIF_BYTES, addRandomSuffix: true }
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Yükleme başarısız oldu.' }, { status: 400 })
  }
}
