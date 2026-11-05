'use client'

import { HeadGame } from '@/components/alkanka/arena/head-game'

export default function HeadTestPage() {
  return (
    <main className="mx-auto max-w-4xl p-4">
      <HeadGame sport="futbol" mode="bot" names={['Sen', 'Kartal Bot']} onEnd={() => {}} />
    </main>
  )
}
