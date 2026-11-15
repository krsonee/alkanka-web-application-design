import { NextResponse } from 'next/server'
import { getKpConfig, levelMap, roleMap } from '@/lib/kanka-puan'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [levels, cfg, roles] = await Promise.all([levelMap(), getKpConfig(), roleMap().catch(() => ({}))])
  return NextResponse.json(
    { levels, names: cfg.levels.map((l) => l.name), roles },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
