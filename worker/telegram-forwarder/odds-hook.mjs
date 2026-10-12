// Özel oran kancası. Canlı Telegram oturumu bu deploy için gerekmez.
// İleride aktarıcı, eşleşen bir postu insertOddsCard ile odds_cards tablosuna yazar.
// Web aynı tabloyu okur. source sütunu 'telegram' kalır; panelden girilenler 'manual'dır.

export async function insertOddsCard(client, card) {
  const body = String(card?.body ?? "").trim();
  if (!body) return null;
  const siteLabel = String(card?.siteLabel ?? "").trim().slice(0, 120);
  const siteId = Number.isInteger(card?.siteId) ? card.siteId : null;
  const { rows } = await client.query(
    `INSERT INTO odds_cards (site_id, site_label, body, event_at, active, source, sort_order)
     VALUES ($1, $2, $3, $4, true, 'telegram', 0)
     RETURNING id`,
    [siteId, siteLabel, body.slice(0, 2000), card?.eventAt ?? null],
  );
  return rows[0]?.id ?? null;
}
