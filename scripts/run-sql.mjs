import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local"), quiet: true });

const target = process.argv[2];
if (!target) {
  console.error("Kullanım: node scripts/run-sql.mjs <dosya.sql>");
  process.exit(1);
}

const sql = readFileSync(resolve(root, target), "utf8");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(sql);
await client.end();
console.log(`${target} çalıştırıldı.`);
