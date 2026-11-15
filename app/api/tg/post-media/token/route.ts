import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { canPanel } from '@/lib/admin-auth'
import { FILE_MAX_BYTES, PHOTO_MAX_BYTES, UPLOAD_TYPES, extensionOf } from '@/lib/tg-posts-shared'

/** Issues a one-off token so post media goes from the browser straight to Blob, past the function body limit. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null
  if (!body) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await canPanel('telegram'))) throw new Error('Oturum süresi doldu, tekrar giriş yap.')
        const type = UPLOAD_TYPES[extensionOf(pathname)]
        if (!type || !/^tgposts\/[a-z0-9-]{1,40}\.[a-z0-9]{1,5}$/i.test(pathname)) throw new Error('Geçersiz dosya adı.')
        return {
          allowedContentTypes: [type.mime],
          maximumSizeInBytes: type.kind === 'photo' ? PHOTO_MAX_BYTES : FILE_MAX_BYTES,
          addRandomSuffix: true,
        }
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Yükleme başarısız oldu.' }, { status: 400 })
  }
}
