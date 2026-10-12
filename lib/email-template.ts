const SITE_NAME = "AL KANKA";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://alkanka.com";

export const EMAIL_LAYOUTS = ["promo", "announcement", "simple"] as const;
export type EmailLayout = (typeof EMAIL_LAYOUTS)[number];

export const EMAIL_BODY_STYLES = [
  ["paragraphs", "Düz paragraflar"],
  ["center", "Ortalı yazı"],
  ["bold", "Kalın yazı"],
  ["boldCenter", "Kalın ve ortalı"],
  ["goldCenter", "Altın şekilli başlık"],
  ["elegant", "Şekilli davet yazısı"],
  ["lead", "Öne çıkan giriş"],
  ["highlight", "Vurgulu kutu"],
  ["bullets", "Madde listesi"],
  ["numbered", "Numaralı adımlar"],
  ["notice", "Duyuru bandı"],
  ["cards", "Kart blokları"],
  ["spotlight", "Son cümle vurgusu"],
] as const;

export type EmailBodyStyle = (typeof EMAIL_BODY_STYLES)[number][0];

export function normalizeEmailBodyStyle(value: unknown): EmailBodyStyle {
  const style = String(value ?? "").trim();
  return EMAIL_BODY_STYLES.some(([id]) => id === style)
    ? (style as EmailBodyStyle)
    : "paragraphs";
}

export type EmailTemplateFields = {
  subject: string;
  preheader: string;
  layout: EmailLayout;
  headline: string;
  bodyText: string;
  bodyStyle: EmailBodyStyle;
  imageUrl: string;
  ctaText: string;
  ctaUrl: string;
  footerNote: string;
};

const MAX = {
  name: 80,
  subject: 180,
  preheader: 140,
  headline: 160,
  bodyText: 8000,
  imageUrl: 500,
  ctaText: 48,
  ctaUrl: 500,
  footerNote: 400,
};

export function normalizeEmailLayout(value: unknown): EmailLayout {
  const layout = String(value ?? "").trim();
  return EMAIL_LAYOUTS.includes(layout as EmailLayout)
    ? (layout as EmailLayout)
    : "promo";
}

