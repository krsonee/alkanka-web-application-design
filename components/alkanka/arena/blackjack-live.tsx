"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import {
  ArrowLeft,
  Armchair,
  Check,
  Eye,
  Hand,
  Layers,
  Loader2,
  LogOut,
  Flag,
  Play,
  Plus,
  ShieldCheck,
  Split,
  Trophy,
} from "lucide-react";
import type { ArenaGameSettings } from "@/lib/arena";
import { playSound } from "@/lib/sound";
import type { BlackjackLiveState } from "@/lib/blackjack-live";
import {
  actBlackjackTable,
  changeBlackjackBet,
  insureBlackjackTable,
  joinBlackjackTable,
  leaveBlackjackTable,
  readyBlackjackTable,
} from "@/app/actions/arena";
import { cn } from "@/lib/utils";
import { formatAC, usePoints } from "../points-context";
import { VoiceChat } from "./voice-chat";
import { useIdle } from "../use-idle";
import { PlayingCard } from "./blackjack";
import {
  SideBetPicker,
  SideBetTags,
  SidePayoutCard,
  type SideStakes,
} from "./blackjack-side-bets";
import { BlackjackLobby, BlackjackTables, BlackjackWatchers } from "./blackjack-tables";
import { TableChat } from "./table-chat";
import { MobileTableChat } from "./mobile-table-chat";
import { TableBrand } from './table-brand'
import { LandscapeFit } from './landscape-fit'

const fetcher = (url: string) => fetch(url).then((r) => r.json());
type Seat = NonNullable<BlackjackLiveState["seats"][number]>;

const RESULT_LABEL: Record<string, string> = {
  blackjack: "Blackjack!",
  win: "Kazandı",
  push: "Berabere",
  loss: "Kaybetti",
  surrender: "Teslim",
};
/** Net gain for the whole seat (hands, insurance and side bets); null until the hand is revealed. */
const seatNet = (seat: Seat) => seat.breakdown?.net ?? null;
const signed = (n: number) => (n > 0 ? `+${formatAC(n)}` : n < 0 ? `-${formatAC(-n)}` : "±0");

/** Main-hand verdict, independent of side bets, so a won hand never reads as "Kaybettin". */
function mainVerdict(seat: Seat) {
  if (seat.surrendered) return "Teslim oldun";
  const main = seat.breakdown?.main ?? 0;
  if (!seat.split && seat.hands[0]?.result === "blackjack") return "Blackjack!";
  return main > 0 ? "Eli kazandın!" : main < 0 ? "Eli kaybettin" : "Berabere";
}

/** Line-by-line result so players can see where the net came from. */
function Breakdown({ seat }: { seat: Seat }) {
  const b = seat.breakdown;
  if (!b) return null;
  const lines = [
    { label: seat.split ? "Eller (ayrılmış)" : "Ana el", v: b.main as number | null },
    { label: seat.natural ? "Eşit para" : "Sigorta", v: b.insurance },
    { label: "Mükemmel Çift", v: b.pairs },
    { label: "21+3", v: b.t213 },
  ].filter((l) => l.v !== null) as { label: string; v: number }[];
  return (
    <dl className="flex w-full max-w-xs flex-col gap-1 rounded-xl border border-primary/20 bg-background/60 px-3 py-2 text-xs">
      {lines.map((l) => (
        <div key={l.label} className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{l.label}</dt>
          <dd className={cn("font-bold tabular-nums", l.v > 0 ? "text-primary" : l.v < 0 ? "text-destructive" : "text-foreground")}>
            {signed(l.v)}
          </dd>
        </div>
      ))}
      <div className="mt-0.5 flex items-center justify-between gap-3 border-t border-primary/15 pt-1">
        <dt className="font-bold text-foreground">Net</dt>
        <dd className={cn("font-black tabular-nums", b.net > 0 ? "text-primary" : b.net < 0 ? "text-destructive" : "text-foreground")}>
          {signed(b.net)}
        </dd>
      </div>
    </dl>
  );
}

