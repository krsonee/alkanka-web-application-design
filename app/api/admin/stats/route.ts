import { db } from "@/db";
import { sites } from "@/db/schema";
import { requireAuth } from "@/lib/admin-gate";
import { displayTargetLabel, istanbulDayStart, TARGET_LABELS } from "@/lib/analytics";
import { desc, gt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CountRow = {
  pageviews: number;
  clicks: number;
  visitors: number;
};

type TargetRow = {
  target: string;
  label: string;
  count: number;
};

type SiteRow = {
  target_id: number;
  label: string;
  count: number;
};

type HourRow = {
  hour_ms: string | number;
  pageviews: number;
  clicks: number;
};

type RecentRow = {
  id: number;
  kind: string;
  target: string;
  target_id: number | null;
  label: string;
  created_at: string | Date;
};

async function rowsOf<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  const withRows = result as { rows?: T[] };
  return withRows.rows ?? [];
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const now = new Date();
  const todayStart = istanbulDayStart(now);
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const liveStart = new Date(now.getTime() - 5 * 60_000);
  const hourStart = new Date(now.getTime() - 24 * 60 * 60_000);

  const [todayRows, yesterdayRows, allRows, liveRows, targetRows, siteTodayRows, hourRows, recentRows, topSites] =
    await Promise.all([
      rowsOf<CountRow>(sql`
        SELECT
          count(*) FILTER (WHERE kind = 'pageview')::int AS pageviews,
          count(*) FILTER (WHERE kind = 'click')::int AS clicks,
          count(DISTINCT visitor_id) FILTER (WHERE visitor_id <> '')::int AS visitors
        FROM analytics_events
        WHERE created_at >= ${todayStart}
      `),
      rowsOf<CountRow>(sql`
        SELECT
          count(*) FILTER (WHERE kind = 'pageview')::int AS pageviews,
          count(*) FILTER (WHERE kind = 'click')::int AS clicks,
          count(DISTINCT visitor_id) FILTER (WHERE visitor_id <> '')::int AS visitors
        FROM analytics_events
        WHERE created_at >= ${yesterdayStart} AND created_at < ${todayStart}
      `),
      rowsOf<CountRow>(sql`
        SELECT
          count(*) FILTER (WHERE kind = 'pageview')::int AS pageviews,
          count(*) FILTER (WHERE kind = 'click')::int AS clicks,
          count(DISTINCT visitor_id) FILTER (WHERE visitor_id <> '')::int AS visitors
        FROM analytics_events
      `),
      rowsOf<{ online: number }>(sql`
        SELECT count(DISTINCT visitor_id)::int AS online
        FROM analytics_events
        WHERE created_at >= ${liveStart} AND visitor_id <> ''
      `),
      rowsOf<TargetRow>(sql`
        SELECT target, coalesce(max(label), '') AS label, count(*)::int AS count
        FROM analytics_events
        WHERE kind = 'click' AND created_at >= ${todayStart}
        GROUP BY target
        ORDER BY count DESC
      `),
      rowsOf<SiteRow>(sql`
        SELECT target_id, coalesce(max(label), '') AS label, count(*)::int AS count
        FROM analytics_events
        WHERE kind = 'click'
          AND target IN ('site', 'site_direct')
          AND target_id IS NOT NULL
          AND created_at >= ${todayStart}
        GROUP BY target_id
        ORDER BY count DESC
        LIMIT 15
      `),
      rowsOf<HourRow>(sql`
        SELECT
          (floor(extract(epoch from (created_at AT TIME ZONE 'UTC')) / 3600) * 3600000)::bigint AS hour_ms,
          count(*) FILTER (WHERE kind = 'pageview')::int AS pageviews,
          count(*) FILTER (WHERE kind = 'click')::int AS clicks
        FROM analytics_events
        WHERE created_at >= ${hourStart}
        GROUP BY 1
        ORDER BY 1
      `),
      rowsOf<RecentRow>(sql`
        SELECT id, kind, target, target_id, label, created_at
        FROM analytics_events
        ORDER BY id DESC
        LIMIT 30
      `),
      db
        .select({
          id: sites.id,
          name: sites.name,
          clicks: sites.clicks,
        })
        .from(sites)
        .where(gt(sites.clicks, 0))
        .orderBy(desc(sites.clicks))
        .limit(15),
    ]);

  const today = todayRows[0] ?? { pageviews: 0, clicks: 0, visitors: 0 };
  const yesterday = yesterdayRows[0] ?? { pageviews: 0, clicks: 0, visitors: 0 };
  const allTime = allRows[0] ?? { pageviews: 0, clicks: 0, visitors: 0 };

  const hourMap = new Map(
    hourRows.map((row) => [num(row.hour_ms), { pageviews: num(row.pageviews), clicks: num(row.clicks) }]),
  );
  const currentHour = Math.floor(now.getTime() / 3_600_000) * 3_600_000;
  const hourly = Array.from({ length: 24 }, (_, index) => {
    const hourMs = currentHour - (23 - index) * 3_600_000;
    const found = hourMap.get(hourMs);
    const label = new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(hourMs));
    return {
      hour: label,
      pageviews: found?.pageviews ?? 0,
      clicks: found?.clicks ?? 0,
    };
  });

  return NextResponse.json({
    generatedAt: now.toISOString(),
    online: num(liveRows[0]?.online),
    today: {
      visitors: num(today.visitors),
      pageviews: num(today.pageviews),
      clicks: num(today.clicks),
    },
    yesterday: {
      visitors: num(yesterday.visitors),
      pageviews: num(yesterday.pageviews),
      clicks: num(yesterday.clicks),
    },
    allTime: {
      visitors: num(allTime.visitors),
      pageviews: num(allTime.pageviews),
      clicks: num(allTime.clicks),
    },
    destinations: targetRows.map((row) => ({
      target: row.target,
      label: TARGET_LABELS[row.target] || row.label || row.target,
      count: num(row.count),
    })),
    topSitesToday: siteTodayRows.map((row) => ({
      id: num(row.target_id),
      name: row.label || `#${row.target_id}`,
      clicks: num(row.count),
    })),
    topSitesAllTime: topSites.map((row) => ({
      id: row.id,
      name: row.name,
      clicks: row.clicks,
    })),
    hourly,
    recent: recentRows.map((row) => ({
      id: num(row.id),
      kind: row.kind,
      target: row.target,
      label: displayTargetLabel(row.target, row.label),
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    })),
  });
}
