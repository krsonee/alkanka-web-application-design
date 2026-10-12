"use client";

import { useCallback, useEffect, useState } from "react";
import { PointsPanel } from "@/components/admin/PointsPanel";
import { ImageField } from "@/components/panel/image-field";

const SECTIONS = [
  ["members", "Üyeler"],
  ["settings", "Ayarlar"],
  ["tasks", "Görevler"],
  ["market", "Market"],
  ["tickets", "Bilet"],
  ["wheel", "Çark"],
  ["campaigns", "Kampanya"],
  ["matches", "Tahmin"],
  ["odds", "Oran"],
] as const;

type Section = (typeof SECTIONS)[number][0];
type Row = Record<string, unknown>;

const TASK_TYPES = [
  ["daily_login", "Günlük giriş"],
  ["visit_site", "Site ziyareti"],
  ["join_telegram", "Telegram kanalı"],
  ["enter_code", "Kod"],
  ["connect_telegram", "Telegram bağla"],
] as const;

function text(row: Row, key: string) {
  const value = row[key];
  return value == null ? "" : String(value);
}

function istanbulInput(value: string) {
  if (!value) return "";
  if (/[zZ]|[+-]\d\d:\d\d$/.test(value)) return value;
  return `${value}:00+03:00`;
}

async function readError(res: Response) {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || "İşlem tamamlanamadı.";
}

export function PointsDesk() {
  const [section, setSection] = useState<Section>("members");

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={section === key ? "btn btn-gold btn-sm" : "btn btn-ghost btn-sm"}
          >
            {label}
          </button>
        ))}
      </div>
      {section === "members" ? <PointsPanel /> : section === "settings" ? <SettingsForm /> : <DeskSection section={section} />}
    </div>
  );
}

function SettingsForm() {
  const [form, setForm] = useState<Record<string, string | boolean> | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/points", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setForm(data as Record<string, string | boolean>))
      .catch(() => setError("Ayarlar alınamadı."));
  }, []);

  if (!form) return <p className="mt-4 text-sm text-[#7e879c]">Yükleniyor...</p>;

  function set(key: string, value: string | boolean) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/admin/points", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    setNotice("Puan ayarları kaydedildi.");
  }

  const flags: [string, string][] = [
    ["dailyEnabled", "Günlük puan"],
    ["tasksEnabled", "Görevler"],
    ["marketEnabled", "Market"],
    ["wheelEnabled", "Çark"],
    ["diceEnabled", "Zar"],
    ["ticketsEnabled", "Biletler"],
    ["predictionsEnabled", "Tahminler"],
    ["oddsEnabled", "Özel oran"],
    ["campaignsEnabled", "Kampanyalar"],
    ["leaderboardEnabled", "Sıralama"],
  ];

  return (
    <form onSubmit={save} className="panel mt-4 space-y-3 rounded-2xl p-5">
      {error ? <p className="text-sm font-semibold text-red-300">{error}</p> : null}
      {notice ? <p className="text-sm font-semibold text-[#f2c94c]">{notice}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["signupBonus", "Kayıt puanı"],
            ["dailyAmount", "Günlük puan"],
            ["diceMin", "Zar alt limit"],
            ["diceMax", "Zar üst limit"],
            ["diceMultiplier", "Zar çarpanı"],
            ["wheelDaily", "Çark günlük hak"],
            ["diceDaily", "Zar günlük hak"],
            ["chestDaily", "Sandık günlük hak"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-xs font-bold uppercase tracking-wide text-[#7e879c]">
            {label}
            <input className="field mt-1" value={String(form[key] ?? "")} onChange={(e) => set(key, e.target.value)} />
          </label>
        ))}
        <label className="text-xs font-bold uppercase tracking-wide text-[#7e879c] sm:col-span-2">
          Telegram kanalı
          <input
            className="field mt-1"
            value={String(form.telegramChannel ?? "")}
            onChange={(e) => set("telegramChannel", e.target.value)}
            placeholder="@kanal veya t.me/kanal"
          />
        </label>
      </div>
      <p className="text-xs leading-relaxed text-[#7e879c]">
        Çark, zar ve sandık hakları İstanbul gününe göre sunucuda sayılır. 0 yazılırsa oyun kapanır. Sayfa yenilemek hak eklemez.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {flags.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-[#b8c0d4]">
            <input
              type="checkbox"
              checked={Boolean(form[key])}
              onChange={(e) => set(key, e.target.checked)}
              className="h-4 w-4 accent-[#d4af37]"
            />
            {label} açık
          </label>
        ))}
      </div>
      <button type="submit" disabled={busy} className="btn btn-gold btn-sm">
        {busy ? "Kaydediliyor..." : "Ayarları kaydet"}
      </button>
    </form>
  );
}

