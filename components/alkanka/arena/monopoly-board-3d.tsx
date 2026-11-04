"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { BOARD, type Group, type MonopolyState } from "@/lib/games/monopoly";

export type MoneyDelta = { id: number; values: number[] } | null;
export type Playback = {
  walking: boolean;
  walker: number | null;
  shown: number[];
};

type Props = {
  s: MonopolyState;
  tokenColors: string[];
  follow: boolean;
  moneyDelta: MoneyDelta;
  onSelect: (i: number) => void;
  /** Reports which positions are on screen while moves are still being played back. */
  onPlayback: (p: Playback) => void;
  /** Action controls rendered on the board, just below where the dice land. */
  dock?: ReactNode;
};

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** Two dice that add up to `sum` (2–12), used when the server only kept the latest roll. */
function diceFor(sum: number): [number, number] {
  const lo = Math.max(1, sum - 6);
  const hi = Math.min(6, sum - 1);
  const a = lo + Math.floor(Math.random() * (hi - lo + 1));
  return [a, sum - a];
}

const GC: Record<Group, string> = {
  brown: "#7a4b2a",
  lightblue: "#8fcbec",
  pink: "#d93b8c",
  orange: "#ee8a2c",
  red: "#d8322f",
  yellow: "#f2cf3a",
  green: "#2e9a5b",
  darkblue: "#2a45a8",
};

const HALF = 6.1;
const C = 1.6;
const SW = 1.0;
const TOP = 0;
type Side = "c" | "b" | "l" | "t" | "r";
const sideOf = (i: number): Side =>
  i % 10 === 0 ? "c" : i < 10 ? "b" : i < 20 ? "l" : i < 30 ? "t" : "r";
const camSide = (i: number) =>
  (i % 10 === 0 ? sideOf((i + 1) % 40) : sideOf(i)) as Exclude<Side, "c">;
const OUT = { b: [0, 1], l: [-1, 0], t: [0, -1], r: [1, 0] } as const;
const AX = { b: [1, 0], l: [0, 1], t: [1, 0], r: [0, 1] } as const;

function rect(i: number) {
  const s = sideOf(i);
  if (s === "c") {
    const p = [
      [HALF - C / 2, HALF - C / 2],
      [-HALF + C / 2, HALF - C / 2],
      [-HALF + C / 2, -HALF + C / 2],
      [HALF - C / 2, -HALF + C / 2],
    ][i / 10];
    return { x: p[0], z: p[1], w: C, d: C };
  }
  const j = i % 10;
  if (s === "b")
    return { x: HALF - C - (j - 0.5) * SW, z: HALF - C / 2, w: SW, d: C };
  if (s === "l")
    return { x: -HALF + C / 2, z: HALF - C - (j - 0.5) * SW, w: C, d: SW };
  if (s === "t")
    return { x: -HALF + C + (j - 0.5) * SW, z: -HALF + C / 2, w: SW, d: C };
  return { x: HALF - C / 2, z: -HALF + C + (j - 0.5) * SW, w: C, d: SW };
}
function tileAt(x: number, z: number) {
  for (let i = 0; i < 40; i++) {
    const r = rect(i);
    if (Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2) return i;
  }
  return -1;
}

/** Canvas resolves any CSS color (incl. oklch) to sRGB so three.js can use it. */
function cssToRgb(c: string) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const x = cv.getContext("2d")!;
  x.fillStyle = "#888";
  x.fillStyle = c;
  x.fillRect(0, 0, 1, 1);
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data;
  return `rgb(${r},${g},${b})`;
}

const fmt = (n: number) => `${n.toLocaleString("tr-TR")} ₺`;

const PATHS: Record<string, string> = {
  rail: "M7 3h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 10h14M8 17l-2 4M16 17l2 4M9 13.5h.01M15 13.5h.01",
  elec: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  water:
    "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z",
  chest:
    "M5 8h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2zM3 12h18M12 8v13M8 8a2.5 2.5 0 1 1 4-2 2.5 2.5 0 1 1 4 2",
  chance: "M9 9a3 3 0 1 1 4 2.8c-.7.3-1 1-1 1.7V15M12 19h.01",
  tax: "M19 5 5 19M7 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM17 15a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  go: "M19 12H5M11 6l-6 6 6 6",
  jail: "M5 3h14v18H5zM9 3v18M12 3v18M15 3v18",
  park: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 17V7h4a3 3 0 0 1 0 6H9",
  lock: "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V7a4 4 0 0 1 8 0v4",
};

type Tween = {
  t0: number;
  dur: number;
  fn: (t: number) => void;
  ease: (t: number) => number;
  res: () => void;
};
const cubicOut = (t: number) => 1 - (1 - t) ** 3;
const backOut = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

type Engine = ReturnType<typeof createEngine>;

