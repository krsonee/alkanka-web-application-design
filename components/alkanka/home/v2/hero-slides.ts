import type { HomeSlide, SlideLook } from '@/lib/custom-slides'
import { HOME_GAME_LABEL } from '@/lib/home-v2-shared'

/** One slide of the home hero, as both the guest and the member slider read it. */
export type HeroSlide = {
  id: string
  look: SlideLook
  game: string | null
  /** Short name on the slide's button under the slider. */
  label: string
  /** What a screen reader says for a banner that has no words of its own on the page. */
  name: string
  thumb: string
  image: string
  mobileImage?: string
  href: string
  eyebrow: string
  title: string
  description: string
  cta: string
}

export function toHeroSlides(slides: HomeSlide[]): HeroSlide[] {
  return slides.map((slide) => {
    const gameLabel = slide.game ? HOME_GAME_LABEL[slide.game] : undefined
    const label = (slide.look === 'cover' ? gameLabel : slide.eyebrow || slide.title) || gameLabel || 'Afiş'
    return {
      id: slide.id,
      look: slide.look,
      game: slide.game,
      label,
      name: slide.title || label,
      thumb: slide.game ? `/images/games/${slide.game}.png` : slide.mobileImage || slide.image,
      image: slide.image,
      mobileImage: slide.mobileImage,
      href: slide.href,
      eyebrow: slide.eyebrow,
      title: slide.title,
      description: slide.description,
      cta: slide.cta,
    }
  })
}