function DeskSection({ section }: { section: Exclude<Section, "members" | "settings"> }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/admin/desk?section=${section}`, { cache: "no-store" });
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    setData((await res.json()) as Record<string, unknown>);
  }, [section]);

  useEffect(() => {
    // Bölüm değişince liste yeniden alınır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/desk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, ...body }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        setError(await readError(res));
        return false;
      }
      const saved = (await res.json().catch(() => null)) as { slice?: Row } | null;
      if (section === "wheel" && body.action === "create" && saved?.slice) {
        setData((prev) => ({
          ...(prev ?? {}),
          slices: [...(((prev?.slices as Row[]) ?? [])), saved.slice as Row],
        }));
      }
      setNotice("Kaydedildi.");
      await load();
      return true;
    } catch {
      setError("Kayıt tamamlanamadı. Bağlantıyı kontrol edip tekrar deneyin.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const sites = (data?.sites as Row[] | undefined) ?? [];

  return (
    <div className="mt-4 space-y-4">
      {error ? <p className="text-sm font-semibold text-red-300">{error}</p> : null}
      {notice ? <p className="text-sm font-semibold text-[#f2c94c]">{notice}</p> : null}
      {!data ? <p className="text-sm text-[#7e879c]">Yükleniyor...</p> : null}

      {section === "tasks" ? (
        <TaskForm busy={busy} onSave={(body) => void send(body)} rows={(data?.tasks as Row[]) ?? []} />
      ) : null}
      {section === "market" ? (
        <MarketForm
          busy={busy}
          onSave={(body) => void send(body)}
          rewards={(data?.rewards as Row[]) ?? []}
          orders={(data?.orders as Row[]) ?? []}
        />
      ) : null}
      {section === "tickets" ? (
        <TicketForm busy={busy} onSave={(body) => void send(body)} rows={(data?.events as Row[]) ?? []} />
      ) : null}
      {section === "wheel" ? (
        <WheelForm busy={busy} onSave={send} rows={(data?.slices as Row[]) ?? []} />
      ) : null}
      {section === "campaigns" ? (
        <CampaignForm busy={busy} onSave={(body) => void send(body)} rows={(data?.campaigns as Row[]) ?? []} sites={sites} />
      ) : null}
      {section === "matches" ? (
        <MatchForm busy={busy} onSave={(body) => void send(body)} rows={(data?.matches as Row[]) ?? []} />
      ) : null}
      {section === "odds" ? (
        <OddsForm busy={busy} onSave={(body) => void send(body)} rows={(data?.cards as Row[]) ?? []} sites={sites} />
      ) : null}
    </div>
  );
}

function TaskForm({
  rows,
  busy,
  onSave,
}: {
  rows: Row[];
  busy: boolean;
  onSave: (body: Record<string, unknown>) => void;
}) {
  return (
    <>
      <form
        className="panel grid gap-3 rounded-2xl p-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          onSave({
            action: "create",
            title: form.get("title"),
            description: form.get("description"),
            reward: Number(form.get("reward")),
            taskType: form.get("taskType"),
            code: form.get("code"),
            repeatDaily: form.get("repeatDaily") === "on",
            active: true,
          });
          e.currentTarget.reset();
        }}
      >
        <input name="title" required placeholder="Başlık" className="field" />
        <input name="reward" required inputMode="numeric" placeholder="Puan" className="field" />
        <select name="taskType" className="field" defaultValue="daily_login">
          {TASK_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input name="code" placeholder="Kod (yalnızca kod görevinde)" className="field" />
        <input name="description" placeholder="Açıklama" className="field sm:col-span-2" />
        <label className="flex items-center gap-2 text-sm text-[#b8c0d4]">
          <input type="checkbox" name="repeatDaily" className="h-4 w-4 accent-[#d4af37]" />
          Her gün
        </label>
        <button disabled={busy} className="btn btn-gold btn-sm">
          Görev ekle
        </button>
      </form>
      <RowList
        empty="Henüz görev yok."
        rows={rows.map((row) => ({
          id: Number(row.id),
          title: `${text(row, "title")} · ${text(row, "reward")} puan`,
          meta: text(row, "active") === "true" || row.active === true ? "Açık" : "Kapalı",
        }))}
        onDelete={(id) => onSave({ action: "delete", id })}
      />
    </>
  );
}

function RewardImage() {
  const [value, setValue] = useState("");
  return <ImageField name="imageUrl" label="Ürün görseli" value={value} onChange={setValue} placeholder="Görsel adresi (isteğe bağlı)" />;
}

function MarketForm({
  rewards,
  orders,
  busy,
  onSave,
}: {
  rewards: Row[];
  orders: Row[];
  busy: boolean;
  onSave: (body: Record<string, unknown>) => void;
}) {
  return (
    <>
      <form
        className="panel grid gap-3 rounded-2xl p-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          onSave({
            action: "create",
            name: form.get("name"),
            description: form.get("description"),
            imageUrl: form.get("imageUrl"),
            price: Number(form.get("price")),
            stock: Number(form.get("stock") || 0),
            unlimited: form.get("unlimited") === "on",
            active: true,
          });
          e.currentTarget.reset();
        }}
      >
        <input name="name" required placeholder="Ürün adı" className="field" />
        <input name="price" required inputMode="numeric" placeholder="Puan fiyatı" className="field" />
        <input name="stock" inputMode="numeric" placeholder="Stok" className="field" />
        <label className="block text-sm text-[#b8c0d4] sm:col-span-2">
          Görsel <span className="font-bold text-[#f2c94c]">1584×672 px</span>
          <RewardImage />
        </label>
        <input name="description" placeholder="Açıklama" className="field sm:col-span-2" />
        <label className="flex items-center gap-2 text-sm text-[#b8c0d4]">
          <input type="checkbox" name="unlimited" className="h-4 w-4 accent-[#d4af37]" />
          Stok sınırsız
        </label>
        <button disabled={busy} className="btn btn-gold btn-sm">
          Ürün ekle
        </button>
      </form>
      <RowList
        empty="Henüz ürün yok."
        rows={rewards.map((row) => ({
          id: Number(row.id),
          title: `${text(row, "name")} · ${text(row, "price")} puan`,
          meta: text(row, "stock") === "-1" ? "Sınırsız" : `Stok ${text(row, "stock")}`,
        }))}
        onDelete={(id) => onSave({ action: "delete", id })}
      />
      <div className="panel rounded-2xl p-4">
        <h4 className="text-xs font-black uppercase tracking-wide gold-text">Siparişler</h4>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-[#7e879c]">Bekleyen sipariş yok.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {orders.map((row) => (
              <li key={text(row, "id")} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {text(row, "username")} · {text(row, "reward_name")} · {text(row, "status")}
                </span>
                {text(row, "status") === "pending" ? (
                  <span className="flex gap-2">
                    <button type="button" className="btn btn-gold btn-sm" onClick={() => onSave({ action: "approve", id: row.id })}>
                      Onayla
                    </button>
                    <button type="button" className="btn btn-line btn-sm" onClick={() => onSave({ action: "reject", id: row.id })}>
                      Reddet
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function TicketForm({
  rows,
  busy,
  onSave,
}: {
  rows: Row[];
  busy: boolean;
  onSave: (body: Record<string, unknown>) => void;
}) {
  return (
    <>
      <form
        className="panel grid gap-3 rounded-2xl p-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          onSave({
            action: "create",
            title: form.get("title"),
            ticketPrice: Number(form.get("ticketPrice")),
            perUserCap: Number(form.get("perUserCap")),
            prizePoints: Number(form.get("prizePoints")),
            endsAt: istanbulInput(String(form.get("endsAt") ?? "")),
            active: true,
          });
          e.currentTarget.reset();
        }}
      >
        <input name="title" required placeholder="Çekiliş adı" className="field" />
        <input name="ticketPrice" required inputMode="numeric" placeholder="Bilet puanı" className="field" />
        <input name="perUserCap" required inputMode="numeric" placeholder="Kişi başı" className="field" />
        <input name="prizePoints" required inputMode="numeric" placeholder="Ödül puanı" className="field" />
        <input name="endsAt" required type="datetime-local" className="field sm:col-span-2" />
        <button disabled={busy} className="btn btn-gold btn-sm">
          Çekiliş ekle
        </button>
      </form>
      <ul className="space-y-2">
        {rows.length === 0 ? <EmptyLine text="Henüz bilet yok." /> : null}
        {rows.map((row) => (
          <li key={text(row, "id")} className="panel flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm">
            <span>
              {text(row, "title")} · {text(row, "sold")} bilet
              {row.winning_number != null ? ` · kazanan ${text(row, "winning_number")}` : ""}
            </span>
            {row.drawn_at ? null : (
              <button type="button" className="btn btn-gold btn-sm" onClick={() => onSave({ action: "draw", id: row.id })}>
                Çekiliş yap
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function WheelForm({
  rows,
  busy,
  onSave,
}: {
  rows: Row[];
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  return (
    <>
      <form
        className="panel grid gap-3 rounded-2xl p-5 sm:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const formEl = e.currentTarget;
          const form = new FormData(formEl);
          const ok = await onSave({
            action: "create",
            label: String(form.get("label") ?? "").trim(),
            points: Number(form.get("points")),
            weight: Number(form.get("weight")),
            active: true,
          });
          if (ok) formEl.reset();
        }}
      >
        <input name="label" required maxLength={40} placeholder="Dilim" className="field" />
        <input name="points" required inputMode="numeric" placeholder="Puan" className="field" />
        <input name="weight" required inputMode="numeric" placeholder="Ağırlık" className="field" />
        <button type="submit" disabled={busy} className="btn btn-gold btn-sm">
          {busy ? "Ekleniyor..." : "Dilim ekle"}
        </button>
      </form>
      <RowList
        empty="Henüz çark dilimi yok."
        rows={rows.map((row) => ({
          id: Number(row.id),
          title: `${text(row, "label")} · ${text(row, "points")} puan`,
          meta: `ağırlık ${text(row, "weight")}`,
        }))}
        onDelete={(id) => onSave({ action: "delete", id })}
      />
    </>
  );
}

function CampaignForm({
  rows,
  sites,
  busy,
  onSave,
}: {
  rows: Row[];
  sites: Row[];
  busy: boolean;
  onSave: (body: Record<string, unknown>) => void;
}) {
  return (
    <>
      <form
        className="panel grid gap-3 rounded-2xl p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          onSave({
            action: "create",
            siteId: Number(form.get("siteId")),
            title: form.get("title"),
            bonusSummary: form.get("bonusSummary"),
            steps: form.get("steps"),
            buttonLabel: form.get("buttonLabel") || "Siteye git",
            active: true,
          });
          e.currentTarget.reset();
        }}
      >
        <select name="siteId" required className="field" defaultValue="">
          <option value="" disabled>
            Site seç
          </option>
          {sites.map((site) => (
            <option key={text(site, "id")} value={text(site, "id")}>
              {text(site, "name")}
            </option>
          ))}
        </select>
        <input name="title" required placeholder="Kampanya adı" className="field" />
        <input name="bonusSummary" placeholder="Bonus özeti" className="field" />
        <textarea name="steps" placeholder="Her satır bir adım" className="field min-h-24" />
        <input name="buttonLabel" placeholder="Buton yazısı" className="field" />
        <button disabled={busy} className="btn btn-gold btn-sm">
          Kampanya ekle
        </button>
      </form>
      <RowList
        empty="Henüz kampanya yok."
        rows={rows.map((row) => ({ id: Number(row.id), title: text(row, "title"), meta: text(row, "bonus_summary") }))}
        onDelete={(id) => onSave({ action: "delete", id })}
      />
    </>
  );
}

function MatchForm({
  rows,
  busy,
  onSave,
}: {
  rows: Row[];
  busy: boolean;
  onSave: (body: Record<string, unknown>) => void;
}) {
  return (
    <>
      <form
        className="panel grid gap-3 rounded-2xl p-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          onSave({
            action: "create",
            home: form.get("home"),
            away: form.get("away"),
            optionA: form.get("optionA") || "Ev sahibi",
            optionB: form.get("optionB") || "Beraberlik",
            optionC: form.get("optionC") || "Deplasman",
            stake: Number(form.get("stake")),
            multiplier: Number(form.get("multiplier") || 2),
            lockAt: istanbulInput(String(form.get("lockAt") ?? "")),
            active: true,
          });
          e.currentTarget.reset();
        }}
      >
        <input name="home" required placeholder="Ev sahibi" className="field" />
        <input name="away" required placeholder="Deplasman" className="field" />
        <input name="stake" required inputMode="numeric" placeholder="Bahis puanı" className="field" />
        <input name="multiplier" inputMode="numeric" placeholder="Çarpan" className="field" />
        <input name="lockAt" required type="datetime-local" className="field sm:col-span-2" />
        <button disabled={busy} className="btn btn-gold btn-sm">
          Maç ekle
        </button>
      </form>
      <ul className="space-y-2">
        {rows.length === 0 ? <EmptyLine text="Henüz maç yok." /> : null}
        {rows.map((row) => (
          <li key={text(row, "id")} className="panel rounded-2xl px-4 py-3 text-sm">
            <div className="font-bold">
              {text(row, "home_team")} — {text(row, "away_team")}
            </div>
            {row.settled_at ? (
              <p className="mt-1 text-xs text-[#7e879c]">Sonuçlandı</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {(["a", "b", "c"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="btn btn-line btn-sm"
                    onClick={() => onSave({ action: "settle", id: row.id, winning: key })}
                  >
                    {text(row, key === "a" ? "option_a" : key === "b" ? "option_b" : "option_c")}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function OddsForm({
  rows,
  sites,
  busy,
  onSave,
}: {
  rows: Row[];
  sites: Row[];
  busy: boolean;
  onSave: (body: Record<string, unknown>) => void;
}) {
  return (
    <>
      <form
        className="panel grid gap-3 rounded-2xl p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          onSave({
            action: "create",
            siteId: form.get("siteId") ? Number(form.get("siteId")) : undefined,
            siteLabel: form.get("siteLabel"),
            body: form.get("body"),
            eventAt: form.get("eventAt") ? istanbulInput(String(form.get("eventAt"))) : "",
            active: true,
          });
          e.currentTarget.reset();
        }}
      >
        <input name="siteLabel" placeholder="Site adı" className="field" />
        <select name="siteId" className="field" defaultValue="">
          <option value="">Bağlı site yok</option>
          {sites.map((site) => (
            <option key={text(site, "id")} value={text(site, "id")}>
              {text(site, "name")}
            </option>
          ))}
        </select>
        <textarea name="body" required placeholder="Oran metni" className="field min-h-24" />
        <input name="eventAt" type="datetime-local" className="field" />
        <button disabled={busy} className="btn btn-gold btn-sm">
          Kart ekle
        </button>
      </form>
      <RowList
        empty="Henüz oran kartı yok."
        rows={rows.map((row) => ({ id: Number(row.id), title: text(row, "site_label") || "Kart", meta: text(row, "body") }))}
        onDelete={(id) => onSave({ action: "delete", id })}
      />
    </>
  );
}

function RowList({
  rows,
  empty,
  onDelete,
}: {
  rows: { id: number; title: string; meta: string }[];
  empty: string;
  onDelete: (id: number) => void;
}) {
  if (rows.length === 0) return <EmptyLine text={empty} />;
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id} className="panel flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">{row.title}</div>
            <div className="truncate text-xs text-[#7e879c]">{row.meta}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDelete(row.id)}>
            Sil
          </button>
        </li>
      ))}
    </ul>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="panel rounded-2xl px-4 py-8 text-center text-sm font-semibold text-[#e8d9a8]">{text}</p>;
}
