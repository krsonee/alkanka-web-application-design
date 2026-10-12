"use client";

import { useEffect } from "react";

const BLOCKED_COMBOS = new Set(["I", "J", "C", "K", "E", "U", "S", "P", "A"]);

function isEditable(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

/**
 * İçerik kopyalamayı ve geliştirici araçlarıyla incelemeyi zorlaştıran
 * istemci önlemleri. Bunlar yalnızca caydırıcıdır: JavaScript kapatılarak
 * veya sayfa kaynağı doğrudan indirilerek aşılabilir. Asıl koruma, hassas
 * verinin tarayıcıya hiç gönderilmemesi ve sunucudaki hız sınırlarıdır.
 *
 * Pencere boyutu farkına bakan geliştirici araçları tespiti bilerek
 * kaldırıldı: o fark sayfa yakınlaştırmasıyla da büyüyor ve %125 üzeri
 * yakınlaştırma kullanan gerçek ziyaretçilere siteyi tamamen gizliyordu.
 * Araçları ayrı pencerede açan biri zaten tespit edilemediği için önlemin
 * getirisi, kaybettirdiği ziyaretçinin yanında önemsizdi.
 */
export function SiteGuard() {
  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => {
      if (!isEditable(e.target)) e.preventDefault();
    };

    const blockKeys = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();

      if (key === "F12") {
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && BLOCKED_COMBOS.has(key)) {
        e.preventDefault();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (key === "U" || key === "S" || key === "P" || key === "A") &&
        !isEditable(e.target)
      ) {
        e.preventDefault();
      }
    };

    const blockClipboard = (e: ClipboardEvent) => {
      if (!isEditable(e.target)) e.preventDefault();
    };

    const blockDrag = (e: DragEvent) => {
      if ((e.target as HTMLElement)?.tagName === "IMG") e.preventDefault();
    };

    const blockSelection = (e: Event) => {
      if (!isEditable(e.target)) e.preventDefault();
    };

    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockKeys);
    document.addEventListener("copy", blockClipboard);
    document.addEventListener("cut", blockClipboard);
    document.addEventListener("dragstart", blockDrag);
    document.addEventListener("selectstart", blockSelection);

    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockKeys);
      document.removeEventListener("copy", blockClipboard);
      document.removeEventListener("cut", blockClipboard);
      document.removeEventListener("dragstart", blockDrag);
      document.removeEventListener("selectstart", blockSelection);
    };
  }, []);

  return null;
}
