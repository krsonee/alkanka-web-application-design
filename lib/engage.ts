import { randomInt, timingSafeEqual } from "crypto";
import { pool } from "@/db";
import {
  balanceOf,
  getPointsConfig,
  insertLedger,
  lockMember,
  PointsError,
  withTx,
} from "@/lib/points";
import { usedToday } from "@/lib/mini-plays";
import { CLOSED_COPY, DAILY_REASON, PENDING_COPY, istanbulDay } from "@/lib/points-rules";
import { checkChannelMembership } from "@/lib/telegram-member";

export const TASK_TYPES = [
  "daily_login",
  "visit_site",
  "join_telegram",
  "enter_code",
  "connect_telegram",
] as const;

function iso(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function repeats(task: { task_type: string; repeat_daily: boolean }) {
  return task.repeat_daily || task.task_type === "daily_login";
}

function codesMatch(input: string, expected: string) {
  const left = Buffer.from(input.trim());
  const right = Buffer.from(expected.trim());
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function recordVisit(memberId: number, siteId: number) {
  await pool.query(
    `INSERT INTO member_site_visits (member_id, site_id)
     SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM members WHERE id = $1)`,
    [memberId, siteId],
  );
}

export async function listTasks(memberId: number | null) {
  const day = istanbulDay();
  const { rows } = await pool.query<{
    id: number;
    title: string;
    description: string;
    reward: number;
    task_type: string;
    repeat_daily: boolean;
    sort_order: number;
    claimed: boolean;
  }>(
    `SELECT t.id, t.title, t.description, t.reward, t.task_type, t.repeat_daily, t.sort_order,
            EXISTS (
              SELECT 1 FROM point_task_claims c
              WHERE c.task_id = t.id
                AND c.member_id = $1
                AND (
                  (NOT (t.repeat_daily OR t.task_type = 'daily_login') AND c.claim_day IS NULL)
                  OR ((t.repeat_daily OR t.task_type = 'daily_login') AND c.claim_day = $2::date)
                )
            ) AS claimed
     FROM point_tasks t
     WHERE t.active
     ORDER BY t.sort_order, t.id`,
    [memberId ?? 0, day],
  );
  return rows.map((row) => ({
    ...row,
    claimed: memberId ? row.claimed : false,
    needsCode: row.task_type === "enter_code",
  }));
}

export async function claimTask(memberId: number, taskId: number, code = "") {
  const config = await getPointsConfig();
  if (!config.tasksEnabled) throw new PointsError(CLOSED_COPY, 400);
  const { rows } = await pool.query<{
    id: number;
    title: string;
    reward: number;
    task_type: string;
    code: string;
    site_id: number | null;
    repeat_daily: boolean;
    active: boolean;
  }>(`SELECT id, title, reward, task_type, code, site_id, repeat_daily, active FROM point_tasks WHERE id = $1`, [
    taskId,
  ]);
  const task = rows[0];
  if (!task || !task.active) throw new PointsError("Görev bulunamadı.", 404);
  const day = istanbulDay();
  const daily = repeats(task);

  if (task.task_type === "daily_login") {
    const logged = await pool.query(
      `SELECT 1 FROM point_ledger WHERE member_id = $1 AND reason = $2 AND claim_day = $3 LIMIT 1`,
      [memberId, DAILY_REASON, day],
    );
    if ((logged.rowCount ?? 0) === 0) {
      throw new PointsError("Bugünkü giriş puanı yazılmamış. Çıkıp tekrar gir.", 400);
    }
  }
  if (task.task_type === "visit_site") {
    const visit = await pool.query(
      `SELECT 1 FROM member_site_visits
       WHERE member_id = $1
         AND ($2::int IS NULL OR site_id = $2)
         AND ($3::date IS NULL OR created_at >= ($3::date AT TIME ZONE 'Europe/Istanbul'))
       LIMIT 1`,
      [memberId, task.site_id, daily ? day : null],
    );
    if ((visit.rowCount ?? 0) === 0) {
      throw new PointsError("Önce listeden bir siteye gir.", 400);
    }
  }
  if (task.task_type === "enter_code" && !codesMatch(code, task.code)) {
    throw new PointsError("Kod hatalı.", 400);
  }
  if (task.task_type === "connect_telegram" || task.task_type === "join_telegram") {
    const account = await pool.query<{ telegram_id: string | null }>(
      `SELECT telegram_id FROM members WHERE id = $1`,
      [memberId],
    );
    const telegramId = account.rows[0]?.telegram_id;
    if (!telegramId) throw new PointsError("Önce Telegram hesabını bağla.", 400);
    if (task.task_type === "join_telegram") {
      const check = await checkChannelMembership(telegramId);
      if (!check.connected) throw new PointsError("Telegram henüz bağlanmadı.", 400);
      if (!check.inChannel) throw new PointsError(check.message, 400);
    }
  }

  return withTx(async (client) => {
    await lockMember(client, memberId);
    const inserted = await client.query(
      daily
        ? `INSERT INTO point_task_claims (task_id, member_id, claim_day)
           VALUES ($1, $2, $3)
           ON CONFLICT (task_id, member_id, claim_day) WHERE claim_day IS NOT NULL DO NOTHING
           RETURNING id`
        : `INSERT INTO point_task_claims (task_id, member_id, claim_day)
           VALUES ($1, $2, NULL)
           ON CONFLICT (task_id, member_id) WHERE claim_day IS NULL DO NOTHING
           RETURNING id`,
      daily ? [task.id, memberId, day] : [task.id, memberId],
    );
    if ((inserted.rowCount ?? 0) === 0) {
      throw new PointsError("Bu görevin puanını zaten aldın.", 400);
    }
    if (task.reward > 0) {
      await insertLedger(client, memberId, task.reward, `Görev: ${task.title}`);
    }
    return { balance: await balanceOf(client, memberId), reward: task.reward };
  });
}

export async function listRewards() {
  const { rows } = await pool.query(
    `SELECT id, name, description, image_url, price, stock, sort_order
     FROM market_rewards WHERE active ORDER BY sort_order, id`,
  );
  return rows;
}

export async function listMyOrders(memberId: number) {
  const { rows } = await pool.query(
    `SELECT id, reward_name, price, status, created_at
     FROM market_orders WHERE member_id = $1 ORDER BY created_at DESC LIMIT 30`,
    [memberId],
  );
  return rows.map((row) => ({ ...row, createdAt: iso(row.created_at) }));
}

export async function buyReward(memberId: number, rewardId: number) {
  const config = await getPointsConfig();
  if (!config.marketEnabled) throw new PointsError(CLOSED_COPY, 400);
  return withTx(async (client) => {
    await lockMember(client, memberId);
    const found = await client.query<{
      id: number;
      name: string;
      price: number;
      stock: number;
      active: boolean;
    }>(`SELECT id, name, price, stock, active FROM market_rewards WHERE id = $1 FOR UPDATE`, [rewardId]);
    const reward = found.rows[0];
    if (!reward || !reward.active) throw new PointsError("Ödül bulunamadı.", 404);
    if (reward.stock === 0) throw new PointsError("Stok tükendi.", 400);
    const balance = await balanceOf(client, memberId);
    if (balance < reward.price) throw new PointsError("Puanın yetmiyor.", 400);
    if (reward.stock > 0) {
      await client.query(`UPDATE market_rewards SET stock = stock - 1 WHERE id = $1`, [reward.id]);
    }
    await client.query(
      `INSERT INTO market_orders (member_id, reward_id, reward_name, price) VALUES ($1, $2, $3, $4)`,
      [memberId, reward.id, reward.name, reward.price],
    );
    await insertLedger(client, memberId, -reward.price, `Market: ${reward.name}`);
    return { balance: balance - reward.price };
  });
}

export async function listEvents(memberId: number | null) {
  const { rows } = await pool.query(
    `SELECT e.id, e.title, e.ticket_price, e.per_user_cap, e.ends_at, e.prize_points,
            e.active, e.winning_number, e.drawn_at,
            (SELECT count(*)::int FROM tickets t WHERE t.event_id = e.id) AS sold,
            (SELECT count(*)::int FROM tickets t WHERE t.event_id = e.id AND t.member_id = $1) AS mine
     FROM ticket_events e
     WHERE e.active OR e.drawn_at IS NOT NULL
     ORDER BY e.created_at DESC`,
    [memberId ?? 0],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    ticketPrice: row.ticket_price,
    perUserCap: row.per_user_cap,
    endsAt: iso(row.ends_at),
    prizePoints: row.prize_points,
    active: row.active,
    winningNumber: row.winning_number,
    drawn: Boolean(row.drawn_at),
    sold: row.sold,
    mine: memberId ? row.mine : 0,
  }));
}

