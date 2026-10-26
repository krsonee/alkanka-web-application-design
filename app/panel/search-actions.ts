'use server'

import { canPanel } from '@/lib/admin-auth'
import { listMembers } from '@/lib/members-admin'
import { listSites } from '@/lib/sites'
import { listPosts } from '@/lib/blog'

export type SearchHit = {
  kind: 'member' | 'sponsor' | 'post'
  id: string
  title: string
  detail: string
  tab: 'users' | 'sponsors' | 'seo'
  query: string
}

const LIMIT = 5

export async function panelSearchAction(raw: string): Promise<SearchHit[]> {
  const q = raw.trim().slice(0, 80)
  if (q.length < 2) return []
  const needle = q.toLocaleLowerCase('tr')
  const [canMembers, canSponsors, canPosts] = await Promise.all([canPanel('users'), canPanel('sponsors'), canPanel('seo')])

  const [members, sites, posts] = await Promise.all([
    canMembers ? listMembers({ q, status: 'tumu', page: 0 }).then((r) => r.members).catch(() => []) : [],
    canSponsors ? listSites().catch(() => []) : [],
    canPosts ? listPosts({ includeDrafts: true }) : [],
  ])

  const hits: SearchHit[] = []
  for (const m of members.slice(0, LIMIT)) {
    hits.push({ kind: 'member', id: m.id, title: m.name || m.email, detail: m.email, tab: 'users', query: m.email || m.name })
  }
  for (const s of sites.filter((s) => `${s.name} ${s.domain}`.toLocaleLowerCase('tr').includes(needle)).slice(0, LIMIT)) {
    hits.push({ kind: 'sponsor', id: String(s.id), title: s.name, detail: s.domain || s.bonusText, tab: 'sponsors', query: s.name })
  }
  for (const p of posts.filter((p) => `${p.title} ${p.slug}`.toLocaleLowerCase('tr').includes(needle)).slice(0, LIMIT)) {
    hits.push({ kind: 'post', id: String(p.id), title: p.title, detail: p.published ? `/${p.slug}` : 'Taslak', tab: 'seo', query: p.title })
  }
  return hits
}
