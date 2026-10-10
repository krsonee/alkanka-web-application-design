export function splitMatch(match: string): [string, string] {
  const [home = match, away = ''] = match.split(' - ').map((t) => t.trim())
  return [home, away]
}
