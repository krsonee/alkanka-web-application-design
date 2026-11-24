'use client'

import { useState } from 'react'
import { playBotsNow } from '@/app/actions/arena'
import type { SetupConfig, WizardGame } from '@/lib/home-v2-shared'
import { usePoints } from '../points-context'
import { TableSetupWizard } from './table-setup-wizard'

/** "Bota karşı oyna": the member picks the rules first, then the table opens with a bot in every other seat. */
export function BotSetup({
  game,
  stake,
  setup,
  bets,
  commission,
  onClose,
  onTable,
}: {
  game: WizardGame
  stake: number
  setup: SetupConfig
  bets: number[]
  commission: number
  onClose: () => void
  onTable: (id: string) => void
}) {
  const { member, points, requireLogin, refresh } = usePoints()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <TableSetupWizard
      game={game}
      config={setup}
      bets={bets}
      balance={member ? points : null}
      commission={commission}
      busy={busy}
      error={error}
      solo={{ stake }}
      onClose={onClose}
      onCreate={async (bet, options) => {
        if (busy || !requireLogin()) return
        setBusy(true)
        setError(null)
        const res = await playBotsNow(game, bet, options)
        setBusy(false)
        refresh()
        if (!res.ok) return setError(res.error ?? 'Bir hata oluştu.')
        onTable(res.id)
      }}
    />
  )
}
