// Tek seferlik: Telegram tarafindaki panel islemlerinde basarili donusleri logged(...) ile sarar. Is bitince silinir.
import { readFileSync, writeFileSync } from 'node:fs'

const ROOT = '/vercel/share/v0-project/app/panel/'
const DRY = process.env.DRY === '1'
const AREA = { posts: 'tg_posts', mod: 'tg_mod', setup: 'telegram', owner: 'telegram' }

// Dosya -> sabit alan (null = blocked('...') cagrisindan okunur)
const files = {
  'telegram-actions.ts': 'telegram',
  'telegram-promo-actions.ts': 'telegram',
  'kankatv-actions.ts': 'telegram',
  'odds-bot-actions.ts': 'telegram',
  'tv-bets-actions.ts': 'telegram',
  'tg-hub-actions.ts': null,
  'tg-resilience-actions.ts': null,
}

// Mesaj dondurmeyen islemler: bu satirdan SONRA log satiri eklenir.
const silent = [
  ["await deleteBot(Number(form.get('id')))", `await logPanel('telegram', 'Bot kaldırıldı', \`Bot #\${Number(form.get('id'))}\`)`],
  ["await setTargetActive(", `await logPanel('telegram', form.get('active') === 'true' ? 'Hedef kanal açıldı' : 'Hedef kanal durduruldu', \`Hedef #\${Number(form.get('id'))}\`)`],
  ["await deleteTarget(", `await logPanel('telegram', 'Hedef kanal silindi', \`Hedef #\${Number(form.get('id'))}\`)`],
  ["await setSourceActive(", `await logPanel('telegram', form.get('active') === 'true' ? 'Kaynak kanal açıldı' : 'Kaynak kanal durduruldu', \`Kaynak #\${Number(form.get('id'))}\`)`],
  ["await deleteSource(", `await logPanel('telegram', 'Kaynak kanal silindi', \`Kaynak #\${Number(form.get('id'))}\`)`],
  ["await getCronKey(true)", `await logPanel('telegram', 'Cron anahtarı yenilendi')`],
  ["await disconnectInviteChannel()", `await logPanel('telegram', 'Masa daveti kanalı ayrıldı')`],
  ["await disconnectChat()", `await logPanel('telegram', 'Site sohbeti grubu ayrıldı')`],
  ["await setOddsSourceActive(", `await logPanel('telegram', form.get('active') === '1' ? 'Özel oran kaynağı açıldı' : 'Özel oran kaynağı durduruldu', \`Kaynak #\${Number(form.get('id'))}\`)`],
  ["await deleteOddsSource(", `await logPanel('telegram', 'Özel oran kaynağı silindi', \`Kaynak #\${Number(form.get('id'))}\`)`],
]

const balanced = (s) => {
  let depth = 0
  let quote = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') quote = c
    else if ('({['.includes(c)) depth++
    else if (')}]'.includes(c)) depth--
    if (depth < 0) return false
  }
  return depth === 0 && !quote
}

for (const [file, fixed] of Object.entries(files)) {
  const path = ROOT + file
  const lines = readFileSync(path, 'utf8').split('\n')
  if (lines.some((l) => l.includes("from '@/lib/panel-log'"))) {
    console.log('atlandi (zaten islenmis):', file)
    continue
  }
  let area = fixed
  let wrapped = 0
  let manual = false
  const skipped = []
  const out = []
  let inDone = false
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    if (/^const done = /.test(line)) inDone = true
    else if (inDone && /^}/.test(line)) inDone = false
    const b = /blocked\('(posts|mod|setup|owner)'\)/.exec(line)
    if (b && !fixed) area = AREA[b[1]]
    const m = /^(\s*(?:if \(.*\) |else )?return )(.+)$/.exec(line)
    if (m && !inDone && (/\bok: true\b/.test(m[2]) || /^done\(/.test(m[2]))) {
      if (balanced(m[2]) && area) {
        line = `${m[1]}logged('${area}', ${m[2]})`
        wrapped++
      } else skipped.push(`${i + 1}: ${line.trim().slice(0, 110)}`)
    } else if (!inDone && /\bok: true\b/.test(line) && !/^\s*(\/\/|\*)/.test(line)) skipped.push(`${i + 1}: ${line.trim().slice(0, 110)}`)
    out.push(line)
    const s = silent.find(([needle]) => line.includes(needle))
    if (s) {
      out.push(/^\s*/.exec(line)[0] + s[1])
      manual = true
      wrapped++
    }
  }
  console.log(`${file}: ${wrapped} satir${skipped.length ? `\n  ELLE BAKILACAK:\n  ${skipped.join('\n  ')}` : ''}`)
  if (DRY) continue
  const names = ['logged', manual ? 'logPanel' : null].filter(Boolean).join(', ')
  out.splice(out.findIndex((l) => l.startsWith('import ')), 0, `import { ${names} } from '@/lib/panel-log'`)
  writeFileSync(path, out.join('\n'))
}
