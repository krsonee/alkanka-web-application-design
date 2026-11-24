import { getContent } from '@/lib/content'

/** The wagering race box on the ranking page: staff can switch it off or reword it while no race is running. */
export type WagerBox = { show: boolean; title: string; text: string; button: string }

export const WAGER_BOX_KEY = 'siralama:cevrim'

export const WAGER_BOX_DEFAULT: WagerBox = {
  show: true,
  title: 'Çevrim yarışı',
  text: 'Sponsor hesabını bağla, veri gelince listeye gir.',
  button: 'Bağla',
}

const LIMITS = { title: 60, text: 200, button: 24 } as const

const line = (value: unknown, max: number, fallback: string) => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
  return text || fallback
}

export function cleanWagerBox(input: unknown): WagerBox {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<Record<keyof WagerBox, unknown>>
  return {
    show: raw.show === undefined ? WAGER_BOX_DEFAULT.show : raw.show === true,
    title: line(raw.title, LIMITS.title, WAGER_BOX_DEFAULT.title),
    text: line(raw.text, LIMITS.text, WAGER_BOX_DEFAULT.text),
    button: line(raw.button, LIMITS.button, WAGER_BOX_DEFAULT.button),
  }
}

export async function getWagerBox(): Promise<WagerBox> {
  return cleanWagerBox(await getContent<WagerBox>(WAGER_BOX_KEY))
}
