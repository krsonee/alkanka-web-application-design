"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import {
  Armchair,
  Check,
  Eye,
  Hand,
  Layers,
  Loader2,
  LogOut,
  Play,
  Plus,
  Trophy,
} from "lucide-react";
import type { ArenaGameSettings } from "@/lib/arena";
import type { BlackjackLiveState } from "@/lib/blackjack-live";
import {
  actBlackjackTable,
  changeBlackjackBet,
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
import { BlackjackTables, BlackjackWatchers } from "./blackjack-tables";
import { TableChat } from "./table-chat";
import { MobileTableChat } from "./mobile-table-chat";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
type Seat = NonNullable<BlackjackLiveState["seats"][number]>;

const RESULT_LABEL: Record<string, string> = {
  blackjack: "Blackjack!",
  win: "Kazandı",
  push: "Berabere",
  loss: "Kaybetti",
};
/** Net gain for the hand including side bets; null until the hand is revealed. */
function seatNet(seat: Seat) {
  if (seat.delta === null) return null;
  return seat.delta + seat.side.won - seat.side.pairs - seat.side.t213;
}

function ResultBanner({ seats }: { seats: (Seat | null)[] }) {
  const played = seats.filter((s): s is Seat => !!s && s.delta !== null);
  if (played.length === 0) return null;
  const me = played.find((s) => s.mine);
  const base =
    "bj-banner pointer-events-none absolute left-1/2 top-[56%] z-30 flex min-w-44 flex-col items-center gap-0.5 rounded-2xl border-2 px-5 py-3 text-center shadow-2xl sm:top-1/2 sm:min-w-56 sm:px-7 sm:py-4";

  if (me) {
    const net = seatNet(me)!;
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
            "font-display text-xl font-black uppercase tracking-wide sm:text-3xl",
            net > 0 ? "text-primary" : net < 0 ? "text-destructive" : "text-foreground",
          )}
        >
          {net > 0
            ? me.result === "blackjack"
              ? "Blackjack!"
              : "Kazandın!"
            : net < 0
              ? "Kaybettin"
              : "Berabere"}
        </span>
        <span className="text-base font-black tabular-nums text-foreground sm:text-xl">
          {net > 0
            ? `+${formatAC(net)}`
            : net < 0
              ? `-${formatAC(-net)}`
              : "Bahsin iade edildi"}
        </span>
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
) {
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

function SeatPod({
  index,
  seat,
  phase,
  selectable = false,
  selected = false,
  onSelect,
}: {
  index: number;
  seat: Seat | null;
  phase: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (seat: number) => void;
}) {
  const pos = SEAT_POS[index];
  const style = {
    "--mx": `${pos.m[0]}%`,
    "--my": `${pos.m[1]}%`,
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
          className={cn(place, "flex flex-col items-center gap-1")}
        >
          {ring}
          {label}
        </div>
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
          "relative flex min-h-12 justify-center -space-x-6 transition-[opacity,filter] duration-500 sm:min-h-14 sm:-space-x-5",
          lose && "bj-lose-shake opacity-45 grayscale",
        )}
      >
        {seat.cards.map((c, i) => (
          <PlayingCard key={`${i}-${c.r}-${c.s}`} card={c} index={i} small />
        ))}
        {seat.cards.length > 0 && (
          <span
            className={cn(
              "absolute -right-2 -top-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums shadow",
              seat.value > 21
                ? "bg-destructive text-primary-foreground"
                : "bg-foreground text-background",
            )}
          >
            {seat.value > 21 ? "Battı" : seat.value}
          </span>
        )}
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
      {seat.result ? (
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
          {win
            ? seat.result === "blackjack"
              ? "Blackjack!"
              : "Kazandı"
            : lose
              ? "Kaybetti"
              : RESULT_LABEL.push}
          {net !== null && net !== 0 && (
            <>
              {" "}
              {win ? "+" : "-"}
              {formatAC(Math.abs(net))}
            </>
          )}
        </span>
      ) : phase === "play" && seat.done ? (
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Durdu
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
    }
  }, [phase]);

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

  async function join() {
    if (busy || !requireLogin()) return;
    if (totalBet > points) return setError("Bakiyen bu bahis için yetersiz.");
    setBusy(true);
    setError("");
    setNotice("");
    const res = await joinBlackjackTable(
      bet,
      data?.tableNo ?? null,
      side,
      chosenSeat,
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
    if (!res.seated)
      setNotice(
        `Masa ${res.tableNo} el oynuyor. Bu el bitince tekrar "Masaya otur"a bas, ilk boş koltuk senin.`,
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

  async function changeBet(b: number) {
    if (busy || !me || b === me.baseBet) return;
    setBusy(true);
    setError("");
    const res = await changeBlackjackBet(b);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setBet(b);
    setBalance(res.balance);
    mutate();
  }

  async function act(a: "hit" | "stand" | "double") {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await actBlackjackTable(a);
    setBusy(false);
    if (!res.ok) return setError(res.error);
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

  const dealer = data.dealer;
  const dealerHidden = data.dealerHidden;
  const phaseLabel =
    phase === "waiting"
      ? "Oyuncu bekleniyor"
      : phase === "bet"
        ? `Bahis · ${secondsLeft} sn`
        : phase === "play"
          ? `Oyun · ${secondsLeft} sn`
          : "Sonuç";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <section
        className="relative flex flex-col overflow-hidden rounded-3xl border border-primary/30 bg-[color-mix(in_oklch,var(--wood)_80%,var(--background))] p-2 sm:p-3"
        aria-label="Canlı blackjack masası"
      >
        <div className="flex flex-col gap-2 px-1 pb-2 pt-1 sm:gap-3 sm:px-2 sm:pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
            {dealerLine(phase, seated, secondsLeft, data.dealerValue)}
          </p>

          <div className="mx-auto w-full max-w-[min(100%,58svh)] rounded-[999px] bg-wood p-2 shadow-[inset_0_2px_0_rgb(255_255_255/0.08),0_18px_40px_-12px_rgb(0_0_0/0.7)] sm:max-w-none sm:p-3.5">
            <div className="felt-table relative mx-auto aspect-square w-full rounded-[999px] border-2 border-primary/40 sm:aspect-[16/9]">
              <div
                className="pointer-events-none absolute inset-3 rounded-[999px] border border-primary/15 sm:inset-5"
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
                <div className="flex min-h-12 justify-center -space-x-6 sm:min-h-14 sm:-space-x-5">
                  {dealer.map((c, i) => (
                    <PlayingCard
                      key={`d-${i}-${c.r}-${c.s}`}
                      card={c}
                      index={i}
                      small
                    />
                  ))}
                  {dealerHidden && <PlayingCard hidden small />}
                </div>
                {dealer.length > 0 && (
                  <span className="rounded-full bg-background/85 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-foreground">
                    Krupiye {data.dealerValue}
                    {dealerHidden ? "+" : ""}
                  </span>
                )}
              </div>

              {phase === "result" && (
                <ResultBanner key={data.roundId} seats={seats} />
              )}
              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 top-[56%] flex w-[40%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center transition-opacity sm:top-[50%] sm:w-[34%]",
                  phase === "result" && "opacity-0",
                )}
              >
                <span className="font-display text-sm font-bold uppercase tracking-[0.25em] text-primary/30 sm:text-lg">
                  Al Kanka
                </span>
                <span className="text-pretty text-[9px] font-bold uppercase leading-relaxed tracking-[0.15em] text-primary/70 sm:text-[10px]">
                  Blackjack 3:2 öder · Krupiye 17’de durur
                </span>
              </div>

              {seats.map((s, i) => (
                <SeatPod
                  key={i}
                  index={i}
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

        <div className="flex flex-col items-center gap-2 px-2 pb-2 pt-3 sm:gap-3 sm:pt-4">
          {myTurn ? (
            <div className="flex flex-wrap justify-center gap-2">
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
              {me.cards.length === 2 && points >= me.bet && (
                <button
                  disabled={busy}
                  onClick={() => act("double")}
                  className="flex items-center gap-2 rounded-xl border border-primary/50 bg-background/70 px-5 py-3 text-sm font-bold uppercase text-foreground disabled:opacity-50"
                >
                  <Layers className="size-4" aria-hidden="true" /> İkiye katla
                </button>
              )}
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
                className="flex flex-wrap justify-center gap-2"
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
              <p className="text-center text-xs text-muted-foreground">
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
                className="flex flex-wrap justify-center gap-2"
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
                onClick={join}
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
              <p className="text-center text-xs text-muted-foreground">
                {!member
                  ? "Oynamak için giriş yap. İzlemek serbest."
                  : chosenSeat
                    ? `Koltuk ${chosenSeat} seçili. Vazgeçmek için tekrar dokun.`
                    : "Masadaki boş bir koltuğa dokunup yerini seç, ya da direkt otur, ilk boş koltuk senin."}
              </p>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              {me
                ? phase === "play"
                  ? "Elin tamam, diğer oyuncular bekleniyor."
                  : me.delta !== null && me.delta > 0
                    ? `Tebrikler, +${formatAC(me.delta)} kazandın!`
                    : me.delta === 0
                      ? "Berabere, bahsin iade edildi."
                      : "Bu el krupiyenin."
                : "Bu eli izliyorsun. Bahis süresi açılınca boş koltuğa oturabilirsin."}
              {me && phase === "result" && !me.leaving &&
                " Koltuğun seni bekliyor, yeni el aynı bahisle başlıyor."}
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

      <aside className="flex h-fit flex-col gap-4" aria-label="Masa bilgileri">
        <BlackjackTables
          tables={data.tables}
          current={data.tableNo}
          locked={!!me}
          onView={setViewTable}
        />
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