export async function buyTicket(memberId: number, eventId: number) {
  const config = await getPointsConfig();
  if (!config.ticketsEnabled) throw new PointsError(CLOSED_COPY, 400);
  return withTx(async (client) => {
    const found = await client.query<{
      id: number;
      title: string;
      ticket_price: number;
      per_user_cap: number;
      ends_at: Date;
      active: boolean;
      drawn_at: Date | null;
    }>(
      `SELECT id, title, ticket_price, per_user_cap, ends_at, active, drawn_at
       FROM ticket_events WHERE id = $1 FOR UPDATE`,
      [eventId],
    );
    const event = found.rows[0];
    if (!event || !event.active || event.drawn_at) throw new PointsError("Bilet satışı kapalı.", 400);
    if (event.ends_at.getTime() <= Date.now()) throw new PointsError("Bilet süresi doldu.", 400);
    await lockMember(client, memberId);
    const owned = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM tickets WHERE event_id = $1 AND member_id = $2`,
      [eventId, memberId],
    );
    if ((owned.rows[0]?.n ?? 0) >= event.per_user_cap) {
      throw new PointsError("Bu etkinlikteki bilet sınırına ulaştın.", 400);
    }
    const balance = await balanceOf(client, memberId);
    if (balance < event.ticket_price) throw new PointsError("Puanın yetmiyor.", 400);
    const next = await client.query<{ n: number }>(
      `SELECT coalesce(max(number), 0)::int + 1 AS n FROM tickets WHERE event_id = $1`,
      [eventId],
    );
    const number = next.rows[0]?.n ?? 1;
    await client.query(
      `INSERT INTO tickets (event_id, member_id, number) VALUES ($1, $2, $3)`,
      [eventId, memberId, number],
    );
    await insertLedger(client, memberId, -event.ticket_price, `Bilet #${number}: ${event.title}`);
    return { number, balance: balance - event.ticket_price };
  });
}

