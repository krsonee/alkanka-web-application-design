type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

// Tek sunucu örneği için bellek içi sayaç yeterli. Birden fazla örneğe
// çıkılırsa bu sayaçların Redis gibi ortak bir depoya taşınması gerekir.
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
};

/**
 * `cost` ile bir istek birden fazla birim tüketebilir. Liste ucunda dönen
 * satır sayısını maliyet olarak vererek, az sayıda ama kalabalık istekle
 * tüm veritabanının boşaltılması engellenir.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  cost = 1,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: cost, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - cost, retryAfter: 0 };
  }

  bucket.count += cost;
  if (bucket.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  return { allowed: true, remaining: limit - bucket.count, retryAfter: 0 };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
