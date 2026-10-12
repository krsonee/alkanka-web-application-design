import { mkdirSync, existsSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local"), quiet: true });

const SOURCE = "https://betlink47.pro/img/";
const CONCURRENCY = 8;
const logosDir = join(root, "public", "logos");
mkdirSync(logosDir, { recursive: true });

function parseValues(line) {
  const start = line.indexOf("VALUES (");
  if (start === -1) return null;

  const body = line.slice(start + 8);
  const values = [];
  let current = "";
  let inString = false;

  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (inString) {
      if (char === "'" && body[i + 1] === "'") {
        current += "'";
        i += 1;
      } else if (char === "'") {
        inString = false;
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'") {
      inString = true;
    } else if (char === ",") {
      values.push(current.trim());
      current = "";
    } else if (char === ")" && body.slice(i).trimEnd() === ");") {
      values.push(current.trim());
      break;
    } else {
      current += char;
    }
  }
  return values;
}

const sql = (await import("node:fs")).readFileSync(
  join(root, "seed", "sites.sql"),
  "utf8",
);

const entries = [];
for (const line of sql.split(/\r?\n/)) {
  if (!line.startsWith("INSERT INTO sites")) continue;
  const values = parseValues(line);
  if (!values) continue;
  const [name, logoUrl] = values;
  const sortOrder = Number(values[9]);
  const file = logoUrl.split("/").pop();
  if (!file || !/\.(webp|png|jpg|jpeg|gif|svg)$/i.test(file)) continue;
  entries.push({ name, file, sortOrder });
}

console.log(`${entries.length} kayıt okundu, indirme başlıyor...`);

let downloaded = 0;
let cached = 0;
let failed = 0;

async function download(entry) {
  const target = join(logosDir, entry.file);
  if (!process.env.FORCE && existsSync(target) && statSync(target).size > 512) {
    cached += 1;
    return true;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(SOURCE + encodeURIComponent(entry.file), {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
          referer: "https://betlink47.pro/",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 512) throw new Error("too small");
      writeFileSync(target, buffer);
      downloaded += 1;
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  failed += 1;
  return false;
}

const queue = [...entries];
const succeeded = [];

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const entry = queue.shift();
      if (await download(entry)) succeeded.push(entry);
      const done = downloaded + cached + failed;
      if (done % 100 === 0) console.log(`  ${done}/${entries.length}`);
    }
  }),
);

console.log(
  `İndirildi: ${downloaded}, zaten vardı: ${cached}, başarısız: ${failed}`,
);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let updated = 0;

for (const entry of succeeded) {
  const result = await pool.query(
    "UPDATE sites SET logo_url = $1 WHERE name = $2",
    [`/logos/${entry.file}`, entry.name],
  );
  updated += result.rowCount;
}

await pool.end();
console.log(`${updated} sitenin logosu güncellendi.`);