export async function listSlices() {
  const { rows } = await pool.query(
    `SELECT id, label, points, weight FROM wheel_slices WHERE active ORDER BY sort_order, id`,
  );
  return rows;
}

export async function spinWheel(memberId: number) {
  const config = await getPointsConfig();
  if (!config.wheelEnabled) throw new PointsError(CLOSED_COPY, 400);
  const slices = await listSlices();
  if (slices.length === 0) throw new PointsError(PENDING_COPY, 400);
  if (config.wheelDaily <= 0) throw new PointsError(CLOSED_COPY, 400);
  const day = istanbulDay();
  return withTx(async (client) => {
    await lockMember(client, memberId);
    const used = await usedToday(client, memberId, "cark", day);
    if (used >= config.wheelDaily) throw new PointsError("Bugünkü çevirmeni kullandın.", 400);
    const total = slices.reduce((sum, slice) => sum + slice.weight, 0);
    let roll = randomInt(total);
    let picked = slices[slices.length - 1];
    for (const slice of slices) {
      roll -= slice.weight;
      if (roll < 0) {
        picked = slice;
        break;
      }
    }
    await client.query(
      `INSERT INTO wheel_spins (member_id, slice_id, label, points, claim_day)
       VALUES ($1, $2, $3, $4, $5)`,
      [memberId, picked.id, picked.label, picked.points, day],
    );
    if (picked.points > 0) {
      await insertLedger(client, memberId, picked.points, `Çark: ${picked.label}`);
    }
    return {
      sliceId: picked.id,
      label: picked.label,
      points: picked.points,
      balance: await balanceOf(client, memberId),
    };
  });
}