function createEngine(
  host: HTMLDivElement,
  fxEl: HTMLDivElement,
  fonts: { display: string; body: string },
  anchorEl: HTMLDivElement | null,
) {
  const disposers: (() => void)[] = [];
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className =
    "absolute inset-0 block size-full touch-manipulation";
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0b1020");
  scene.fog = new THREE.Fog("#0b1020", 26, 48);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.22;
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);

  scene.add(new THREE.HemisphereLight("#cfdcff", "#20160a", 0.7));
  const sun = new THREE.DirectionalLight("#fff3df", 1.35);
  sun.position.set(6, 15, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -9,
    right: 9,
    top: 9,
    bottom: -9,
    near: 1,
    far: 40,
  });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const rim = new THREE.DirectionalLight("#7fb4ff", 0.3);
  rim.position.set(-10, 6, -8);
  scene.add(rim);

  const table = new THREE.Mesh(
    new THREE.CircleGeometry(40, 64),
    new THREE.MeshStandardMaterial({ color: "#0f1730", roughness: 0.9 }),
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.62;
  table.receiveShadow = true;
  scene.add(table);

  const lacquer = new THREE.MeshStandardMaterial({
    color: "#121a33",
    roughness: 0.7,
  });
  const goldM = new THREE.MeshStandardMaterial({
    color: "#b8901f",
    metalness: 0.7,
    roughness: 0.5,
  });
  const base = new THREE.Mesh(
    new RoundedBoxGeometry(13.5, 0.5, 13.5, 4, 0.12),
    lacquer,
  );
  base.position.y = -0.25;
  base.castShadow = base.receiveShadow = true;
  scene.add(base);
  const lip = new THREE.Mesh(
    new RoundedBoxGeometry(13.9, 0.22, 13.9, 4, 0.08),
    goldM,
  );
  lip.position.y = -0.45;
  lip.receiveShadow = true;
  scene.add(lip);

  /* ---------- printed board ---------- */
  const N = 2048;
  const K = N / (2 * HALF);
  const cv = document.createElement("canvas");
  cv.width = cv.height = N;
  const g = cv.getContext("2d")!;
  const IVORY = "#e4dac3";
  const INK = "#111827";
  const icon = (
    name: string,
    x: number,
    y: number,
    size: number,
    color: string,
    lw = 2,
  ) => {
    g.save();
    g.translate(x, y);
    g.scale(size / 24, size / 24);
    g.translate(-12, -12);
    g.strokeStyle = color;
    g.lineWidth = lw;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.stroke(new Path2D(PATHS[name]));
    g.restore();
  };
  const wrapLines = (text: string, maxW: number) => {
    const lines: string[] = [];
    let line = "";
    for (const w of text.split(" ")) {
      const t = line ? `${line} ${w}` : w;
      if (g.measureText(t).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    lines.push(line);
    return lines;
  };
  /** Shrinks the font until the text fits, then squeezes horizontally as a last resort. Returns the used height. */
  const fitText = (
    text: string,
    cx: number,
    top: number,
    maxW: number,
    maxLines: number,
    big: number,
    small: number,
    weight: number,
    family = fonts.body,
  ) => {
    let size = big;
    let lines: string[] = [];
    for (; size >= small; size -= 2) {
      g.font = `${weight} ${size}px ${family}`;
      lines = wrapLines(text, maxW);
      if (
        lines.length <= maxLines &&
        lines.every((l) => g.measureText(l).width <= maxW)
      )
        break;
    }
    size = Math.max(size, small);
    g.font = `${weight} ${size}px ${family}`;
    lines = wrapLines(text, maxW);
    if (lines.length > maxLines)
      lines = [
        ...lines.slice(0, maxLines - 1),
        lines.slice(maxLines - 1).join(" "),
      ];
    const lh = size * 1.06;
    g.textBaseline = "top";
    lines.forEach((l, k) => {
      const lw = g.measureText(l).width;
      g.save();
      g.translate(cx, top + k * lh);
      if (lw > maxW) g.scale(maxW / lw, 1);
      g.fillText(l, 0, 0);
      g.restore();
    });
    return lines.length * lh;
  };
  const drawBoard = () => {
    g.fillStyle = IVORY;
    g.fillRect(0, 0, N, N);
    const a = C * K;
    const b = N - C * K;
    const grd = g.createRadialGradient(
      N / 2,
      N / 2,
      40,
      N / 2,
      N / 2,
      N * 0.48,
    );
    grd.addColorStop(0, "#1d3d66");
    grd.addColorStop(1, "#0f2240");
    g.fillStyle = grd;
    g.fillRect(a, a, b - a, b - a);
    g.strokeStyle = "rgba(232,185,49,.55)";
    g.lineWidth = 6;
    g.strokeRect(a + 28, a + 28, b - a - 56, b - a - 56);
    g.save();
    g.translate(N / 2, N / 2 - 60);
    g.rotate(-0.12);
    g.font = `700 230px ${fonts.display}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#8a6410";
    g.fillText("JAKOPOLY", 0, 14);
    g.fillStyle = "#e8b931";
    g.fillText("JAKOPOLY", 0, 0);
    g.restore();
    g.save();
    g.translate(N / 2, N / 2 + 130);
    g.fillStyle = "#0b1020";
    g.strokeStyle = "#9c7712";
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(-250, -40, 500, 80, 40);
    g.fill();
    g.stroke();
    g.font = `600 34px ${fonts.body}`;
    g.fillStyle = "#f4efe4";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.letterSpacing = "14px";
    g.fillText("ALKANKA ARENA", 8, 2);
    g.letterSpacing = "0px";
    g.restore();

    BOARD.forEach((sq, i) => {
      const r = rect(i);
      const s = sideOf(i);
      g.save();
      g.translate((r.x + HALF) * K, (r.z + HALF) * K);
      // Every tile is printed upright so it reads straight from the camera, which always sits on the south side.
      const W = r.w * K;
      const H = r.d * K;
      g.fillStyle = IVORY;
      g.fillRect(-W / 2, -H / 2, W, H);
      g.strokeStyle = "#1d2742";
      g.lineWidth = 3;
      g.strokeRect(-W / 2, -H / 2, W, H);
      g.textAlign = "center";
      g.textBaseline = "top";
      g.fillStyle = INK;
      const upper = sq.name.toLocaleUpperCase("tr-TR");
      if (s === "c") {
        const ic =
          { go: "go", jail: "jail", parking: "park", gotojail: "lock" }[
            sq.type as "go"
          ] ?? "go";
        const tint =
          {
            go: "#2e9a5b",
            jail: "#d8322f",
            parking: "#2a45a8",
            gotojail: "#d8322f",
          }[sq.type as "go"] ?? INK;
        icon(ic, 0, -H / 2 + 62, 86, tint, 2.4);
        g.fillStyle = INK;
        const used = fitText(
          upper,
          0,
          -6,
          W - 28,
          2,
          42,
          26,
          800,
          fonts.display,
        );
        if (sq.type === "go") {
          g.font = `800 32px ${fonts.body}`;
          g.fillStyle = "#2e9a5b";
          g.textBaseline = "top";
          g.fillText("+200 ₺", 0, -2 + used + 6);
        }
      } else {
        const [ox, oy] = OUT[s];
        const BT = 0.28 * K;
        let x0 = -W / 2 + 4;
        let x1 = W / 2 - 4;
        let y0 = -H / 2 + 4;
        let y1 = H / 2 - 4;
        const cut = (dx: number, dy: number, amt: number) => {
          if (dx > 0) x1 -= amt;
          if (dx < 0) x0 += amt;
          if (dy > 0) y1 -= amt;
          if (dy < 0) y0 += amt;
        };
        if (sq.type === "property") {
          g.fillStyle = GC[sq.group];
          const bx = -ox > 0 ? W / 2 - BT - 3 : -W / 2 + 3;
          const by = -oy > 0 ? H / 2 - BT - 3 : -H / 2 + 3;
          g.fillRect(bx, by, ox ? BT : W - 6, oy ? BT : H - 6);
          cut(-ox, -oy, BT + 2);
        }
        // Leave room on the outer edge for the owner marker.
        cut(ox, oy, 0.16 * K);
        const cx = (x0 + x1) / 2;
        const bw = x1 - x0 - 10;
        g.fillStyle = INK;
        const nameH = fitText(upper, cx, y0 + 6, bw, 2, 34, 24, 800);
        const ic =
          sq.type === "rail"
            ? "rail"
            : sq.type === "utility"
              ? sq.name.includes("Su")
                ? "water"
                : "elec"
              : sq.type === "chance"
                ? "chance"
                : sq.type === "chest"
                  ? "chest"
                  : sq.type === "tax"
                    ? "tax"
                    : null;
        const price =
          "price" in sq ? fmt(sq.price) : "amount" in sq ? fmt(sq.amount) : "";
        let priceH = 0;
        if (price) {
          g.font = `800 30px ${fonts.body}`;
          const pw = g.measureText(price).width;
          g.fillStyle = "#1f2940";
          g.textBaseline = "bottom";
          g.save();
          g.translate(cx, y1 - 4);
          if (pw > bw) g.scale(bw / pw, 1);
          g.fillText(price, 0, 0);
          g.restore();
          priceH = 34;
        }
        const room = y1 - 4 - priceH - (y0 + 6 + nameH);
        const size = Math.min(room - 8, bw * 0.55, ic === "chance" ? 84 : 70);
        if (ic && size >= 28) {
          const col =
            sq.type === "chance"
              ? "#a86f00"
              : sq.type === "chest"
                ? "#1f6aa8"
                : "#1f2940";
          icon(ic, cx, y0 + 6 + nameH + room / 2, size, col, 2.8);
        }
      }
      g.restore();
    });
  };
  drawBoard();
  const boardTex = new THREE.CanvasTexture(cv);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  boardTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  document.fonts?.ready.then(() => {
    drawBoard();
    boardTex.needsUpdate = true;
  });
  const boardTop = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * HALF, 2 * HALF),
    new THREE.MeshStandardMaterial({
      map: boardTex,
      roughness: 0.95,
      metalness: 0,
    }),
  );
  boardTop.rotation.x = -Math.PI / 2;
  boardTop.position.y = TOP + 0.002;
  boardTop.receiveShadow = true;
  scene.add(boardTop);

  type TileInfo = {
    center: THREE.Vector3;
    inward?: THREE.Vector3;
    axis?: THREE.Vector3;
    bandCenter?: THREE.Vector3;
    outer?: THREE.Vector3;
    houses?: THREE.Group;
  };
  const tileInfo: TileInfo[] = BOARD.map((sq, i) => {
    const r = rect(i);
    const s = sideOf(i);
    const info: TileInfo = { center: new THREE.Vector3(r.x, TOP, r.z) };
    if (s === "c") return info;
    const [ox, oz] = OUT[s];
    const [ax, az] = AX[s];
    info.inward = new THREE.Vector3(-ox, 0, -oz);
    info.axis = new THREE.Vector3(ax, 0, az);
    info.bandCenter = info.center
      .clone()
      .addScaledVector(info.inward, C / 2 - 0.16);
    info.outer = info.center
      .clone()
      .addScaledVector(info.inward, -(C / 2 - 0.08));
    if (sq.type === "property") {
      const len = SW - 0.06;
      const geo = new RoundedBoxGeometry(
        ax ? len : 0.3,
        0.07,
        ax ? 0.3 : len,
        2,
        0.02,
      );
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: GC[sq.group], roughness: 0.6 }),
      );
      m.position.copy(info.bandCenter).setY(TOP + 0.035);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
    }
    info.houses = new THREE.Group();
    scene.add(info.houses);
    return info;
  });

  /* ---------- card decks ---------- */
  const labelTex = (text: string, bg: string, fg: string) => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 340;
    const x = c.getContext("2d")!;
    x.fillStyle = bg;
    x.fillRect(0, 0, 512, 340);
    x.strokeStyle = "rgba(255,255,255,.45)";
    x.lineWidth = 8;
    x.strokeRect(22, 22, 468, 296);
    x.fillStyle = fg;
    x.font = `700 78px ${fonts.display}`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(text, 256, 170);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const cardGeo = new RoundedBoxGeometry(1.5, 0.035, 1.0, 2, 0.015);
  const decks: Record<
    string,
    { grp: THREE.Group; top: THREE.Material; side: THREE.Material }
  > = {};
  (
    [
      ["chance", "ŞANS", "#e8b931", "#2a1f05", -2.1, -2.75, 0.3],
      ["chest", "KAMU FONU", "#3fa7e0", "#06233a", 2.1, 2.7, -0.3],
    ] as const
  ).forEach(([k, txt, bg, fg, x, z, rot]) => {
    const grp = new THREE.Group();
    const side = new THREE.MeshStandardMaterial({
      color: "#efe8d6",
      roughness: 0.7,
    });
    const top = new THREE.MeshPhysicalMaterial({
      map: labelTex(txt, bg, fg),
      roughness: 0.35,
      clearcoat: 0.6,
    });
    for (let n = 0; n < 6; n++) {
      const card = new THREE.Mesh(cardGeo, [
        side,
        side,
        n === 5 ? top : side,
        side,
        side,
        side,
      ]);
      card.position.set(
        (Math.random() - 0.5) * 0.04,
        0.02 + n * 0.04,
        (Math.random() - 0.5) * 0.04,
      );
      card.rotation.y = (Math.random() - 0.5) * 0.06;
      card.castShadow = card.receiveShadow = true;
      grp.add(card);
    }
    grp.position.set(x, TOP, z);
    grp.rotation.y = rot;
    scene.add(grp);
    decks[k] = { grp, top, side };
  });

  /* ---------- pawns: 3D Jako parrots ---------- */
  // Walking pace in world units per second (one regular tile ≈ 0.3 s).
  const WALK_SPEED = 3.4;
  const JM = {
    grey: new THREE.MeshStandardMaterial({ color: "#9aa1ab", roughness: 0.85 }),
    greyDark: new THREE.MeshStandardMaterial({
      color: "#6c737d",
      roughness: 0.8,
    }),
    belly: new THREE.MeshStandardMaterial({ color: "#b7bdc5", roughness: 0.9 }),
    face: new THREE.MeshStandardMaterial({ color: "#e4e7eb", roughness: 0.7 }),
    beak: new THREE.MeshStandardMaterial({ color: "#16181c", roughness: 0.3 }),
    eye: new THREE.MeshStandardMaterial({ color: "#f7f5ee", roughness: 0.2 }),
    pupil: new THREE.MeshStandardMaterial({ color: "#050505", roughness: 0.1 }),
    leg: new THREE.MeshStandardMaterial({ color: "#575c66", roughness: 0.7 }),
    tail: new THREE.MeshStandardMaterial({ color: "#d4352b", roughness: 0.55 }),
    gold: new THREE.MeshStandardMaterial({
      color: "#e2b13c",
      metalness: 1,
      roughness: 0.28,
    }),
  };
  const sph = (r: number, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
  const buildJako = (jacketMat: THREE.Material) => {
    const root = new THREE.Group();
    const add = (
      parent: THREE.Object3D,
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      sx = 1,
      sy = 1,
      sz = 1,
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    const legs = [-1, 1].map((side) => {
      const g = new THREE.Group();
      g.position.set(side * 0.075, 0.27, 0);
      add(g, new THREE.CylinderGeometry(0.024, 0.021, 0.24, 10), JM.leg, 0, -0.12, 0);
      add(g, sph(0.05, 12, 8), JM.leg, 0, -0.245, 0.035, 1, 0.4, 1.5);
      root.add(g);
      return g;
    });
    add(root, sph(0.2), JM.grey, 0, 0.47, 0, 1, 1.22, 0.92);
    add(root, sph(0.15), JM.belly, 0, 0.43, 0.07, 0.85, 1.25, 0.8);
    // Open-front leather jacket in the player's colour.
    add(
      root,
      new THREE.CylinderGeometry(0.207, 0.228, 0.3, 28, 1, true, 0.55, Math.PI * 2 - 1.1),
      jacketMat,
      0,
      0.44,
      -0.005,
      1,
      1,
      0.95,
    );
    const chain = add(root, new THREE.TorusGeometry(0.12, 0.016, 8, 28), JM.gold, 0, 0.6, 0.035);
    chain.rotation.x = Math.PI / 2 - 0.45;
    const wings = [-1, 1].map((side) => {
      const g = new THREE.Group();
      g.position.set(side * 0.2, 0.6, -0.01);
      add(g, sph(0.15, 16, 12), JM.greyDark, side * 0.02, -0.14, -0.01, 0.32, 1, 0.75);
      root.add(g);
      return g;
    });
    const tail = new THREE.Group();
    tail.position.set(0, 0.3, -0.16);
    [-0.4, 0, 0.4].forEach((a) => {
      const f = add(tail, sph(0.1, 12, 8), JM.tail, Math.sin(a) * 0.07, -0.02, -0.1, 0.35, 0.12, 1.15);
      f.rotation.set(0.55, a, 0);
    });
    root.add(tail);
    const head = new THREE.Group();
    head.position.set(0, 0.7, 0.01);
    root.add(head);
    add(head, sph(0.155), JM.grey, 0, 0.09, 0);
    add(head, sph(0.11), JM.face, 0, 0.1, 0.075, 1.15, 0.95, 0.7);
    [-1, 1].forEach((side) => {
      add(head, sph(0.036, 12, 10), JM.eye, side * 0.068, 0.135, 0.118);
      add(head, sph(0.021, 10, 8), JM.pupil, side * 0.07, 0.137, 0.146);
    });
    const beak = add(head, new THREE.ConeGeometry(0.055, 0.15, 14), JM.beak, 0, 0.055, 0.165);
    beak.rotation.x = Math.PI / 2 + 0.55;
    add(head, sph(0.04, 10, 8), JM.beak, 0, 0.02, 0.13, 1, 0.6, 1);
    return { root, legs, wings, tail, head };
  };
  const ringGeo = new THREE.RingGeometry(0.2, 0.28, 40);
  const shadowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, "rgba(0,0,0,0.55)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
  });
  const shadowGeo = new THREE.PlaneGeometry(0.95, 0.95);
  type Pawn = {
    grp: THREE.Group;
    fig: THREE.Group;
    rig: ReturnType<typeof buildJako>;
    mat: THREE.MeshPhysicalMaterial;
    ringMat: THREE.MeshBasicMaterial;
    target: THREE.Vector3;
    busy: boolean;
    moving: boolean;
    flying: boolean;
    gait: number;
    phase: number;
    lastX: number;
    lastZ: number;
    heading: number;
    pos: number;
    out: boolean;
    queue: number[];
    flight: number | null;
    waiters: (() => void)[];
  };
  const pawns: Pawn[] = [];
  const ensurePawn = (seat: number) => {
    if (pawns[seat]) return pawns[seat];
    const grp = new THREE.Group();
    const fig = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({
      color: "#e8b931",
      roughness: 0.42,
      clearcoat: 0.7,
      clearcoatRoughness: 0.25,
      side: THREE.DoubleSide,
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: "#e8b931",
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    const ground = new THREE.Mesh(ringGeo, ringMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.006;
    grp.add(shadow, ground);
    const rig = buildJako(mat);
    fig.add(rig.root);
    grp.add(fig);
    grp.scale.setScalar(0.92);
    scene.add(grp);
    pawns[seat] = {
      grp,
      fig,
      rig,
      mat,
      ringMat,
      target: new THREE.Vector3(),
      busy: false,
      moving: false,
      flying: false,
      gait: 0,
      phase: 0,
      lastX: 0,
      lastZ: 0,
      heading: 0,
      pos: -1,
      out: false,
      queue: [],
      flight: null,
      waiters: [],
    };
    return pawns[seat];
  };
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.035, 12, 48),
    new THREE.MeshBasicMaterial({
      color: "#e8b931",
      transparent: true,
      opacity: 0.9,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);
  let activeSeat = 0;

  const slot = (seat: number, pos: number) => {
    const info = tileInfo[pos];
    const same = pawns
      .map((p, k) => (p && !p.out && p.pos >= 0 && p.pos === pos ? k : -1))
      .filter((k) => k >= 0);
    const k = Math.max(0, same.indexOf(seat));
    const n = Math.max(1, same.length);
    const v = info.center.clone();
    const off = (k - (n - 1) / 2) * (n > 3 ? 0.3 : 0.4);
    if (info.axis && info.inward)
      v.addScaledVector(info.axis, off).addScaledVector(info.inward, -0.12);
    else {
      // Corner labels sit in the south half, so pawns stand behind them instead of covering them.
      v.x += off;
      v.z -= 0.42;
    }
    v.y = TOP;
    return v;
  };
  /** The walking lane through a tile the pawn only passes over. */
  const lane = (tile: number) => {
    const info = tileInfo[tile];
    const v = info.center.clone();
    if (info.inward) v.addScaledVector(info.inward, -0.12);
    else v.z -= 0.42;
    v.y = TOP;
    return v;
  };
  let walkSeat: number | null = null;
  // The whole path is known up front, so the Jako walks it as one continuous stroll at a
  // constant pace — legs, sway and heading are animated per frame in the render loop.
  const runPawn = async (seat: number) => {
    const p = pawns[seat];
    if (!p || p.busy) return;
    p.busy = true;
    walkSeat = seat;
    while (p.queue.length || p.flight !== null) {
      const a = p.grp.position.clone();
      if (p.flight !== null) {
        const b = slot(seat, p.flight);
        const height = p.flight === 10 ? 3.0 : 2.2;
        p.flight = null;
        p.flying = true;
        p.heading = Math.atan2(b.x - a.x, b.z - a.z);
        await tween(
          1000,
          (t) =>
            p.grp.position.set(
              a.x + (b.x - a.x) * t,
              TOP + Math.sin(Math.PI * t) * height,
              a.z + (b.z - a.z) * t,
            ),
          (t) => t * t * (3 - 2 * t),
        );
        p.flying = false;
        continue;
      }
      // Take every queued tile as one polyline so the stroll is a single smooth tween:
      // no per-tile stop, which on slow frames looked like hopping from square to square.
      const tiles = p.queue.splice(0);
      const pts = [a, ...tiles.map((tile, k) => (k < tiles.length - 1 ? lane(tile) : slot(seat, tile)))];
      const lens: number[] = [];
      let total = 0;
      for (let k = 1; k < pts.length; k++) {
        const l = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
        lens.push(l);
        total += l;
      }
      if (total < 0.01) continue;
      p.moving = true;
      const speed = tiles.length > 12 ? WALK_SPEED * 1.4 : WALK_SPEED;
      const dur = (total / speed) * 1000;
      // Trapezoid velocity: a short speed-up and slow-down instead of starting/stopping at full pace.
      const acc = Math.min(0.2, 220 / dur);
      const vmax = 1 / (1 - acc);
      const glide = (t: number) =>
        t < acc
          ? (vmax * t * t) / (2 * acc)
          : t > 1 - acc
            ? 1 - (vmax * (1 - t) * (1 - t)) / (2 * acc)
            : vmax * (t - acc / 2);
      await tween(dur, (t) => {
        let d = t * total;
        let k = 0;
        while (k < lens.length - 1 && d > lens[k]) d -= lens[k++];
        const u = lens[k] > 0 ? Math.min(1, d / lens[k]) : 1;
        const s0 = pts[k];
        const s1 = pts[k + 1];
        p.heading = Math.atan2(s1.x - s0.x, s1.z - s0.z);
        p.grp.position.set(s0.x + (s1.x - s0.x) * u, TOP, s0.z + (s1.z - s0.z) * u);
      }, glide);
    }
    p.moving = false;
    p.grp.position.y = TOP;
    // Let the legs settle back to standing before the turn continues.
    await tween(200, () => {});
    p.busy = false;
    if (walkSeat === seat) walkSeat = null;
    if (p.queue.length || p.flight !== null) return void runPawn(seat);
    p.waiters.splice(0).forEach((fn) => fn());
  };
  /** Moves a pawn along the board (or flies it, for jail and long card jumps) and resolves on arrival. */
  const movePawn = (seat: number, to: number, fly: boolean) => {
    const p = ensurePawn(seat);
    const from = p.queue.length ? p.queue[p.queue.length - 1] : p.pos;
    p.pos = to;
    if (from < 0 || from === to) {
      retarget();
      return Promise.resolve();
    }
    const fwd = (to - from + 40) % 40;
    const back = (from - to + 40) % 40;
    // Jakos always walk the board — never fly. Jail and short "go back" cards walk backwards,
    // everything else (including several turns batched into one update) walks forward.
    const backwards = back <= 3 || (to === 10 && back < fwd) || (fly && back < fwd);
    if (backwards) {
      for (let i = 1; i <= back; i++) p.queue.push((from - i + 40) % 40);
    } else {
      for (let i = 1; i <= fwd; i++) p.queue.push((from + i) % 40);
    }
    retarget();
    const done = new Promise<void>((res) => p.waiters.push(res));
    if (!p.busy) void runPawn(seat);
    return done;
  };
  const retarget = () =>
    pawns.forEach((p, k) => {
      if (!p) return;
      if (p.pos < 0 || p.pos > 39) {
        p.grp.visible = false;
        return;
      }
      if (!p.out) p.target.copy(slot(k, p.pos));
    });

  /* ---------- houses / ownership / mortgage ---------- */
  const houseMat = new THREE.MeshPhysicalMaterial({
    color: "#2fae62",
    roughness: 0.35,
    clearcoat: 0.7,
  });
  const roofMat = new THREE.MeshPhysicalMaterial({
    color: "#1f7d45",
    roughness: 0.4,
    clearcoat: 0.5,
  });
  const hotelMat = new THREE.MeshPhysicalMaterial({
    color: "#e0493d",
    roughness: 0.3,
    clearcoat: 0.8,
  });
  const hotelRoof = new THREE.MeshPhysicalMaterial({
    color: "#9f241b",
    roughness: 0.4,
    clearcoat: 0.5,
  });
  const winMat = new THREE.MeshStandardMaterial({
    color: "#ffe39a",
    emissive: "#ffcf5a",
    emissiveIntensity: 0.8,
  });
  const makeHouse = (hotel: boolean) => {
    const grp = new THREE.Group();
    if (!hotel) {
      const body = new THREE.Mesh(
        new RoundedBoxGeometry(0.2, 0.17, 0.2, 2, 0.02),
        houseMat,
      );
      body.position.y = 0.085;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.13, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 0.17 + 0.065;
      grp.add(body, roof);
    } else {
      // Flat-roofed two-storey block with a rooftop penthouse instead of a stretched pyramid roof.
      const bw = 0.54;
      const bh = 0.36;
      const bd = 0.26;
      const body = new THREE.Mesh(
        new RoundedBoxGeometry(bw, bh, bd, 2, 0.02),
        hotelMat,
      );
      body.position.y = bh / 2;
      const slab = new THREE.Mesh(
        new RoundedBoxGeometry(bw + 0.04, 0.035, bd + 0.04, 2, 0.01),
        hotelRoof,
      );
      slab.position.y = bh + 0.0175;
      const penthouse = new THREE.Mesh(
        new RoundedBoxGeometry(0.22, 0.09, 0.15, 2, 0.015),
        hotelMat,
      );
      penthouse.position.y = bh + 0.035 + 0.045;
      const capTop = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.02, 0.18),
        hotelRoof,
      );
      capTop.position.y = bh + 0.035 + 0.09 + 0.01;
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.02, 0.06),
        hotelRoof,
      );
      canopy.position.set(0, 0.1, bd / 2 + 0.03);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.01), winMat);
      door.position.set(0, 0.045, bd / 2 + 0.003);
      grp.add(body, slab, penthouse, capTop, canopy, door);
      for (const row of [0.2, 0.3]) {
        for (let k = -2; k <= 2; k++) {
          if (row === 0.2 && k === 0) continue;
          const w = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.055, 0.01), winMat);
          w.position.set(k * 0.1, row, bd / 2 + 0.003);
          grp.add(w);
        }
      }
    }
    grp.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
    });
    return grp;
  };
  const houseCount: number[] = Array(40).fill(-1);
  const renderHouses = (i: number, h: number, animate: boolean) => {
    const info = tileInfo[i];
    if (!info.houses || !info.axis || !info.bandCenter || houseCount[i] === h)
      return;
    const grew = houseCount[i] >= 0 && h > houseCount[i];
    houseCount[i] = h;
    info.houses.clear();
    const items =
      h === 5
        ? [makeHouse(true)]
        : Array.from({ length: h }, () => makeHouse(false));
    items.forEach((m, k) => {
      const off = h === 5 ? 0 : (k - (h - 1) / 2) * 0.22;
      m.position
        .copy(info.bandCenter!)
        .addScaledVector(info.axis!, off)
        .setY(TOP + 0.07);
      if (info.axis!.z) m.rotation.y = Math.PI / 2;
      info.houses!.add(m);
      if (animate && grew && k === items.length - 1) {
        m.scale.setScalar(0.01);
        tween(520, (t) => m.scale.setScalar(Math.max(0.01, t)), backOut);
        tween(
          520,
          (t) => (m.position.y = TOP + 0.07 + (1 - t) * 0.8),
          cubicOut,
        );
        floatText(info.bandCenter!, h === 5 ? "OTEL!" : "+1 EV", "#7ef0a8");
      }
    });
  };
  const ownerMeshes: (
    THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined
  )[] = [];
  const ownerOf: (number | null)[] = Array(40).fill(undefined);
  const tintMeshes: (
    THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | undefined
  )[] = [];
  const renderOwner = (
    i: number,
    o: number | null,
    color: string | null,
    animate: boolean,
  ) => {
    const info = tileInfo[i];
    if (!info.outer || !info.axis) return;
    if (!ownerMeshes[i]) {
      const len = SW - 0.14;
      const m = new THREE.Mesh(
        new RoundedBoxGeometry(
          info.axis.x ? len : 0.1,
          0.04,
          info.axis.x ? 0.1 : len,
          2,
          0.015,
        ),
        new THREE.MeshStandardMaterial({
          color: "#fff",
          emissive: "#000",
          roughness: 0.3,
          metalness: 0.2,
        }),
      );
      m.position.copy(info.outer).setY(TOP + 0.02);
      scene.add(m);
      ownerMeshes[i] = m;
    }
    if (!tintMeshes[i] && info.inward) {
      // Fills the whole tile; on streets it stops exactly at the group colour band so the two never blend.
      const hasBand = BOARD[i].type === "property";
      const depth = hasBand ? C - 0.31 : C - 0.02;
      const width = SW - 0.02;
      const t = new THREE.Mesh(
        new THREE.PlaneGeometry(
          info.axis.x ? width : depth,
          info.axis.x ? depth : width,
        ),
        new THREE.MeshBasicMaterial({
          color: "#fff",
          transparent: true,
          opacity: 0.34,
          depthWrite: false,
        }),
      );
      t.rotation.x = -Math.PI / 2;
      t.position
        .copy(info.center)
        .addScaledVector(info.inward, hasBand ? -0.15 : 0)
        .setY(TOP + 0.012);
      t.renderOrder = 2;
      scene.add(t);
      tintMeshes[i] = t;
    }
    const m = ownerMeshes[i]!;
    const tint = tintMeshes[i];
    const changed = ownerOf[i] !== undefined && ownerOf[i] !== o;
    ownerOf[i] = o;
    m.visible = o != null;
    if (tint) tint.visible = o != null;
    if (o != null && color) {
      tint?.material.color.set(color);
      m.material.color.set(color);
      m.material.emissive.set(color);
      m.material.emissiveIntensity = 0.35;
      if (animate && changed) floatText(info.center, "TAPU!", "#ffd35a");
    }
  };
  const mortMat = new THREE.MeshBasicMaterial({
    color: "#0b1020",
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const mortMeshes: (THREE.Mesh | undefined)[] = [];
  const renderMortgage = (i: number, on: boolean) => {
    const r = rect(i);
    if (on && !mortMeshes[i]) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(r.w - 0.04, r.d - 0.04),
        mortMat,
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(r.x, TOP + 0.08, r.z);
      scene.add(m);
      mortMeshes[i] = m;
    } else if (!on && mortMeshes[i]) {
      scene.remove(mortMeshes[i]!);
      mortMeshes[i] = undefined;
    }
  };

  /* ---------- dice ---------- */
  const pipTex = (v: number) => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d")!;
    x.fillStyle = "#f6f1e6";
    x.fillRect(0, 0, 256, 256);
    const P: Record<number, number[][]> = {
      1: [[1, 1]],
      2: [
        [0, 0],
        [2, 2],
      ],
      3: [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
      4: [
        [0, 0],
        [2, 0],
        [0, 2],
        [2, 2],
      ],
      5: [
        [0, 0],
        [2, 0],
        [1, 1],
        [0, 2],
        [2, 2],
      ],
      6: [
        [0, 0],
        [2, 0],
        [0, 1],
        [2, 1],
        [0, 2],
        [2, 2],
      ],
    };
    P[v].forEach(([a, b]) => {
      const cx = 56 + a * 72;
      const cy = 56 + b * 72;
      const gr = x.createRadialGradient(
        cx - 6,
        cy - 6,
        2,
        cx,
        cy,
        v === 1 ? 34 : 24,
      );
      gr.addColorStop(0, v === 1 ? "#ff6a5a" : "#3a4466");
      gr.addColorStop(1, v === 1 ? "#b3241a" : "#0b1020");
      x.fillStyle = gr;
      x.beginPath();
      x.arc(cx, cy, v === 1 ? 32 : 22, 0, Math.PI * 2);
      x.fill();
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const FACE_VAL = [3, 4, 1, 6, 2, 5];
  const FACE_N = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ].map(([a, b, c]) => new THREE.Vector3(a, b, c));
  const diceMats = FACE_VAL.map(
    (v) =>
      new THREE.MeshPhysicalMaterial({
        map: pipTex(v),
        roughness: 0.25,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      }),
  );
  const DS = 0.58;
  const dice = [0, 1].map(() => {
    const m = new THREE.Mesh(
      new RoundedBoxGeometry(DS, DS, DS, 4, 0.08),
      diceMats,
    );
    m.castShadow = true;
    m.visible = false;
    scene.add(m);
    return m;
  });

  /* ---------- coins ---------- */
  const coinGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.035, 28);
  const coinMat = new THREE.MeshStandardMaterial({
    color: "#f0c23a",
    metalness: 1,
    roughness: 0.22,
    emissive: "#5a3c00",
    emissiveIntensity: 0.25,
  });
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const coinBurst = (
    from: THREE.Vector3,
    to: THREE.Vector3 | null,
    n: number,
  ) => {
    for (let k = 0; k < n; k++) {
      const c = new THREE.Mesh(coinGeo, coinMat);
      c.castShadow = true;
      const a = from.clone().add(new THREE.Vector3(0, 0.6, 0));
      const b = to
        ? to.clone().add(new THREE.Vector3(0, 0.7, 0))
        : a
            .clone()
            .add(
              new THREE.Vector3(
                (Math.random() - 0.5) * 1.6,
                1.6 + Math.random() * 1.2,
                (Math.random() - 0.5) * 1.6,
              ),
            );
      const peak = Math.max(a.y, b.y) + 1.2 + Math.random() * 0.8;
      const jx = (Math.random() - 0.5) * 0.8;
      const jz = (Math.random() - 0.5) * 0.8;
      const spin = new THREE.Vector3(
        Math.random() * 8,
        Math.random() * 8,
        Math.random() * 8,
      );
      later(() => {
        scene.add(c);
        tween(to ? 800 : 900, (t) => {
          const x = a.x + (b.x - a.x) * t + jx * Math.sin(Math.PI * t);
          const z = a.z + (b.z - a.z) * t + jz * Math.sin(Math.PI * t);
          const y =
            (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * peak + t * t * b.y;
          c.position.set(x, y, z);
          c.rotation.set(spin.x * t, spin.y * t, spin.z * t);
          c.scale.setScalar(t > 0.8 ? Math.max(0.01, (1 - t) * 5) : 1);
        }).then(() => scene.remove(c));
      }, k * 55);
    }
  };

  /* ---------- tweens, camera, loop ---------- */
  const tweens: Tween[] = [];
  function tween(
    dur: number,
    fn: (t: number) => void,
    ease: (t: number) => number = (t) => t,
  ) {
    return new Promise<void>((res) =>
      tweens.push({ t0: performance.now(), dur, fn, ease, res }),
    );
  }
  const cam = {
    pos: new THREE.Vector3(0, 22, 18),
    look: new THREE.Vector3(0, 0, 0.6),
    dPos: new THREE.Vector3(0, 14, 12),
    dLook: new THREE.Vector3(0, 0, 0.6),
  };
  let follow = true;
  let override: { until: number } | null = null;
  let diceUntil = 0;
  // Where the dice always land: the free strip below the logo plate in the middle of the board.
  const DICE_SPOT = new THREE.Vector3(0, 0, 1.45);
  const ANCHOR = new THREE.Vector3(0, 0, 2.25);
  const overview = { pos: new THREE.Vector3(0, 20, 14), look: new THREE.Vector3() };
  const portrait = () => camera.aspect < 0.85;
  /**
   * Fits the whole board into the free area between the HUD and the bubble rails: the distance
   * is solved by bisection on the projected board corners, then a view offset centres it.
   */
  const fitOverview = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    const ins = portrait()
      ? { l: 4, r: 4, t: 106, b: 82 }
      : { l: w < 700 ? 60 : 68, r: w < 700 ? 60 : 68, t: 40, b: 22 };
    const dir = portrait()
      ? new THREE.Vector3(0, 1, 0.24).normalize()
      : new THREE.Vector3(0, 14, 6).normalize();
    const corners = [
      [-6.9, -6.9],
      [6.9, -6.9],
      [-6.9, 6.9],
      [6.9, 6.9],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z));
    const tmp = camera.clone();
    tmp.clearViewOffset();
    const bounds = (d: number) => {
      tmp.position.copy(dir).multiplyScalar(d);
      tmp.lookAt(0, 0, 0);
      tmp.updateMatrixWorld();
      const ps = corners.map((c) => c.clone().project(tmp));
      const xs = ps.map((p) => p.x);
      const ys = ps.map((p) => p.y);
      return {
        x0: Math.min(...xs),
        x1: Math.max(...xs),
        y0: Math.min(...ys),
        y1: Math.max(...ys),
      };
    };
    const availW = (w - ins.l - ins.r) / w;
    const availH = (h - ins.t - ins.b) / h;
    let lo = 4;
    let hi = 90;
    for (let k = 0; k < 28; k++) {
      const d = (lo + hi) / 2;
      const b = bounds(d);
      if ((b.x1 - b.x0) / 2 <= availW && (b.y1 - b.y0) / 2 <= availH) hi = d;
      else lo = d;
    }
    const b = bounds(hi);
    overview.pos.copy(dir).multiplyScalar(hi);
    overview.look.set(0, 0, 0);
    // Shift the picture so the board's projected box sits in the middle of the free area.
    const bx = (((b.x0 + b.x1) / 2 + 1) / 2) * w;
    const by = ((1 - (b.y0 + b.y1) / 2) / 2) * h;
    const cx = (ins.l + w - ins.r) / 2;
    const cy = (ins.t + h - ins.b) / 2;
    camera.setViewOffset(w, h, bx - cx, by - cy, w, h);
  };
  const camTarget = (now: number) => {
    if (override && now < override.until) return;
    // The camera never orbits: it always looks from the south so the upright print stays readable.
    if (follow && now < diceUntil) {
      cam.dLook.copy(DICE_SPOT);
      cam.dPos
        .copy(DICE_SPOT)
        .add(portrait() ? new THREE.Vector3(0, 10.5, 2.8) : new THREE.Vector3(0, 8.6, 6.2));
      return;
    }
    const mover = follow && walkSeat !== null ? pawns[walkSeat] : null;
    if (mover && !mover.out) {
      const c = mover.grp.position;
      if (portrait()) {
        cam.dLook.set(
          THREE.MathUtils.clamp(c.x, -3.1, 3.1),
          0,
          THREE.MathUtils.clamp(c.z, -4.4, 4.5),
        );
        cam.dPos.copy(cam.dLook).add(new THREE.Vector3(0, 10, 3.2));
        return;
      }
      cam.dLook.set(c.x * 0.35, 0, c.z * 0.4 + 0.3);
      cam.dPos.copy(cam.dLook).add(new THREE.Vector3(0, 11, 8.2));
      return;
    }
    cam.dPos.copy(overview.pos);
    cam.dLook.copy(overview.look);
  };

  const floats = new Set<{ update: () => void }>();
  const project = (v: THREE.Vector3) => {
    const p = v.clone().project(camera);
    return [
      ((p.x + 1) / 2) * host.clientWidth,
      ((1 - p.y) / 2) * host.clientHeight,
    ];
  };
  function floatText(world: THREE.Vector3, text: string, color: string) {
    const el = document.createElement("div");
    el.className =
      "absolute whitespace-nowrap font-display text-xl font-bold sm:text-2xl";
    el.style.textShadow = "0 2px 0 rgb(0 0 0/.7),0 0 14px rgb(0 0 0/.5)";
    el.textContent = text;
    el.style.color = color;
    fxEl.appendChild(el);
    const t0 = performance.now();
    const base = world.clone();
    const fl = {
      update() {
        const t = (performance.now() - t0) / 1500;
        if (t >= 1) {
          el.remove();
          floats.delete(fl);
          return;
        }
        const [x, y] = project(
          base.clone().add(new THREE.Vector3(0, 1.1 + t * 1.2, 0)),
        );
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.opacity = String(
          t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1,
        );
        el.style.transform = `translate(-50%,-100%) scale(${t < 0.15 ? 0.6 + (t / 0.15) * 0.4 : 1})`;
      },
    };
    floats.add(fl);
  }

  let raf = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (let k = tweens.length - 1; k >= 0; k--) {
      const tw = tweens[k];
      const t = Math.min(1, (now - tw.t0) / tw.dur);
      tw.fn(tw.ease(t));
      if (t >= 1) {
        tweens.splice(k, 1);
        tw.res();
      }
    }
    if (override && now > override.until) override = null;
    camTarget(now);
    const f = 1 - Math.exp(-dt * 3.2);
    cam.pos.lerp(cam.dPos, f);
    cam.look.lerp(cam.dLook, f);
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    const pf = 1 - Math.exp(-dt * 10);
    const yawF = 1 - Math.exp(-dt * 9);
    pawns.forEach((p, seat) => {
      if (!p) return;
      if (!p.busy && !p.out) p.grp.position.lerp(p.target, pf);
      const gp = p.grp.position;
      const r = p.rig;
      // Walking: face the path; standing: turn towards the viewer.
      const want =
        p.moving || p.flying
          ? p.heading
          : Math.atan2(camera.position.x - gp.x, camera.position.z - gp.z);
      let dy = want - p.fig.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      p.fig.rotation.y += dy * yawF;
      p.gait += ((p.moving ? 1 : 0) - p.gait) * Math.min(1, dt * 8);
      // Steps follow the distance actually covered, so the feet never skate or race ahead.
      const stepped = Math.hypot(gp.x - p.lastX, gp.z - p.lastZ);
      p.lastX = gp.x;
      p.lastZ = gp.z;
      if (p.moving && stepped < 1) p.phase += stepped * 9;
      else if (!p.moving) p.phase += (Math.round(p.phase / Math.PI) * Math.PI - p.phase) * Math.min(1, dt * 8);
      const g = p.gait;
      const s = Math.sin(p.phase);
      r.legs[0].rotation.x = s * 0.55 * g;
      r.legs[1].rotation.x = -s * 0.55 * g;
      r.root.rotation.z = s * 0.05 * g;
      r.root.position.y = s * s * 0.018 * g;
      const breathe = Math.sin(now / 650 + seat);
      r.root.scale.set(1, 1 + breathe * 0.015, 1);
      r.head.rotation.x = Math.sin(p.phase * 2) * 0.12 * g + breathe * 0.04;
      r.head.rotation.y = g < 0.1 ? Math.sin(now / 1700 + seat * 2) * 0.25 : 0;
      const flap = p.flying ? 0.7 + Math.sin(now / 45) * 0.6 : 0.1 * g + breathe * 0.03;
      r.wings[0].rotation.z = -flap;
      r.wings[1].rotation.z = flap;
      r.tail.rotation.y = Math.sin(now / 520 + seat) * 0.12 + s * 0.22 * g;
    });
    const ap = pawns[activeSeat];
    if (ap && !ap.out) {
      const pg = ap.grp.position;
      ring.visible = true;
      ring.position.set(pg.x, TOP + 0.012, pg.z);
      const sc = 1 + Math.sin(now / 260) * 0.08;
      ring.scale.set(sc, sc, sc);
      ring.material.opacity = 0.55 + Math.sin(now / 260) * 0.3;
    } else ring.visible = false;
    floats.forEach((fl) => fl.update());
    if (anchorEl) {
      // The action dock (ZAR AT etc.) rides just below the dice spot on screen.
      const [ax, ay] = project(ANCHOR);
      const w = host.clientWidth;
      const h = host.clientHeight;
      anchorEl.style.left = `${THREE.MathUtils.clamp(ax, 110, Math.max(110, w - 110))}px`;
      anchorEl.style.top = `${THREE.MathUtils.clamp(ay, 60, Math.max(60, h - 70))}px`;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.85 ? 50 : 38;
    camera.updateProjectionMatrix();
    fitOverview();
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  disposers.push(() => ro.disconnect());

  /* ---------- picking ---------- */
  let onSelect: (i: number) => void = () => {};
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt: [number, number] | null = null;
  const onDown = (e: PointerEvent) => (downAt = [e.clientX, e.clientY]);
  const onUp = (e: PointerEvent) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6)
      return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(boardTop)[0];
    if (!hit) return;
    const i = tileAt(hit.point.x, hit.point.z);
    if (i >= 0) onSelect(i);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  resize();
  cam.pos.copy(overview.pos);
  cam.look.copy(overview.look);
  raf = requestAnimationFrame(frame);

  /* ---------- public API ---------- */
  return {
    setOnSelect(fn: (i: number) => void) {
      onSelect = fn;
    },
    setFollow(on: boolean) {
      follow = on;
    },
    setColors(colors: string[]) {
      colors.forEach((c, k) => {
        const p = ensurePawn(k);
        p.mat.color.set(c);
        p.ringMat.color.set(c);
      });
    },
    move: movePawn,
    /** Places pawns; any position the move sequencer did not animate is walked (or flown) here. */
    setPlayers(pos: number[], out: boolean[], active: number) {
      activeSeat = active;
      const first = !pawns.some((p) => p && p.pos >= 0);
      pos.forEach((to, seat) => {
        const p = ensurePawn(seat);
        p.out = out[seat];
        p.grp.visible = !p.out;
        if (p.pos < 0) {
          p.pos = to;
          return;
        }
        if (p.pos !== to) void movePawn(seat, to, false);
      });
      retarget();
      if (first) pawns.forEach((p) => p && p.grp.position.copy(p.target));
    },
    setBoard(state: MonopolyState, colors: string[], animate: boolean) {
      for (let i = 0; i < 40; i++) {
        const o = state.owner[i];
        renderOwner(i, o, o != null ? (colors[o] ?? null) : null, animate);
        renderHouses(i, state.houses[i] ?? 0, animate);
        renderMortgage(i, !!state.mortgaged[i]);
      }
    },
    /** Throws both dice into the middle of the board; resolves once they have settled. */
    roll(a: number, b: number) {
      diceUntil = performance.now() + 1650;
      const up = new THREE.Vector3(0, 1, 0);
      const done = [a, b].map((v, k) => {
        const d = dice[k];
        d.visible = true;
        d.scale.set(1, 1, 1);
        const end = DICE_SPOT.clone()
          .add(new THREE.Vector3(k ? 0.46 : -0.46, 0, (k ? -0.12 : 0.1) + (Math.random() - 0.5) * 0.15))
          .setY(TOP + DS / 2);
        // Thrown from the viewer's side towards the centre, every time.
        const start = end
          .clone()
          .add(new THREE.Vector3((k ? 1 : -1) * 0.7, 0, 4.6))
          .setY(3);
        const qEnd = new THREE.Quaternion().setFromUnitVectors(
          FACE_N[FACE_VAL.indexOf(v)],
          up,
        );
        qEnd.premultiply(
          new THREE.Quaternion().setFromAxisAngle(
            up,
            Math.random() * Math.PI * 2,
          ),
        );
        const axis = new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5,
        ).normalize();
        const spins = Math.PI * 2 * (3 + Math.random() * 2);
        return tween(1150 + k * 90, (t) => {
          const e = cubicOut(t);
          d.position.lerpVectors(start, end, e);
          const bounce =
            Math.abs(Math.sin(Math.PI * 2.6 * t)) * (1 - t) ** 2 * 2.4;
          d.position.y = TOP + DS / 2 + bounce + (1 - t) ** 3 * 2.2;
          d.quaternion.copy(
            qEnd
              .clone()
              .multiply(
                new THREE.Quaternion().setFromAxisAngle(axis, spins * (1 - e)),
              ),
          );
        }).then(() =>
          tween(160, (t) =>
            d.scale.set(
              1 + 0.08 * Math.sin(Math.PI * t),
              1 - 0.1 * Math.sin(Math.PI * t),
              1 + 0.08 * Math.sin(Math.PI * t),
            ),
          ),
        );
      });
      return Promise.all(done).then(() => undefined);
    },
    drawCard(deck: "chance" | "chest") {
      const dk = decks[deck];
      if (!dk) return;
      const card = new THREE.Mesh(cardGeo, [
        dk.side,
        dk.side,
        dk.top,
        dk.side,
        dk.side,
        dk.side,
      ]);
      card.castShadow = true;
      const from = dk.grp.position.clone().setY(TOP + 0.26);
      card.position.copy(from);
      card.rotation.y = dk.grp.rotation.y;
      scene.add(card);
      if (follow) {
        override = { until: performance.now() + 2200 };
        cam.dLook.copy(from);
        cam.dPos.copy(from).add(new THREE.Vector3(0, 5.5, 4.5));
      }
      tween(
        700,
        (t) => {
          card.position.set(
            from.x,
            from.y + Math.sin(Math.PI * t * 0.5) * 1.8,
            from.z,
          );
          card.rotation.z = t * Math.PI;
        },
        cubicOut,
      ).then(() =>
        later(
          () =>
            tween(300, (t) => card.scale.setScalar(Math.max(0.01, 1 - t))).then(
              () => scene.remove(card),
            ),
          1300,
        ),
      );
    },
    money(values: number[]) {
      const payers = values
        .map((v, k) => (v < 0 ? k : -1))
        .filter((k) => k >= 0);
      const gainers = values
        .map((v, k) => (v > 0 ? k : -1))
        .filter((k) => k >= 0);
      const at = (k: number) =>
        pawns[k] && !pawns[k].out ? pawns[k].grp.position.clone() : null;
      values.forEach((v, k) => {
        const p = at(k);
        if (!v || !p) return;
        floatText(
          p,
          `${v > 0 ? "+" : "-"}${fmt(Math.abs(v))}`,
          v > 0 ? "#7ef0a8" : "#ff8a7a",
        );
      });
      const n = (v: number) => Math.min(12, 4 + Math.round(Math.abs(v) / 50));
      if (payers.length === 1 && gainers.length >= 1) {
        const from = at(payers[0]);
        gainers.forEach((k) => {
          const to = at(k);
          if (from && to) coinBurst(from, to, n(values[k]));
        });
      } else {
        gainers.forEach((k) => {
          const p = at(k);
          if (p) coinBurst(p, null, n(values[k]));
        });
        payers.forEach((k) => {
          const p = at(k);
          if (p) coinBurst(p, null, Math.min(6, n(values[k])));
        });
      }
    },
    dispose() {
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      disposers.forEach((d) => d());
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material)
          ? m.material
          : m.material
            ? [m.material]
            : [];
        mats.forEach((mat) => {
          const tex = (mat as THREE.MeshStandardMaterial).map;
          tex?.dispose();
          mat.dispose();
        });
      });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      fxEl.replaceChildren();
    },
  };
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function gridCell(i: number) {
  if (i <= 10) return { row: 11, col: 11 - i };
  if (i <= 20) return { row: 11 - (i - 10), col: 1 };
  if (i <= 30) return { row: 1, col: 1 + (i - 20) };
  return { row: 1 + (i - 30), col: 11 };
}

function FlatBoard({
  s,
  shownPos,
  tokenColors,
  onSelect,
}: Pick<Props, "s" | "tokenColors" | "onSelect"> & { shownPos: number[] }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-2">
      <div
        className="grid aspect-square w-full max-w-[min(100%,calc(100dvh-8rem))] gap-px rounded-lg border border-border bg-border"
        style={{
          gridTemplateColumns: "repeat(11, minmax(0, 1fr))",
          gridTemplateRows: "repeat(11, minmax(0, 1fr))",
        }}
      >
        {BOARD.map((sq, i) => {
          const { row, col } = gridCell(i);
          const owner = s.owner[i];
          const here = shownPos
            .map((p, pi) => (p === i && !s.players[pi]?.out ? pi : -1))
            .filter((pi) => pi >= 0);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              style={{ gridRow: row, gridColumn: col }}
              className={`relative flex min-w-0 flex-col overflow-hidden bg-card text-left text-foreground ${s.mortgaged[i] ? "opacity-50" : ""}`}
              aria-label={sq.name}
            >
              {sq.type === "property" && (
                <span
                  className="h-1.5 w-full shrink-0"
                  style={{ background: GC[sq.group] }}
                />
              )}
              <span className="line-clamp-2 px-0.5 pt-0.5 text-[clamp(6px,1.1vw,11px)] font-medium leading-tight">
                {sq.name}
              </span>
              <span className="mt-auto flex flex-wrap items-center gap-0.5 px-0.5 pb-0.5">
                {owner != null && owner >= 0 && (
                  <span
                    className="size-2 shrink-0 rounded-sm ring-1 ring-foreground/30"
                    style={{ background: tokenColors[owner] }}
                  />
                )}
                {s.houses[i] > 0 && (
                  <span className="text-[9px] font-bold text-muted-foreground">
                    {s.houses[i] >= 5 ? "O" : `${s.houses[i]}E`}
                  </span>
                )}
                {here.map((pi) => (
                  <span
                    key={pi}
                    className="size-2.5 shrink-0 rounded-full ring-1 ring-background"
                    style={{ background: tokenColors[pi] }}
                  />
                ))}
              </span>
            </button>
          );
        })}
        <div
          className="flex flex-col items-center justify-center gap-1 bg-background p-4 text-center"
          style={{ gridRow: "2 / 11", gridColumn: "2 / 11" }}
        >
          <p className="font-display text-xl font-bold text-foreground">
            JAKOPOLY
          </p>
          <p className="max-w-56 text-pretty text-xs leading-relaxed text-muted-foreground">
            3D tahta bu cihazda açılamadı, basit tahta gösteriliyor. Oyun aynen
            devam ediyor.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MonopolyBoard3D({
  s,
  tokenColors,
  follow,
  moneyDelta,
  onSelect,
  onPlayback,
  dock,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const colorsRef = useRef<string[]>([]);
  const readyRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const failedRef = useRef(false);

  const realPos = s.players.map((p) => p.pos);
  const [shown, setShown] = useState<number[]>(realPos);
  const [walker, setWalker] = useState<number | null>(null);
  const shownRef = useRef<number[]>(realPos);
  const queuedRef = useRef<number[]>(realPos);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef(0);
  const turnRef = useRef(s.turn);
  const rollRef = useRef<string | null>(
    s.dice ? `${s.seq}-${s.turn}-${s.dice.join("")}` : null,
  );
  const lastRollRef = useRef(s.lastRoll ?? null);
  lastRollRef.current = s.lastRoll ?? null;
  const reportRef = useRef(onPlayback);
  reportRef.current = onPlayback;

  useEffect(() => {
    const host = hostRef.current;
    const fx = fxRef.current;
    if (!host || !fx) return;
    if (!webglAvailable()) {
      failedRef.current = true;
      setFailed(true);
      return;
    }
    const cs = getComputedStyle(host);
    const display =
      cs.getPropertyValue("--font-display").trim() ||
      cs.fontFamily ||
      "sans-serif";
    const body = cs.fontFamily || "sans-serif";
    let engine: Engine;
    try {
      engine = createEngine(host, fx, { display, body }, anchorRef.current);
    } catch (err) {
      console.error("Jakopoly 3D başlatılamadı", err);
      host.querySelectorAll("canvas").forEach((c) => c.remove());
      failedRef.current = true;
      setFailed(true);
      return;
    }
    engineRef.current = engine;
    const canvas = host.querySelector("canvas");
    const onLost = () => {
      failedRef.current = true;
      setFailed(true);
    };
    canvas?.addEventListener("webglcontextlost", onLost);
    return () => {
      canvas?.removeEventListener("webglcontextlost", onLost);
      engine.dispose();
      engineRef.current = null;
      readyRef.current = false;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setOnSelect(onSelect);
  }, [onSelect]);

  useEffect(() => {
    engineRef.current?.setFollow(follow);
  }, [follow]);

  const colorKey = tokenColors.join("|");
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    colorsRef.current = colorKey.split("|").map(cssToRgb);
    engine.setColors(colorsRef.current);
  }, [colorKey]);

  const outKey = s.players.map((p) => (p.out ? 1 : 0)).join("");
  const shownKey = shown.join(",");
  const activeSeat = walker ?? s.turn;
  useEffect(() => {
    engineRef.current?.setPlayers(
      shownKey.split(",").map(Number),
      outKey.split("").map((c) => c === "1"),
      activeSeat,
    );
  }, [shownKey, outKey, activeSeat]);

  const boardKey = `${s.owner.join(",")}|${s.houses.join(",")}|${s.mortgaged.map(Number).join("")}`;
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setBoard(s, colorsRef.current, readyRef.current);
    readyRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardKey, colorKey]);

  // One server update can carry several bot turns, so the diff between what is
  // already queued and the new positions is replayed seat by seat in turn order.
  const posKey = realPos.join(",");
  const rollKey = s.dice ? `${s.seq}-${s.turn}-${s.dice.join("")}` : null;
  useEffect(() => {
    const goal = posKey.split(",").map(Number);
    const n = goal.length;
    if (queuedRef.current.length !== n) {
      queuedRef.current = goal;
      shownRef.current = goal;
      setShown(goal);
      turnRef.current = s.turn;
      return;
    }
    const start = turnRef.current;
    turnRef.current = s.turn;
    const order = Array.from({ length: n }, (_, k) => (start + k) % n);
    const movers = order.filter((i) => queuedRef.current[i] !== goal[i]);
    const freshRoll = rollKey !== null && rollKey !== rollRef.current;
    if (rollKey) rollRef.current = rollKey;
    if (!movers.length && !(freshRoll && s.dice)) return;

    const jobs: (() => Promise<void>)[] = [];
    const report = (walking: boolean, who: number | null) => {
      const snap = [...shownRef.current];
      setShown(snap);
      setWalker(who);
      reportRef.current({ walking, walker: who, shown: snap });
    };

    if (!movers.length && s.dice) {
      const [a, b] = s.dice;
      const seat = s.turn;
      jobs.push(async () => {
        report(true, seat);
        await engineRef.current?.roll(a, b);
        await wait(500);
      });
    }

    for (const seat of movers) {
      const from = queuedRef.current[seat];
      const to = goal[seat];
      queuedRef.current = queuedRef.current.map((p, i) => (i === seat ? to : p));
      const steps = (to - from + 40) % 40;
      jobs.push(async () => {
        report(true, seat);
        // A hidden tab gets no animation frames, so replaying there would only pile up a backlog.
        const engine =
          failedRef.current || document.hidden ? null : engineRef.current;
        if (engine && steps >= 2 && steps <= 12) {
          const last = lastRollRef.current;
          const dice =
            last && last.seat === seat && last.dice[0] + last.dice[1] === steps
              ? last.dice
              : diceFor(steps);
          await engine.roll(dice[0], dice[1]);
          await wait(180);
        }
        if (engine) await engine.move(seat, to, steps > 12);
        shownRef.current = shownRef.current.map((p, i) => (i === seat ? to : p));
        report(true, seat);
        await wait(engine ? 420 : 0);
      });
    }

    pendingRef.current += 1;
    chainRef.current = chainRef.current.then(async () => {
      for (const job of jobs) await job();
      pendingRef.current -= 1;
      if (pendingRef.current === 0) report(false, null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posKey, rollKey]);

  const cardKey = s.card ? `${s.card.deck}-${s.card.text}-${s.seq}` : null;
  const lastCard = useRef<string | null>(null);
  useEffect(() => {
    if (!cardKey || cardKey === lastCard.current || !s.card) return;
    lastCard.current = cardKey;
    const deck = s.card.deck;
    if (deck === "chance" || deck === "chest")
      chainRef.current = chainRef.current.then(() => {
        engineRef.current?.drawCard(deck);
        return wait(400);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);

  const deltaId = moneyDelta?.id;
  useEffect(() => {
    if (moneyDelta) engineRef.current?.money(moneyDelta.values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deltaId]);

  if (failed)
    return (
      <>
        <FlatBoard
          s={s}
          shownPos={shown}
          tokenColors={tokenColors}
          onSelect={onSelect}
        />
        {dock && (
          <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
            {dock}
          </div>
        )}
      </>
    );

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 overflow-hidden"
      role="img"
      aria-label="3D Jakopoly tahtası. Ayrıntı için bir kareye dokun."
    >
      <div
        ref={fxRef}
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
        aria-hidden="true"
      />
      <div
        ref={anchorRef}
        className="absolute left-1/2 top-[62%] z-20 flex w-max max-w-[calc(100%-1rem)] -translate-x-1/2 justify-center"
      >
        {dock}
      </div>
    </div>
  );
}
