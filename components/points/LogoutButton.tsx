"use client";

import { useState } from "react";

export function LogoutButton({
  className = "btn btn-line",
  label = "Çıkış",
  dock = false,
}: {
  className?: string;
  label?: string;
  dock?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/uye/cikis", { method: "POST" });
      if (!res.ok) throw new Error("Çıkış tamamlanamadı.");
      window.location.assign("/");
    } catch {
      setError("Çıkış tamamlanamadı.");
      setLoading(false);
    }
  }

  if (dock) {
    return (
      <button type="button" className="dock-link" onClick={() => void logout()} disabled={loading}>
        <span className="dock-mark" />
        {loading ? "..." : "Çıkış"}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button type="button" onClick={() => void logout()} disabled={loading} className={className}>
        {loading ? "Çıkılıyor..." : label}
      </button>
      {error ? <span className="mt-1 text-xs font-semibold text-[#f2c94c]">{error}</span> : null}
    </span>
  );
}
