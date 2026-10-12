const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

/** Turn `Türkiye&#x27;nin` into `Türkiye'nin`. Plain text is left as-is. */
export function decodeHtml(value: string) {
  let text = value;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, body: string) => {
      if (body[0] === "#") {
        const code = body[1]?.toLowerCase() === "x" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
        if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return all;
        return String.fromCodePoint(code);
      }
      return NAMED[body.toLowerCase()] ?? all;
    });
    if (next === text) break;
    text = next;
  }
  return text.replace(/\s+/g, " ").trim();
}
