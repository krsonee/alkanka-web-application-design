'use client'

import { useEffect, useState } from 'react'
import { TournamentCard } from '@/components/alkanka/arena/tournament-card'
import { TournamentManager } from '@/components/panel/tournament-manager'
import { createBracket, createTableBracket, setMatchWinner, setTableResult, type Bracket } from '@/lib/bracket'
import type { Tournament } from '@/lib/tournaments-shared'

const keys = (n: number) => Array.from({ length: n }, (_, i) => `k${i + 1}`)
const people = (n: number) => ({
  entries: keys(n).map((k, i) => ({ id: i + 1, userId: k, nickname: `Kanka ${i + 1}`, telegram: '', createdAt: new Date().toISOString() })),
  names: Object.fromEntries(keys(n).map((k, i) => [k, `Kanka ${i + 1}`])),
})
const base = {
  description: 'Deneme turnuvası.',
  rules: '',
  entryFee: 100,
  prizeNote: '',
  startsAt: new Date(Date.now() + 3600_000).toISOString(),
  endsAt: new Date(Date.now() + 4 * 3600_000).toISOString(),
  joinMinutes: 5,
  finishedAt: null,
  finishReason: null,
  winner: null,
  liveMatches: [],
  currentRound: null,
} as const

function build(): Tournament[] {
  const named = (b: Bracket, r: number, m: number) => b.rounds[r][m].players.filter((p): p is string => Boolean(p))
  let running = createTableBracket(keys(9), 4, 2)
  const played = running.rounds[0].findIndex((m) => m.players.filter(Boolean).length === 3)
  const three = named(running, 0, played)
  running = setTableResult(running, 0, played, three, three.slice(0, 2))

  let over = createTableBracket(keys(8), 4, 2)
  for (const m of [0, 1]) {
    const p = named(over, 0, m)
    over = setTableResult(over, 0, m, p, p.slice(0, 2), m === 1 ? [p[3]] : [])
  }
  const final = named(over, 1, 0)
  over = setTableResult(over, 1, 0, final, [final[0]])

  let duel = createBracket(keys(4), 2)
  duel = setMatchWinner(duel, 0, 0, duel.rounds[0][0].players[0])

  return [
    { ...base, id: 901, game: 'pisti', title: 'Pişti Masa Kupası', prizes: [5000, 2500, 1500, 1000, 250], prizePool: 11000, maxPlayers: 16, tableSize: 4, status: 'kayit', format: 'eleme', bracket: null, ...people(5) },
    {
      ...base,
      id: 902,
      game: 'batak',
      title: 'Batak Gecesi',
      prizes: [5000, 2500, 1500, 1000, 250],
      prizePool: 11000,
      maxPlayers: 16,
      tableSize: 4,
      status: 'basladi',
      format: 'eleme',
      bracket: running,
      currentRound: 1,
      liveMatches: running.rounds[1].map((m, i) => ({ tableId: `t${i}`, round: 1, match: i, players: m.players.filter((p): p is string => Boolean(p)), status: 'oynaniyor' })),
      ...people(9),
    },
    {
      ...base,
      id: 903,
      game: 'okey101',
      title: '101 Okey Finali',
      prizes: [5000, 2500, 1500, 1000, 250],
      prizePool: 11000,
      maxPlayers: 8,
      tableSize: 4,
      status: 'bitti',
      format: 'eleme',
      bracket: over,
      winner: `Kanka ${final[0].slice(1)}`,
      finishReason: 'tamam',
      finishedAt: new Date().toISOString(),
      ...people(8),
    },
    {
      ...base,
      id: 904,
      game: 'tavla',
      title: 'Tavla Kupası',
      prizes: [3000, 1500, 500],
      prizePool: 5500,
      maxPlayers: 4,
      tableSize: 2,
      status: 'basladi',
      format: 'eleme',
      bracket: duel,
      currentRound: 0,
      liveMatches: [{ tableId: 'd1', round: 0, match: 1, players: duel.rounds[0][1].players as string[], status: 'oynaniyor' }],
      ...people(4),
    },
  ]
}

export default function Page() {
  const [list, setList] = useState<Tournament[]>([])
  const [panel, setPanel] = useState(false)
  useEffect(() => {
    setList(build())
    setPanel(new URLSearchParams(window.location.search).has('panel'))
  }, [])
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4">
      {panel ? <TournamentManager tournaments={list} /> : list.map((t) => <TournamentCard key={t.id} t={t} />)}
    </main>
  )
}
