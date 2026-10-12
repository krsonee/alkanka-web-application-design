"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPoints, formatPointsWhen } from "@/lib/points-rules";

type MemberRow = {
  id: number;
  username: string;
  email: string;
  balance: number;
  createdAt: string;
  closedAt: string | null;
  telegramLinked: boolean;
  telegramUsername: string;
};

type Dossier = MemberRow & {
  ageConfirmed: boolean;
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

type MemberPlay = {
  game: "wheel" | "dice" | "chest" | "pick";
  title: string;
  detail: string;
  outcome: "win" | "loss" | "push" | "open";
  amount: number;
  createdAt: string;
};

type Filter = "all" | "open" | "closed" | "telegram";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

function when(value: string | null) {
  return value ? formatPointsWhen(value) : "Henüz yok";
}

export function MembersPanel() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as { members?: MemberRow[]; error?: string } | null;
    if (!res.ok || !data?.members) {
      setError(data?.error || "Liste alınamadı.");
      setLoading(false);
      return;
    }
    setMembers(data.members);
    setLoading(false);
  }, []);

  useEffect(() => {
    // load() only sets state after its fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load("");
  }, [load]);

  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetailLoading(true);
    setDetailError("");
    void fetch(`/api/admin/members/${selectedId}`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as (Dossier & { error?: string }) | null;
        if (cancelled) return;
        if (!res.ok || !data?.id) {
          setDossier(null);
          setDetailError(data?.error || "Üye dosyası alınamadı.");
        } else {
          setDossier(data);
          setEmailDraft(data.email ?? "");
        }
        setDetailLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDossier(null);
        setDetailError("Üye dosyası alınamadı.");
        setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function select(id: number) {
    if (id === selectedId) return;
    setSelectedId(id);
    setPassword("");
    setPasswordAgain("");
    setNotice("");
    setDetailError("");
    setConfirmClose(false);
    setConfirmUnlink(false);
    setDossier(null);
  }

  function applyDossier(next: Dossier) {
    setDossier(next);
    setEmailDraft(next.email);
    setMembers((rows) =>
      rows.map((row) =>
        row.id === next.id
          ? {
              ...row,
              email: next.email,
              balance: next.balance,
              closedAt: next.closedAt,
              telegramLinked: next.telegramLinked,
              telegramUsername: next.telegramUsername,
            }
          : row,
      ),
    );
  }

  async function patch(body: Record<string, unknown>, success: string) {
    if (selectedId == null) return false;
    setBusy(true);
    setNotice("");
    setDetailError("");
    const res = await fetch(`/api/admin/members/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as (Dossier & { error?: string }) | null;
    setBusy(false);
    if (!res.ok || !data?.id) {
      setDetailError(data?.error || "İşlem tamamlanamadı.");
      return false;
    }
    applyDossier(data);
    setNotice(success);
    setConfirmClose(false);
    setConfirmUnlink(false);
    return true;
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    const email = emailDraft.trim();
    if (!email) {
      setDetailError("Geçerli bir e-posta yazın.");
      return;
    }
    if (dossier && email.toLowerCase() === dossier.email.toLowerCase()) {
      setNotice("E-posta aynı, değişiklik yok.");
      return;
    }
    await patch({ email }, "E-posta güncellendi.");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setDetailError("Şifre en az 8 karakter olmalı.");
      return;
    }
    if (password.length > 72) {
      setDetailError("Şifre en fazla 72 karakter olabilir.");
      return;
    }
    if (password !== passwordAgain) {
      setDetailError("Şifre tekrarı uyuşmuyor.");
      return;
    }
    const ok = await patch({ password }, "Şifre değiştirildi. Üye yeni şifreyle giriş yapar.");
    if (ok) {
      setPassword("");
      setPasswordAgain("");
    }
  }

  async function download() {
    setDownloading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/members?format=csv", { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error || "CSV indirilemedi.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "uyeler.csv";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const visible = members.filter((member) => {
    if (filter === "open") return !member.closedAt;
    if (filter === "closed") return Boolean(member.closedAt);
    if (filter === "telegram") return member.telegramLinked;
    return true;
  });

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-primary">Üyeler</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Üyelik, şifre, e-posta, Telegram, Kanka Coin ve oyun geçmişi.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className={`${selectedId != null ? "hidden xl:block" : ""} overflow-hidden rounded-2xl border border-border bg-card`}>
          <form
            className="flex flex-wrap gap-2 border-b border-border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void load(search);
            }}
          >
            <input
              className={`${inputCls} min-w-[12rem] flex-1`}
              placeholder="Kullanıcı adı veya e-posta"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="rounded-lg bg-primary px-4 text-xs font-bold uppercase text-primary-foreground">Ara</button>
            <button
              type="button"
              onClick={() => void download()}
              disabled={downloading}
              className="rounded-lg border border-primary/40 px-4 text-xs font-bold uppercase text-primary disabled:opacity-60"
            >
              {downloading ? "İndiriliyor..." : "CSV indir"}
            </button>
          </form>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {(
              [
                ["all", "Tümü"],
                ["open", "Açık"],
                ["closed", "Kapalı"],
                ["telegram", "Telegram bağlı"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${
                  filter === key
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {error ? <p className="px-4 py-3 text-sm font-semibold text-red-400">{error}</p> : null}
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Yükleniyor...</p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Bu filtrede üye yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-3 font-bold">Kullanıcı adı</th>
                    <th className="whitespace-nowrap px-5 py-3 font-bold">E-posta</th>
                    <th className="whitespace-nowrap px-5 py-3 font-bold">Kanka Coin</th>
                    <th className="whitespace-nowrap px-5 py-3 font-bold">Telegram</th>
                    <th className="whitespace-nowrap px-5 py-3 font-bold">Durum</th>
                    <th className="whitespace-nowrap px-5 py-3 font-bold">Kayıt</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((member) => (
                    <tr
                      key={member.id}
                      onClick={() => select(member.id)}
                      className={`cursor-pointer border-t border-border ${
                        selectedId === member.id ? "bg-primary/10" : "hover:bg-background"
                      } ${member.closedAt ? "text-muted-foreground" : ""}`}
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-foreground">{member.username}</td>
                      <td className="whitespace-nowrap px-5 py-3.5">{member.email || "—"}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-black text-primary">{formatPoints(member.balance)}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs">
                        {member.telegramLinked ? (
                          <span className="text-accent">{member.telegramUsername ? `@${member.telegramUsername.replace(/^@/, "")}` : "Bağlı"}</span>
                        ) : (
                          "Yok"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <StatusPill closed={Boolean(member.closedAt)} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs text-muted-foreground">{formatPointsWhen(member.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className={`${selectedId == null ? "hidden" : ""} rounded-2xl border border-border bg-card p-4`}>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="mb-3 text-xs font-bold text-primary xl:hidden"
          >
            ← Listeye dön
          </button>
          {selectedId == null ? (
            <p className="py-8 text-sm text-muted-foreground">Bir üyeye basınca dosyası burada açılır.</p>
          ) : detailLoading && !dossier ? (
            <p className="py-8 text-sm text-muted-foreground">Dosya yükleniyor...</p>
          ) : !dossier ? (
            <p className="py-8 text-sm text-red-400">{detailError || "Üye dosyası yok."}</p>
          ) : (
            <MemberFile
              dossier={dossier}
              emailDraft={emailDraft}
              setEmailDraft={setEmailDraft}
              password={password}
              setPassword={setPassword}
              passwordAgain={passwordAgain}
              setPasswordAgain={setPasswordAgain}
              busy={busy}
              notice={notice}
              detailError={detailError}
              confirmClose={confirmClose}
              setConfirmClose={setConfirmClose}
              confirmUnlink={confirmUnlink}
              setConfirmUnlink={setConfirmUnlink}
              onEmail={saveEmail}
              onPassword={savePassword}
              onClose={() => void patch({ closed: true }, "Üyelik kapatıldı. Bu hesap giriş yapamaz.")}
              onOpen={() => void patch({ closed: false }, "Üyelik yeniden açıldı.")}
              onUnlink={() => void patch({ unlinkTelegram: true }, "Telegram bağlantısı kaldırıldı.")}
            />
          )}
        </aside>
      </div>
      {dossier ? <PlaysBoard dossier={dossier} /> : null}
    </div>
  );
}

function StatusPill({ closed }: { closed: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
        closed ? "bg-red-500/15 text-red-300" : "bg-live/15 text-live"
      }`}
    >
      {closed ? "Kapalı" : "Açık"}
    </span>
  );
}

