import type { PoolClient } from "pg";
import { pool } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import {
  DAILY_AMOUNT_DEFAULT,
  DAILY_REASON,
  POINTS_AMOUNT_MAX,
  SIGNUP_BONUS_DEFAULT,
  SIGNUP_REASON,
  cleanAdjustReason,
  istanbulDay,
  normalizeEmail,
  normalizeUsername,
  parseNonNegativeAmount,
  parseSettingAmount,
  passwordIssue,
} from "@/lib/points-rules";

export class PointsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type LedgerRow = {
  amount: number;
  reason: string;
  createdAt: string;
};

export type MemberListRow = {
  id: number;
  username: string;
  email: string;
  balance: number;
  createdAt: string;
  closedAt: string | null;
  telegramLinked: boolean;
  telegramUsername: string;
};

function asNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function asIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export function pointsFailure(err: unknown): Response {
  if (err instanceof PointsError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error("[puan]", err);
  return Response.json({ error: "İşlem tamamlanamadı." }, { status: 500 });
}

const DAILY_PLAY_MAX = 50;

function dailyPlayCount(raw: string | undefined, fallback: number) {
  const value = parseSettingAmount(raw, fallback);
  if (value > DAILY_PLAY_MAX) return DAILY_PLAY_MAX;
  return value;
}

function readDailyPlay(body: Record<string, unknown>, key: string, current: number) {
  if (!(key in body)) return current;
  const value = parseNonNegativeAmount(body[key]);
  if (value == null || value > DAILY_PLAY_MAX) {
    throw new PointsError("Günlük hak 0 ile 50 arasında olmalı.", 400);
  }
  return value;
}

function flagValue(raw: string | undefined, fallback: boolean) {
  if (raw == null || raw.trim() === "") return fallback;
  return raw.trim() === "1" || raw.trim().toLowerCase() === "true";
}

export type PointsConfig = {
  signupBonus: number;
  dailyAmount: number;
  dailyEnabled: boolean;
  diceEnabled: boolean;
  diceMin: number;
  diceMax: number;
  diceMultiplier: number;
  wheelEnabled: boolean;
  wheelDaily: number;
  diceDaily: number;
  chestDaily: number;
  marketEnabled: boolean;
  tasksEnabled: boolean;
  ticketsEnabled: boolean;
  predictionsEnabled: boolean;
  leaderboardEnabled: boolean;
  campaignsEnabled: boolean;
  oddsEnabled: boolean;
  telegramChannel: string;
};

export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function getPointsConfig(): Promise<PointsConfig> {
  const { rows } = await pool.query<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key LIKE 'points_%'`,
  );
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const diceMin = parseSettingAmount(map.get("points_dice_min"), 10);
  let diceMax = parseSettingAmount(map.get("points_dice_max"), 500);
  if (diceMax < diceMin) diceMax = diceMin;
  let diceMultiplier = parseSettingAmount(map.get("points_dice_multiplier"), 2);
  if (diceMultiplier < 1) diceMultiplier = 1;
  if (diceMultiplier > 20) diceMultiplier = 20;
  return {
    signupBonus: parseSettingAmount(map.get("points_signup_bonus"), SIGNUP_BONUS_DEFAULT),
    dailyAmount: parseSettingAmount(map.get("points_daily_amount"), DAILY_AMOUNT_DEFAULT),
    dailyEnabled: flagValue(map.get("points_daily_enabled"), true),
    diceEnabled: flagValue(map.get("points_dice_enabled"), true),
    diceMin: Math.max(1, diceMin),
    diceMax,
    diceMultiplier,
    wheelEnabled: flagValue(map.get("points_wheel_enabled"), true),
    wheelDaily: dailyPlayCount(map.get("points_wheel_daily"), 1),
    diceDaily: dailyPlayCount(map.get("points_dice_daily"), 3),
    chestDaily: dailyPlayCount(map.get("points_chest_daily"), 1),
    marketEnabled: flagValue(map.get("points_market_enabled"), true),
    tasksEnabled: flagValue(map.get("points_tasks_enabled"), true),
    ticketsEnabled: flagValue(map.get("points_tickets_enabled"), true),
    predictionsEnabled: flagValue(map.get("points_predictions_enabled"), true),
    leaderboardEnabled: flagValue(map.get("points_leaderboard_enabled"), true),
    campaignsEnabled: flagValue(map.get("points_campaigns_enabled"), true),
    oddsEnabled: flagValue(map.get("points_odds_enabled"), true),
    telegramChannel: (map.get("points_telegram_channel") ?? "").trim().slice(0, 120),
  };
}

function asFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return null;
}

export async function savePointsSettings(body: Record<string, unknown>) {
  const current = await getPointsConfig();
  const next: PointsConfig = { ...current };
  if ("signupBonus" in body) {
    const value = parseNonNegativeAmount(body.signupBonus);
    if (value == null) throw new PointsError("Kayıt bonusu 0 ile 1.000.000 arasında olmalı.", 400);
    next.signupBonus = value;
  }
  if ("dailyAmount" in body) {
    const value = parseNonNegativeAmount(body.dailyAmount);
    if (value == null) throw new PointsError("Günlük puan 0 ile 1.000.000 arasında olmalı.", 400);
    next.dailyAmount = value;
  }
  if ("diceMin" in body || "diceMax" in body || "diceMultiplier" in body) {
    const diceMin = "diceMin" in body ? parseNonNegativeAmount(body.diceMin) : next.diceMin;
    const diceMax = "diceMax" in body ? parseNonNegativeAmount(body.diceMax) : next.diceMax;
    const diceMultiplier =
      "diceMultiplier" in body ? parseNonNegativeAmount(body.diceMultiplier) : next.diceMultiplier;
    if (
      diceMin == null ||
      diceMax == null ||
      diceMultiplier == null ||
      diceMin < 1 ||
      diceMax < diceMin ||
      diceMultiplier < 1 ||
      diceMultiplier > 20
    ) {
      throw new PointsError("Zar limiti 1 ile 1.000.000 arasında olmalı; çarpan 1-20.", 400);
    }
    next.diceMin = diceMin;
    next.diceMax = diceMax;
    next.diceMultiplier = diceMultiplier;
  }
  const flagFields = [
    ["dailyEnabled", "dailyEnabled"],
    ["diceEnabled", "diceEnabled"],
    ["wheelEnabled", "wheelEnabled"],
    ["marketEnabled", "marketEnabled"],
    ["tasksEnabled", "tasksEnabled"],
    ["ticketsEnabled", "ticketsEnabled"],
    ["predictionsEnabled", "predictionsEnabled"],
    ["leaderboardEnabled", "leaderboardEnabled"],
    ["campaignsEnabled", "campaignsEnabled"],
    ["oddsEnabled", "oddsEnabled"],
  ] as const;
  for (const [key] of flagFields) {
    if (key in body) {
      const value = asFlag(body[key]);
      if (value == null) throw new PointsError("Açık/kapalı alanı hatalı.", 400);
      next[key] = value;
    }
  }
  if ("telegramChannel" in body) {
    next.telegramChannel = String(body.telegramChannel ?? "").trim().slice(0, 120);
  }
  next.wheelDaily = readDailyPlay(body, "wheelDaily", next.wheelDaily);
  next.diceDaily = readDailyPlay(body, "diceDaily", next.diceDaily);
  next.chestDaily = readDailyPlay(body, "chestDaily", next.chestDaily);

  const pairs: [string, string][] = [
    ["points_signup_bonus", String(next.signupBonus)],
    ["points_daily_amount", String(next.dailyAmount)],
    ["points_daily_enabled", next.dailyEnabled ? "1" : "0"],
    ["points_dice_enabled", next.diceEnabled ? "1" : "0"],
    ["points_dice_min", String(next.diceMin)],
    ["points_dice_max", String(next.diceMax)],
    ["points_dice_multiplier", String(next.diceMultiplier)],
    ["points_wheel_enabled", next.wheelEnabled ? "1" : "0"],
    ["points_wheel_daily", String(next.wheelDaily)],
    ["points_dice_daily", String(next.diceDaily)],
    ["points_chest_daily", String(next.chestDaily)],
    ["points_market_enabled", next.marketEnabled ? "1" : "0"],
    ["points_tasks_enabled", next.tasksEnabled ? "1" : "0"],
    ["points_tickets_enabled", next.ticketsEnabled ? "1" : "0"],
    ["points_predictions_enabled", next.predictionsEnabled ? "1" : "0"],
    ["points_leaderboard_enabled", next.leaderboardEnabled ? "1" : "0"],
    ["points_campaigns_enabled", next.campaignsEnabled ? "1" : "0"],
    ["points_odds_enabled", next.oddsEnabled ? "1" : "0"],
    ["points_telegram_channel", next.telegramChannel],
  ];
  await withTx(async (client) => {
    for (const [key, value] of pairs) {
      await client.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value],
      );
    }
  });
  return next;
}

export async function lockMember(client: PoolClient, memberId: number) {
  const found = await client.query(`SELECT id FROM members WHERE id = $1 FOR UPDATE`, [memberId]);
  if ((found.rowCount ?? 0) === 0) throw new PointsError("Üye bulunamadı.", 404);
}

export async function balanceOf(client: PoolClient, memberId: number) {
  const { rows } = await client.query<{ balance: string }>(
    `SELECT coalesce(sum(amount), 0)::bigint AS balance FROM point_ledger WHERE member_id = $1`,
    [memberId],
  );
  return asNumber(rows[0]?.balance);
}

export async function insertLedger(
  client: PoolClient,
  memberId: number,
  amount: number,
  reason: string,
  claimDay: string | null = null,
) {
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > POINTS_AMOUNT_MAX) {
    throw new PointsError("Puan hareketi yazılamadı.", 500);
  }
  const clean = reason.trim().slice(0, 160);
  if (!clean) throw new PointsError("Puan hareketi yazılamadı.", 500);
  await client.query(
    `INSERT INTO point_ledger (member_id, amount, reason, claim_day) VALUES ($1, $2, $3, $4)`,
    [memberId, amount, clean, claimDay],
  );
}

export async function getBalance(memberId: number): Promise<number> {
  const { rows } = await pool.query<{ balance: string }>(
    `SELECT coalesce(sum(amount), 0)::bigint AS balance
     FROM point_ledger WHERE member_id = $1`,
    [memberId],
  );
  return asNumber(rows[0]?.balance);
}

export async function listLedger(memberId: number, limit = 30, offset = 0): Promise<LedgerRow[]> {
  const { rows } = await pool.query<{ amount: number; reason: string; created_at: Date }>(
    `SELECT amount, reason, created_at
     FROM point_ledger
     WHERE member_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [memberId, limit, offset],
  );
  return rows.map((row) => ({
    amount: row.amount,
    reason: row.reason,
    createdAt: asIso(row.created_at),
  }));
}

