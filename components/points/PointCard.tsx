import type { ReactNode } from "react";

export type PointMark = "task" | "market" | "ticket" | "flag" | "odds" | "campaign";

const PHOTO: Record<PointMark, { src: string; position: string }> = {
  task: { src: "/home/altin-card-gorev.jpg", position: "center 35%" },
  market: { src: "/home/altin-card-market.jpg", position: "center 40%" },
  ticket: { src: "/home/altin-card-bilet.jpg", position: "center 30%" },
  flag: { src: "/home/altin-card-tahmin.jpg", position: "center 45%" },
  odds: { src: "/home/altin-slide-tahmin.jpg", position: "center 55%" },
  campaign: { src: "/home/altin-card-cark.jpg", position: "center 40%" },
};

export function PointCard({
  mark,
  title,
  badge,
  text,
  meta,
  action,
  photo: photoOverride,
}: {
  mark: PointMark;
  title: string;
  badge?: string;
  text?: string;
  meta?: string;
  action?: ReactNode;
  photo?: { src: string; position: string };
}) {
  const photo = photoOverride ?? PHOTO[mark];
  const line = text || meta || "";
  return (
    <article className="point-card">
      <div className="point-photo">
        <img src={photo.src} alt="" style={{ objectPosition: photo.position }} />
      </div>
      <div className="point-body">
        <div className="point-card-head">
          <h2 className="point-title">{title}</h2>
          {badge ? <span className="point-badge">{badge}</span> : null}
        </div>
        {line ? <p className="point-line">{line}</p> : null}
        {action ? <div className="point-action">{action}</div> : null}
      </div>
    </article>
  );
}
