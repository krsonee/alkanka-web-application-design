import Link from "next/link";
import { SiteFrame } from "@/components/SiteFrame";
import { FeatureHeading } from "@/components/points/FeatureHeading";

export const dynamic = "force-dynamic";

const LINKS = [
  ["/cuzdan", "Cüzdan", "Bakiye ve bütün hareketler"],
  ["/gorevler", "Görevler", "Günlük görevler"],
  ["/market", "Market", "Rozet, hak ve hediyelik"],
  ["/oyunlar/cark", "Çark", "Şans çarkı"],
  ["/oyunlar/zar", "Zar", "Kanka zarı"],
  ["/oyunlar/sandik", "Sandık", "Gizemli sandık"],
  ["/biletler", "Biletler", "Çekilişler"],
  ["/tahminler", "Tahminler", "Maç tahminleri"],
  ["/ozel-oranlar", "Özel oran", "Artırılmış oranlar"],
  ["/kampanyalar", "Kampanyalar", "Aktif kampanyalar"],
  ["/siralama", "Sıralama", "Haftalık liderler"],
];

export default function PointsHubPage() {
  return (
    <SiteFrame>
      <section className="mx-auto max-w-5xl px-4 py-12">
        <FeatureHeading
          title="Puan"
          subtitle="Puan nakit, TL bahis bakiyesi veya kripto ile değiştirilemez."
        />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {LINKS.map(([href, title, text]) => (
            <Link key={href} href={href} className="flex flex-col rounded-xl border border-border bg-card p-4">
              <div className="font-display text-sm font-bold text-primary">{title}</div>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
              <span className="mt-4 text-xs font-bold uppercase tracking-wider text-primary">Aç</span>
            </Link>
          ))}
        </div>
      </section>
    </SiteFrame>
  );
}
