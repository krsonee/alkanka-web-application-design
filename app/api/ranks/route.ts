import { NextResponse } from 'next/server'
import { getKpConfig, levelMap, roleMap } from '@/lib/kanka-puan'
import { chatBadges } from '@/lib/badge-value'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [levels, cfg, roles, badges] = await Promise.all([levelMap(), getKpConfig(), roleMap().catch(() => ({})), chatBadges().catch(() => ({}))])
  return NextResponse.json(
    { levels, names: cfg.levels.map((l) => l.name), roles, badges },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
