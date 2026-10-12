import { pool } from "@/db";
import { balanceOf, insertLedger, lockMember, PointsError, savePointsSettings, withTx } from "@/lib/points";
import { TASK_TYPES } from "@/lib/engage";

function line(value: unknown, max: number, min = 1) {
  const clean = String(value ?? "").trim().replace(/\s+/g, " ");
  if (clean.length < min || clean.length > max) return null;
  return clean;
}

function block(value: unknown, max: number) {
  const clean = String(value ?? "").replace(/\r\n/g, "\n").trim();
  if (clean.length > max) return null;
  return clean;
}

function intIn(value: unknown, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function flag(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return fallback;
}

export async function deskGet(section: string) {
  if (section === "tasks") {
    const { rows } = await pool.query(
      `SELECT id, title, description, reward, task_type, code, site_id, repeat_daily, active, sort_order
       FROM point_tasks ORDER BY sort_order, id`,
    );
    return { tasks: rows };
  }
  if (section === "market") {
    const [rewards, orders] = await Promise.all([
      pool.query(
        `SELECT id, name, description, image_url, price, stock, active, sort_order
         FROM market_rewards ORDER BY sort_order, id`,
      ),
      pool.query(
        `SELECT o.id, o.reward_name, o.price, o.status, o.created_at, m.username
         FROM market_orders o JOIN members m ON m.id = o.member_id
         ORDER BY o.created_at DESC LIMIT 100`,
      ),
    ]);
    return { rewards: rewards.rows, orders: orders.rows };
  }
  if (section === "tickets") {
    const { rows } = await pool.query(
      `SELECT e.id, e.title, e.ticket_price, e.per_user_cap, e.ends_at, e.prize_points,
              e.active, e.winning_number, e.drawn_at,
              (SELECT count(*)::int FROM tickets t WHERE t.event_id = e.id) AS sold
       FROM ticket_events e ORDER BY e.created_at DESC`,
    );
    return { events: rows };
  }
  if (section === "wheel") {
    const { rows } = await pool.query(
      `SELECT id, label, points, weight, active, sort_order FROM wheel_slices ORDER BY sort_order, id`,
    );
    return { slices: rows };
  }
  if (section === "campaigns") {
    const [campaigns, sites] = await Promise.all([
      pool.query(
        `SELECT id, site_id, title, bonus_summary, steps, button_label, active, sort_order
         FROM sponsor_campaigns ORDER BY sort_order, id`,
      ),
      pool.query(`SELECT id, name FROM sites WHERE active ORDER BY name`),
    ]);
    return { campaigns: campaigns.rows, sites: sites.rows };
  }
  if (section === "matches") {
    const { rows } = await pool.query(
      `SELECT id, home_team, away_team, lock_at, option_a, option_b, option_c, stake,
              payout_multiplier, winning, active, settled_at
       FROM matches ORDER BY lock_at DESC, id DESC`,
    );
    return { matches: rows };
  }
  if (section === "odds") {
    const [cards, sites] = await Promise.all([
      pool.query(
        `SELECT id, site_id, site_label, body, event_at, active, source, sort_order
         FROM odds_cards ORDER BY sort_order, id DESC`,
      ),
      pool.query(`SELECT id, name FROM sites WHERE active ORDER BY name`),
    ]);
    return { cards: cards.rows, sites: sites.rows };
  }
  throw new PointsError("Bölüm bulunamadı.", 404);
}

export async function deskPost(body: Record<string, unknown>) {
  const section = String(body.section ?? "");
  const action = String(body.action ?? "");
  if (section === "settings" && action === "save") return savePointsSettings(body);
  if (section === "tasks") return taskAction(action, body);
  if (section === "market") return marketAction(action, body);
  if (section === "tickets") return ticketAction(action, body);
  if (section === "wheel") return wheelAction(action, body);
  if (section === "campaigns") return campaignAction(action, body);
  if (section === "matches") return matchAction(action, body);
  if (section === "odds") return oddsAction(action, body);
  throw new PointsError("İşlem bulunamadı.", 404);
}

async function taskAction(action: string, body: Record<string, unknown>) {
  if (action === "delete") {
    const id = intIn(body.id, 1, 1_000_000_000);
    if (!id) throw new PointsError("Görev bulunamadı.", 404);
    await pool.query(`DELETE FROM point_tasks WHERE id = $1`, [id]);
    return { ok: true };
  }
  const title = line(body.title, 80);
  const description = block(body.description, 500) ?? "";
  const reward = intIn(body.reward, 0, 1_000_000);
  const taskType = String(body.taskType ?? "");
  const sortOrder = intIn(body.sortOrder, 0, 10_000) ?? 0;
  if (!title || reward == null || !TASK_TYPES.includes(taskType as (typeof TASK_TYPES)[number])) {
    throw new PointsError("Görev alanları eksik.", 400);
  }
  const code = taskType === "enter_code" ? line(body.code, 40) : "";
  if (taskType === "enter_code" && !code) throw new PointsError("Kod yazın.", 400);
  const siteId = intIn(body.siteId, 1, 1_000_000_000);
  const repeat = taskType === "daily_login" ? true : flag(body.repeatDaily, false);
  const active = flag(body.active, true);
  if (action === "create") {
    await pool.query(
      `INSERT INTO point_tasks (title, description, reward, task_type, code, site_id, repeat_daily, active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [title, description, reward, taskType, code ?? "", siteId, repeat, active, sortOrder],
    );
    return { ok: true };
  }
  const id = intIn(body.id, 1, 1_000_000_000);
  if (!id) throw new PointsError("Görev bulunamadı.", 404);
  await pool.query(
    `UPDATE point_tasks
     SET title = $2, description = $3, reward = $4, task_type = $5, code = $6, site_id = $7,
         repeat_daily = $8, active = $9, sort_order = $10
     WHERE id = $1`,
    [id, title, description, reward, taskType, code ?? "", siteId, repeat, active, sortOrder],
  );
  return { ok: true };
}

async function marketAction(action: string, body: Record<string, unknown>) {
  if (action === "approve" || action === "reject") return decideOrder(action, intIn(body.id, 1, 1_000_000_000));
  if (action === "delete") {
    const id = intIn(body.id, 1, 1_000_000_000);
    if (!id) throw new PointsError("Ödül bulunamadı.", 404);
    const used = await pool.query(`SELECT 1 FROM market_orders WHERE reward_id = $1 LIMIT 1`, [id]);
    if ((used.rowCount ?? 0) > 0) {
      await pool.query(`UPDATE market_rewards SET active = false WHERE id = $1`, [id]);
      return { ok: true, closed: true };
    }
    await pool.query(`DELETE FROM market_rewards WHERE id = $1`, [id]);
    return { ok: true };
  }
  const name = line(body.name, 80);
  const description = block(body.description, 800) ?? "";
  const imageUrl = String(body.imageUrl ?? "").trim().slice(0, 400);
  const price = intIn(body.price, 1, 1_000_000);
  const unlimited = flag(body.unlimited, false);
  const stock = unlimited ? -1 : intIn(body.stock, 0, 1_000_000);
  const sortOrder = intIn(body.sortOrder, 0, 10_000) ?? 0;
  const active = flag(body.active, true);
  if (!name || price == null || stock == null) throw new PointsError("Ödül alanları eksik.", 400);
  if (imageUrl && !/^(\/|https?:\/\/)/.test(imageUrl)) {
    throw new PointsError("Görsel adresi / ile veya https ile başlamalı.", 400);
  }
  if (action === "create") {
    await pool.query(
      `INSERT INTO market_rewards (name, description, image_url, price, stock, active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [name, description, imageUrl, price, stock, active, sortOrder],
    );
    return { ok: true };
  }
  const id = intIn(body.id, 1, 1_000_000_000);
  if (!id) throw new PointsError("Ödül bulunamadı.", 404);
  await pool.query(
    `UPDATE market_rewards
     SET name = $2, description = $3, image_url = $4, price = $5, stock = $6, active = $7, sort_order = $8
     WHERE id = $1`,
    [id, name, description, imageUrl, price, stock, active, sortOrder],
  );
  return { ok: true };
}

async function decideOrder(action: string, id: number | null) {
  if (!id) throw new PointsError("Sipariş bulunamadı.", 404);
  return withTx(async (client) => {
    const found = await client.query<{
      id: number;
      member_id: number;
      reward_id: number;
      reward_name: string;
      price: number;
      status: string;
    }>(`SELECT id, member_id, reward_id, reward_name, price, status FROM market_orders WHERE id = $1 FOR UPDATE`, [
      id,
    ]);
    const order = found.rows[0];
    if (!order || order.status !== "pending") {
      throw new PointsError("Sipariş bulunamadı veya sonuçlanmış.", 404);
    }
    if (action === "approve") {
      await client.query(
        `UPDATE market_orders SET status = 'approved', decided_at = now() WHERE id = $1`,
        [id],
      );
      return { ok: true };
    }
    await lockMember(client, order.member_id);
    const reward = await client.query<{ stock: number }>(
      `SELECT stock FROM market_rewards WHERE id = $1 FOR UPDATE`,
      [order.reward_id],
    );
    if (reward.rows[0] && reward.rows[0].stock >= 0) {
      await client.query(`UPDATE market_rewards SET stock = stock + 1 WHERE id = $1`, [order.reward_id]);
    }
    await client.query(
      `UPDATE market_orders SET status = 'rejected', decided_at = now() WHERE id = $1`,
      [id],
    );
    await insertLedger(client, order.member_id, order.price, `Market iadesi: ${order.reward_name}`);
    return { ok: true, balance: await balanceOf(client, order.member_id) };
  });
}

async function ticketAction(action: string, body: Record<string, unknown>) {
  if (action === "draw") return drawEvent(intIn(body.id, 1, 1_000_000_000));
  const title = line(body.title, 80);
  const price = intIn(body.ticketPrice, 1, 1_000_000);
  const cap = intIn(body.perUserCap, 1, 1000);
  const prize = intIn(body.prizePoints, 1, 1_000_000);
  const endsAt = new Date(String(body.endsAt ?? ""));
  const active = flag(body.active, true);
  if (!title || price == null || cap == null || prize == null || Number.isNaN(endsAt.getTime())) {
    throw new PointsError("Bilet alanları eksik.", 400);
  }
  if (action === "create") {
    await pool.query(
      `INSERT INTO ticket_events (title, ticket_price, per_user_cap, ends_at, prize_points, active)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [title, price, cap, endsAt.toISOString(), prize, active],
    );
    return { ok: true };
  }
  const id = intIn(body.id, 1, 1_000_000_000);
  if (!id) throw new PointsError("Etkinlik bulunamadı.", 404);
  await pool.query(
    `UPDATE ticket_events
     SET title = $2, ticket_price = $3, per_user_cap = $4, ends_at = $5, prize_points = $6, active = $7
     WHERE id = $1 AND drawn_at IS NULL`,
    [id, title, price, cap, endsAt.toISOString(), prize, active],
  );
  return { ok: true };
}

async function drawEvent(id: number | null) {
  if (!id) throw new PointsError("Etkinlik bulunamadı.", 404);
  return withTx(async (client) => {
    const found = await client.query<{ id: number; title: string; prize_points: number; drawn_at: Date | null }>(
      `SELECT id, title, prize_points, drawn_at FROM ticket_events WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const event = found.rows[0];
    if (!event) throw new PointsError("Etkinlik bulunamadı.", 404);
    if (event.drawn_at) throw new PointsError("Çekiliş zaten yapıldı.", 400);
    const ticket = await client.query<{ id: number; member_id: number; number: number }>(
      `SELECT id, member_id, number FROM tickets WHERE event_id = $1 ORDER BY random() LIMIT 1`,
      [id],
    );
    const winner = ticket.rows[0];
    if (!winner) throw new PointsError("Satılmış bilet yok.", 400);
    await lockMember(client, winner.member_id);
    await insertLedger(client, winner.member_id, event.prize_points, `Bilet ödülü: ${event.title}`);
    await client.query(
      `UPDATE ticket_events
       SET winner_ticket_id = $2, winner_member_id = $3, winning_number = $4, drawn_at = now()
       WHERE id = $1`,
      [id, winner.id, winner.member_id, winner.number],
    );
    return { ok: true, number: winner.number };
  });
}

async function wheelAction(action: string, body: Record<string, unknown>) {
  if (action === "delete") {
    const id = intIn(body.id, 1, 1_000_000_000);
    if (!id) throw new PointsError("Dilim bulunamadı.", 404);
    await pool.query(`DELETE FROM wheel_slices WHERE id = $1`, [id]);
    return { ok: true };
  }
  const label = line(body.label, 40);
  const points = intIn(body.points, 0, 1_000_000);
  const weight = intIn(body.weight, 1, 1_000_000);
  const sortOrder = intIn(body.sortOrder, 0, 10_000) ?? 0;
  const active = flag(body.active, true);
  if (!label) throw new PointsError("Dilim adı yazın.", 400);
  if (points == null) throw new PointsError("Puan 0 ile 1.000.000 arasında tam sayı olmalı.", 400);
  if (weight == null) throw new PointsError("Ağırlık en az 1 olmalı.", 400);
  if (action === "create") {
    const inserted = await pool.query(
      `INSERT INTO wheel_slices (label, points, weight, active, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, label, points, weight, active, sort_order`,
      [label, points, weight, active, sortOrder],
    );
    return { ok: true, slice: inserted.rows[0] };
  }
  const id = intIn(body.id, 1, 1_000_000_000);
  if (!id) throw new PointsError("Dilim bulunamadı.", 404);
  await pool.query(
    `UPDATE wheel_slices SET label = $2, points = $3, weight = $4, active = $5, sort_order = $6 WHERE id = $1`,
    [id, label, points, weight, active, sortOrder],
  );
  return { ok: true };
}

async function campaignAction(action: string, body: Record<string, unknown>) {
  if (action === "delete") {
    const id = intIn(body.id, 1, 1_000_000_000);
    if (!id) throw new PointsError("Kampanya bulunamadı.", 404);
    await pool.query(`DELETE FROM sponsor_campaigns WHERE id = $1`, [id]);
    return { ok: true };
  }
  const siteId = intIn(body.siteId, 1, 1_000_000_000);
  const title = line(body.title, 80);
  const bonus = block(body.bonusSummary, 400) ?? "";
  const steps = block(body.steps, 2000) ?? "";
  const button = line(body.buttonLabel, 40) ?? "Siteye git";
  const sortOrder = intIn(body.sortOrder, 0, 10_000) ?? 0;
  const active = flag(body.active, true);
  if (!siteId || !title) throw new PointsError("Kampanya alanları eksik.", 400);
  const site = await pool.query(`SELECT id FROM sites WHERE id = $1`, [siteId]);
  if ((site.rowCount ?? 0) === 0) throw new PointsError("Site bulunamadı.", 404);
  if (action === "create") {
    await pool.query(
      `INSERT INTO sponsor_campaigns (site_id, title, bonus_summary, steps, button_label, active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [siteId, title, bonus, steps, button, active, sortOrder],
    );
    return { ok: true };
  }
  const id = intIn(body.id, 1, 1_000_000_000);
  if (!id) throw new PointsError("Kampanya bulunamadı.", 404);
  await pool.query(
    `UPDATE sponsor_campaigns
     SET site_id = $2, title = $3, bonus_summary = $4, steps = $5, button_label = $6, active = $7, sort_order = $8
     WHERE id = $1`,
    [id, siteId, title, bonus, steps, button, active, sortOrder],
  );
  return { ok: true };
}

async function matchAction(action: string, body: Record<string, unknown>) {
  if (action === "settle") {
    const id = intIn(body.id, 1, 1_000_000_000);
    const winning = String(body.winning ?? "");
    if (!id || !["a", "b", "c"].includes(winning)) throw new PointsError("Sonuç eksik.", 400);
    return withTx(async (client) => {
      const found = await client.query<{
        id: number;
        home_team: string;
        away_team: string;
        payout_multiplier: number;
        settled_at: Date | null;
      }>(
        `SELECT id, home_team, away_team, payout_multiplier, settled_at FROM matches WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const match = found.rows[0];
      if (!match) throw new PointsError("Maç bulunamadı.", 404);
      if (match.settled_at) throw new PointsError("Maç zaten sonuçlandı.", 400);
      await client.query(
        `UPDATE matches SET winning = $2, settled_at = now() WHERE id = $1`,
        [id, winning],
      );
      const winners = await client.query<{ member_id: number; stake: number }>(
        `SELECT member_id, stake FROM match_picks WHERE match_id = $1 AND option = $2 ORDER BY member_id`,
        [id, winning],
      );
      for (const winner of winners.rows) {
        if (winner.stake <= 0) continue;
        const payout = winner.stake * match.payout_multiplier;
        if (payout <= 0 || payout > 1_000_000) continue;
        await lockMember(client, winner.member_id);
        await insertLedger(
          client,
          winner.member_id,
          payout,
          `Tahmin kazancı: ${match.home_team} - ${match.away_team}`,
        );
      }
      return { ok: true, paid: winners.rows.length };
    });
  }
  const home = line(body.home, 60);
  const away = line(body.away, 60);
  const optionA = line(body.optionA, 40) ?? "Ev sahibi";
  const optionB = line(body.optionB, 40) ?? "Beraberlik";
  const optionC = line(body.optionC, 40) ?? "Deplasman";
  const stake = intIn(body.stake, 0, 1_000_000);
  const multiplier = intIn(body.multiplier, 1, 20);
  const lockAt = new Date(String(body.lockAt ?? ""));
  const active = flag(body.active, true);
  if (!home || !away || stake == null || multiplier == null || Number.isNaN(lockAt.getTime())) {
    throw new PointsError("Maç alanları eksik.", 400);
  }
  if (action === "create") {
    await pool.query(
      `INSERT INTO matches (home_team, away_team, lock_at, option_a, option_b, option_c, stake, payout_multiplier, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [home, away, lockAt.toISOString(), optionA, optionB, optionC, stake, multiplier, active],
    );
    return { ok: true };
  }
  throw new PointsError("İşlem bulunamadı.", 404);
}

async function oddsAction(action: string, body: Record<string, unknown>) {
  if (action === "delete") {
    const id = intIn(body.id, 1, 1_000_000_000);
    if (!id) throw new PointsError("Kart bulunamadı.", 404);
    await pool.query(`DELETE FROM odds_cards WHERE id = $1`, [id]);
    return { ok: true };
  }
  const siteLabel = line(body.siteLabel, 80, 0) ?? "";
  const text = block(body.body, 800);
  const siteId = intIn(body.siteId, 1, 1_000_000_000);
  const sortOrder = intIn(body.sortOrder, 0, 10_000) ?? 0;
  const active = flag(body.active, true);
  const eventRaw = String(body.eventAt ?? "").trim();
  const eventAt = eventRaw ? new Date(eventRaw) : null;
  if (!text) throw new PointsError("Oran metni yazın.", 400);
  if (eventAt && Number.isNaN(eventAt.getTime())) throw new PointsError("Saat hatalı.", 400);
  if (action === "create") {
    await pool.query(
      `INSERT INTO odds_cards (site_id, site_label, body, event_at, active, source, sort_order)
       VALUES ($1, $2, $3, $4, $5, 'manual', $6)`,
      [siteId, siteLabel, text, eventAt ? eventAt.toISOString() : null, active, sortOrder],
    );
    return { ok: true };
  }
  const id = intIn(body.id, 1, 1_000_000_000);
  if (!id) throw new PointsError("Kart bulunamadı.", 404);
  await pool.query(
    `UPDATE odds_cards
     SET site_id = $2, site_label = $3, body = $4, event_at = $5, active = $6, sort_order = $7
     WHERE id = $1`,
    [id, siteId, siteLabel, text, eventAt ? eventAt.toISOString() : null, active, sortOrder],
  );
  return { ok: true };
}