async function writeDaily(
  client: PoolClient,
  memberId: number,
  amount: number,
  enabled: boolean,
) {
  if (!enabled || amount <= 0) return false;
  const inserted = await client.query(
    `INSERT INTO point_ledger (member_id, amount, reason, claim_day)
     VALUES ($1, $2, '${DAILY_REASON}', $3)
     ON CONFLICT (member_id, claim_day) WHERE reason = '${DAILY_REASON}' DO NOTHING
     RETURNING id`,
    [memberId, amount, istanbulDay()],
  );
  return (inserted.rowCount ?? 0) > 0;
}

export async function registerMember(username: string, password: string, emailRaw: string, adult: boolean) {
  if (adult !== true) {
    throw new PointsError("18 yaşından büyük olduğunu onaylamalısın.", 400);
  }
  const email = normalizeEmail(emailRaw);
  if (!email) throw new PointsError("Geçerli bir e-posta yazın.", 400);
  const name = normalizeUsername(username);
  if (!name) {
    throw new PointsError(
      "Kullanıcı adı 3-20 karakter olmalı; yalnızca harf, rakam ve alt çizgi kullanılabilir.",
      400,
    );
  }
  const issue = passwordIssue(password);
  if (issue) throw new PointsError(issue, 400);

  const passwordHash = await hashPassword(password);
  const config = await getPointsConfig();

  try {
    return await withTx(async (client) => {
      const inserted = await client.query<{ id: number; username: string }>(
        `INSERT INTO members (username, password_hash, age_confirmed, email)
         VALUES ($1, $2, true, $3) RETURNING id, username`,
        [name, passwordHash, email],
      );
      const member = inserted.rows[0];
      if (config.signupBonus > 0) {
        await client.query(
          `INSERT INTO point_ledger (member_id, amount, reason)
           VALUES ($1, $2, '${SIGNUP_REASON}')
           ON CONFLICT (member_id) WHERE reason = '${SIGNUP_REASON}' DO NOTHING`,
          [member.id, config.signupBonus],
        );
      }
      await writeDaily(client, member.id, config.dailyAmount, config.dailyEnabled);
      return {
        id: member.id,
        username: member.username,
        balance: await balanceOf(client, member.id),
      };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const constraint = typeof err === "object" && err && "constraint" in err ? String(err.constraint) : "";
      if (constraint.includes("email")) throw new PointsError("Bu e-posta kullanılıyor.", 409);
      throw new PointsError("Bu kullanıcı adı alınmış.", 409);
    }
    throw err;
  }
}

export async function grantDailyLogin(memberId: number) {
  const config = await getPointsConfig();
  return withTx(async (client) => {
    const granted = await writeDaily(client, memberId, config.dailyAmount, config.dailyEnabled);
    return { granted, amount: config.dailyAmount, balance: await balanceOf(client, memberId) };
  });
}

export async function authenticateMember(login: string, password: string) {
  const issue = passwordIssue(password);
  const email = normalizeEmail(login);
  const name = email ? null : normalizeUsername(login);
  const { rows } = email
    ? await pool.query<{ id: number; username: string; password_hash: string; closed_at: Date | null }>(
        `SELECT id, username, password_hash, closed_at FROM members WHERE email = $1`,
        [email],
      )
    : name
      ? await pool.query<{ id: number; username: string; password_hash: string; closed_at: Date | null }>(
          `SELECT id, username, password_hash, closed_at FROM members WHERE username = $1`,
          [name],
        )
      : { rows: [] };
  const row = rows[0];
  const match = await verifyPassword(issue ? "" : password, row?.password_hash ?? null);
  if (issue || !row || !match) return null;
  if (row.closed_at) throw new PointsError("Bu üyelik kapatılmış.", 403);
  return { id: row.id, username: row.username };
}

export async function listLedgerPage(memberId: number, page: number) {
  const size = 50;
  const current = Number.isInteger(page) && page > 0 ? page : 1;
  const offset = (current - 1) * size;
  const [rows, count] = await Promise.all([
    listLedger(memberId, size, offset),
    pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM point_ledger WHERE member_id = $1`,
      [memberId],
    ),
  ]);
  const total = count.rows[0]?.n ?? 0;
  return { rows, page: current, pages: Math.max(1, Math.ceil(total / size)), total };
}

export async function getAccount(memberId: number) {
  const { rows } = await pool.query<{
    id: number;
    username: string;
    email: string;
    telegram_id: string | null;
    telegram_username: string;
  }>(
    `SELECT id, username, email, telegram_id, telegram_username FROM members WHERE id = $1`,
    [memberId],
  );
  return rows[0] ?? null;
}

export async function getMemberProfile(memberId: number) {
  const day = istanbulDay();
  const [balance, config, ledger, claim] = await Promise.all([
    getBalance(memberId),
    getPointsConfig(),
    listLedger(memberId, 30),
    pool.query(
      `SELECT 1 FROM point_ledger
       WHERE member_id = $1 AND reason = $2 AND claim_day = $3
       LIMIT 1`,
      [memberId, DAILY_REASON, day],
    ),
  ]);

  return {
    balance,
    signupBonus: config.signupBonus,
    dailyAmount: config.dailyAmount,
    claimedToday: (claim.rowCount ?? 0) > 0,
    ledger,
  };
}

export async function getLeaderboard(limit = 50) {
  const { rows } = await pool.query<{ username: string; balance: string }>(
    `SELECT m.username, coalesce(sum(l.amount), 0)::bigint AS balance
     FROM members m
     LEFT JOIN point_ledger l ON l.member_id = m.id
     GROUP BY m.id
     ORDER BY balance DESC, m.created_at ASC, m.username ASC
     LIMIT $1`,
    [limit],
  );
  return rows.map((row, index) => ({
    rank: index + 1,
    username: row.username,
    balance: asNumber(row.balance),
  }));
}

export async function listMembers(search: string, limit = 500): Promise<MemberListRow[]> {
  const query = search.trim().toLowerCase();
  const pattern = query ? `%${query.replace(/[!%_]/g, (char) => `!${char}`)}%` : "";
  const cap = Math.min(Math.max(limit, 1), 20000);
  const { rows } = await pool.query<{
    id: number;
    username: string;
    email: string;
    balance: string;
    created_at: Date;
    closed_at: Date | null;
    telegram_id: string | null;
    telegram_username: string;
  }>(
    `SELECT m.id, m.username, m.email, m.created_at, m.closed_at,
            m.telegram_id, m.telegram_username,
            coalesce(sum(l.amount), 0)::bigint AS balance
     FROM members m
     LEFT JOIN point_ledger l ON l.member_id = m.id
     WHERE ($1::text = '' OR m.username ILIKE $1 ESCAPE '!' OR m.email ILIKE $1 ESCAPE '!')
     GROUP BY m.id
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [pattern, cap],
  );
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    email: row.email ?? "",
    balance: asNumber(row.balance),
    createdAt: asIso(row.created_at),
    closedAt: row.closed_at ? asIso(row.closed_at) : null,
    telegramLinked: Boolean(row.telegram_id),
    telegramUsername: row.telegram_username ?? "",
  }));
}

