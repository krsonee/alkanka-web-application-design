import { pool } from "@/db";
import { hashPassword } from "@/lib/passwords";
import { getBalance, PointsError, updateMemberEmail } from "@/lib/points";
import { passwordIssue, pointReasonLabel } from "@/lib/points-rules";

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asInt(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type MemberDossier = {
  id: number;
  username: string;
  email: string;
  balance: number;
  createdAt: string;
  closedAt: string | null;
  ageConfirmed: boolean;
  telegramLinked: boolean;
  telegramUsername: string;
  games: {
    wheel: number;
    wheelLast: string | null;
    dice: number;
    diceLast: string | null;
    chest: number;
    chestLast: string | null;
    tasks: number;
    orders: number;
    tickets: number;
    picks: number;
    visits: number;
  };
  plays: MemberPlay[];
  ledger: { amount: number; reason: string; label: string; createdAt: string }[];
};

export type MemberPlay = {
  game: "wheel" | "dice" | "chest" | "pick";
  title: string;
  detail: string;
  outcome: "win" | "loss" | "push" | "open";
  amount: number;
  createdAt: string;
};

function dicePlays(
  rows: { id: number; amount: number; reason: string; created_at: Date }[],
  bets: { stake: number; side: string; roll: number; outcome: string; payout: number; created_at: Date }[],
): MemberPlay[] {
  const plays: MemberPlay[] = [];
  const ordered = [...rows].sort((a, b) => a.id - b.id);
  const stakes = ordered.filter((row) => row.reason === "Zar bahsi");
  const results = ordered.filter((row) => row.reason !== "Zar bahsi");
  const used = new Set<number>();
  for (let index = 0; index < stakes.length; index += 1) {
    const row = stakes[index];
    const nextStake = stakes[index + 1];
    const at = row.created_at.getTime();
    const result = results.find((item) => {
      if (used.has(item.id)) return false;
      const diff = Math.abs(item.created_at.getTime() - at);
      if (diff > 5000) return false;
      if (item.id < row.id && diff > 50) return false;
      if (nextStake && item.id >= nextStake.id) return false;
      return true;
    });
    if (result) used.add(result.id);
    const stake = Math.abs(asInt(row.amount));
    let outcome: MemberPlay["outcome"] = "loss";
    let payout = 0;
    if (result?.reason === "Zar iadesi") {
      outcome = "push";
      payout = asInt(result.amount);
    } else if (result?.reason === "Zar kazancı") {
      outcome = "win";
      payout = asInt(result.amount);
    }
    const betIndex = bets.findIndex((bet) => {
      const diff = Math.abs(new Date(bet.created_at).getTime() - at);
      return diff < 15000 && asInt(bet.stake) === stake && bet.outcome === outcome;
    });
    const bet = betIndex >= 0 ? bets.splice(betIndex, 1)[0] : null;
    const side = bet?.side === "over" ? "Üst" : bet?.side === "under" ? "Alt" : "";
    const roll = bet ? `gelen ${asInt(bet.roll)}` : "";
    const detail = [side, roll, `${stake.toLocaleString("tr-TR")} bahis`].filter(Boolean).join(" · ");
    plays.push({
      game: "dice",
      title: "Zar",
      detail,
      outcome,
      amount: outcome === "loss" ? -stake : outcome === "win" ? payout : 0,
      createdAt: iso(row.created_at) ?? "",
    });
  }
  for (const bet of bets) {
    const stake = asInt(bet.stake);
    const outcome = bet.outcome === "win" || bet.outcome === "push" ? bet.outcome : "loss";
    const side = bet.side === "over" ? "Üst" : bet.side === "under" ? "Alt" : "";
    plays.push({
      game: "dice",
      title: "Zar",
      detail: [side, `gelen ${asInt(bet.roll)}`, `${stake.toLocaleString("tr-TR")} bahis`].filter(Boolean).join(" · "),
      outcome,
      amount: outcome === "loss" ? -stake : outcome === "win" ? asInt(bet.payout) : 0,
      createdAt: iso(bet.created_at) ?? "",
    });
  }
  return plays;
}

export async function getMemberDossier(memberId: number): Promise<MemberDossier> {
  const { rows } = await pool.query<{
    id: number;
    username: string;
    email: string;
    created_at: Date;
    closed_at: Date | null;
    age_confirmed: boolean;
    telegram_id: string | null;
    telegram_username: string;
  }>(
    `SELECT id, username, email, created_at, closed_at, age_confirmed, telegram_id, telegram_username
     FROM members WHERE id = $1`,
    [memberId],
  );
  const member = rows[0];
  if (!member) throw new PointsError("Üye bulunamadı.", 404);

  const [games, ledger, wheelRows, chestRows, diceRows, diceBetRows, pickRows] = await Promise.all([
    pool.query<{
      wheel: number;
      wheel_last: Date | null;
      dice: number;
      dice_last: Date | null;
      chest: number;
      chest_last: Date | null;
      tasks: number;
      orders: number;
      tickets: number;
      picks: number;
      visits: number;
    }>(
      `SELECT
         (SELECT count(*)::int FROM wheel_spins WHERE member_id = $1) AS wheel,
         (SELECT max(created_at) FROM wheel_spins WHERE member_id = $1) AS wheel_last,
         (SELECT count(*)::int FROM point_ledger WHERE member_id = $1 AND reason = 'Zar bahsi') AS dice,
         (SELECT max(created_at) FROM point_ledger WHERE member_id = $1 AND reason = 'Zar bahsi') AS dice_last,
         (SELECT count(*)::int FROM chest_opens WHERE member_id = $1) AS chest,
         (SELECT max(created_at) FROM chest_opens WHERE member_id = $1) AS chest_last,
         (SELECT count(*)::int FROM point_task_claims WHERE member_id = $1) AS tasks,
         (SELECT count(*)::int FROM market_orders WHERE member_id = $1) AS orders,
         (SELECT count(*)::int FROM tickets WHERE member_id = $1) AS tickets,
         (SELECT count(*)::int FROM match_picks WHERE member_id = $1) AS picks,
         (SELECT count(*)::int FROM member_site_visits WHERE member_id = $1) AS visits`,
      [memberId],
    ),
    pool.query<{ amount: number; reason: string; created_at: Date }>(
      `SELECT amount, reason, created_at
       FROM point_ledger
       WHERE member_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 40`,
      [memberId],
    ),
    pool.query<{ label: string; points: number; created_at: Date }>(
      `SELECT label, points, created_at FROM wheel_spins
       WHERE member_id = $1 ORDER BY created_at DESC, id DESC LIMIT 30`,
      [memberId],
    ),
    pool.query<{ label: string; points: number; created_at: Date }>(
      `SELECT label, points, created_at FROM chest_opens
       WHERE member_id = $1 ORDER BY created_at DESC, id DESC LIMIT 30`,
      [memberId],
    ),
    pool.query<{ id: number; amount: number; reason: string; created_at: Date }>(
      `SELECT id, amount, reason, created_at FROM point_ledger
       WHERE member_id = $1 AND reason IN ('Zar bahsi', 'Zar iadesi', 'Zar kazancı')
       ORDER BY id ASC`,
      [memberId],
    ),
    pool.query<{ stake: number; side: string; roll: number; outcome: string; payout: number; created_at: Date }>(
      `SELECT stake, side, roll, outcome, payout, created_at FROM dice_bets
       WHERE member_id = $1 ORDER BY id ASC`,
      [memberId],
    ),
    pool.query<{
      stake: number;
      option: string;
      created_at: Date;
      home_team: string;
      away_team: string;
      option_a: string;
      option_b: string;
      option_c: string;
      winning: string | null;
      payout_multiplier: number;
      settled_at: Date | null;
    }>(
      `SELECT p.stake, p.option, p.created_at, m.home_team, m.away_team,
              m.option_a, m.option_b, m.option_c, m.winning, m.payout_multiplier, m.settled_at
       FROM match_picks p
       JOIN matches m ON m.id = p.match_id
       WHERE p.member_id = $1
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT 30`,
      [memberId],
    ),
  ]);
  const counts = games.rows[0];
  const wheelPlays: MemberPlay[] = wheelRows.rows.map((row) => {
    const points = asInt(row.points);
    return {
      game: "wheel",
      title: "Çark",
      detail: row.label,
      outcome: points > 0 ? "win" : "loss",
      amount: points,
      createdAt: iso(row.created_at) ?? "",
    };
  });
  const chestPlays: MemberPlay[] = chestRows.rows.map((row) => ({
    game: "chest",
    title: "Sandık",
    detail: row.label,
    outcome: "win",
    amount: asInt(row.points),
    createdAt: iso(row.created_at) ?? "",
  }));
  const pickPlays: MemberPlay[] = pickRows.rows.map((row) => {
    const choice = row.option === "a" ? row.option_a : row.option === "b" ? row.option_b : row.option_c;
    const stake = asInt(row.stake);
    const settled = Boolean(row.settled_at);
    const won = settled && row.winning === row.option;
    const outcome: MemberPlay["outcome"] = !settled ? "open" : won ? "win" : "loss";
    const payout = won ? stake * asInt(row.payout_multiplier) : 0;
    return {
      game: "pick",
      title: "Tahmin",
      detail: `${row.home_team} - ${row.away_team} · ${choice} · ${stake.toLocaleString("tr-TR")} bahis`,
      outcome,
      amount: outcome === "win" ? payout : outcome === "loss" ? -stake : 0,
      createdAt: iso(row.created_at) ?? "",
    };
  });
  const plays = [...wheelPlays, ...dicePlays(diceRows.rows, [...diceBetRows.rows]), ...chestPlays, ...pickPlays]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, 40);

  return {
    id: member.id,
    username: member.username,
    email: member.email ?? "",
    balance: await getBalance(memberId),
    createdAt: iso(member.created_at) ?? "",
    closedAt: iso(member.closed_at),
    ageConfirmed: member.age_confirmed,
    telegramLinked: Boolean(member.telegram_id),
    telegramUsername: member.telegram_username ?? "",
    games: {
      wheel: asInt(counts?.wheel),
      wheelLast: iso(counts?.wheel_last),
      dice: asInt(counts?.dice),
      diceLast: iso(counts?.dice_last),
      chest: asInt(counts?.chest),
      chestLast: iso(counts?.chest_last),
      tasks: asInt(counts?.tasks),
      orders: asInt(counts?.orders),
      tickets: asInt(counts?.tickets),
      picks: asInt(counts?.picks),
      visits: asInt(counts?.visits),
    },
    plays,
    ledger: ledger.rows.map((row) => ({
      amount: asInt(row.amount),
      reason: row.reason,
      label: pointReasonLabel(row.reason),
      createdAt: iso(row.created_at) ?? "",
    })),
  };
}

