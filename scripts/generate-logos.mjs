import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local"), quiet: true });
const publicDir = join(root, "public");
const logoDir = join(publicDir, "logos");

// Marka tonları: koyu lacivert kart zemininde okunaklı kalacak şekilde seçildi.
const PALETTE = [
  ["#f3c969", "#d4a02a"],
  ["#6fb1fc", "#2f6fd0"],
  ["#5ed3a5", "#209c72"],
  ["#f38d8d", "#c94f4f"],
  ["#b79cf7", "#7b56d6"],
  ["#f7b267", "#d97a1f"],
  ["#5fd0dd", "#1d8f9e"],
  ["#f490bd", "#c4478a"],
  ["#a8d861", "#6c9c25"],
  ["#f2a25c", "#cf6c22"],
  ["#7fb0e8", "#3a6ea8"],
  ["#4fd1c5", "#199e94"],
];

const escapeXml = (value) =>
  value.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch],
  );

function hashCode(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function initials(name) {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) {
    const word = words[0];
    // Tek kelimelik markalarda ikinci harf küçük kalırsa monogram daha dengeli duruyor.
    return word.length > 3
      ? word.slice(0, 2).toLocaleUpperCase("tr-TR")
      : word.slice(0, 1).toLocaleUpperCase("tr-TR");
  }
  return (words[0][0] + words[1][0]).toLocaleUpperCase("tr-TR");
}

function buildSvg(name) {
  const [light, dark] = PALETTE[hashCode(name) % PALETTE.length];
  const text = initials(name);
  const fontSize = text.length > 1 ? 38 : 50;
  const id = hashCode(name).toString(36);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" role="img" aria-label="${escapeXml(name)}">
  <defs>
    <linearGradient id="g${id}" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="92" height="92" rx="24" fill="url(#g${id})"/>
  <rect x="2.75" y="2.75" width="90.5" height="90.5" rx="23.25" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="1.5"/>
  <path d="M2 62c22 12 48 14 92 4v6a24 24 0 0 1-24 24H26A24 24 0 0 1 2 72z" fill="#000000" fill-opacity="0.12"/>
  <text x="48" y="49" text-anchor="middle" dominant-baseline="central"
        font-family="Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
        font-size="${fontSize}" font-weight="700" letter-spacing="0.5" fill="#0d1220">${escapeXml(text)}</text>
</svg>
`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  mkdirSync(logoDir, { recursive: true });

  const pool = new pg.Pool({ connectionString });
  const { rows } = await pool.query(
    "SELECT id, name, logo_url FROM sites ORDER BY id",
  );

  let generated = 0;
  let kept = 0;

  for (const row of rows) {
    const current = String(row.logo_url ?? "");

    // Gerçek logo dosyası pakete eklenmişse ona dokunmuyoruz.
    if (current && existsSync(join(publicDir, current.replace(/^\//, "")))) {
      kept += 1;
      continue;
    }

    const base =
      current.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ||
      `site-${row.id}`;
    const target = `/logos/${base}.svg`;

    writeFileSync(join(logoDir, `${base}.svg`), buildSvg(row.name), "utf8");
    if (current !== target) {
      await pool.query("UPDATE sites SET logo_url = $1 WHERE id = $2", [
        target,
        row.id,
      ]);
    }
    generated += 1;
  }

  await pool.end();
  console.log(`generated: ${generated}, kept existing: ${kept}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
