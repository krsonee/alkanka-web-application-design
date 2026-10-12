import { randomInt } from "crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import {
  CHEST_TABLE,
  chestLabel,
  diceReward,
  isChestId,
  WHEEL_SEGMENTS,
  wheelIndex,
  type ChestId,
} from "@/lib/mini-games";
import {
  balanceOf,
  getPointsConfig,
  insertLedger,
  lockMember,
  PointsError,
  withTx,
} from "@/lib/points";
import { CLOSED_COPY, istanbulDay } from "@/lib/points-rules";

export type MiniGame = "cark" | "zar" | "sandik";

const USED_COPY: Record<MiniGame, string> = {
  cark: "Bugünkü çevirmeni kullandın.",
  zar: "Bugünkü zar haklarını kullandın.",
  sandik: "Bugünkü sandığını açtın.",
};

export async function playCaps() {
  const config = await getPointsConfig();
  return {
    cark: config.wheelEnabled ? config.wheelDaily : 0,
    zar: config.diceEnabled ? config.diceDaily : 0,
    sandik: config.chestDaily,
  };
}

export async function usedToday(client: PoolClient, memberId: number, game: MiniGame, day: string) {
  if (game === "cark") {
    const { rows } = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM wheel_spins WHERE member_id = $1 AND claim_day = $2::date`,
      [memberId, day],
    );
    return rows[0]?.n ?? 0;
  }
  if (game === "sandik") {
    const { rows } = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM chest_opens WHERE member_id = $1 AND claim_day = $2::date`,
      [memberId, day],
    );
    return rows[0]?.n ?? 0;
  }
  const { rows } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM mini_plays WHERE member_id = $1 AND game = 'zar' AND claim_day = $2::date`,
    [memberId, day],
  );
  return rows[0]?.n ?? 0;
}

async function takeTurn(client: PoolClient, memberId: number, game: MiniGame, day: string, cap: number) {
  if (cap <= 0) throw new PointsError(CLOSED_COPY, 400);
  const used = await usedToday(client, memberId, game, day);
  if (used >= cap) throw new PointsError(USED_COPY[game], 400);
  return used;
}

export async function miniStatus(memberId: number) {
  const day = istanbulDay();
  const caps = await playCaps();
  const [wheel, dice, chest] = await Promise.all([
    pool.query<{ label: string; points: number; n: number }>(
      `SELECT label, points, count(*) OVER ()::int AS n
       FROM wheel_spins WHERE member_id = $1 AND claim_day = $2::date
       ORDER BY id DESC LIMIT 1`,
      [memberId, day],
    ),
    pool.query<{ label: string; points: number; detail: string; n: number }>(
      `SELECT label, points, detail, count(*) OVER ()::int AS n
       FROM mini_plays WHERE member_id = $1 AND game = 'zar' AND claim_day = $2::date
       ORDER BY id DESC LIMIT 1`,
      [memberId, day],
    ),
    pool.query<{ chest: string; label: string; points: number; n: number }>(
      `SELECT chest, label, points, count(*) OVER ()::int AS n
       FROM chest_opens WHERE member_id = $1 AND claim_day = $2::date
       ORDER BY id DESC LIMIT 1`,
      [memberId, day],
    ),
  ]);
  const wheelRow = wheel.rows[0];
  const diceRow = dice.rows[0];
  const chestRow = chest.rows[0];
  const faces = String(diceRow?.detail ?? "").split("-").map((part) => Number(part));
  const dicePair: [number, number] | null =
    faces.length === 2 && faces.every((face) => face >= 1 && face <= 6) ? [faces[0], faces[1]] : null;
  return {
    cark: {
      used: wheelRow?.n ?? 0,
      limit: caps.cark,
      last: wheelRow
        ? { index: wheelIndex(wheelRow.label), label: wheelRow.label, points: Number(wheelRow.points) }
        : null,
    },
    zar: {
      used: diceRow?.n ?? 0,
      limit: caps.zar,
      last: diceRow && dicePair ? { dice: dicePair, label: diceRow.label, points: Number(diceRow.points) } : null,
    },
    sandik: {
      used: chestRow?.n ?? 0,
      limit: caps.sandik,
      last: chestRow
        ? { chest: String(chestRow.chest), label: chestRow.label, points: Number(chestRow.points) }
        : null,
    },
  };
}

export async function playDesignWheel(memberId: number) {
  const day = istanbulDay();
  const cap = (await playCaps()).cark;
  return withTx(async (client) => {
    await lockMember(client, memberId);
    const used = await takeTurn(client, memberId, "cark", day, cap);
    const index = randomInt(WHEEL_SEGMENTS.length);
    const segment = WHEEL_SEGMENTS[index];
    await client.query(
      `INSERT INTO wheel_spins (member_id, slice_id, label, points, claim_day)
       VALUES ($1, NULL, $2, $3, $4::date)`,
      [memberId, segment.label, segment.points, day],
    );
    if (segment.points > 0) {
      await insertLedger(client, memberId, segment.points, `Çark: ${segment.label}`);
    }
    return {
      index,
      label: segment.label,
      points: segment.points,
      balance: await balanceOf(client, memberId),
      used: used + 1,
      limit: cap,
    };
  });
}

export async function playDesignDice(memberId: number) {
  const day = istanbulDay();
  const cap = (await playCaps()).zar;
  return withTx(async (client) => {
    await lockMember(client, memberId);
    const used = await takeTurn(client, memberId, "zar", day, cap);
    const dice: [number, number] = [randomInt(1, 7), randomInt(1, 7)];
    const reward = diceReward(dice[0], dice[1]);
    await client.query(
      `INSERT INTO mini_plays (member_id, game, label, points, detail, claim_day)
       VALUES ($1, 'zar', $2, $3, $4, $5::date)`,
      [memberId, reward.label, reward.points, `${dice[0]}-${dice[1]}`, day],
    );
    await insertLedger(client, memberId, reward.points, `Zar: ${reward.label}`);
    return {
      dice,
      label: reward.label,
      points: reward.points,
      balance: await balanceOf(client, memberId),
      used: used + 1,
      limit: cap,
    };
  });
}

export async function playDesignChest(memberId: number, chestId: string) {
  if (!isChestId(chestId)) throw new PointsError("Sandık seçin.", 400);
  const chest = CHEST_TABLE.find((item) => item.id === chestId) as (typeof CHEST_TABLE)[number];
  const day = istanbulDay();
  const cap = (await playCaps()).sandik;
  return withTx(async (client) => {
    await lockMember(client, memberId);
    const used = await takeTurn(client, memberId, "sandik", day, cap);
    const points = chest.rewards[randomInt(chest.rewards.length)];
    const label = chestLabel(points);
    await client.query(
      `INSERT INTO chest_opens (member_id, chest, label, points, claim_day)
       VALUES ($1, $2, $3, $4, $5::date)`,
      [memberId, chest.id satisfies ChestId, label, points, day],
    );
    await insertLedger(client, memberId, points, `Sandık: ${label}`);
    return {
      chest: chest.id,
      label,
      points,
      balance: await balanceOf(client, memberId),
      used: used + 1,
      limit: cap,
    };
  });
}
