export const WHEEL_SEGMENTS = [
  { short: "50", label: "50 Kanka Coin", points: 50, tone: "gold" },
  { short: "2x", label: "2x Boost", points: 120, tone: "muted" },
  { short: "VIP", label: "VIP Geçiş", points: 300, tone: "purple" },
  { short: "Pas", label: "Tekrar dene", points: 0, tone: "muted" },
  { short: "100", label: "100 Kanka Coin", points: 100, tone: "gold" },
  { short: "Kod", label: "Ücretsiz Promo Kod", points: 150, tone: "muted" },
  { short: "250", label: "250 Kanka Coin", points: 250, tone: "gold" },
  { short: "Kutu", label: "Gizemli Kutu", points: 200, tone: "muted" },
] as const;

export type WheelTone = (typeof WHEEL_SEGMENTS)[number]["tone"];

export const CHEST_TABLE = [
  { id: "bronze", name: "Bronz Sandık", odds: "Sık", rewards: [40, 60, 75, 90] },
  { id: "gold", name: "Altın Sandık", odds: "Nadir", rewards: [150, 200, 300, 500] },
  { id: "silver", name: "Gümüş Sandık", odds: "Orta", rewards: [75, 100, 120, 150] },
] as const;

export type ChestId = (typeof CHEST_TABLE)[number]["id"];

const CHEST_LABELS: Record<number, string> = {
  500: "Jackpot! 500 KC",
  300: "VIP Promo Kod + 300 KC",
  200: "24s 2x Boost + 200 KC",
  150: "150 Kanka Coin",
};

export function chestLabel(points: number) {
  return CHEST_LABELS[points] ?? `${points} Kanka Coin`;
}

export function isChestId(value: string): value is ChestId {
  return CHEST_TABLE.some((chest) => chest.id === value);
}

export function diceReward(a: number, b: number) {
  if (a === 6 && b === 6) return { label: "Düşeş! Jackpot Kutusu", points: 400 };
  if (a === b) return { label: `Çift! ${a * 40} Kanka Coin`, points: a * 40 };
  const sum = a + b;
  if (sum >= 10) return { label: `Yüksek atış — ${sum * 10} Kanka Coin`, points: sum * 10 };
  return { label: `${sum * 5} Kanka Coin`, points: sum * 5 };
}

export function wheelIndex(label: string) {
  return WHEEL_SEGMENTS.findIndex((segment) => segment.label === label);
}
