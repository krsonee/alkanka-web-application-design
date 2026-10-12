"use client";

export const LOGO_STORAGE_KEY = "alkanka-logo-v2";

export const LOGO_CHOICES = [
  { id: "site", name: "AL KANKA", image: "/logo.png" },
  { id: "fist", name: "Yumruk", image: "/images/logos/fist.png" },
  { id: "crown", name: "Taç", image: "/images/logos/crown.png" },
  { id: "lion", name: "Aslan", image: "/images/logos/lion.png" },
  { id: "wolf", name: "Kurt", image: "/images/logos/wolf.png" },
  { id: "eagle", name: "Kartal", image: "/images/logos/eagle.png" },
  { id: "coin", name: "Altın para", image: "/images/logos/coin.png" },
  { id: "diamond", name: "Elmas", image: "/images/logos/diamond.png" },
  { id: "laurel", name: "Defne", image: "/images/logos/laurel.png" },
  { id: "bolt", name: "Şimşek", image: "/images/logos/bolt.png" },
  { id: "pro-monogram", name: "AK monogram", image: "/images/logos/pro-monogram.png" },
  { id: "pro-crown", name: "Taçlı A", image: "/images/logos/pro-crown.png" },
  { id: "pro-badge", name: "K arması", image: "/images/logos/pro-badge.png" },
] as const;

export function logoSrc(id: string) {
  return LOGO_CHOICES.find((item) => item.id === id)?.image ?? "/logo.png";
}

export function LogoPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const current = LOGO_CHOICES.find((item) => item.id === value) ?? LOGO_CHOICES[0];

  return (
    <div className="logo-picker">
      <span className="logo-picker-label">Logo seç</span>
      <div role="radiogroup" aria-label="Alkanka logosu" className="logo-picker-grid">
        {LOGO_CHOICES.map((item) => {
          const selected = item.id === current.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={item.name}
              title={item.name}
              onClick={() => onChange(item.id)}
              className={selected ? "logo-choice logo-choice-on" : "logo-choice"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt="" />
            </button>
          );
        })}
      </div>
      <span className="logo-picker-current">Seçili: {current.name}</span>
    </div>
  );
}
