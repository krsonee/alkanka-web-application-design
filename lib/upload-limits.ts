import type { PanelModule } from './panel-modules'

export const IMAGE_UPLOAD_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_GIF_BYTES = 8 * 1024 * 1024
/** An SVG is text and is checked on the server before it is stored, so it never takes the direct route. */
export const MAX_SVG_BYTES = 2 * 1024 * 1024

/** File types that may go from the browser straight to Blob, by extension. */
export const DIRECT_UPLOAD_TYPES: Record<string, string> = { gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }

/** Vercel Functions reject request bodies over 4.5 MB, so larger files go from the browser straight to Blob. */
export const DIRECT_UPLOAD_OVER_BYTES = 4 * 1024 * 1024

export const UPLOAD_MODULES: PanelModule[] = [
  'logo', 'branding', 'sponsors', 'messages', 'slide', 'hero', 'seo', 'market',
  'games', 'catalog', 'tasks', 'tournaments', 'rewards', 'badges', 'studio', 'users',
]

export const uploadId = (value: unknown, fallback = 'logo') =>
  String(value ?? fallback).replace(/[^a-z0-9-]/gi, '').slice(0, 40) || fallback

const mb = (bytes: number) => (bytes / 1024 / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })

/** Returns the file extension, or throws the reason the file is refused. Dimensions are never checked: any pixel size is accepted. */
export function checkImageUpload(file: { type: string; size: number }) {
  const ext = IMAGE_UPLOAD_TYPES[file.type]
  if (!ext) throw new Error('Sadece PNG, JPG, WEBP, SVG veya GIF yükleyebilirsin.')
  const maxBytes = ext === 'gif' ? MAX_GIF_BYTES : ext === 'svg' ? MAX_SVG_BYTES : MAX_IMAGE_BYTES
  if (file.size > maxBytes) {
    throw new Error(`Bu dosya ${mb(file.size)} MB. ${ext === 'gif' ? 'GIF' : ext === 'svg' ? 'SVG' : 'Görsel'} en fazla ${mb(maxBytes)} MB olabilir.`)
  }
  return ext
}
