export const FILTER_PRESETS = [
  {
    id: 'oran',
    label: 'Özel oran',
    hint: 'Özel, süper, artırılmış oran ve boost postları',
    words: ['oran', 'boost', 'odds', 'artırılmış', 'yükseltilmiş'],
  },
  {
    id: 'promo',
    label: 'Promo kod',
    hint: 'Promosyon kodu ve kupon kodu postları',
    words: ['promo', 'kod', 'code', 'kupon'],
  },
  {
    id: 'bonus',
    label: 'Bonus ve freespin',
    hint: 'Bonus, freespin, freebet ve deneme bonusu postları',
    words: ['bonus', 'freespin', 'free spin', 'freebet', 'free bet', 'deneme'],
  },
  {
    id: 'cekilis',
    label: 'Çekiliş ve turnuva',
    hint: 'Çekiliş, giveaway, turnuva ve yarışma postları',
    words: ['çekiliş', 'cekilis', 'giveaway', 'turnuva', 'yarışma', 'yarisma'],
  },
] as const

export type FilterPresetId = (typeof FILTER_PRESETS)[number]['id']

const PRESET_PREFIX = '#'

export function encodeFilter(presets: string[], custom: string) {
  const validPresets = presets.filter((p) => FILTER_PRESETS.some((f) => f.id === p)).map((p) => PRESET_PREFIX + p)
  const customWords = custom
    .split(',')
    .map((w) => w.trim().replace(/^#+/, ''))
    .filter(Boolean)
  return [...new Set([...validPresets, ...customWords])].join(', ')
}

export function decodeFilter(stored: string) {
  const parts = stored
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const presets = parts.filter((p) => p.startsWith(PRESET_PREFIX)).map((p) => p.slice(PRESET_PREFIX.length))
  const custom = parts.filter((p) => !p.startsWith(PRESET_PREFIX))
  return { presets, custom }
}

export function filterWords(stored: string) {
  const { presets, custom } = decodeFilter(stored)
  const presetWords = FILTER_PRESETS.filter((f) => presets.includes(f.id)).flatMap((f) => [...f.words])
  return [...presetWords, ...custom].map((w) => w.toLocaleLowerCase('tr'))
}

export function describeFilter(stored: string) {
  const { presets, custom } = decodeFilter(stored)
  const labels = FILTER_PRESETS.filter((f) => presets.includes(f.id)).map((f) => f.label)
  return [...labels, ...custom.map((w) => `"${w}"`)].join(', ')
}
