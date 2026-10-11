import Link from 'next/link'
import { PageHero } from '@/components/alkanka/page-hero'
import { listPosts } from '@/lib/blog'
import { pageMeta } from '@/lib/seo'

export const metadata = pageMeta('rehber')
export const revalidate = 600

export default async function GuidePage() {
  const posts = await listPosts()
  return (
    <>
      <PageHero
        eyebrow="Rehber"
        title="Bonus, promo kod ve kampanya rehberleri"
        description="Bonusları nasıl alacağını, promo kodları nerede kullanacağını ve kampanyalardan en iyi şekilde nasıl yararlanacağını adım adım anlatıyoruz."
        image="/images/heroes/sss.png"
      />
      {posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm leading-relaxed text-muted-foreground">
          İlk rehberler yakında burada.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/rehber/${p.slug}`}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary"
              >
                {p.cover && (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-provided cover URL
                  <img src={p.cover} alt="" className="aspect-video w-full object-cover" />
                )}
                <div className="flex flex-col gap-2 p-4">
                  <h2 className="text-pretty font-semibold leading-snug text-card-foreground">{p.title}</h2>
                  <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{p.excerpt}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
