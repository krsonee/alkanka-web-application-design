import { put } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { canPanelAny } from '@/lib/admin-auth'
import { rejectCrossSite } from '@/lib/same-origin'
import { UPLOAD_MODULES, checkImageUpload, uploadId } from '@/lib/upload-limits'

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSite(request)
  if (crossSite) return crossSite
  if (!(await canPanelAny(UPLOAD_MODULES))) {
    return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get('file')
  const id = uploadId(form.get('id'))

  if (!(file instanceof File)) return NextResponse.json({ error: 'Dosya seçilmedi.' }, { status: 400 })
  let ext: string
  try {
    ext = checkImageUpload(file)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Dosya kabul edilmedi.' }, { status: 400 })
  }

  try {
    const blob = await put(`logos/${id}.${ext}`, file, {
      access: 'private',
      addRandomSuffix: true,
      contentType: file.type,
    })
    const name = blob.pathname.slice('logos/'.length)
    return NextResponse.json({ url: `/api/logo/${name}` })
  } catch (error) {
    console.error('Logo upload failed:', error)
    return NextResponse.json({ error: 'Yükleme başarısız oldu.' }, { status: 500 })
  }
}
