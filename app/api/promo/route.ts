import { recordPromo } from '@/lib/promo-stats'

const REF_RE = /^[a-z0-9:_-]{1,80}$/i

export async function POST(req: Request) {
  const data = (await req.json().catch(() => null)) as { k?: string; r?: string; e?: string } | null
  const kind = data?.k
  const ref = data?.r
  const event = data?.e
  if ((kind !== 'slide' && kind !== 'ad') || !ref || !REF_RE.test(ref) || (event !== 'view' && event !== 'click')) {
    return new Response(null, { status: 400 })
  }
  try {
    await recordPromo(kind, ref, event)
  } catch {
    return new Response(null, { status: 500 })
  }
  return new Response(null, { status: 204 })
}
