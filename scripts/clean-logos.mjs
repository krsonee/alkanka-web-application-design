import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local"), quiet: true });

const logosDir = join(root, "public", "logos");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query("SELECT name, logo_url FROM sites");
await pool.end();

const used = new Set(rows.map((r) => String(r.logo_url).split("/").pop()));
const missing = rows.filter(
  (r) => !existsSync(join(logosDir, String(r.logo_url).split("/").pop())),
);

let removed = 0;
for (const file of readdirSync(logosDir)) {
  if (used.has(file)) continue;
  rmSync(join(logosDir, file), { force: true });
  removed += 1;
}

console.log(`Kullanımda: ${used.size} dosya, silinen artık: ${removed}`);
console.log(`Dosyası eksik site: ${missing.length}`);
for (const row of missing.slice(0, 10)) console.log(`  ${row.name} -> ${row.logo_url}`);
