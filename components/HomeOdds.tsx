import Link from "next/link";
import { PointCard } from "@/components/points/PointCard";
import { PENDING_COPY, formatPointsWhen } from "@/lib/points-rules";

export type HomeOddsCard = {
  id: number;
  siteId: number | null;
  siteLabel: string;
  body: string;
  eventAt: string | null;
};

export function HomeOdds({ enabled, cards }: { enabled: boolean; cards: HomeOddsCard[] }) {
  const visible = enabled ? cards : [];

  return (
    <section aria-labelledby="ozel-oranlar" className="mt-8">
      <div className="page-head">
        <h2 id="ozel-oranlar" className="text-2xl font-black uppercase tracking-wide sm:text-3xl">
          <span className="gold-text">Özel oranlar</span>
        </h2>
      </div>

      {visible.length === 0 ? (
        <p className="page-head-line mt-4 font-semibold text-[#e8d9a8]">
          {enabled ? PENDING_COPY : "Bu bölüm şu an kapalı."}
        </p>
      ) : (
        <ul className="point-grid">
          {visible.map((card) => (
            <li key={card.id}>
              <PointCard
                mark="odds"
                title={card.siteLabel}
                badge="Özel oran"
                text={card.body}
                meta={card.eventAt ? formatPointsWhen(card.eventAt) : undefined}
                action={
                  card.siteId ? (
                    <Link href={`/go/${card.siteId}`} className="btn btn-gold btn-sm w-full">
                      Siteye git
                    </Link>
                  ) : null
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
