'use client'

import { useEffect, useRef } from 'react'
import { linkReferralAction } from '@/app/actions/community'
import { usePoints } from '../points-context'

/** Once a member is signed in, binds the pending invite cookie (set by /davet/[code]) to their account. */
export function ReferralLinker() {
  const { member } = usePoints()
  const done = useRef(false)

  useEffect(() => {
    if (!member || done.current) return
    done.current = true
    void linkReferralAction()
  }, [member])

  return null
}
