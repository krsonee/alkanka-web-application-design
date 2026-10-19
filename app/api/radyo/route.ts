import { NextResponse } from 'next/server'

export const revalidate = 3600
export const maxDuration = 60

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
  fallbacks: string[]
  favicon: string | null
  tags: string[]
  bitrate: number
}

const MIRRORS = ['de1.api.radio-browser.info', 'nl1.api.radio-browser.info', 'at1.api.radio-browser.info']
const PLAYABLE_CODECS = new Set(['MP3', 'AAC', 'AAC+', 'OGG'])
const AUDIO_TYPES = ['audio/', 'application/ogg', 'application/octet-stream']
const MAX_STATIONS = 150
const PROBE_TIMEOUT_MS = 4000
const PROBE_CONCURRENCY = 30

async function fetchStations(): Promise<RawStation[]> {
  const query = 'countrycode=TR&hidebroken=true&is_https=true&order=clickcount&reverse=true&limit=500'
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

async function isStreamAlive(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 alkanka.com radio check', 'Icy-MetaData': '0' },
    })
    const type = res.headers.get('content-type')?.toLowerCase() ?? ''
    if (!res.ok || !res.url.startsWith('https://') || !AUDIO_TYPES.some((t) => type.startsWith(t))) return false
    const reader = res.body?.getReader()
    const chunk = reader ? await reader.read() : null
    return Boolean(chunk?.value?.byteLength)
  } catch {
    return false
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
}

async function filterAlive<T>(items: T[], getUrl: (item: T) => string): Promise<T[]> {
  const alive: boolean[] = new Array(items.length).fill(false)
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++
      alive[i] = await isStreamAlive(getUrl(items[i]))
    }
  }
  await Promise.all(Array.from({ length: PROBE_CONCURRENCY }, worker))
  return items.filter((_, i) => alive[i])
}

const normalizeName = (name: string) =>
  name.trim().toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]/g, '')

export async function GET() {
  const raw = await fetchStations()
  const candidates = raw.filter(
    (s) =>
      s.name.trim() &&
      !s.hls &&
      s.lastcheckok &&
      s.url_resolved.startsWith('https://') &&
      PLAYABLE_CODECS.has(s.codec.toUpperCase()),
  )

  const alive = await filterAlive(candidates, (s) => s.url_resolved)

  const byName = new Map<string, RadioStation>()
  for (const s of alive) {
    const key = normalizeName(s.name)
    if (!key) continue
    const existing = byName.get(key)
    if (existing) {
      if (existing.url !== s.url_resolved && !existing.fallbacks.includes(s.url_resolved)) {
        existing.fallbacks.push(s.url_resolved)
      }
      continue
    }
    if (byName.size >= MAX_STATIONS) continue
    byName.set(key, {
      id: s.stationuuid,
      name: s.name.trim(),
      url: s.url_resolved,
      fallbacks: [],
      favicon: s.favicon?.startsWith('https://') ? s.favicon : null,
      tags: s.tags ? s.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3) : [],
      bitrate: s.bitrate,
    })
  }

  return NextResponse.json(
    { stations: [...byName.values()] },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600' } },
  )
}
