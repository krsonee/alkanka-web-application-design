import { notFound } from 'next/navigation'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { extraHeroes, getAllContent, type HeroOverride } from '@/lib/content'

export default async function CustomHeroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) notFound()
  const content = await getAllContent()
  const hit = extraHeroes(content).find((item) => item.slug === slug)
  if (!hit) notFound()
  const saved = (content[`hero:${slug}`] as HeroOverride | undefined) ?? {}
  return (
    <EditableHero
      slug={slug}
      image={saved.image || '/images/banner-events.png'}
      eyebrow={saved.eyebrow || hit.label}
      title={saved.title || hit.label}
      description={saved.description || ''}
      speech={saved.speech}
      pose="jako"
    />
  )
}