export async function setMemberClosed(memberId: number, closed: boolean) {
  const { rows } = await pool.query<{ closed_at: Date | null }>(
    `UPDATE members SET closed_at = CASE WHEN $2 THEN now() ELSE NULL END
     WHERE id = $1
     RETURNING closed_at`,
    [memberId, closed],
  );
  if (rows.length === 0) throw new PointsError("Üye bulunamadı.", 404);
  return { closedAt: iso(rows[0].closed_at) };
}

export async function setMemberPassword(memberId: number, password: string) {
  const issue = passwordIssue(password);
  if (issue) throw new PointsError(issue, 400);
  const passwordHash = await hashPassword(password);
  const updated = await pool.query(`UPDATE members SET password_hash = $2 WHERE id = $1`, [memberId, passwordHash]);
  if ((updated.rowCount ?? 0) === 0) throw new PointsError("Üye bulunamadı.", 404);
  return { ok: true };
}

export async function setMemberEmail(memberId: number, email: string) {
  return updateMemberEmail(memberId, email);
}

export async function unlinkMemberTelegram(memberId: number) {
  const updated = await pool.query(
    `UPDATE members SET telegram_id = NULL, telegram_username = '' WHERE id = $1`,
    [memberId],
  );
  if ((updated.rowCount ?? 0) === 0) throw new PointsError("Üye bulunamadı.", 404);
  return { ok: true };
}
