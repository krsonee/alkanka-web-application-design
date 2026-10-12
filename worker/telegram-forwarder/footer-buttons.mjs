const MAX_BUTTONS = 8;
const MAX_LABEL = 64;

const STYLE_ALIASES = {
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

function foldTr(value) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("İ", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");
}

export function normalizeFooterButtonStyle(raw) {
  return STYLE_ALIASES[foldTr(raw).trim()] || "primary";
}

export function isSafeButtonUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "tg:";
  } catch {
    return false;
  }
}

export function normalizeFooterButtons(raw) {
  let list = raw;
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

  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const text = String(item.text ?? "").trim().slice(0, MAX_LABEL);
    const url = String(item.url ?? "").trim();
    if (!text || !isSafeButtonUrl(url)) continue;
    out.push({
      text,
      url,
      style: normalizeFooterButtonStyle(item.style),
    });
    if (out.length >= MAX_BUTTONS) break;
  }
  return out;
}

export function serializeFooterButtons(raw) {
  return JSON.stringify(normalizeFooterButtons(raw));
}

export function normalizeFooterButtonLayout(raw) {
  const value = foldTr(raw).trim();
  if (value === "row" || value === "yan" || value === "yanyana" || value === "horizontal") {
    return "row";
  }
  return "stack";
}

export function footerButtonsToInlineKeyboard(buttons, layout = "stack") {
  const perRow = layout === "row" ? 2 : 1;
  const rows = [];
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

export function parseButtonMessage(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || trimmed === "-") return [];
  return normalizeFooterButtons(
    trimmed.split(/\r?\n/).map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      return { text: parts[0] || "", url: parts[1] || "", style: parts[2] || "primary" };
    }),
  );
}

export function buttonHelpHtml() {
  return `Postun altına eklenecek <b>renkli butonları</b> gönderin. Her satır:
<code>Metin | https://adres | yesil</code>

Renk: <code>mavi</code> · <code>yesil</code> · <code>kirmizi</code>
Birden fazla satır gönderebilirsiniz. Atlamak için <code>-</code> yazın.`;
}

export function layoutHelpHtml() {
  return `Butonlar nasıl dizilsin?

<code>alt</code> → alt alta (önerilen)
<code>yan</code> → yan yana`;
}

export function formatLayoutLabel(layout) {
  return normalizeFooterButtonLayout(layout) === "row" ? "yan yana" : "alt alta";
}

export function formatButtonsHtml(buttons, esc, layout) {
  const list = normalizeFooterButtons(buttons);
  if (!list.length) return "<i>Alt buton yok</i>";
  const label = { primary: "mavi", success: "yeşil", danger: "kırmızı" };
  const lines = list.map((button) => `• ${esc(button.text)} <i>(${label[button.style]})</i>`);
  return `${lines.join("\n")}\n<i>Düzen: ${formatLayoutLabel(layout)}</i>`;
}
