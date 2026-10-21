import { loadTgHub } from '@/lib/tg-hub-panel'
import { listBots } from '@/lib/telegram-mirror'
import { hubTick } from '@/lib/tg-hub-jobs'

async function main() {
  const bots = await listBots()
  const d = await loadTgHub(bots, null, 0)
  console.log('bots', bots.length, 'groups', d.hub.groups.length, 'stats', JSON.stringify(d.stats), 'tickets', d.tickets.length, 'log', d.log.length, 'leaders', d.leaders.length)
  console.log('jobs', JSON.stringify(await hubTick()))
}
main().then(() => process.exit(0)).catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
