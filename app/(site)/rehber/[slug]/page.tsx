import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getPost } from '@/lib/blog'
import { BlogBody, bodyWordCount, extractFaq } from '@/lib/blog-format'
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
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url,
      publishedTime: post.createdAt,
      modifiedTime: post.updatedAt,
      images: post.cover ? [post.cover] : undefined,
    },
  }
}

export default async function GuideArticle({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug)
  if (!post) notFound()

  const url = `${SITE_URL}/rehber/${post.slug}`
  const faq = extractFaq(post.body)
  const words = bodyWordCount(post.body)
  const minutes = Math.max(1, Math.round(words / 200))

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Article',
      headline: post.title,
      description: post.excerpt,
      datePublished: post.createdAt,
      dateModified: post.updatedAt,
      wordCount: words,
      mainEntityOfPage: url,
      image: post.cover || `${SITE_URL}/images/og.png`,
      author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Ana sayfa', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Rehber', item: `${SITE_URL}/rehber` },
        { '@type': 'ListItem', position: 3, name: post.title, item: url },
      ],
    },
  ]
  if (faq.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    })
  }

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ '@context': 'https://schema.org', '@graph': graph })} />
      <nav aria-label="Konum" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        <Link href="/rehber" className="hover:text-foreground">
          Tüm rehberler
        </Link>
      </nav>
      <header className="flex flex-col gap-2">
        <h1 className="text-balance text-2xl font-bold leading-tight text-foreground md:text-4xl">{post.title}</h1>
        <p className="text-pretty leading-relaxed text-muted-foreground">{post.excerpt}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{SITE_NAME} ekibi</span>
          <time dateTime={post.updatedAt}>
            Son kontrol: {new Date(post.updatedAt).toLocaleDateString('tr-TR', { dateStyle: 'long' })}
          </time>
          <span>{minutes} dk okuma</span>
        </p>
      </header>
      {post.cover && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-provided cover URL from arbitrary hosts
        <img
          src={post.cover}
          alt={post.title}
          width={1280}
          height={720}
          fetchPriority="high"
          className="aspect-video w-full rounded-2xl border border-border object-cover"
        />
      )}
      <BlogBody body={post.body} />
      <aside className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm leading-relaxed text-secondary-foreground">
        {'+18 — Bu içerik bilgilendirme amaçlıdır. Bonus şartları siteye göre değişebilir, katılmadan önce güncel kuralları kontrol et. Sorumlu oyna, bütçeni aşma.'}
      </aside>
    </article>
  )
}
