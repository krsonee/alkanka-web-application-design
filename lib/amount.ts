const GROUPED = /^\d{1,3}([.,])\d{3}(\1\d{3})*$/

/**
 * Reads a money amount the way it is written in Turkey: "1.250,50", "12.500", "1250,5".
 * A lone separator followed by exactly three digits is a thousands separator, since money
 * never has three decimals. Returns null when the text is not a non-negative amount.
 */
export function parseAmount(raw: string): number | null {
  let v = raw.replace(/\s/g, '')
  if (!v || !/^[\d.,]+$/.test(v)) return null
  const commas = v.split(',').length - 1
  const dots = v.split('.').length - 1
  if (commas && dots) {
    const decimal = v.lastIndexOf(',') > v.lastIndexOf('.') ? ',' : '.'
    const grouping = decimal === ',' ? '.' : ','
    const [whole, fraction, ...rest] = v.split(decimal)
    if (rest.length || !GROUPED.test(whole) || !/^\d+$/.test(fraction)) return null
    v = `${whole.split(grouping).join('')}.${fraction}`
  } else if (GROUPED.test(v)) {
    v = v.replace(/[.,]/g, '')
  } else if (commas + dots > 1) {
    return null
  } else {
    v = v.replace(',', '.')
  }
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

/** The same amount as it should appear in an input: "1250,5". */
export function amountInput(value: number): string {
  return value ? String(value).replace('.', ',') : ''
}
