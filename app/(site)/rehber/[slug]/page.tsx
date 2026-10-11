import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getPost, parseBody } from '@/lib/blog'
import { jsonLd, SITE_NAME, SITE_URL } from '@/lib/seo'

export const revalidate = 600

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = await getPost((await params).slug)
  if (!post) return { title: 'Yazı bulunamadı', robots: { index: false } }
  const url = `/rehber/${post.slug}`
  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.keywords ? post.keywords.split(',').map((k) => k.trim()).filter(Boolean) : undefined,
    alternates: { canonical: url },
    openGraph: { type: 'article', title: post.title, description: post.excerpt, url, images: post.cover ? [post.cover] : undefined },
  }
}

export default async function GuideArticle({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug)
  if (!post) notFound()

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    image: post.cover || `${SITE_URL}/images/og.png`,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  }

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <Link href="/rehber" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Tüm rehberler
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-balance text-2xl font-bold leading-tight text-foreground md:text-4xl">{post.title}</h1>
        <p className="text-pretty leading-relaxed text-muted-foreground">{post.excerpt}</p>
        <time dateTime={post.updatedAt} className="text-sm text-muted-foreground">
          Güncellendi: {new Date(post.updatedAt).toLocaleDateString('tr-TR', { dateStyle: 'long' })}
        </time>
      </header>
      {post.cover && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-provided cover URL
        <img src={post.cover} alt={post.title} className="aspect-video w-full rounded-2xl border border-border object-cover" />
      )}
      <div className="flex flex-col gap-4 leading-relaxed text-foreground">
        {parseBody(post.body).map((block, i) =>
          block.type === 'h2' ? (
            <h2 key={i} className="mt-2 text-balance text-xl font-bold">{block.text}</h2>
          ) : block.type === 'ul' ? (
            <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5">
              {block.items.map((item, j) => <li key={j}>{item}</li>)}
            </ul>
          ) : (
            <p key={i} className="text-pretty">{block.text}</p>
          ),
        )}
      </div>
    </article>
  )
}