function ResultBanner({ seats }: { seats: (Seat | null)[] }) {
  const played = seats.filter((s): s is Seat => !!s && s.breakdown !== null);
  if (played.length === 0) return null;
  const me = played.find((s) => s.mine);
  const base =
    "bj-strip flex w-full max-w-md flex-wrap items-center justify-center gap-x-3 gap-y-0.5 rounded-2xl border-2 px-4 py-2 text-center shadow-lg";

  if (me) {
    const net = seatNet(me)!;
    const main = me.breakdown!.main;
    const sides = net - main;
    const tone =
      net > 0
        ? "border-primary bg-background/95 shadow-primary/40"
        : net < 0
          ? "border-destructive bg-background/95"
          : "border-primary/40 bg-background/95";
    return (
      <div role="status" className={cn(base, tone)}>
        <span
          className={cn(
            "font-display text-lg font-black uppercase tracking-wide sm:text-2xl",
            main > 0 ? "text-primary" : main < 0 ? "text-destructive" : "text-foreground",
          )}
        >
          {mainVerdict(me)}
        </span>
        <span className="text-base font-black tabular-nums text-foreground sm:text-xl">
          Net {signed(net)}
        </span>
        {sides !== 0 && (
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground sm:text-xs">
            El {signed(main)} · Ek bahisler {signed(sides)}
          </span>
        )}
      </div>
    );
  }

  const winners = played.filter((s) => seatNet(s)! > 0);
  const losers = played.filter((s) => seatNet(s)! < 0).length;
  const top = winners.sort((a, b) => seatNet(b)! - seatNet(a)!)[0];
  return (
    <div role="status" className={cn(base, "border-primary/60 bg-background/95")}>
      <span className="font-display text-base font-black uppercase tracking-wide text-primary sm:text-xl">
        El bitti
      </span>
      <span className="text-xs font-bold text-foreground sm:text-sm">
        {winners.length} kazanan · {losers} kaybeden
      </span>
      {top && (
        <span className="text-xs font-bold tabular-nums text-primary sm:text-sm">
          {top.name} +{formatAC(seatNet(top)!)}
        </span>
      )}
    </div>
  );
}

/** Server time, ticking locally between polls. */
function useServerNow(serverNow: number | undefined) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (serverNow) setOffset(serverNow - Date.now());
  }, [serverNow]);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return now === null ? null : now + offset;
}

function dealerLine(
  phase: string,
  seated: number,
  secondsLeft: number,
  dealerValue: number,
  dealerBlackjack = false,
) {
  if (phase === "insurance")
    return `Açık kartım As. Sigorta ister misin? ${secondsLeft} saniye, sonra kapalı karta bakıyorum.`;
  if (phase === "result" && dealerBlackjack)
    return "Krupiye blackjack yaptı. Sigortalılar 2:1 alır, kimse kart çekmeden el bitti.";
  if (phase === "waiting")
    return "Masa boş kanka. Bahsini seç, koltuğa otur, kartları hemen dağıtayım!";
  if (phase === "bet")
    return seated > 1
      ? `Bahisler açık, ${secondsLeft} saniye. Herkes "Dağıt" derse hemen başlarım.`
      : `Bahisler açık, ${secondsLeft} saniye. Beklemek istemezsen "Hemen dağıt" de.`;
  if (phase === "play")
    return `Kartlar dağıtıldı. Kart mı, dur mu? ${secondsLeft} saniye.`;
  return dealerValue > 21
    ? `Krupiye ${dealerValue} ile battı! Masada kalan herkes kazandı.`
    : `Krupiye ${dealerValue}. Ödemeler yapılıyor.`;
}

/**
 * Seat centres around the table rail, as % of the table box.
 * Mobile uses a compact round table (two side columns + a bottom pair) so the whole game fits one screen; sm+ uses a wide poker-style arc.
 */
const SEAT_POS: { m: [number, number]; d: [number, number] }[] = [
  { m: [14, 41], d: [9, 47] },
  { m: [86, 41], d: [22, 75] },
  { m: [15, 67], d: [40, 86] },
  { m: [85, 67], d: [60, 86] },
  { m: [37, 87], d: [78, 75] },
  { m: [63, 87], d: [91, 47] },
];

/**
 * Mobile slots by offset from the player's own seat, so on a phone you always sit bottom-centre
 * and the other five seats wrap around you towards the dealer.
 */
const MOBILE_SLOTS: [number, number][] = [
  [50, 80],
  [23, 73],
  [12, 46],
  [17, 20],
  [88, 46],
  [77, 73],
];

/** On phones the decision buttons dock just above the bottom nav so the thumb never has to hunt for them. */
const MOBILE_BAR =
  "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-sm:z-40 max-sm:border-t max-sm:border-primary/40 max-sm:bg-background/95 max-sm:px-3 max-sm:py-3 max-sm:shadow-[0_-12px_30px_-10px_rgb(0_0_0/0.6)] max-sm:backdrop-blur-md";

const CHIP_ROW =
  "grid w-full grid-cols-4 justify-items-center gap-2 px-1 py-1 sm:flex sm:w-auto sm:flex-wrap sm:justify-center";