export async function updateMemberEmail(memberId: number, emailRaw: string) {
  const email = normalizeEmail(emailRaw);
  if (!email) throw new PointsError("Geçerli bir e-posta yazın.", 400);
  try {
    const updated = await pool.query<{ email: string }>(
      `UPDATE members SET email = $2 WHERE id = $1 RETURNING email`,
      [memberId, email],
    );
    if ((updated.rowCount ?? 0) === 0) throw new PointsError("Üye bulunamadı.", 404);
    return { email: updated.rows[0].email };
  } catch (err) {
    if (err instanceof PointsError) throw err;
    if (isUniqueViolation(err)) throw new PointsError("Bu e-posta kullanılıyor.", 409);
    throw err;
  }
}

export async function changeMemberPassword(memberId: number, current: string, next: string) {
  const issue = passwordIssue(next);
  if (issue) throw new PointsError(issue, 400);
  if (current === next) throw new PointsError("Yeni şifre eskisinden farklı olmalı.", 400);
  const { rows } = await pool.query<{ password_hash: string }>(
    `SELECT password_hash FROM members WHERE id = $1`,
    [memberId],
  );
  const row = rows[0];
  if (!row) throw new PointsError("Üye bulunamadı.", 404);
  const matches = await verifyPassword(current, row.password_hash);
  if (!matches) throw new PointsError("Mevcut şifre yanlış.", 400);
  const passwordHash = await hashPassword(next);
  await pool.query(`UPDATE members SET password_hash = $2 WHERE id = $1`, [memberId, passwordHash]);
  return { ok: true };
}