export async function spunToday(memberId: number) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM wheel_spins WHERE member_id = $1 AND claim_day = $2 LIMIT 1`,
    [memberId, istanbulDay()],
  );
  return (rowCount ?? 0) > 0;
}

const CHEST_REWARDS = {
  bronze: { label: "Bronz sandık", points: 20 },
  silver: { label: "Gümüş sandık", points: 45 },
  gold: { label: "Altın sandık", points: 90 },
} as const;

export type ChestId = keyof typeof CHEST_REWARDS;

export async function openChest(memberId: number, chestId: string) {
  if (!(chestId in CHEST_REWARDS)) throw new PointsError("Sandık seçin.", 400);
  const chest = CHEST_REWARDS[chestId as ChestId];
  const config = await getPointsConfig();
  if (config.chestDaily <= 0) throw new PointsError(CLOSED_COPY, 400);
  const day = istanbulDay();
  return withTx(async (client) => {
    await lockMember(client, memberId);
    const used = await usedToday(client, memberId, "sandik", day);
    if (used >= config.chestDaily) throw new PointsError("Bugünkü sandığını açtın.", 400);
    await client.query(
      `INSERT INTO chest_opens (member_id, chest, label, points, claim_day)
       VALUES ($1, $2, $3, $4, $5)`,
      [memberId, chestId, chest.label, chest.points, day],
    );
    await insertLedger(client, memberId, chest.points, `Sandık: ${chest.label}`);
    return {
      chest: chestId,
      label: chest.label,
      points: chest.points,
      balance: await balanceOf(client, memberId),
    };
  });
}

export async function chestOpenedToday(memberId: number) {
  const { rows } = await pool.query(
    `SELECT chest, label, points FROM chest_opens WHERE member_id = $1 AND claim_day = $2 LIMIT 1`,
    [memberId, istanbulDay()],
  );
  const row = rows[0];
  if (!row) return null;
  return { chest: String(row.chest), label: String(row.label), points: Number(row.points) };
}

export type LiveMove = {
  username: string;
  label: string;
  points: number;
  kind: "cark" | "sandik";
};

export async function listRecentMoves(limit = 12): Promise<LiveMove[]> {
  const { rows } = await pool.query(
    `SELECT username, label, points, kind FROM (
       SELECT m.username, s.label, s.points, s.created_at, 'cark' AS kind
       FROM wheel_spins s
       JOIN members m ON m.id = s.member_id
       UNION ALL
       SELECT m.username, c.label, c.points, c.created_at, 'sandik' AS kind
       FROM chest_opens c
       JOIN members m ON m.id = c.member_id
     ) moves
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((row) => ({
    username: String(row.username),
    label: String(row.label),
    points: Number(row.points),
    kind: row.kind === "sandik" ? "sandik" : "cark",
  }));
}

export async function listRecentSpins(limit = 8) {
  const { rows } = await pool.query(
    `SELECT s.label, s.points, s.created_at, m.username
     FROM wheel_spins s
     JOIN members m ON m.id = s.member_id
     ORDER BY s.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((row) => ({
    username: String(row.username),
    label: String(row.label),
    points: Number(row.points),
    createdAt: iso(row.created_at),
  }));
}

export async function lastWheelSpin(memberId: number | null) {
  const { rows } = await pool.query(
    memberId
      ? `SELECT label, points FROM wheel_spins WHERE member_id = $1 ORDER BY created_at DESC LIMIT 1`
      : `SELECT label, points FROM wheel_spins ORDER BY created_at DESC LIMIT 1`,
    memberId ? [memberId] : [],
  );
  const row = rows[0];
  if (!row) return null;
  return { label: String(row.label), points: Number(row.points) };
}

export async function playDice(memberId: number, stake: number, side: "over" | "under") {
  const config = await getPointsConfig();
  if (!config.diceEnabled) throw new PointsError(CLOSED_COPY, 400);
  if (!Number.isInteger(stake) || stake < config.diceMin || stake > config.diceMax) {
    throw new PointsError(`Bahis ${config.diceMin} ile ${config.diceMax} puan arasında olmalı.`, 400);
  }
  const payout = stake * config.diceMultiplier;
  if (payout > 1_000_000) throw new PointsError("Bu bahis kazancı limite sığmıyor.", 400);

  return withTx(async (client) => {
    await lockMember(client, memberId);
    const balance = await balanceOf(client, memberId);
    if (balance < stake) throw new PointsError("Puanın yetmiyor.", 400);
    const roll = randomInt(1, 101);
    await insertLedger(client, memberId, -stake, "Zar bahsi");
    let outcome: "win" | "loss" | "push" = "loss";
    let credit = 0;
    if (roll === 50) {
      await insertLedger(client, memberId, stake, "Zar iadesi");
      outcome = "push";
      credit = stake;
    } else if ((side === "over" && roll > 50) || (side === "under" && roll < 50)) {
      await insertLedger(client, memberId, payout, "Zar kazancı");
      outcome = "win";
      credit = payout;
    }
    await client.query(
      `INSERT INTO dice_bets (member_id, stake, side, roll, outcome, payout)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [memberId, stake, side, roll, outcome, credit],
    );
    return { roll, outcome, balance: await balanceOf(client, memberId) };
  });
}