function SeatPod({
  index,
  anchor,
  seat,
  phase,
  selectable = false,
  selected = false,
  onSelect,
}: {
  index: number;
  anchor: number;
  seat: Seat | null;
  phase: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (seat: number) => void;
}) {
  const pos = SEAT_POS[index];
  const mobile = MOBILE_SLOTS[(index - anchor + 6) % 6];
  const style = {
    "--mx": `${mobile[0]}%`,
    "--my": `${mobile[1]}%`,
    "--dx": `${pos.d[0]}%`,
    "--dy": `${pos.d[1]}%`,
  } as React.CSSProperties;
  const place =
    "absolute left-(--mx) top-(--my) -translate-x-1/2 -translate-y-1/2 sm:left-(--dx) sm:top-(--dy)";

  if (!seat) {
    const ring = (
      <span
        className={cn(
          "relative flex size-9 items-center justify-center rounded-full border-2 border-dashed border-primary/35 bg-background/30 transition-all duration-200 sm:size-12",
          selectable &&
            "group-hover:scale-110 group-hover:border-primary/80 group-hover:bg-primary/15",
          selected &&
            "scale-110 border-solid border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_30%,transparent),0_0_24px_color-mix(in_oklch,var(--primary)_55%,transparent)]",
        )}
      >
        {selected && (
          <span
            className="absolute inset-0 animate-ping rounded-full border-2 border-primary/60"
            aria-hidden="true"
          />
        )}
        {selected ? (
          <Check className="size-4 sm:size-5" aria-hidden="true" />
        ) : (
          <Armchair
            className={cn(
              "size-4 text-primary/60",
              selectable && "group-hover:text-primary",
            )}
            aria-hidden="true"
          />
        )}
      </span>
    );
    const label = (
      <span
        className={cn(
          "whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors",
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-background/50 text-muted-foreground",
          selectable && !selected && "group-hover:text-foreground",
        )}
      >
        {selected ? "Senin yerin" : `Koltuk ${index + 1}`}
      </span>
    );
    if (!selectable) {
      return (
        <div
          style={style}
          aria-hidden="true"
          className={cn(
            place,
            "size-6 rounded-full border border-dashed border-primary/20 sm:size-8",
          )}
        />
      );
    }
    return (
      <button
        type="button"
        style={style}
        onClick={() => onSelect?.(index + 1)}
        aria-pressed={selected}
        aria-label={`Koltuk ${index + 1}${selected ? ", seçili" : ", boş, seçmek için dokun"}`}
        className={cn(
          place,
          "group z-10 flex cursor-pointer flex-col items-center gap-1 rounded-2xl p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )}
      >
        {ring}
        {label}
      </button>
    );
  }

  const net = seatNet(seat);
  const win = net !== null && net > 0;
  const lose = net !== null && net < 0;
  const acting = phase === "play" && !seat.done;
  return (
    <div
      style={style}
      className={cn(
        place,
        "flex w-20 flex-col items-center gap-1 sm:w-28",
        seat.mine && "z-10",
      )}
    >
      {net !== null && net !== 0 && (
        <span
          aria-hidden="true"
          className={cn(
            "bj-float-up pointer-events-none absolute -top-5 left-1/2 z-20 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-black tabular-nums shadow-lg",
            win
              ? "bg-primary text-primary-foreground"
              : "bg-destructive text-primary-foreground",
          )}
        >
          {win ? "+" : "-"}
          {formatAC(Math.abs(net))}
        </span>
      )}
      <div
        className={cn(
          "flex min-h-12 justify-center gap-3 transition-[opacity,filter] duration-500 sm:min-h-14",
          lose && "bj-lose-shake opacity-45 grayscale",
          seat.surrendered && "opacity-45 grayscale",
        )}
      >
        {seat.hands.map((h, k) => (
          <div
            key={k}
            aria-label={seat.split ? `${k + 1}. el, ${h.value}` : undefined}
            className={cn(
              "relative flex justify-center rounded-lg",
              seat.split ? "-space-x-7 sm:-space-x-6" : "-space-x-6 sm:-space-x-5",
              h.active && seat.split && "ring-2 ring-primary ring-offset-2 ring-offset-transparent",
              seat.split && !h.active && phase === "play" && "opacity-70",
            )}
          >
            {h.cards.map((c, i) => (
              <PlayingCard
                key={`${i}-${c.r}-${c.s}`}
                card={c}
                index={i}
                small={!seat.mine || seat.split}
                medium={seat.mine && !seat.split}
              />
            ))}
            <span
              className={cn(
                "absolute -right-2 -top-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums shadow",
                h.value > 21
                  ? "bg-destructive text-primary-foreground"
                  : "bg-foreground text-background",
              )}
            >
              {h.value > 21 ? "Battı" : h.value}
              {h.doubled && " ×2"}
            </span>
          </div>
        ))}
      </div>
      <div
        className={cn(
          "flex w-full items-center gap-1.5 rounded-full border bg-background/90 py-1 pl-1 pr-2 shadow-lg",
          seat.mine
            ? "border-primary ring-2 ring-primary/40"
            : "border-primary/25",
          acting && "bj-seat-active",
          win && "bj-win-glow border-primary",
          lose && "border-destructive/70",
        )}
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase",
            seat.mine
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground",
          )}
          aria-hidden="true"
        >
          {seat.name.charAt(0)}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[11px] font-bold text-foreground">
            {seat.mine ? "Sen" : seat.name}
          </span>
          <span className="text-[10px] font-bold tabular-nums text-primary">
            {formatAC(seat.bet)}
          </span>
        </span>
      </div>
      <SideBetTags side={seat.side} />
      {seat.insurance > 0 && phase !== "result" && (
        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-foreground">
          Sigortalı {formatAC(seat.insurance)}
        </span>
      )}
      {seat.breakdown ? (
        <span
          className={cn(
            "pop-in whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black uppercase tabular-nums shadow",
            win
              ? "bg-primary text-primary-foreground"
              : lose
                ? "bg-destructive text-primary-foreground"
                : "bg-secondary text-foreground",
          )}
        >
          {seat.split
            ? seat.hands.map((h) => RESULT_LABEL[h.result ?? "push"]).join(" / ")
            : RESULT_LABEL[seat.hands[0]?.result ?? "push"]}
          {net !== null && net !== 0 && ` ${signed(net)}`}
        </span>
      ) : phase === "insurance" ? (
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          {seat.insDecided ? "Karar verdi" : "Düşünüyor"}
        </span>
      ) : phase === "play" && seat.done ? (
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          {seat.surrendered ? "Teslim oldu" : "Durdu"}
        </span>
      ) : null}
    </div>
  );
}

