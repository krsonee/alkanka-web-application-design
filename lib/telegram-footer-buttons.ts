export type FooterButtonLayout = "stack" | "row";
export type FooterButtonStyle = "primary" | "success" | "danger";

export type FooterButton = {
  text: string;
  url: string;
  style: FooterButtonStyle;
};

const MAX_BUTTONS = 8;
const MAX_LABEL = 64;

const STYLE_ALIASES: Record<string, FooterButtonStyle> = {
  primary: "primary",
  mavi: "primary",
  blue: "primary",
  success: "success",
  yesil: "success",
  green: "success",
  danger: "danger",
  kirmizi: "danger",
  red: "danger",
};

function foldTr(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("İ", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");
}

export function normalizeFooterButtonStyle(raw: unknown): FooterButtonStyle {
  return STYLE_ALIASES[foldTr(String(raw ?? "").trim())] ?? "primary";
}

export function isSafeButtonUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "tg:";
  } catch {
    return false;
  }
}

export function normalizeFooterButtons(raw: unknown): FooterButton[] {
  let list: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      list = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];

  const out: FooterButton[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const text = String(record.text ?? "").trim().slice(0, MAX_LABEL);
    const url = String(record.url ?? "").trim();
    if (!text || !isSafeButtonUrl(url)) continue;
    out.push({
      text,
      url,
      style: normalizeFooterButtonStyle(record.style),
    });
    if (out.length >= MAX_BUTTONS) break;
  }
  return out;
}

export function serializeFooterButtons(raw: unknown): string {
  return JSON.stringify(normalizeFooterButtons(raw));
}

export function normalizeFooterButtonLayout(raw: unknown): FooterButtonLayout {
  const value = foldTr(String(raw ?? "").trim());
  if (value === "row" || value === "yan" || value === "yanyana" || value === "horizontal") {
    return "row";
  }
  return "stack";
}

export function footerButtonsToInlineKeyboard(
  buttons: FooterButton[],
  layout: FooterButtonLayout = "stack",
) {
  const perRow = layout === "row" ? 2 : 1;
  const rows: Array<Array<{ text: string; url: string; style: FooterButtonStyle }>> = [];
  for (let i = 0; i < buttons.length; i += perRow) {
    rows.push(
      buttons.slice(i, i + perRow).map((button) => ({
        text: button.text,
        url: button.url,
        style: button.style,
      })),
    );
  }
  return { inline_keyboard: rows };
}
