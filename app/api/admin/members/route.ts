import { requireAuth } from "@/lib/admin-gate";
import { getPointsConfig, listMembers, pointsFailure } from "@/lib/points";
import { NextRequest, NextResponse } from "next/server";

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? "";
  const csv = url.searchParams.get("format") === "csv";
  try {
    const members = await listMembers(search, csv ? 20000 : 500);
    if (csv) {
      const lines = [
        ["Kullanıcı adı", "E-posta", "Puan", "Telegram", "Durum", "Kayıt tarihi"].map(csvCell).join(","),
        ...members.map((member) =>
          [
            member.username,
            member.email,
            String(member.balance),
            member.telegramLinked ? member.telegramUsername || "bağlı" : "yok",
            member.closedAt ? "kapalı" : "açık",
            member.createdAt.slice(0, 10),
          ]
            .map(csvCell)
            .join(","),
        ),
      ];
      return new NextResponse(`\uFEFF${lines.join("\n")}\n`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="uyeler.csv"',
        },
      });
    }
    const config = await getPointsConfig();
    return NextResponse.json({ members, ...config });
  } catch (err) {
    return pointsFailure(err);
  }
}
