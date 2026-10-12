import { pool } from "@/db";
import { getCurrentMember } from "@/lib/member-auth";
import { balanceOf, getBalance as ledgerBalance, insertLedger, lockMember, withTx } from "@/lib/points";

export type Member = { id: string; name: string; email: string };

export async function getMember(): Promise<Member | null> {
  const member = await getCurrentMember();
  if (!member) return null;
  return { id: String(member.id), name: member.username, email: "" };
}

function memberId(userId: string) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Üye bulunamadı.");
  return id;
}

export async function getBalance(userId: string): Promise<number> {
  return ledgerBalance(memberId(userId));
}

export async function debit(userId: string, amount: number, reason = "Masa bahsi"): Promise<boolean> {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("Geçersiz tutar.");
  if (amount === 0) return true;
  const id = memberId(userId);
  return withTx(async (client) => {
    await lockMember(client, id);
    const balance = await balanceOf(client, id);
    if (balance < amount) return false;
    await insertLedger(client, id, -amount, reason.slice(0, 160));
    return true;
  });
}

export async function credit(userId: string, amount: number, reason = "Masa kazancı") {
  if (!Number.isInteger(amount) || amount <= 0) return;
  const id = memberId(userId);
  await withTx(async (client) => {
    await lockMember(client, id);
    await insertLedger(client, id, amount, reason.slice(0, 160));
  });
}

export type HistoryInput = {
  userId: string;
  userName: string;
  game: string;
  mode: string;
  opponent: string;
  stake: number;
  result: "win" | "loss" | "draw" | "refund";
  delta: number;
  score?: number | null;
  tableId?: string | null;
};

export async function recordHistory(h: HistoryInput) {
  await pool.query(
    `INSERT INTO game_history (user_id, user_name, game, mode, opponent, stake, result, delta, score, table_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [h.userId, h.userName, h.game, h.mode, h.opponent, h.stake, h.result, h.delta, h.score ?? null, h.tableId ?? null],
  );
}
