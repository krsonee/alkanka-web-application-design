const SKIP_HOST =
  /(?:^|\.)(?:t\.me|telegram\.me|telegram\.org|telegra\.ph)$/i;

const NOISE_LINE =
  /^(al\s*kanka|duyuru|sohbet|sponsorlar?|sponsor|duyuru\s+sohbet)$/i;

const NOISE_PHRASE =
  /\b(duyuru|sohbet|sponsor|yoruma|emoji bırak|butona tıkla|daha fazlası|kanal(ımız|a)|start bas)\b/i;

const CODE_PREFIX = /^(kod|code|bonus\s*kodu|giriş\s*kodu)\s*[:：\-–]?\s*/i;

const URL_IN_TEXT =
  /https?:\/\/[^\s<>"'\]\)]+/gi;

function entityKind(entity) {
  return entity?.className || entity?.constructor?.name || entity?.type || "";
}

function stripInvisible(value) {
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ");
}

function stripEmojis(value) {
  return String(value || "")
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimUrl(raw) {
  return String(raw || "").replace(/[.,;:!?)\]>]+$/g, "").trim();
}

export function normalizePromoUrl(raw) {
  const trimmed = trimUrl(raw);
  if (!trimmed) return "";
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProto);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    if (SKIP_HOST.test(parsed.hostname)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function collectUrls(text, entities) {
  const found = [];
  for (const entity of entities || []) {
    const kind = entityKind(entity);
    const offset = Number(entity.offset);
    const length = Number(entity.length);
    if (!Number.isFinite(offset) || !Number.isFinite(length) || length < 1) continue;
    if (kind === "MessageEntityTextUrl" || kind === "text_link") {
      const url = normalizePromoUrl(entity.url);
      if (url) found.push({ url, offset });
    } else if (kind === "MessageEntityUrl" || kind === "url") {
      const url = normalizePromoUrl(text.slice(offset, offset + length));
      if (url) found.push({ url, offset });
    }
  }

  for (const match of text.matchAll(URL_IN_TEXT)) {
    const url = normalizePromoUrl(match[0]);
    if (url) found.push({ url, offset: match.index ?? 0 });
  }

  found.sort((a, b) => a.offset - b.offset);
  const seen = new Set();
  return found.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function asCode(line) {
  let value = stripEmojis(stripInvisible(line));
  value = value.replace(CODE_PREFIX, "").trim();
  if (!value) return "";
  if (NOISE_LINE.test(value)) return "";
  if (NOISE_PHRASE.test(value)) return "";
  if (/https?:\/\//i.test(value) || /^www\./i.test(value)) return "";
  if (value.length < 2 || value.length > 48) return "";
  if (value.split(/\s+/).length > 4) return "";
  if (!/[\p{L}\p{N}]/u.test(value)) return "";
  if (/[.!?@]/.test(value)) return "";
  return value;
}

function findCode(text, urlOffset) {
  const before = text.slice(0, urlOffset);
  const after = text.slice(urlOffset);
  const linesBefore = before.split(/\n/).map((line) => line.trim()).filter(Boolean);

  for (let i = linesBefore.length - 1; i >= 0; i -= 1) {
    const code = asCode(linesBefore[i]);
    if (code) return code;
  }

  const sameLine = asCode(before.slice(before.lastIndexOf("\n") + 1));
  if (sameLine) return sameLine;

  const afterLines = after.split(/\n/).slice(1).map((line) => line.trim()).filter(Boolean);
  for (const line of afterLines) {
    const code = asCode(line);
    if (code) return code;
  }

  return "";
}

export function extractCodeAndLink(text, entities = []) {
  const raw = stripInvisible(text);
  if (!raw.trim()) return null;

  const urls = collectUrls(raw, entities);
  const promo = urls[0];
  if (!promo) return null;

  const code = findCode(raw, promo.offset);
  if (!code) return null;

  const body = `${code}\n${promo.url}`;
  return {
    code,
    url: promo.url,
    text: body,
    urlOffset: code.length + 1,
    urlLength: promo.url.length,
  };
}
