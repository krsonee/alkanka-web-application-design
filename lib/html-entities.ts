const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function decodeEntities(input: string) {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] !== '#') return NAMED[code.toLowerCase()] ?? match
    const hex = code[1] === 'x' || code[1] === 'X'
    const n = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10)
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match
  })
}
