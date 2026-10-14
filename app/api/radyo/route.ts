import { NextResponse } from 'next/server'

export const revalidate = 21600

type RawStation = {
  stationuuid: string
  name: string
  url_resolved: string
  favicon: string
  tags: string
  codec: string
  bitrate: number
  hls: number
  lastcheckok: number
}

export type RadioStation = {
  id: string
  name: string
  url: string
  favicon: string | null
  tags: string[]
  bitrate: number
}

const MIRRORS = ['de1.api.radio-browser.info', 'nl1.api.radio-browser.info', 'at1.api.radio-browser.info']
const PLAYABLE_CODECS = new Set(['MP3', 'AAC', 'AAC+', 'OGG'])

async function fetchStations(): Promise<RawStation[]> {
  const query = 'countrycode=TR&hidebroken=true&is_https=true&order=clickcount&reverse=true&limit=400'
  for (const host of MIRRORS) {
    try {
      const res = await fetch(`https://${host}/json/stations/search?${query}`, {
        headers: { 'User-Agent': 'alkanka.com/1.0' },
        next: { revalidate },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) return (await res.json()) as RawStation[]
    } catch {
      // try the next mirror
    }
  }
  return []
}

export async function GET() {
  const raw = await fetchStations()
  const seen = new Set<string>()
  const stations: RadioStation[] = []

  for (const s of raw) {
    const key = s.name.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    if (s.hls || !s.lastcheckok || !s.url_resolved.startsWith('https://')) continue
    if (!PLAYABLE_CODECS.has(s.codec.toUpperCase())) continue
    seen.add(key)
    stations.push({
      id: s.stationuuid,
      name: s.name.trim(),
      url: s.url_resolved,
      favicon: s.favicon?.startsWith('https://') ? s.favicon : null,
      tags: s.tags ? s.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3) : [],
      bitrate: s.bitrate,
    })
    if (stations.length >= 200) break
  }

  return NextResponse.json(
    { stations },
    { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
  )
}
