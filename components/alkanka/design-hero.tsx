import { heroById } from "@/lib/design-content";
import { getDesignContent } from "@/lib/load-design-content";
import { PageHero, type HeroStat } from "./page-hero";
import type { ReactNode } from "react";

export async function DesignHero({
  id,
  stats,
  tone,
  children,
}: {
  id: string;
  stats?: HeroStat[];
  tone?: "gold" | "accent" | "live";
  children?: ReactNode;
}) {
  const hero = heroById(await getDesignContent(), id);
  return (
    <PageHero
      image={hero.image}
      eyebrow={hero.eyebrow}
      title={hero.title}
      description={hero.description}
      stats={stats}
      tone={tone}
    >
      {children}
    </PageHero>
  );
}