export function BlackjackLive({ settings }: { settings: ArenaGameSettings }) {
  const { member, setBalance, requireLogin, points } = usePoints();
  const idle = useIdle();
  const [seatedHere, setSeatedHere] = useState(false);
  const [viewTable, setViewTable] = useState<number | null>(null);
  const [entered, setEntered] = useState(false);
  function enterTable(no: number) {
    setViewTable(no);
    setEntered(true);
    setNotice("");
    setError("");
  }
  // Poll quickly only while this viewer is in a hand; spectators and idle tabs poll slowly.
  const { data, mutate } = useSWR<BlackjackLiveState>(
    viewTable ? `/api/blackjack?masa=${viewTable}` : "/api/blackjack",
    fetcher,
    {
      refreshInterval: idle ? 30000 : seatedHere ? 1500 : 4000,
      keepPreviousData: true,
    },
  );
  const now = useServerNow(data?.serverNow);
  const [bet, setBet] = useState(settings.bets[0] ?? 25);
  const [side, setSide] = useState<SideStakes>({ pairs: 0, t213: 0 });
  const totalBet = bet + side.pairs + side.t213;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const phase = data?.phase ?? "waiting";
  const seats = data?.seats ?? Array.from({ length: 6 }, () => null);
  const me = seats.find((s) => s?.mine) ?? null;
  const seated = seats.filter(Boolean).length;
  const msLeft =
    data?.phaseEndsAt && now ? Math.max(0, data.phaseEndsAt - now) : 0;
  const secondsLeft = Math.ceil(msLeft / 1000);
  const progress = data?.phaseTotal ? Math.min(1, msLeft / data.phaseTotal) : 0;
  const myTurn = phase === "play" && me && !me.done;
  const [pickedSeat, setPickedSeat] = useState<number | null>(null);
  const canPick = !me && (phase === "waiting" || phase === "bet");
  const chosenSeat =
    canPick && pickedSeat !== null && !seats[pickedSeat - 1] ? pickedSeat : null;

  function pickSeat(n: number) {
    setError("");
    setPickedSeat((cur) => (cur === n ? null : n));
  }

  useEffect(() => {
    setSeatedHere(!!me && !me.leaving);
  }, [me]);

  // When the countdown runs out, ask the server for the next phase instead of waiting for the next poll.
  const askedFor = useRef<number | null>(null);
  useEffect(() => {
    if (
      !data?.phaseEndsAt ||
      msLeft > 0 ||
      askedFor.current === data.phaseEndsAt
    )
      return;
    askedFor.current = data.phaseEndsAt;
    const t = setTimeout(() => mutate(), 300);
    return () => clearTimeout(t);
  }, [data?.phaseEndsAt, msLeft, mutate]);

  const lastPhase = useRef(phase);
  useEffect(() => {
    if (lastPhase.current !== phase) {
      lastPhase.current = phase;
      setError("");
      if (phase === "bet") playSound("turn");
      if (phase === "result" && me) {
        const net = seatNet(me);
        if (net !== null) playSound(net > 0 ? "win" : net < 0 ? "lose" : "tick");
      }
    }
  }, [phase, me]);

  // One soft "fwip" per card that lands on the felt, spaced like a real deal.
  const cardCount =
    (data?.dealer?.length ?? 0) +
    (data?.dealerHidden ? 1 : 0) +
    seats.reduce((n, s) => n + (s?.hands ?? []).reduce((m, h) => m + h.cards.length, 0), 0);
  const lastCount = useRef<{ round: unknown; n: number } | null>(null);
  useEffect(() => {
    const round = data?.roundId;
    const prev = lastCount.current;
    lastCount.current = { round, n: cardCount };
    if (!prev || prev.round !== round || cardCount <= prev.n) return;
    const timers = Array.from({ length: Math.min(cardCount - prev.n, 8) }, (_, i) =>
      setTimeout(() => playSound("card"), i * 150),
    );
    return () => timers.forEach(clearTimeout);
  }, [cardCount, data?.roundId]);

  useEffect(() => {
    if (typeof data?.balance === "number" && data.phase === "result")
      setBalance(data.balance);
  }, [data?.balance, data?.phase, setBalance]);

  async function dealNow() {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await readyBlackjackTable();
    setBusy(false);
    if (!res.ok) return setError(res.error);
    mutate();
  }

  const [notice, setNotice] = useState("");

  async function join(fresh = false) {
    if (busy || !requireLogin()) return;
    if (totalBet > points) return setError("Bakiyen bu bahis için yetersiz.");
    setBusy(true);
    setError("");
    setNotice("");
    const res = await joinBlackjackTable(
      bet,
      fresh ? null : (data?.tableNo ?? null),
      side,
      fresh ? null : chosenSeat,
      fresh,
    );
    setBusy(false);
    if (!res.ok) {
      setPickedSeat(null);
      mutate();
      return setError(res.error);
    }
    setPickedSeat(null);
    setBalance(res.balance);
    setViewTable(res.tableNo);
    setEntered(true);
    if (!res.seated)
      setNotice(
        `Masa ${res.tableNo} el oynuyor. Bu el bitince tekrar "Masaya otur"a bas, ilk boş koltuk senin.`,
      );
    else if (fresh)
      setNotice(
        `Masa ${res.tableNo} senin masan. Kankalar masalar listesinden gelip oturabilir.`,
      );
    else if (data && res.tableNo !== data.tableNo)
      setNotice(
        `Masa ${data.tableNo} doluydu, seni Masa ${res.tableNo}'e oturttuk.`,
      );
    mutate();
  }

  async function leave() {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await leaveBlackjackTable();
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setBalance(res.balance);
    setNotice(
      res.left
        ? "Masadan kalktın, bahsin iade edildi."
        : "Bu el bitince masadan kalkacaksın. Elin normal şekilde sonuçlanır.",
    );
    mutate();
  }

  async function changeBet(b: number, s?: SideStakes) {
    if (busy || !me) return;
    if (b === me.baseBet && !s) return;
    setBusy(true);
    setError("");
    const res = await changeBlackjackBet(b, s);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setBet(b);
    if (s) setSide(s);
    setBalance(res.balance);
    mutate();
  }

  async function insure(take: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await insureBlackjackTable(take);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    playSound("tick");
    setBalance(res.balance);
    mutate();
  }

  async function act(a: "hit" | "stand" | "double" | "split" | "surrender") {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await actBlackjackTable(a);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    playSound(a === "stand" ? "tick" : "card");
    setBalance(res.balance);
    mutate();
  }

  if (now === null || !data || !Array.isArray(data.seats)) {
    return (
      <div className="felt-table flex min-h-96 items-center justify-center rounded-3xl border border-primary/30">
        <Loader2
          className="size-6 animate-spin text-muted-foreground"
          aria-label="Masa yükleniyor"
        />
      </div>
    );
  }

  if (!me && !entered) {
    return (
      <BlackjackLobby
        tables={data.tables}
        busy={busy}
        openLabel={`Kendi masanı aç · ${formatAC(totalBet)}`}
        onPick={enterTable}
        onOpen={() => join(true)}
        message={error}
      />
    );
  }

  const dealer = data.dealer;
  const dealerHidden = data.dealerHidden;
  const phaseLabel =
    phase === "waiting"
      ? "Oyuncu bekleniyor"
      : phase === "bet"
        ? `Bahis · ${secondsLeft} sn`
        : phase === "insurance"
          ? `Sigorta · ${secondsLeft} sn`
          : phase === "play"
          ? `Oyun · ${secondsLeft} sn`
          : "Sonuç";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <LandscapeFit label="Canlı Blackjack">
      <section
        className="relative flex flex-col overflow-hidden rounded-3xl border border-primary/30 bg-[color-mix(in_oklch,var(--wood)_80%,var(--background))] p-2 sm:p-3"
        aria-label="Canlı blackjack masası"
      >
        <div className="flex flex-col gap-2 px-1 pb-2 pt-1 sm:gap-3 sm:px-2 sm:pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {!me && (
              <button
                type="button"
                onClick={() => setEntered(false)}
                className="flex items-center gap-1 rounded-full border border-primary/40 bg-background/70 px-3 py-1 text-xs font-bold uppercase text-foreground hover:border-primary"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Masalar
              </button>
            )}
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
              Masa {data.tableNo} · El #{data.roundId % 10000}
            </span>
            {!me && (
              <span className="flex items-center gap-1 rounded-full border border-primary/30 bg-background/60 px-2.5 py-1 text-[11px] font-bold uppercase text-muted-foreground">
                <Eye className="size-3.5" aria-hidden="true" />
                İzleyici · {data.watchers.length}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <VoiceChat key={`v-${data.tableNo}`} roomId={`blackjack-masa-${data.tableNo}`} />
              <MobileTableChat key={`m-${data.tableNo}`} tableId={`blackjack-masa-${data.tableNo}`} />
              <span className="rounded-full border border-primary/40 bg-background/70 px-3 py-1 text-xs font-bold tabular-nums text-foreground">
                {phaseLabel}
              </span>
            </div>
          </div>

          <p
            aria-live="polite"
            className="rounded-xl border border-primary/30 bg-background/70 px-3 py-1.5 text-center text-xs font-semibold text-foreground sm:py-2 sm:text-sm"
          >
            {dealerLine(phase, seated, secondsLeft, data.dealerValue, data.dealerBlackjack)}
          </p>

          <div className="mx-auto w-full rounded-t-[2.5rem] rounded-b-[9rem] bg-wood p-2 shadow-[inset_0_2px_0_rgb(255_255_255/0.08),0_18px_40px_-12px_rgb(0_0_0/0.7)] sm:rounded-[999px] sm:p-3.5">
            <div className="felt-table relative mx-auto aspect-[6/5] w-full rounded-t-[2rem] rounded-b-[8.5rem] border-2 border-primary/40 sm:aspect-[16/9] sm:rounded-[999px]">
              <TableBrand corners={false} jako={false} />
              <div
                className="pointer-events-none absolute right-[9%] top-[13%] flex flex-col items-center gap-0.5 sm:right-[14%] sm:top-[9%]"
                aria-hidden="true"
              >
                <div className="relative h-9 w-7 rotate-[18deg] sm:h-12 sm:w-9">
                  <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-md border border-primary/30 bg-secondary" />
                  <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-md border border-primary/40 bg-secondary" />
                  <div className="absolute inset-0 rounded-md border-2 border-primary/70 bg-[color-mix(in_oklch,var(--wood)_70%,black)] shadow-lg" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-primary/80 sm:text-[10px]">6 deste</span>
              </div>
              <div
                className="pointer-events-none absolute inset-3 rounded-t-[1.5rem] rounded-b-[7.5rem] border border-primary/15 sm:inset-5 sm:rounded-[999px]"
                aria-hidden="true"
              />

              <div className="absolute left-1/2 top-[5%] flex -translate-x-1/2 flex-col items-center gap-1 sm:top-[4%] sm:gap-1.5">
                <div className="relative size-9 overflow-hidden rounded-full border-2 border-primary/70 bg-background shadow-lg sm:size-14">
                  <Image
                    src="/images/mascots/jako-dealer.png"
                    alt="Krupiye Jako"
                    fill
                    sizes="56px"
                    className="object-cover object-top"
                    priority
                  />
                </div>
                <div className="flex min-h-16 justify-center -space-x-6 sm:min-h-20 sm:-space-x-6">
                  {dealer.map((c, i) => (
                    <PlayingCard
                      key={`d-${i}-${c.r}-${c.s}`}
                      card={c}
                      index={i}
                      medium
                    />
                  ))}
                  {dealerHidden && <PlayingCard hidden medium />}
                </div>
                {dealer.length > 0 && (
                  <span className="rounded-full bg-background/85 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-foreground">
                    {data.dealerBlackjack
                      ? "Krupiye Blackjack"
                      : `Krupiye ${data.dealerValue}${dealerHidden ? " · 1 kapalı" : ""}`}
                  </span>
                )}
              </div>

              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 top-[47%] flex w-[44%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center transition-opacity sm:top-[50%] sm:w-[34%]",
                  phase === "result" && "opacity-0",
                )}
              >
                <span className="font-display text-sm font-bold uppercase tracking-[0.25em] text-primary/30 sm:text-lg">
                  Al Kanka
                </span>
                <span className="text-pretty text-[9px] font-bold uppercase leading-relaxed tracking-[0.15em] text-primary/70 sm:text-[10px]">
                  Blackjack 3:2 öder · Krupiye 17’de durur · Sigorta 2:1
                </span>
              </div>

              {seats.map((s, i) => (
                <SeatPod
                  key={i}
                  index={i}
                  anchor={me ? me.seat - 1 : 0}
                  seat={s}
                  phase={phase}
                  selectable={canPick}
                  selected={chosenSeat === i + 1}
                  onSelect={pickSeat}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="h-1 bg-background/60" aria-hidden="true">
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="flex min-h-44 flex-col items-center gap-2 px-2 pb-2 pt-3 sm:gap-3 sm:pt-4">
          {phase === "result" && (
            <ResultBanner key={data.roundId} seats={seats} />
          )}
          {phase === "insurance" && me ? (
            me.can.insure ? (
              <div className={cn("flex flex-col items-center gap-2", MOBILE_BAR)}>
                <p className="text-center text-sm font-semibold text-foreground">
                  {me.natural
                    ? `Blackjack'in var! Eşit para alırsan krupiye ne açarsa açsın ${formatAC(me.baseBet)} kazanırsın.`
                    : `Krupiyenin açık kartı As. Sigorta ${formatAC(Math.floor(me.baseBet / 2))}, krupiye blackjack yaparsa 2:1 öder.`}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    disabled={busy || points < Math.floor(me.baseBet / 2)}
                    onClick={() => insure(true)}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50"
                  >
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    {me.natural ? "Eşit para al" : `Sigorta al · ${formatAC(Math.floor(me.baseBet / 2))}`}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => insure(false)}
                    className="flex items-center gap-2 rounded-xl border border-primary/50 bg-background/70 px-5 py-3 text-sm font-bold uppercase text-foreground disabled:opacity-50"
                  >
                    {me.natural ? "Hayır, oyna" : "Sigorta yok"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Kararın alındı. Diğer oyuncular bekleniyor, sonra krupiye kapalı karta bakacak.
              </p>
            )
          ) : myTurn ? (
            <div className={cn("flex flex-col items-center gap-2", MOBILE_BAR)}>
              {me.split && (
                <p className="text-center text-xs font-bold uppercase tracking-wide text-primary">
                  {me.hands.findIndex((h) => h.active) + 1}. eli oynuyorsun
                </p>
              )}
            <div className="flex w-full flex-wrap justify-center gap-2 max-sm:[&>button]:grow max-sm:[&>button]:basis-[calc(50%-0.25rem)] max-sm:[&>button]:justify-center">
              <button
                disabled={busy}
                onClick={() => act("hit")}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50"
              >
                <Plus className="size-4" aria-hidden="true" /> Kart çek
              </button>
              <button
                disabled={busy}
                onClick={() => act("stand")}
                className="flex items-center gap-2 rounded-xl border border-primary/50 bg-background/70 px-5 py-3 text-sm font-bold uppercase text-foreground disabled:opacity-50"
              >
                <Hand className="size-4" aria-hidden="true" /> Dur
              </button>
              {me.can.double && points >= me.baseBet && (
                <button
                  disabled={busy}
                  onClick={() => act("double")}
                  className="flex items-center gap-2 rounded-xl border border-primary/50 bg-background/70 px-5 py-3 text-sm font-bold uppercase text-foreground disabled:opacity-50"
                >
                  <Layers className="size-4" aria-hidden="true" /> İkiye katla
                </button>
              )}
              {me.can.split && points >= me.baseBet && (
                <button
                  disabled={busy}
                  onClick={() => act("split")}
                  className="flex items-center gap-2 rounded-xl border border-primary/50 bg-background/70 px-5 py-3 text-sm font-bold uppercase text-foreground disabled:opacity-50"
                >
                  <Split className="size-4" aria-hidden="true" /> İkiye ayır
                </button>
              )}
              {me.can.surrender && (
                <button
                  disabled={busy}
                  onClick={() => act("surrender")}
                  title="Bahsinin yarısını geri alıp eli bırakırsın"
                  className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-4 py-3 text-xs font-bold uppercase text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <Flag className="size-4" aria-hidden="true" /> Teslim ol
                </button>
              )}
            </div>
            </div>
          ) : phase === "bet" && me ? (
            <div className="flex flex-col items-center gap-2">
              {me.ready ? (
                <p className="text-center text-sm text-muted-foreground">
                  {seated > 1
                    ? `Hazırsın. Diğer oyuncular bekleniyor, en geç ${secondsLeft} saniye.`
                    : "Kartlar dağıtılıyor..."}
                </p>
              ) : (
                <button
                  disabled={busy}
                  onClick={dealNow}
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50"
                >
                  <Play className="size-4" aria-hidden="true" />
                  {seated > 1 ? "Hazırım, dağıt" : "Hemen dağıt"}
                </button>
              )}
              <div
                className={CHIP_ROW}
                role="radiogroup"
                aria-label="Bu elin bahsi"
              >
                {settings.bets.map((b) => (
                  <button
                    key={b}
                    role="radio"
                    aria-checked={me.baseBet === b}
                    disabled={busy}
                    onClick={() => changeBet(b)}
                    className={cn("chip", me.baseBet === b && "chip-active")}
                  >
                    {formatAC(b)}
                  </button>
                ))}
              </div>
              <SideBetPicker
                value={{ pairs: me.side.pairs, t213: me.side.t213 }}
                onChange={(s) => changeBet(me.baseBet, s)}
              />
              <p className="w-full text-pretty px-2 text-center text-xs leading-relaxed text-muted-foreground">
                Koltuk {me.seat} senin, kalkana kadar her el burada oynarsın.
                Basmazsan kartlar {secondsLeft} saniye sonra kendiliğinden
                dağıtılır.
                {me.idle > 0 &&
                  " Son eli kaçırdın, bu eli de kaçırırsan masadan kaldırılırsın."}
              </p>
            </div>
          ) : !me ? (
            <div className="flex w-full flex-col items-center gap-2 sm:gap-3">
              <span className="sr-only text-xs font-bold uppercase tracking-wider text-muted-foreground sm:not-sr-only">
                Ana bahis
              </span>
              <div
                className={CHIP_ROW}
                role="radiogroup"
                aria-label="Bahis"
              >
                {settings.bets.map((b) => (
                  <button
                    key={b}
                    role="radio"
                    aria-checked={bet === b}
                    onClick={() => setBet(b)}
                    className={cn("chip", bet === b && "chip-active")}
                  >
                    {formatAC(b)}
                  </button>
                ))}
              </div>
              <SideBetPicker value={side} onChange={setSide} />
              <button
                disabled={busy}
                onClick={() => join()}
                className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Armchair className="size-4" aria-hidden="true" />
                )}
                {chosenSeat
                  ? `Koltuk ${chosenSeat}'e otur`
                  : "Masaya otur"}{" "}
                · {formatAC(totalBet)}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => join(true)}
                className="flex items-center gap-2 rounded-xl border border-primary/60 px-5 py-2.5 text-xs font-bold uppercase text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                <Plus className="size-4" aria-hidden="true" />
                Kendi masanı aç
              </button>
              <p className="text-center text-xs text-muted-foreground">
                {!member
                  ? "Oynamak için giriş yap. İzlemek serbest."
                  : chosenSeat
                    ? `Koltuk ${chosenSeat} seçili. Vazgeçmek için tekrar dokun.`
                    : "Masadaki boş bir koltuğa dokunup yerini seç, ya da direkt otur, ilk boş koltuk senin."}
              </p>
            </div>
          ) : phase === "result" && me?.breakdown ? (
            <div className="flex w-full flex-col items-center gap-2">
              <Breakdown seat={me} />
              {!me.leaving && (
                <p className="text-center text-xs text-muted-foreground">
                  Koltuğun seni bekliyor, yeni el aynı bahislerle başlıyor. Bahis süresinde değiştirebilirsin.
                </p>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              {me
                ? phase === "play"
                  ? me.surrendered
                    ? "Teslim oldun, bahsinin yarısı iade edilecek."
                    : "Elin tamam, diğer oyuncular bekleniyor."
                  : "Bu el krupiyenin."
                : "Bu eli izliyorsun. Bahis süresi açılınca boş koltuğa oturabilirsin."}
            </p>
          )}
          {me && (
            <button
              disabled={busy || me.leaving}
              onClick={leave}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              {me.leaving ? "El bitince kalkıyorsun" : "Masadan kalk"}
            </button>
          )}
          {notice && !error && (
            <p
              aria-live="polite"
              className="text-center text-sm font-semibold text-primary"
            >
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <p className="hidden text-center text-xs text-muted-foreground sm:block">
            Masada 6 koltuk var. Herkes durunca krupiye hemen açar, süre dolunca
            oynamayan el otomatik durur.
          </p>
        </div>
      </section>
      </LandscapeFit>

      <aside className="flex h-fit flex-col gap-4" aria-label="Masa bilgileri">
        <div className={cn(me && "hidden lg:block")}>
          <BlackjackTables
            tables={data.tables}
            current={data.tableNo}
            locked={!!me}
            onView={enterTable}
          />
        </div>
        <TableChat
          key={data.tableNo}
          tableId={`blackjack-masa-${data.tableNo}`}
          className="hidden h-80 lg:flex"
        />
        <BlackjackWatchers names={data.watchers} spectating={!!member && !me} />
        <section
          className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-4"
          aria-labelledby="bj-winners"
        >
          <h3
            id="bj-winners"
            className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground"
          >
            <Trophy className="size-4 text-primary" aria-hidden="true" />
            Son el kazananları
          </h3>
          {!data.lastRound ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Henüz oynanmış el yok.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Krupiye:{" "}
                {data.lastRound.dealerValue > 21
                  ? `${data.lastRound.dealerValue} (battı)`
                  : data.lastRound.dealerValue}
              </p>
              <LastWinners winners={data.lastRound.winners} />
            </>
          )}
        </section>
        <SidePayoutCard />
      </aside>
    </div>
  );
}

function LastWinners({
  winners,
}: {
  winners: { name: string; won: number }[];
}) {
  if (winners.length === 0)
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        Son elde kazanan yok.
      </p>
    );
  return (
    <ol className="flex flex-col gap-1.5">
      {winners.map((w, i) => (
        <li
          key={`${w.name}-${i}`}
          className="flex items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm"
        >
          <span className="truncate font-semibold text-foreground">
            {w.name}
          </span>
          <span className="shrink-0 font-bold tabular-nums text-primary">
            +{formatAC(w.won)}
          </span>
        </li>
      ))}
    </ol>
  );
}
