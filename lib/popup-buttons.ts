export type PopupButton = {
  text: string;
  url: string;
};

const MAX_BUTTONS = 4;
const MAX_LABEL = 48;

export function isSafePopupUrl(url: string): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "tg:";
  } catch {
    return false;
  }
}

export function normalizePopupButtons(raw: unknown): PopupButton[] {
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

  const out: PopupButton[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const text = String(record.text ?? "").trim().slice(0, MAX_LABEL);
    const url = String(record.url ?? "").trim();
    if (!text || !isSafePopupUrl(url)) continue;
    out.push({ text, url });
    if (out.length >= MAX_BUTTONS) break;
  }
  return out;
}

export function serializePopupButtons(raw: unknown): string {
  return JSON.stringify(normalizePopupButtons(raw));
}
