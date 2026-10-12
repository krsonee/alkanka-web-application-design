import type { Site } from "@/db/schema";

/**
 * Tarayıcıya gönderilen alanlar. Affiliate bağlantısı (url), doğrudan giriş
 * adresi (entryUrl), alan adı ve tıklama sayısı kasıtlı olarak dışarıda
 * bırakılır; bunlar sunucuda kalır ve yönlendirme /go/[id] üzerinden yapılır.
 */
export type PublicSite = {
  id: number;
  name: string;
  logoUrl: string;
  bonusText: string;
  badge: string;
  featured: boolean;
  hasDirectEntry: boolean;
};

export function toPublicSite(site: Site): PublicSite {
  return {
    id: site.id,
    name: site.name,
    logoUrl: site.logoUrl,
    bonusText: site.bonusText,
    badge: site.badge,
    featured: site.featured,
    hasDirectEntry: Boolean(site.entryUrl) && site.entryUrl !== site.url,
  };
}
