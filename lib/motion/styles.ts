import 'server-only'
import { rows, sql } from '@/lib/db'
import { fileUrl } from '@/lib/studio'
import { cleanColors, cleanLook, type MotionColors, type MotionLook } from './spec'

/** A manner read from an example banner, kept so that any later film can be made in it. */
export type MotionStyle = { id: number; name: string; sheetUrl: string; look: MotionLook; colors: MotionColors; note: string; seconds: number }

let ready: Promise<unknown> | null = null
function ensure() {
  ready ??= rows(sql`CREATE TABLE IF NOT EXISTS studio_motion_styles (
    id serial PRIMARY KEY,
    name text NOT NULL DEFAULT '',
    sheet text NOT NULL DEFAULT '',
    look text NOT NULL DEFAULT '',
    colors text NOT NULL DEFAULT '',
    note text NOT NULL DEFAULT '',
    seconds real NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`).catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const parsed = (text: unknown) => {
  try {
    return JSON.parse(String(text || '{}'))
  } catch {
    return {}
  }
}

const map = (r: Record<string, unknown>): MotionStyle => ({
  id: Number(r.id),
  name: String(r.name ?? ''),
  sheetUrl: fileUrl(String(r.sheet ?? '')),
  look: cleanLook(parsed(r.look)),
  colors: cleanColors(parsed(r.colors)),
  note: String(r.note ?? ''),
  seconds: Number(r.seconds ?? 0),
})

export async function listMotionStyles() {
  await ensure()
  return (await rows(sql`SELECT * FROM studio_motion_styles ORDER BY id DESC LIMIT 60`)).map(map)
}

export async function addMotionStyle(style: { name: string; sheet: string; look: MotionLook; colors: MotionColors; note: string; seconds: number }) {
  await ensure()
  const r = await rows(sql`INSERT INTO studio_motion_styles (name, sheet, look, colors, note, seconds)
    VALUES (${style.name}, ${style.sheet}, ${JSON.stringify(style.look)}, ${JSON.stringify(style.colors)}, ${style.note}, ${style.seconds}) RETURNING *`)
  return map(r[0])
}

export async function deleteMotionStyle(id: number) {
  await ensure()
  await rows(sql`DELETE FROM studio_motion_styles WHERE id = ${id}`)
}
