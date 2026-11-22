import { NextResponse, type NextRequest } from 'next/server'
import { canPanel, isPanelOwner } from '@/lib/admin-auth'
import { logPanel } from '@/lib/panel-log'
import { rejectCrossSite } from '@/lib/same-origin'
import { labelAsset, readFile, unlabelledAssets } from '@/lib/studio'
import { sortAsset } from '@/lib/studio-sort'

export const maxDuration = 120

const MAX_PER_REQUEST = 8
const SIDE_BY_SIDE = 4

/** Labels library pictures that were added while the model could not be reached. */
export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSite(request)
  if (crossSite) return crossSite
  if (!(await canPanel('studio'))) return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yap.' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null
  const ids = (Array.isArray(body?.ids) ? body.ids : [])
    .map((v) => Number.parseInt(String(v), 10))
    .filter((n) => Number.isSafeInteger(n) && n > 0)
    .slice(0, MAX_PER_REQUEST)
  // Pictures that already carry a label are left alone, so a role set by hand is never overwritten.
  const waiting = await unlabelledAssets(ids)
  const figures = await isPanelOwner()
  let done = 0

  async function label(asset: { id: number; pathname: string }) {
    try {
      const sorted = await sortAsset(await readFile(asset.pathname), figures)
      if (!sorted) return
      await labelAsset(asset.id, sorted)
      done += 1
    } catch (error) {
      console.error('[studio] kütüphane görseli etiketlenemedi', asset.id, error)
    }
  }

  for (let at = 0; at < waiting.length; at += SIDE_BY_SIDE) {
    await Promise.all(waiting.slice(at, at + SIDE_BY_SIDE).map(label))
  }

  if (done) await logPanel('studio', 'Kütüphane görselleri etiketlendi', null, `${done} görsel`)
  return NextResponse.json({ done, left: waiting.length - done })
}
