import type { ComponentProps } from 'react'
import { getContent, withoutEmpty, type HeroOverride } from '@/lib/content'
import { JAKO_POSES } from '@/lib/site-registry'
import { PageHero } from './page-hero'
import type { JakoPose } from './jako'

type Props = ComponentProps<typeof PageHero> & { slug: string }

export async function EditableHero({ slug, ...defaults }: Props) {
  const { pose, ...override } = withoutEmpty(await getContent<HeroOverride>(`hero:${slug}`))
  const validPose = pose && (JAKO_POSES as readonly string[]).includes(pose) ? (pose as JakoPose) : undefined
  return <PageHero {...defaults} {...override} pose={validPose ?? defaults.pose} />
}