export async function listCampaigns() {
  const { rows } = await pool.query(
    `SELECT c.id, c.title, c.bonus_summary, c.steps, c.button_label, c.site_id,
            s.name AS site_name, s.logo_url
     FROM sponsor_campaigns c
     JOIN sites s ON s.id = c.site_id
     WHERE c.active
     ORDER BY c.sort_order, c.id`,
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    bonusSummary: row.bonus_summary,
    steps: String(row.steps)
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter(Boolean),
    buttonLabel: row.button_label || "Siteye git",
    siteId: row.site_id,
    siteName: row.site_name,
    logoUrl: String(row.logo_url ?? "").trim(),
  }));
}

export async function getCampaign(id: number) {
  const rows = await listCampaigns();
  return rows.find((row) => row.id === id) ?? null;
}

export async function listOdds() {
  const { rows } = await pool.query(
    `SELECT o.id, o.site_id, o.site_label, o.body, o.event_at, o.source, s.name AS site_name
     FROM odds_cards o
     LEFT JOIN sites s ON s.id = o.site_id
     WHERE o.active
     ORDER BY o.sort_order, o.id DESC`,
  );
  return rows.map((row) => ({
    id: row.id,
    siteId: row.site_id,
    siteLabel: row.site_label || row.site_name || "Site",
    body: row.body,
    eventAt: iso(row.event_at),
    source: row.source,
  }));
}

export async function listMatches(memberId: number | null) {
  const { rows } = await pool.query(
    `SELECT m.id, m.home_team, m.away_team, m.lock_at, m.option_a, m.option_b, m.option_c,
            m.stake, m.payout_multiplier, m.winning, m.settled_at, m.active,
            p.option AS mine
     FROM matches m
     LEFT JOIN match_picks p ON p.match_id = m.id AND p.member_id = $1
     WHERE m.active OR m.settled_at IS NOT NULL
     ORDER BY m.lock_at ASC, m.id`,
    [memberId ?? 0],
  );
  return rows.map((row) => ({
    id: row.id,
    home: row.home_team,
    away: row.away_team,
    lockAt: iso(row.lock_at),
    options: { a: row.option_a, b: row.option_b, c: row.option_c },
    stake: row.stake,
    multiplier: row.payout_multiplier,
    winning: row.winning,
    settled: Boolean(row.settled_at),
    locked: new Date(row.lock_at).getTime() <= Date.now(),
    mine: memberId ? row.mine : null,
  }));
}

export async function pickMatch(memberId: number, matchId: number, option: "a" | "b" | "c") {
  const config = await getPointsConfig();
  if (!config.predictionsEnabled) throw new PointsError(CLOSED_COPY, 400);
  return withTx(async (client) => {
    const found = await client.query<{
      id: number;
      home_team: string;
      away_team: string;
      lock_at: Date;
      stake: number;
      active: boolean;
      settled_at: Date | null;
    }>(
      `SELECT id, home_team, away_team, lock_at, stake, active, settled_at
       FROM matches WHERE id = $1 FOR UPDATE`,
      [matchId],
    );
    const match = found.rows[0];
    if (!match || !match.active || match.settled_at) throw new PointsError("Tahmin kapalı.", 400);
    if (match.lock_at.getTime() <= Date.now()) throw new PointsError("Tahmin kilitlendi.", 400);
    await lockMember(client, memberId);
    if (match.stake > 0) {
      const balance = await balanceOf(client, memberId);
      if (balance < match.stake) throw new PointsError("Puanın yetmiyor.", 400);
      await insertLedger(client, memberId, -match.stake, `Tahmin: ${match.home_team} - ${match.away_team}`);
    }
    const inserted = await client.query(
      `INSERT INTO match_picks (match_id, member_id, option, stake)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (match_id, member_id) DO NOTHING
       RETURNING id`,
      [match.id, memberId, option, match.stake],
    );
    if ((inserted.rowCount ?? 0) === 0) throw new PointsError("Bu maça zaten tahmin yaptın.", 400);
    return { balance: await balanceOf(client, memberId) };
  });
}