export async function adjustPoints(memberId: number, amount: number, reasonRaw: string) {
  if (!Number.isInteger(memberId) || memberId <= 0) {
    throw new PointsError("Üye bulunamadı.", 404);
  }
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > POINTS_AMOUNT_MAX) {
    throw new PointsError(
      "Tutar -1.000.000 ile 1.000.000 arasında, sıfırdan farklı bir tam sayı olmalı.",
      400,
    );
  }
  const reason = cleanAdjustReason(reasonRaw);
  if (!reason) {
    throw new PointsError("Sebep 2-160 karakter olmalı ve sistem kayıtlarından farklı yazılmalı.", 400);
  }

  const inserted = await pool.query<{ id: number; created_at: Date }>(
    `INSERT INTO point_ledger (member_id, amount, reason)
     SELECT $1, $2, $3
     WHERE EXISTS (SELECT 1 FROM members WHERE id = $1)
     RETURNING id, created_at`,
    [memberId, amount, reason],
  );
  if ((inserted.rowCount ?? 0) === 0) {
    throw new PointsError("Üye bulunamadı.", 404);
  }

  const entry = inserted.rows[0];
  return {
    balance: await getBalance(memberId),
    entry: {
      amount,
      reason,
      createdAt: asIso(entry.created_at),
    },
  };
}
