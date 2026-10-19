import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }

/** Loads a site image (public file, internal route or https URL) as a data URL for next/og rendering. */
export async function imageDataUrl(src: string, origin: string): Promise<string | null> {
  if (src.startsWith('/images/')) {
    try {
      const file = await readFile(path.join(process.cwd(), 'public', src))
      const ext = src.split('.').pop()?.toLowerCase() ?? 'png'
      return `data:${MIME[ext] ?? 'image/png'};base64,${file.toString('base64')}`
    } catch {
      // Public files aren't always traced into the function bundle; fall through to an HTTP fetch.
    }
  }
  try {
    const res = await fetch(new URL(src, origin), { cache: 'force-cache' })
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? 'image/png'
    if (!type.startsWith('image/') || type.includes('svg')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:${type};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}
