/**
 * Panel saves run the submitted value through a cleaner that clamps numbers and fills blanks.
 * Saving the cleaned value while saying "saved" hides a mistyped zero until it is live, so a save
 * compares what was written with what would be stored and refuses when they differ.
 */

type Path = (string | number)[]
export type Drift = { path: Path; wrote: unknown; saved: unknown; rows?: true }
export type DriftLabels = Record<string, string>
export type DriftOptions = {
  labels?: DriftLabels
  /** Keys the cleaner derives on its own (ids, computed labels); never compared. */
  ignore?: string[]
  /** Keys that may be left blank and then fall back to a default. */
  blankOk?: string[]
}

const fmt = (n: number) => n.toLocaleString('tr-TR')

const toNumber = (v: unknown) => (typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.')))

const isPrimitiveList = (list: unknown[]) => list.every((v) => v === null || typeof v !== 'object')

export function findDrift(wrote: unknown, saved: unknown, options: DriftOptions = {}, path: Path = []): Drift[] {
  if (wrote === undefined || wrote === null) return []
  const key = path[path.length - 1]
  if (typeof key === 'string' && options.ignore?.includes(key)) return []
  if (typeof saved === 'number') {
    if (typeof wrote !== 'number' && typeof wrote !== 'string') return []
    if (typeof wrote === 'string' && !wrote.trim()) return []
    return toNumber(wrote) === saved ? [] : [{ path, wrote, saved }]
  }
  if (typeof saved === 'string') {
    if (typeof wrote !== 'string') return []
    const text = wrote.trim()
    if (text === saved) return []
    if (!text) return typeof key === 'string' && options.blankOk?.includes(key) ? [] : [{ path, wrote, saved }]
    return [{ path, wrote, saved }]
  }
  if (Array.isArray(saved)) {
    if (!Array.isArray(wrote)) return []
    if (isPrimitiveList(wrote) && isPrimitiveList(saved)) {
      // Cleaners sort number lists, so order is not a difference; a dropped or changed entry is.
      const a = wrote.map((v) => String(v).trim()).filter(Boolean).sort().join('\u0000')
      const b = saved.map(String).sort().join('\u0000')
      return a === b ? [] : [{ path, wrote, saved }]
    }
    if (wrote.length !== saved.length) return [{ path, wrote: wrote.length, saved: saved.length, rows: true }]
    return saved.flatMap((item, i) => findDrift(wrote[i], item, options, [...path, i]))
  }
  if (saved && typeof saved === 'object') {
    if (typeof wrote !== 'object' || Array.isArray(wrote)) return []
    const source = wrote as Record<string, unknown>
    return Object.entries(saved).flatMap(([name, value]) => findDrift(source[name], value, options, [...path, name]))
  }
  return []
}

function labelOf(path: Path, labels: DriftLabels) {
  const full = path.map((p) => (typeof p === 'number' ? '#' : p)).join('.')
  const row = path.find((p): p is number => typeof p === 'number')
  const prefix = row === undefined ? '' : `${row + 1}. satır · `
  if (labels[full]) return prefix + labels[full]
  const last = [...path].reverse().find((p): p is string => typeof p === 'string')
  return prefix + ((last && labels[last]) || last || 'alan')
}

function explain({ path, wrote, saved, rows }: Drift, labels: DriftLabels) {
  const label = labelOf(path, labels)
  if (rows) return `${path.length ? label : 'Liste'}: ${wrote} satır yazdın, ${saved} tanesi geçerli. Boş ya da aynı olan satırları düzelt.`
  if (Array.isArray(saved)) return `${label}: yazdıklarının bir kısmı geçersiz. Sadece geçerli sayıları, virgülle ayırarak yaz.`
  if (typeof saved === 'string') {
    if (!String(wrote).trim()) return `${label} boş bırakılamaz.`
    const text = String(wrote).trim()
    if (text.length > saved.length && text.startsWith(saved)) return `${label} en fazla ${saved.length} karakter olabilir (yazdığın ${text.length} karakter).`
    return `${label} geçerli değil: "${text.slice(0, 40)}" kabul edilmedi.`
  }
  const n = toNumber(wrote)
  const target = saved as number
  if (!Number.isFinite(n)) return `${label} bir sayı olmalı.`
  if (!Number.isInteger(n) && Number.isInteger(target) && Math.abs(n - target) < 1) return `${label} tam sayı olmalı (yazdığın ${String(wrote).trim()}).`
  if (n > target && Number.isInteger(target) && Math.ceil(n) > target) return `${label} en fazla ${fmt(target)} olabilir (yazdığın ${fmt(n)}).`
  if (n < target && Math.floor(n) < target) return `${label} en az ${fmt(target)} olabilir (yazdığın ${fmt(n)}).`
  return `${label} tam sayı olmalı (yazdığın ${String(wrote).trim()}).`
}

/** A whole number inside the range, or an error that names the field and the limit. */
export function wholeInRange(value: unknown, min: number, max: number, label: string): number {
  const text = typeof value === 'number' ? String(value) : String(value ?? '').trim()
  const n = Number(text.replace(',', '.'))
  if (!text || !Number.isFinite(n)) throw new Error(`${label} bir sayı olmalı.`)
  if (!Number.isInteger(n)) throw new Error(`${label} tam sayı olmalı (yazdığın ${text}).`)
  if (n < min) throw new Error(`${label} en az ${fmt(min)} olabilir (yazdığın ${fmt(n)}).`)
  if (n > max) throw new Error(`${label} en fazla ${fmt(max)} olabilir (yazdığın ${fmt(n)}).`)
  return n
}

/** One sentence naming the first field whose stored value would differ from what was written, or null. */
export function driftMessage(wrote: unknown, saved: unknown, options: DriftOptions = {}): string | null {
  const [first, ...rest] = findDrift(wrote, saved, options)
  if (!first) return null
  const more = rest.length ? ` (${rest.length} alan daha hatalı.)` : ''
  return `${explain(first, options.labels ?? {})}${more} Hiçbir şey kaydedilmedi.`
}
