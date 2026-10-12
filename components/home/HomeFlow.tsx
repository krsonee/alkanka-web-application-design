import Link from "next/link";
import { TrackedLink } from "@/components/SiteAnalytics";
import { PlayStage } from "@/components/home/PlayStage";
import type { LiveMove } from "@/lib/engage";

function safeHttp(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.toString();
  } catch {
    /* geçersiz adres gösterilmez */
  }
  return "";
}

function bonusLabel(raw: string) {
  const text = raw.trim();
  if (!text) return "";
  if (text.includes("%")) return text;
  if (/^\d+([.,]\d+)?$/.test(text)) return `%${text}`;
  return text;
}

export function HomeFlow({
  telegramUrl,
  announceUrl,
  promoCode,
  heroImage,
  campaignImage,
  partnerBrand,
  partnerUrl,
  partnerBonus,
  moves,
  loggedIn,
  openedChest,
}: {
  telegramUrl: string;
  announceUrl: string;
  promoCode: string;
  heroImage: string;
  campaignImage: string;
  partnerBrand: string;
  partnerUrl: string;
  partnerBonus: string;
  moves: LiveMove[];
  loggedIn: boolean;
  openedChest: { chest: string; label: string; points: number } | null;
}) {
  const announce = safeHttp(announceUrl) || safeHttp(telegramUrl);
  const partnerHref = safeHttp(partnerUrl);
  const bonus = bonusLabel(partnerBonus);
  const loop = moves.length > 0 ? [...moves, ...moves] : [];

  return (
    <div className="home-flow">
      {heroImage ? (
        <figure className="home-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroImage} alt="" />
        </figure>
      ) : null}

      <section className="announce-strip" aria-label="Telegram duyurusu">
        <span className="announce-kicker">Telegram</span>
        {announce ? (
          <TrackedLink
            href={announce}
            target="_blank"
            rel="noopener noreferrer"
            track={{ target: "telegram", label: "Telegram duyuru şeridi" }}
            className="announce-link"
          >
            Duyuruyu aç
          </TrackedLink>
        ) : (
          <span className="announce-link">Duyuru linki panelden eklenir.</span>
        )}
        {promoCode ? <span className="promo-chip">Kod: {promoCode}</span> : null}
      </section>

      <section className="live-strip" aria-label="Canlı hareket">
        <span className="live-kicker">
          <span className="live-dot" aria-hidden="true" />
          Canlı
        </span>
        {loop.length > 0 ? (
          <div className="live-mask">
            <ul className="live-track animate-marquee">
              {loop.map((move, index) => (
                <li key={`${move.kind}-${move.username}-${move.label}-${index}`}>
                  <span>{move.username}</span>
                  <span>{move.kind === "sandik" ? "sandık" : "çark"}</span>
                  <span>{move.label}</span>
                  {move.points > 0 ? <strong>+{move.points}</strong> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="live-empty">Çark ve sandık hareketi burada görünecek.</p>
        )}
      </section>

      <PlayStage loggedIn={loggedIn} opened={openedChest} />

      {campaignImage || partnerBrand ? (
        <section className="partner-row">
          {campaignImage ? (
            <figure className="home-campaign">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={campaignImage} alt="" />
            </figure>
          ) : null}
          {partnerBrand ? (
            <div className="partner-copy">
              <p className="partner-kicker">Ortak</p>
              <h2>{partnerBrand}</h2>
              {bonus ? <p className="partner-bonus">{bonus} bonus</p> : null}
              {partnerHref ? (
                <Link href={partnerHref} target="_blank" rel="noopener noreferrer" className="btn btn-gold btn-sm">
                  Siteye git
                </Link>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
