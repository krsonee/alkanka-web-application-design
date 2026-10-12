import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

// Veritabanını hazırlar: tabloları oluşturur, boş tablolara başlangıç
// verisini yükler. Her açılışta güvenle çalıştırılabilir; dolu tablolara ve
// panelden değiştirilmiş ayarlara dokunmaz.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local"), quiet: true });
dotenv.config({ path: join(root, ".env"), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[db-init] DATABASE_URL tanımlı değil");
  process.exit(1);
}

const read = (path) => readFileSync(join(root, "db", path), "utf8");

// Yalnızca tablo boşsa yüklenenler. settings her zaman çalışır ama
// ON CONFLICT DO NOTHING ile var olan anahtarların üzerine yazmaz.
const SEED_IF_EMPTY = ["sites", "faqs", "point_tasks"];

const client = new pg.Client({ connectionString: databaseUrl });

async function connectWithRetry(attempts = 10) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await client.connect();
      return;
    } catch (err) {
      if (i === attempts) throw err;
      console.log(`[db-init] veritabanına bağlanılamadı (${i}/${attempts}), tekrar deneniyor`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function removeLiveTrialUsers(client) {
  // Canlı doğrulamada açılan deneme hesabı. Render veritabanına dışarıdan
  // bağlanılamadığı için silme, bir sonraki açılışta burada yapılır.
  const pattern = "deneme-c561-live-%@example.com";
  const present = async (name) => {
    const { rows } = await client.query("SELECT to_regclass($1) AS rel", [`public.${name}`]);
    return Boolean(rows[0]?.rel);
  };
  if (!(await present("user"))) return;
  const { rows } = await client.query(`SELECT id FROM "user" WHERE email LIKE $1`, [pattern]);
  if (!rows.length) return;
  const ids = rows.map((row) => row.id);
  const drop = async (sql, params) => {
    try {
      await client.query(sql, params);
    } catch (err) {
      console.error("[db-init] deneme satırı silinemedi:", err.message);
    }
  };
  for (const table of ["session", "account"]) {
    if (await present(table)) await drop(`DELETE FROM "${table}" WHERE "userId" = ANY($1::text[])`, [ids]);
  }
  for (const table of ["social_accounts", "social_entries", "game_history", "wallets", "market_requests"]) {
    if (await present(table)) await drop(`DELETE FROM ${table} WHERE user_id = ANY($1::text[])`, [ids]);
  }
  await drop(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [ids]);
  console.log(`[db-init] canlı deneme hesabı silindi: ${ids.length}`);
}

await connectWithRetry();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(4167001)");
  await client.query(read("schema.sql"));

  for (const table of SEED_IF_EMPTY) {
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
    if (rows[0].n > 0) {
      console.log(`[db-init] ${table}: ${rows[0].n} kayıt var, başlangıç verisi atlandı`);
      continue;
    }
    await client.query(read(`seed/${table}.sql`));
    const after = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
    console.log(`[db-init] ${table}: ${after.rows[0].n} başlangıç kaydı yüklendi`);
  }

  await client.query(read("seed/settings.sql"));
  await client.query("COMMIT");
  console.log("[db-init] veritabanı hazır");
  try {
    await removeLiveTrialUsers(client);
  } catch (err) {
    console.error("[db-init] deneme temizliği atlandı:", err.message);
  }
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("[db-init] hata:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