function MemberFile({
  dossier,
  emailDraft,
  setEmailDraft,
  password,
  setPassword,
  passwordAgain,
  setPasswordAgain,
  busy,
  notice,
  detailError,
  confirmClose,
  setConfirmClose,
  confirmUnlink,
  setConfirmUnlink,
  onEmail,
  onPassword,
  onClose,
  onOpen,
  onUnlink,
}: {
  dossier: Dossier;
  emailDraft: string;
  setEmailDraft: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  passwordAgain: string;
  setPasswordAgain: (value: string) => void;
  busy: boolean;
  notice: string;
  detailError: string;
  confirmClose: boolean;
  setConfirmClose: (value: boolean) => void;
  confirmUnlink: boolean;
  setConfirmUnlink: (value: boolean) => void;
  onEmail: (e: React.FormEvent) => void;
  onPassword: (e: React.FormEvent) => void;
  onClose: () => void;
  onOpen: () => void;
  onUnlink: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Üye dosyası</p>
          <h3 className="font-display text-2xl font-bold text-foreground">{dossier.username}</h3>
        </div>
        <StatusPill closed={Boolean(dossier.closedAt)} />
      </div>

      <div className="rounded-xl border border-primary/30 bg-background px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kanka Coin</p>
        <p className="font-display text-3xl font-black text-primary">{formatPoints(dossier.balance)}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Fact label="E-posta" value={dossier.email || "E-posta yok"} />
        <Fact label="Kayıt" value={formatPointsWhen(dossier.createdAt)} />
        <Fact label="Yaş onayı" value={dossier.ageConfirmed ? "18+ onaylı" : "Onay yok"} />
        <Fact
          label="Telegram"
          value={
            dossier.telegramLinked
              ? dossier.telegramUsername
                ? `@${dossier.telegramUsername.replace(/^@/, "")}`
                : "Bağlı, kullanıcı adı yok"
              : "Bağlı değil"
          }
        />
      </dl>
      {dossier.closedAt ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          Üyelik {formatPointsWhen(dossier.closedAt)} tarihinde kapatıldı. Giriş ve oturum kapalı.
        </p>
      ) : null}

      {notice ? <p className="text-sm font-semibold text-primary">{notice}</p> : null}
      {detailError ? <p className="text-sm font-semibold text-red-400">{detailError}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      <form onSubmit={onEmail} className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">E-posta değiştir</p>
        <input
          className={inputCls}
          type="email"
          autoComplete="off"
          value={emailDraft}
          onChange={(e) => setEmailDraft(e.target.value)}
          placeholder="yeni@ornek.com"
        />
        <button disabled={busy} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold uppercase text-primary-foreground disabled:opacity-60">
          E-postayı kaydet
        </button>
      </form>

      <form onSubmit={onPassword} className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Şifre değiştir</p>
        <input
          className={inputCls}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Yeni şifre, en az 8 karakter"
        />
        <input
          className={inputCls}
          type="password"
          autoComplete="new-password"
          value={passwordAgain}
          onChange={(e) => setPasswordAgain(e.target.value)}
          placeholder="Yeni şifre tekrar"
        />
        <button disabled={busy} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold uppercase text-primary-foreground disabled:opacity-60">
          Şifreyi kaydet
        </button>
      </form>

      <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Telegram</p>
        {dossier.telegramLinked ? (
          confirmUnlink ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onUnlink}
                className="rounded-lg bg-red-500/80 px-3 py-2 text-xs font-bold uppercase text-white disabled:opacity-60"
              >
                Bağlantıyı kaldır
              </button>
              <button type="button" onClick={() => setConfirmUnlink(false)} className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground">
                Vazgeç
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmUnlink(true)}
              className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground"
            >
              Telegram bağlantısını kaldır
            </button>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Bu üye Telegram hesabını bağlamamış.</p>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Üyelik</p>
        {dossier.closedAt ? (
          <button
            type="button"
            disabled={busy}
            onClick={onOpen}
            className="rounded-lg border border-live/40 px-3 py-2 text-xs font-bold uppercase text-live disabled:opacity-60"
          >
            Üyeliği yeniden aç
          </button>
        ) : confirmClose ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-foreground">Hesap kapanır, mevcut oturum düşer ve giriş yapılamaz.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="rounded-lg bg-red-500/80 px-3 py-2 text-xs font-bold uppercase text-white disabled:opacity-60"
              >
                Evet, kapat
              </button>
              <button type="button" onClick={() => setConfirmClose(false)} className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground">
                Vazgeç
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClose(true)}
            className="rounded-lg border border-red-400/40 px-3 py-2 text-xs font-bold uppercase text-red-300"
          >
            Üyeliği kapat
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

function outcomeText(play: MemberPlay) {
  if (play.outcome === "win") return "Kazandı";
  if (play.outcome === "push") return "Berabere";
  if (play.outcome === "open") return "Bekliyor";
  if (play.game === "wheel") return "Boş";
  return "Kaybetti";
}

function PlaysBoard({ dossier }: { dossier: Dossier }) {
  const games = dossier.games;
  const plays = dossier.plays ?? [];
  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">{dossier.username} oyunları</h3>
          <p className="mt-1 text-sm text-muted-foreground">Hangi bahsi almış, kazanmış mı kaybetmiş mi.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <GameStat label="Çark" count={games.wheel} last={games.wheelLast} />
        <GameStat label="Zar" count={games.dice} last={games.diceLast} />
        <GameStat label="Sandık" count={games.chest} last={games.chestLast} />
        <MiniStat label="Görev" value={games.tasks} />
        <MiniStat label="Market" value={games.orders} />
        <MiniStat label="Bilet" value={games.tickets} />
        <MiniStat label="Tahmin" value={games.picks} />
        <MiniStat label="Ziyaret" value={games.visits} />
      </div>
      {plays.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">
          Kayıtlı bahis yok.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-bold">Oyun</th>
                <th className="whitespace-nowrap px-4 py-2 font-bold">Bahis</th>
                <th className="whitespace-nowrap px-4 py-2 font-bold">Sonuç</th>
                <th className="whitespace-nowrap px-4 py-2 font-bold">Coin</th>
                <th className="whitespace-nowrap px-4 py-2 font-bold">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {plays.map((play, index) => (
                <tr key={`${play.game}-${play.createdAt}-${index}`} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-foreground">{play.title}</td>
                  <td className="px-4 py-3 text-foreground">{play.detail}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <OutcomePill outcome={play.outcome} game={play.game} />
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 font-black ${play.amount > 0 ? "text-live" : play.amount < 0 ? "text-red-300" : "text-muted-foreground"}`}>
                    {play.amount > 0 ? "+" : ""}
                    {formatPoints(play.amount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatPointsWhen(play.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ne yapmış</p>
        {dossier.ledger.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">Henüz puan hareketi yok.</p>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {dossier.ledger.map((row, index) => (
              <li key={`${row.createdAt}-${row.reason}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{row.label}</p>
                  <p className="text-[11px] text-muted-foreground">{formatPointsWhen(row.createdAt)}</p>
                </div>
                <p className={`shrink-0 font-black ${row.amount > 0 ? "text-live" : "text-red-300"}`}>
                  {row.amount > 0 ? "+" : ""}
                  {formatPoints(row.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function OutcomePill({ outcome, game }: { outcome: MemberPlay["outcome"]; game: MemberPlay["game"] }) {
  const loss = outcome === "loss";
  const label = outcomeText({ game, outcome, title: "", detail: "", amount: 0, createdAt: "" });
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
        outcome === "win" ? "bg-live/15 text-live" : loss ? "bg-red-500/15 text-red-300" : "bg-primary/15 text-primary"
      }`}
    >
      {label}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-all text-foreground">{value}</dd>
    </div>
  );
}

function GameStat({ label, count, last }: { label: string; count: number; last: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-background px-2 py-2 text-center">
      <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-black text-primary">{count}</p>
      <p className="text-[10px] text-muted-foreground">{when(last)}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-black text-foreground">{value}</span>
    </div>
  );
}
