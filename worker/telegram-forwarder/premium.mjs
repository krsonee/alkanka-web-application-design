const KEEP_TYPES = new Set([
  "custom_emoji",
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "spoiler",
  "code",
  "pre",
  "text_link",
  "url",
  "blockquote",
  "expandable_blockquote",
  "mention",
  "text_mention",
]);

const premiumIcons = new Map(); // unicode alt -> custom_emoji_id

export function parseMessageEntities(raw) {
  if (Array.isArray(raw)) return sanitizeEntities(raw);
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    return sanitizeEntities(JSON.parse(trimmed));
  } catch {
    return [];
  }
}

function sanitizeEntities(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    if (!item || !KEEP_TYPES.has(item.type)) continue;
    const offset = Number(item.offset);
    const length = Number(item.length);
    if (!Number.isFinite(offset) || !Number.isFinite(length) || length < 1) continue;
    const row = { type: item.type, offset, length };
    if (item.custom_emoji_id) row.custom_emoji_id = String(item.custom_emoji_id);
    if (item.url) row.url = String(item.url);
    if (item.language) row.language = String(item.language);
    if (item.user?.id) row.user_id = Number(item.user.id);
    if (item.user_id) row.user_id = Number(item.user_id);
    out.push(row);
  }
  return out;
}

export function serializeMessageEntities(raw) {
  return JSON.stringify(parseMessageEntities(raw));
}

export function normalizeFooterInput(text, entities) {
  const raw = String(text ?? "");
  if (raw.trim() === "-" || raw.trim() === "") {
    return { text: "", entities: [] };
  }
  const start = raw.match(/^\s*/)[0].length;
  const end = raw.length - raw.match(/\s*$/)[0].length;
  const sliced = raw.slice(start, end);
  const shifted = parseMessageEntities(entities)
    .map((entity) => {
      const offset = entity.offset - start;
      const stop = offset + entity.length;
      const nextOffset = Math.max(0, offset);
      const nextStop = Math.min(sliced.length, stop);
      if (nextStop <= nextOffset) return null;
      return { ...entity, offset: nextOffset, length: nextStop - nextOffset };
    })
    .filter(Boolean);
  return { text: sliced, entities: shifted };
}

function escAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function wrapFormatted(inner, entity) {
  switch (entity.type) {
    case "bold":
      return `<b>${inner}</b>`;
    case "italic":
      return `<i>${inner}</i>`;
    case "underline":
      return `<u>${inner}</u>`;
    case "strikethrough":
      return `<s>${inner}</s>`;
    case "spoiler":
      return `<tg-spoiler>${inner}</tg-spoiler>`;
    case "code":
      return `<code>${inner}</code>`;
    case "pre":
      return entity.language
        ? `<pre><code class="language-${escAttr(entity.language)}">${inner}</code></pre>`
        : `<pre>${inner}</pre>`;
    case "text_link":
      return `<a href="${escAttr(entity.url)}">${inner}</a>`;
    case "custom_emoji":
      return `<tg-emoji emoji-id="${escAttr(entity.custom_emoji_id)}">${inner}</tg-emoji>`;
    case "blockquote":
      return `<blockquote>${inner}</blockquote>`;
    case "expandable_blockquote":
      return `<blockquote expandable>${inner}</blockquote>`;
    default:
      return inner;
  }
}

export function footerToHtml(text, entities, esc) {
  const value = String(text || "");
  const parsed = parseMessageEntities(entities);
  if (!parsed.length) return esc(value);

  const points = new Set([0, value.length]);
  for (const entity of parsed) {
    points.add(entity.offset);
    points.add(Math.min(value.length, entity.offset + entity.length));
  }
  const sorted = [...points].sort((a, b) => a - b);
  let html = "";
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end <= start) continue;
    let inner = esc(value.substring(start, end));
    const covering = parsed
      .filter((entity) => entity.offset <= start && entity.offset + entity.length >= end)
      .sort((a, b) => a.length - b.length);
    for (const entity of covering) inner = wrapFormatted(inner, entity);
    html += inner;
  }
  return html;
}

export function harvestPremiumIcons(text, entities) {
  const value = String(text || "");
  for (const entity of parseMessageEntities(entities)) {
    if (entity.type !== "custom_emoji" || !entity.custom_emoji_id) continue;
    const alt = value.substring(entity.offset, entity.offset + entity.length);
    if (alt) premiumIcons.set(alt, entity.custom_emoji_id);
  }
}

export function harvestGramjsPremium(text, entities) {
  const mapped = [];
  for (const entity of entities || []) {
    const kind = entity.className || entity.constructor?.name || "";
    if (kind !== "MessageEntityCustomEmoji") continue;
    mapped.push({
      type: "custom_emoji",
      offset: entity.offset,
      length: entity.length,
      custom_emoji_id: String(entity.documentId ?? ""),
    });
  }
  harvestPremiumIcons(text, mapped);
}

export function applyCustomEmojiHtml(text, entities) {
  const value = String(text || "");
  const custom = parseMessageEntities(entities)
    .filter((entity) => entity.type === "custom_emoji" && entity.custom_emoji_id)
    .sort((a, b) => b.offset - a.offset);
  let html = value;
  for (const entity of custom) {
    const alt = html.substring(entity.offset, entity.offset + entity.length);
    if (!alt) continue;
    html =
      html.substring(0, entity.offset) +
      `<tg-emoji emoji-id="${entity.custom_emoji_id}">${alt}</tg-emoji>` +
      html.substring(entity.offset + entity.length);
  }
  return html;
}

export function premiumizeHtml(html) {
  let out = String(html || "");
  const entries = [...premiumIcons.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [alt, id] of entries) {
    if (!alt || !out.includes(alt)) continue;
    const token = `<tg-emoji emoji-id="${id}">${alt}</tg-emoji>`;
    const protectedOut = out.split(token).join("\u0000");
    out = protectedOut.split(alt).join(token).split("\u0000").join(token);
  }
  return out;
}

export function decorateKeyboard(markup) {
  const rows = markup?.inline_keyboard;
  if (!Array.isArray(rows) || premiumIcons.size === 0) return markup;
  return {
    ...markup,
    inline_keyboard: rows.map((row) =>
      row.map((button) => {
        const text = String(button.text || "");
        for (const [alt, id] of premiumIcons) {
          if (!text.startsWith(alt)) continue;
          const rest = text.slice(alt.length).trimStart();
          return {
            ...button,
            text: rest || text,
            icon_custom_emoji_id: id,
          };
        }
        return button;
      }),
    ),
  };
}
