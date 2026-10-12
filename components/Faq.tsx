import { ChevronIcon } from "@/components/icons";
import { TrackedLink } from "@/components/SiteAnalytics";
import { slugify } from "@/lib/slug";
import type { Faq } from "@/db/schema";

type Props = {
  items: Faq[];
  telegramUrl?: string;
  className?: string;
};

export function FaqSection({ items, telegramUrl, className }: Props) {
  if (items.length === 0) return null;

  const categories: { name: string; entries: Faq[] }[] = [];
  for (const item of items) {
    const bucket = categories.find((c) => c.name === item.category);
    if (bucket) bucket.entries.push(item);
    else categories.push({ name: item.category, entries: [item] });
  }

  return (
    <section
      id="sss"
      aria-labelledby="sss-baslik"
      className={className ?? "mx-auto max-w-4xl px-4 pb-16"}
    >
      <div className="page-head">
        <h2
          id="sss-baslik"
          className="text-2xl font-black uppercase tracking-wide sm:text-3xl"
        >
          <span className="gold-text">Sıkça Sorulan Sorular</span>
        </h2>
        <p className="page-head-line">
          Deneme bonusu, çevrim şartı, para çekme süreleri ve güncel giriş
          adresleri hakkında en çok sorulan {items.length} soruyu yanıtladık.
        </p>
      </div>

      <nav
        aria-label="Soru kategorileri"
        className="mt-5 flex flex-wrap gap-2"
      >
        {categories.map((category) => (
          <a
            key={category.name}
            href={`#sss-${slugify(category.name)}`}
            className="rounded-full border border-[#d4af37]/30 bg-[#121827] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#b8c0d4] transition-colors hover:border-[#d4af37] hover:text-[#f2c94c]"
          >
            {category.name}
          </a>
        ))}
      </nav>

      {categories.map((category) => (
        <div
          key={category.name}
          id={`sss-${slugify(category.name)}`}
          className="mt-10 scroll-mt-24"
        >
          <h3 className="mb-4 flex items-center gap-3 text-sm font-black uppercase tracking-[0.18em] text-[#f2c94c]">
            {category.name}
            <span className="h-px flex-1 bg-[#d4af37]/20" />
          </h3>
          <div className="space-y-3">
            {category.entries.map((entry) => (
              <details
                key={entry.id}
                id={entry.slug || undefined}
                className="card-surface group scroll-mt-24 rounded-2xl p-5"
              >
                <summary className="flex cursor-pointer list-none items-start gap-3">
                  <ChevronIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#d4af37] transition-transform duration-200 group-open:rotate-90" />
                  <h4 className="text-sm font-bold text-white sm:text-base">
                    {entry.question}
                  </h4>
                </summary>
                <p className="mt-3 pl-7 text-sm leading-relaxed text-[#b8c0d4]">
                  {entry.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      ))}

      {telegramUrl ? (
        <div className="mt-10 rounded-2xl border border-[#d4af37]/25 bg-[#0d1220] p-6 text-center">
          <p className="text-sm text-[#b8c0d4]">
            Sorunuzun yanıtı burada yoksa doğrudan bize sorun. Ödeme sorunlarını
            ilgili sitenin temsilcisine biz iletiyoruz.
          </p>
          <TrackedLink
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            track={{ target: "faq_telegram", label: "Telegram (S.S.S.)" }}
            className="mt-4 inline-block rounded-xl gold-gradient px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider text-black transition-opacity hover:opacity-90"
          >
            Telegram’dan Sor
          </TrackedLink>
        </div>
      ) : null}
    </section>
  );
}