export function isSafeEmailUrl(url: string): boolean {
  if (!url) return true;
  if (url.startsWith("/") && !url.startsWith("//")) {
    return /^\/[A-Za-z0-9/_\-.]+$/.test(url);
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function toAbsoluteUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return `${SITE_URL}${trimmed}`;
  return trimmed;
}

function clip(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export function normalizeEmailFields(raw: Record<string, unknown>): EmailTemplateFields {
  const imageUrl = clip(raw.imageUrl, MAX.imageUrl);
  const ctaUrl = clip(raw.ctaUrl, MAX.ctaUrl);
  return {
    subject: clip(raw.subject, MAX.subject),
    preheader: clip(raw.preheader, MAX.preheader),
    layout: normalizeEmailLayout(raw.layout),
    headline: clip(raw.headline, MAX.headline),
    bodyText: clip(raw.bodyText, MAX.bodyText),
    bodyStyle: normalizeEmailBodyStyle(raw.bodyStyle),
    imageUrl: isSafeEmailUrl(imageUrl) ? imageUrl : "",
    ctaText: clip(raw.ctaText, MAX.ctaText),
    ctaUrl: isSafeEmailUrl(ctaUrl) ? ctaUrl : "",
    footerNote: clip(raw.footerNote, MAX.footerNote),
  };
}

export function normalizeTemplateName(value: unknown) {
  return clip(value, MAX.name);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitBlocks(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const byBlank = trimmed.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (byBlank.length > 1) return byBlank;
  const byLine = trimmed.split(/\n/).map((part) => part.trim()).filter(Boolean);
  if (byLine.length > 1) return byLine;
  return trimmed
    .split(/(?<=[.!?…])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function paragraph(text: string, extra = "") {
  return `<p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#d5dbe8;${extra}">${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;
}

function wrapLine(text: string, width: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function wrapBlock(text: string, width = 68) {
  return text
    .split(/\n/)
    .map((line) => {
      const trimmed = line.trimEnd();
      if (!trimmed.trim()) return "";
      if (/^https?:\/\//i.test(trimmed.trim()) || trimmed.length <= width) {
        return trimmed;
      }
      return wrapLine(trimmed, width).join("\n");
    })
    .join("\n");
}

function prefixWrap(prefix: string, text: string, hang?: string) {
  const indent = hang ?? " ".repeat(prefix.length);
  const innerWidth = Math.max(24, 68 - prefix.length);
  return wrapBlock(text, innerWidth)
    .split("\n")
    .map((line, index) => (index === 0 ? `${prefix}${line}` : `${indent}${line}`))
    .join("\n");
}

function boxBlock(text: string) {
  const inner = wrapBlock(text, 62).split("\n");
  const width = Math.max(20, ...inner.map((line) => line.length));
  const top = `┌${"─".repeat(width + 2)}┐`;
  const bottom = `└${"─".repeat(width + 2)}┘`;
  const mid = inner.map((line) => `│ ${line.padEnd(width, " ")} │`).join("\n");
  return `${top}\n${mid}\n${bottom}`;
}

function compileBodyText(text: string, style: EmailBodyStyle) {
  const blocks = splitBlocks(text);
  if (blocks.length === 0) return "";

  if (style === "center" || style === "bold" || style === "boldCenter") {
    return blocks.map((block) => wrapBlock(block)).join("\n\n");
  }

  if (style === "goldCenter") {
    const [first, ...rest] = blocks;
    return [
      `★  ${first}  ★`,
      ...rest.map((block) => wrapBlock(block)),
    ].join("\n\n");
  }

  if (style === "elegant") {
    const [first, ...rest] = blocks;
    return [
      `·  ${first.toLocaleUpperCase("tr")}  ·`,
      ...rest.map((block) => wrapBlock(block)),
    ].join("\n\n");
  }

  if (style === "lead") {
    const [first, ...rest] = blocks;
    return [wrapBlock(first), ...rest.map((block) => wrapBlock(block))].join("\n\n");
  }

  if (style === "highlight") {
    return boxBlock(blocks.join("\n\n"));
  }

  if (style === "bullets") {
    return blocks.map((block) => prefixWrap("  •  ", block, "     ")).join("\n\n");
  }

  if (style === "numbered") {
    return blocks
      .map((block, index) =>
        prefixWrap(`  ${String(index + 1).padStart(2, " ")}.  `, block, "       "),
      )
      .join("\n\n");
  }

  if (style === "notice") {
    const [first, ...rest] = blocks;
    return [
      "[ DUYURU ]",
      wrapBlock(first),
      ...rest.map((block) => wrapBlock(block)),
    ].join("\n\n");
  }

  if (style === "cards") {
    return blocks.map((block) => prefixWrap("  ▎  ", block, "     ")).join("\n\n");
  }

  if (style === "spotlight") {
    if (blocks.length === 1) return `★  ${wrapBlock(blocks[0])}`;
    const last = blocks[blocks.length - 1];
    const rest = blocks.slice(0, -1);
    return [...rest.map((block) => wrapBlock(block)), `★  ${wrapBlock(last)}`].join("\n\n");
  }

  return blocks.map((block) => wrapBlock(block)).join("\n\n");
}

function compileBodyHtml(text: string, style: EmailBodyStyle) {
  const blocks = splitBlocks(text);
  if (blocks.length === 0) return "";

  if (style === "center") {
    return blocks.map((block) => paragraph(block, "text-align:center;")).join("");
  }

  if (style === "bold") {
    return blocks
      .map((block) => paragraph(block, "font-weight:800;color:#ffffff;"))
      .join("");
  }

  if (style === "boldCenter") {
    return blocks
      .map(
        (block) =>
          paragraph(block, "font-weight:800;text-align:center;color:#ffffff;font-size:17px;line-height:26px;"),
      )
      .join("");
  }

  if (style === "goldCenter") {
    const [first, ...rest] = blocks;
    return (
      `<p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:34px;font-weight:800;letter-spacing:1px;text-align:center;color:#f2c94c;">${escapeHtml(first)}</p>` +
      rest
        .map(
          (block) =>
            paragraph(block, "text-align:center;font-size:16px;"),
        )
        .join("")
    );
  }

  if (style === "elegant") {
    const [first, ...rest] = blocks;
    return (
      `<p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;text-align:center;color:#d4af37;">${escapeHtml(first)}</p>` +
      (rest.length
        ? rest
            .map(
              (block) =>
                `<p style="margin:0 0 14px 0;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:28px;font-weight:700;text-align:center;color:#ffffff;">${escapeHtml(block)}</p>`,
            )
            .join("")
        : "")
    );
  }

  if (style === "lead") {
    const [first, ...rest] = blocks;
    return (
      `<p style="margin:0 0 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:28px;font-weight:700;color:#f2c94c;">${escapeHtml(first)}</p>` +
      rest.map((block) => paragraph(block)).join("")
    );
  }

  if (style === "highlight") {
    const inner = blocks.map((block) => paragraph(block, "margin:0 0 12px 0;")).join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;"><tr><td style="padding:16px 18px;background-color:#161b2c;border:1px solid #d4af37;border-radius:12px;">${inner}</td></tr></table>`;
  }

  if (style === "bullets") {
    const rows = blocks
      .map(
        (block) =>
          `<tr><td valign="top" width="22" style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#d4af37;">▸</td><td valign="top" style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#d5dbe8;">${escapeHtml(block)}</td></tr>`,
      )
      .join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;">${rows}</table>`;
  }

  if (style === "numbered") {
    const rows = blocks
      .map(
        (block, index) =>
          `<tr><td valign="top" width="36" style="padding:0 10px 12px 0;"><span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:13px;background-color:#d4af37;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;color:#111111;">${index + 1}</span></td><td valign="top" style="padding:3px 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#d5dbe8;">${escapeHtml(block)}</td></tr>`,
      )
      .join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
  }

  if (style === "notice") {
    const [first, ...rest] = blocks;
    return (
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;"><tr><td style="padding:10px 14px;background-color:#d4af37;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#111111;text-align:center;">Duyuru</td></tr><tr><td style="padding:14px 16px 4px 16px;background-color:#161b2c;border-radius:0 0 8px 8px;"><p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;font-weight:700;color:#f2c94c;">${escapeHtml(first)}</p>${rest.map((block) => paragraph(block)).join("")}</td></tr></table>`
    );
  }

  if (style === "cards") {
    return blocks
      .map(
        (block) =>
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;"><tr><td style="padding:14px 16px;background-color:#161b2c;border-left:3px solid #d4af37;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#d5dbe8;">${escapeHtml(block)}</td></tr></table>`,
      )
      .join("");
  }

  if (style === "spotlight") {
    if (blocks.length === 1) {
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:16px;background-color:#d4af37;border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;font-weight:700;color:#111111;text-align:center;">${escapeHtml(blocks[0])}</td></tr></table>`;
    }
    const last = blocks[blocks.length - 1];
    const rest = blocks.slice(0, -1);
    return (
      rest.map((block) => paragraph(block)).join("") +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 0 0;"><tr><td style="padding:14px 16px;background-color:#d4af37;border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;font-weight:700;color:#111111;text-align:center;">${escapeHtml(last)}</td></tr></table>`
    );
  }

  return blocks.map((block) => paragraph(block)).join("");
}

function bulletproofButton(text: string, url: string) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 0 auto;">
      <tr>
        <td align="center" bgcolor="#d4af37" style="border-radius:10px;">
          <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;letter-spacing:1px;color:#111111;text-decoration:none;text-transform:uppercase;">${escapeHtml(text)}</a>
        </td>
      </tr>
    </table>`;
}

export function compileEmailHtml(fields: EmailTemplateFields) {
  const logoUrl = `${SITE_URL}/logo.png`;
  const year = new Date().getFullYear();
  const preheader = escapeHtml(fields.preheader);
  const headline = escapeHtml(fields.headline);
  const bodyHtml = compileBodyHtml(fields.bodyText, fields.bodyStyle);
  const imageUrl = toAbsoluteUrl(fields.imageUrl);
  const showCta = Boolean(fields.ctaText && fields.ctaUrl);
  const footer =
    fields.footerNote.trim() ||
    `${SITE_NAME} bağımsız bir bahis rehberidir. Bu ileti bilgilendirme amaçlıdır.`;

  const hero = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:12px;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <title>${escapeHtml(fields.subject || SITE_NAME)}</title>
  <base href="${escapeHtml(SITE_URL)}/">
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#07090f;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#07090f;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background-color:#0d1220;border:1px solid #d4af3759;border-radius:16px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:22px 24px 16px 24px;background:linear-gradient(180deg,#161b2c 0%,#0d1220 100%);">
              <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(SITE_NAME)}" width="140" style="display:block;height:auto;border:0;max-width:140px;">
              <p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#d4af37;">${escapeHtml(SITE_NAME)} · Bahis Rehberi</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px 32px;">
              ${hero ? `<div style="margin:8px 0 22px 0;">${hero}</div>` : ""}
              ${
                headline
                  ? `<h1 style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:34px;font-weight:800;color:#f2c94c;text-align:center;">${headline}</h1>`
                  : ""
              }
              <div style="text-align:left;">${bodyHtml}</div>
              ${showCta ? bulletproofButton(fields.ctaText, fields.ctaUrl) : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px 28px;border-top:1px solid #d4af3729;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#8b93a7;text-align:center;">${escapeHtml(footer)}</p>
              <p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;color:#667085;text-align:center;">© ${year} ${escapeHtml(SITE_NAME)} · <a href="${escapeHtml(SITE_URL)}" style="color:#d4af37;text-decoration:none;">alkanka.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function compileEmailText(fields: EmailTemplateFields) {
  const year = new Date().getFullYear();
  const imageUrl = toAbsoluteUrl(fields.imageUrl);
  const ctaUrl = toAbsoluteUrl(fields.ctaUrl);
  const footer =
    fields.footerNote.trim() ||
    `${SITE_NAME} bağımsız bir bahis rehberidir. Bu ileti bilgilendirme amaçlıdır.`;
  const rule = "────────────────────────────────────────";
  const bar = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
  const parts: string[] = [
    SITE_NAME,
    "Bahis Rehberi",
    SITE_URL,
    "",
    rule,
  ];

  if (fields.subject) {
    parts.push(`Konu: ${fields.subject}`, rule, "");
  }

  if (fields.preheader) {
    parts.push(wrapBlock(fields.preheader), "");
  }

  if (fields.headline) {
    parts.push(fields.headline.toLocaleUpperCase("tr"), "");
  }

  const body = compileBodyText(fields.bodyText, fields.bodyStyle);
  if (body) parts.push(body, "");

  if (imageUrl) {
    parts.push("[ Görsel ]", imageUrl, "");
  }

  if (fields.ctaText && ctaUrl) {
    parts.push(bar, `  ${fields.ctaText}`, `  ${ctaUrl}`, bar, "");
  }

  parts.push("—", wrapBlock(footer), "", `© ${year} ${SITE_NAME}  ·  alkanka.com`);

  return `${parts.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export const EMAIL_PRESETS: Record<
  string,
  { label: string; fields: EmailTemplateFields }
> = {
  promo: {
    label: "Kampanya",
    fields: {
      subject: "Özel deneme bonusu seni bekliyor",
      preheader: "Güncel kampanyayı kaçırma.",
      layout: "promo",
      headline: "Bu haftanın öne çıkan kampanyası",
      bodyText:
        "Seçili sitelerde deneme bonusu ve hızlı çekim fırsatlarını senin için derledik.\n\nKampanya koşullarını ilgili sitede kontrol etmeyi unutma.",
      bodyStyle: "highlight",
      imageUrl: "",
      ctaText: "Kampanyayı incele",
      ctaUrl: SITE_URL,
      footerNote: "",
    },
  },
  announcement: {
    label: "Duyuru",
    fields: {
      subject: "AL KANKA'dan kısa bir duyuru",
      preheader: "Listede güncellenen adresler.",
      layout: "announcement",
      headline: "Giriş adresleri güncellendi",
      bodyText:
        "Bazı sitelerin giriş adresleri yenilendi. Güncel bağlantılara alkanka.com üzerinden ulaşabilirsin.\n\nYeni adres değişince hesabın ve bakiyen aynı kalır.",
      bodyStyle: "notice",
      imageUrl: "",
      ctaText: "Güncel listeye git",
      ctaUrl: SITE_URL,
      footerNote: "",
    },
  },
  simple: {
    label: "Sade metin",
    fields: {
      subject: "Bilgilendirme",
      preheader: "Kısa bir not.",
      layout: "simple",
      headline: "",
      bodyText: "Merhaba,\n\nKısa bilgilendirme metnini buraya yaz.",
      bodyStyle: "paragraphs",
      imageUrl: "",
      ctaText: "",
      ctaUrl: "",
      footerNote: "",
    },
  },
};

