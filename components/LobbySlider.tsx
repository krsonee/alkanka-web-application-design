"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HomeSlide } from "@/lib/home-visuals";

export function LobbySlider({ slides }: { slides: HomeSlide[] }) {
  const [index, setIndex] = useState(0);
  const count = slides.length || 1;
  const slide = slides[index] ?? slides[0];

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (!slide) return null;

  function step(dir: number) {
    setIndex((current) => (current + dir + count) % count);
  }

  return (
    <section className="lobby-slider" aria-roledescription="carousel" aria-label="Öne çıkanlar">
      <div className="lobby-slide">
        {slide.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.imageUrl} alt="" className="lobby-bleed" />
        ) : null}
        <div className="lobby-copy">
          <h2 className="text-2xl font-black leading-none text-white sm:text-3xl">{slide.title}</h2>
          {slide.line ? <p className="mt-1 max-w-xl text-xs leading-snug text-white sm:text-sm">{slide.line}</p> : null}
          <Link href={slide.href} className="btn btn-gold btn-sm mt-2 w-fit">
            {slide.buttonLabel}
          </Link>
        </div>
      </div>
      {slides.length > 1 ? (
        <>
          <button type="button" className="lobby-nav lobby-nav-prev" aria-label="Önceki" onClick={() => step(-1)}>
            ‹
          </button>
          <button type="button" className="lobby-nav lobby-nav-next" aria-label="Sonraki" onClick={() => step(1)}>
            ›
          </button>
          <div className="lobby-dots" role="tablist" aria-label="Slaytlar">
            {slides.map((item, i) => (
              <button
                key={`${item.id}-${item.href}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={item.title}
                className={i === index ? "lobby-dot lobby-dot-on" : "lobby-dot"}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
