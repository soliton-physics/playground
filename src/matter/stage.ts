import type { Insets } from '../modern/stage';
import { cssVar, formatNumber, stageFont, stageScale } from '../ui';

type Point = [number, number];

export type MatterPicture =
  | { kind: 'wire'; strain: number; broken: boolean; load: number }
  | { kind: 'shear'; angle: number }
  | { kind: 'squeeze'; share: number }
  | { kind: 'tank'; depth: number; deepest: number }
  | { kind: 'lift'; small: number; large: number; push: number; rise: number }
  | { kind: 'float'; side: number; height: number; depth: number }
  | { kind: 'venturi'; tracers: Point[]; throat: number; gauges: Point }
  | { kind: 'drain'; level: number; full: number; height: number; range: number }
  | { kind: 'column'; fallen: number; tall: number }
  | { kind: 'capillary'; tubes: Point[]; angle: number }
  | { kind: 'rod'; share: number }
  | { kind: 'mixing'; block: number; water: number; hottest: number }
  | { kind: 'beaker'; ice: number; water: number; steam: number; temperature: number }
  | { kind: 'bar'; temperatures: number[]; hot: number; cold: number }
  | { kind: 'cup'; temperature: number; room: number; start: number }
  | { kind: 'chart' };

/** How much the tiny changes of a solid are magnified to be seen, said beside each picture. */
const STRETCH = 60;
const LEAN = 500;
const SHRINK = 10;
const GROWTH = 200;

/** Draws whatever a properties-of-matter lesson has on its stage. `plain` is for a thumbnail. */
export function drawMatter(canvas: HTMLCanvasElement, picture: MatterPicture, insets: Insets, plain = false): void {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) {
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const k = plain ? 0.6 : stageScale();
  ctx.fillStyle = cssVar('--canvas-bg');
  ctx.fillRect(0, 0, rect.width, rect.height);
  if (picture.kind === 'chart') return;

  const margin = plain ? 6 : 36 * k;
  const [roomW, roomH] = [rect.width - insets.left - insets.right - 2 * margin, rect.height - insets.top - insets.bottom - 2 * margin];
  const side = Math.max(40, Math.min(roomW, roomH));
  const x0 = insets.left + margin + (roomW - side) / 2;
  const y0 = insets.top + margin + (roomH - side) / 2;
  const cx = x0 + side / 2;
  const [ink, muted, edge, solid] = [cssVar('--canvas-text'), cssVar('--muted'), cssVar('--canvas-static-edge'), cssVar('--surface-2')];
  const [liquid, accent, hot, cold] = [cssVar('--accent-soft'), cssVar('--accent'), cssVar('--bath-hot'), cssVar('--bath-cold')];
  /** A colour for a temperature, from the cold one at `share` 0 to the hot one at 1. */
  const warmth = (share: number) => `color-mix(in srgb, ${hot} ${Math.round(100 * Math.min(1, Math.max(0, share)))}%, ${cold})`;
  const words = (text: string, x: number, y: number, align: CanvasTextAlign = 'center', color = ink) => {
    if (plain) return;
    ctx.font = stageFont(12.5, 600);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  };
  const stroke = (color: string, width: number, dash: number[] = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * k;
    ctx.setLineDash(dash.map((d) => d * k));
  };
  const line = (...points: Point[]) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const box = (x: number, y: number, w: number, h: number, fill: string, outline = edge) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    stroke(outline, 2);
    ctx.strokeRect(x, y, w, h);
  };
  /** An arrow from one point to another, with a name by its tail. */
  const arrow = (from: Point, to: Point, color: string, label = '') => {
    const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
    const length = Math.hypot(dx, dy);
    if (length < 2) return;
    const [ux, uy] = [dx / length, dy / length];
    const head = Math.min(10 * k, 0.5 * length);
    stroke(color, 3);
    line(from, [to[0] - ux * head, to[1] - uy * head]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(to[0], to[1]);
    ctx.lineTo(to[0] - ux * head - uy * head * 0.55, to[1] - uy * head + ux * head * 0.55);
    ctx.lineTo(to[0] - ux * head + uy * head * 0.55, to[1] - uy * head - ux * head * 0.55);
    ctx.fill();
    if (label) words(label, from[0] - ux * 14 * k, from[1] - uy * 14 * k, 'center', color);
  };
  const disc = (x: number, y: number, r: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
  };
  /** An open vessel: two sides and a bottom. */
  const vessel = (x: number, y: number, w: number, h: number) => {
    stroke(edge, 3);
    line([x, y], [x, y + h], [x + w, y + h], [x + w, y]);
  };

  if (picture.kind === 'wire') {
    const [top, length] = [y0 + 0.08 * side, 0.5 * side];
    const grown = length * Math.min(0.32, picture.strain * STRETCH);
    box(cx - 0.3 * side, top - 12 * k, 0.6 * side, 12 * k, solid);
    const weight = (18 + 5 * Math.cbrt(picture.load)) * k;
    stroke(muted, 1.5, [5, 5]);
    line([cx - 0.24 * side, top + length], [cx + 0.24 * side, top + length]);
    words('unloaded length', cx + 0.25 * side, top + length, 'left', muted);
    stroke(ink, 2.5);
    if (picture.broken) {
      line([cx, top], [cx, top + 0.45 * length]);
      const floor = y0 + side - weight;
      line([cx, floor - 0.3 * length], [cx, floor]);
      box(cx - weight / 2, floor, weight, weight, accent, ink);
      words('broken', cx + 14 * k, top + 0.5 * length, 'left');
    } else {
      line([cx, top], [cx, top + length + grown]);
      if (picture.load > 0) box(cx - weight / 2, top + length + grown, weight, weight, accent, ink);
      words(`stretch shown × ${STRETCH}`, cx, y0 + side - 6 * k, 'center', muted);
    }
  } else if (picture.kind === 'shear') {
    const [w, h] = [0.5 * side, 0.36 * side];
    const [left, base] = [cx - w / 2, y0 + 0.7 * side];
    const lean = h * Math.min(0.6, picture.angle * LEAN);
    stroke(muted, 1.5, [5, 5]);
    ctx.strokeRect(left, base - h, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = solid;
    ctx.beginPath();
    ctx.moveTo(left, base);
    ctx.lineTo(left + w, base);
    ctx.lineTo(left + w + lean, base - h);
    ctx.lineTo(left + lean, base - h);
    ctx.closePath();
    ctx.fill();
    stroke(edge, 2);
    ctx.stroke();
    stroke(ink, 4);
    line([left - 0.08 * side, base + 2 * k], [left + w + 0.08 * side, base + 2 * k]);
    arrow([left + lean, base - h - 16 * k], [left + lean + 0.3 * w, base - h - 16 * k], accent, 'F');
    words(`lean shown × ${LEAN}`, cx, y0 + side - 6 * k, 'center', muted);
  } else if (picture.kind === 'squeeze') {
    const a = 0.42 * side;
    const now = a * Math.cbrt(1 - Math.min(0.6, picture.share * SHRINK));
    const cy = y0 + 0.5 * side;
    box(x0, y0, side, side, liquid, 'transparent');
    stroke(muted, 1.5, [5, 5]);
    ctx.strokeRect(cx - a / 2, cy - a / 2, a, a);
    ctx.setLineDash([]);
    box(cx - now / 2, cy - now / 2, now, now, solid);
    const reach = 0.4 * side;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Point[]) arrow([cx + dx * reach, cy + dy * reach], [cx + dx * (a / 2 + 6 * k), cy + dy * (a / 2 + 6 * k)], accent);
    words(`shrinking shown × ${SHRINK}`, cx, y0 + side - 10 * k, 'center', muted);
  } else if (picture.kind === 'tank') {
    const [left, w, top, h] = [x0 + 0.18 * side, 0.64 * side, y0 + 0.1 * side, 0.82 * side];
    ctx.fillStyle = liquid;
    ctx.fillRect(left, top, w, h);
    vessel(left, top - 0.06 * side, w, h + 0.06 * side);
    const y = top + (h * picture.depth) / picture.deepest;
    stroke(ink, 1.5, [5, 5]);
    line([left, y], [left + w, y]);
    disc(cx, y, 6 * k, accent);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Point[]) arrow([cx + dx * 34 * k, y + dy * 34 * k], [cx + dx * 9 * k, y + dy * 9 * k], accent);
    words('surface', left - 8 * k, top, 'right', muted);
    words(`${formatNumber(picture.depth)} m down`, left - 8 * k, y, 'right');
  } else if (picture.kind === 'lift') {
    const base = y0 + 0.62 * side;
    const wide = 0.4 * side;
    const narrow = Math.max(12 * k, (wide * picture.small) / picture.large);
    const [leftX, rightX] = [x0 + 0.2 * side - narrow / 2, x0 + 0.72 * side - wide / 2];
    const scale = (0.26 * side) / 0.2;
    const [down, up] = [picture.push * scale, picture.rise * scale];
    ctx.fillStyle = liquid;
    ctx.fillRect(leftX, base + down - 0.12 * side, narrow, 0.34 * side - down + 0.12 * side);
    ctx.fillRect(rightX, base - up, wide, 0.22 * side + up);
    ctx.fillRect(leftX, base + 0.14 * side, rightX + wide - leftX, 0.08 * side);
    stroke(edge, 3);
    line([leftX, y0 + 0.2 * side], [leftX, base + 0.22 * side], [rightX + wide, base + 0.22 * side], [rightX + wide, y0 + 0.36 * side]);
    line([leftX + narrow, y0 + 0.2 * side], [leftX + narrow, base + 0.14 * side], [rightX, base + 0.14 * side], [rightX, y0 + 0.36 * side]);
    box(leftX + 2, base + down - 0.12 * side - 10 * k, narrow - 4, 10 * k, solid, ink);
    box(rightX + 2, base - up - 10 * k, wide - 4, 10 * k, solid, ink);
    arrow([leftX + narrow / 2, base + down - 0.12 * side - 54 * k], [leftX + narrow / 2, base + down - 0.12 * side - 14 * k], accent, 'F₁');
    arrow([rightX + wide / 2, base - up - 14 * k], [rightX + wide / 2, base - up - 74 * k], cssVar('--molecule-2'));
    words('F₂', rightX + wide / 2 + 16 * k, base - up - 44 * k, 'left', cssVar('--molecule-2'));
  } else if (picture.kind === 'float') {
    const air = 0.4;
    const scale = (0.86 * side) / (picture.depth + air);
    const surface = y0 + 0.06 * side + air * scale;
    const [left, w] = [x0 + 0.14 * side, 0.72 * side];
    ctx.fillStyle = liquid;
    ctx.fillRect(left, surface, w, picture.depth * scale);
    vessel(left, surface - 0.5 * air * scale, w, (picture.depth + 0.5 * air) * scale);
    const s = picture.side * scale;
    box(cx - s / 2, surface - picture.height * scale - s / 2, s, s, cssVar('--molecule-2'), ink);
    stroke(accent, 2);
    line([left, surface], [cx - s / 2, surface]);
    line([cx + s / 2, surface], [left + w, surface]);
  } else if (picture.kind === 'venturi') {
    const [left, w, cy, bore] = [x0, side, y0 + 0.62 * side, 0.13 * side];
    const narrow = picture.throat * picture.throat;
    // The same shape the engine's pipe has: wide, a taper, the throat, a taper, wide.
    const area = (x: number) => {
      const blend = (t: number) => 1 + (narrow - 1) * Math.min(1, Math.max(0, t));
      return x < 0.42 ? blend((x - 0.32) / 0.1) : x > 0.58 ? blend((0.68 - x) / 0.1) : narrow;
    };
    const half = (x: number) => bore * Math.sqrt(area(x));
    const xs = Array.from({ length: 101 }, (_, i) => i / 100);
    ctx.fillStyle = liquid;
    ctx.beginPath();
    xs.forEach((x, i) => (i === 0 ? ctx.moveTo(left, cy - half(x)) : ctx.lineTo(left + x * w, cy - half(x))));
    [...xs].reverse().forEach((x) => ctx.lineTo(left + x * w, cy + half(x)));
    ctx.fill();
    stroke(edge, 3);
    line(...xs.map((x): Point => [left + x * w, cy - half(x)]));
    stroke(edge, 3);
    line(...xs.map((x): Point => [left + x * w, cy + half(x)]));
    for (const [along, across] of picture.tracers) disc(left + along * w, cy + across * bore * 0.9, 3 * k, accent);
    const tallest = Math.max(...picture.gauges, 1e-9);
    [0.18, 0.5].forEach((x, i) => {
      const [gx, foot] = [left + x * w, cy - half(x)];
      const height = (0.34 * side * picture.gauges[i]!) / tallest;
      ctx.fillStyle = liquid;
      ctx.fillRect(gx - 5 * k, foot - height, 10 * k, height);
      stroke(edge, 2);
      line([gx - 5 * k, foot], [gx - 5 * k, y0 + 0.04 * side]);
      stroke(edge, 2);
      line([gx + 5 * k, foot], [gx + 5 * k, y0 + 0.04 * side]);
      stroke(accent, 2);
      line([gx - 5 * k, foot - height], [gx + 5 * k, foot - height]);
    });
    words('slow, high pressure', left + 0.18 * w, y0 + side - 10 * k, 'center', muted);
    words('fast, low pressure', left + 0.5 * w, y0 + side - 28 * k, 'center', muted);
  } else if (picture.kind === 'drain') {
    const furthest = 2 * Math.sqrt(picture.full * picture.height);
    const scale = Math.min((0.9 * side) / (picture.full + picture.height + 0.1), (0.6 * side) / furthest);
    const ground = y0 + 0.96 * side;
    const [left, w] = [x0 + 0.04 * side, 0.26 * side];
    const hole = ground - picture.height * scale;
    stroke(ink, 3);
    line([x0, ground], [x0 + side, ground]);
    box(left, hole + 6 * k, w, picture.height * scale - 6 * k, solid);
    ctx.fillStyle = liquid;
    ctx.fillRect(left, hole - picture.level * scale, w, picture.level * scale + 6 * k);
    vessel(left, hole - (picture.full + 0.08) * scale, w, (picture.full + 0.08) * scale + 6 * k);
    stroke(accent, 2);
    line([left, hole - picture.level * scale], [left + w, hole - picture.level * scale]);
    if (picture.range > 1e-6) {
      // A parabola from the hole to where it lands.
      stroke(accent, 3);
      line(...Array.from({ length: 31 }, (_, i): Point => [left + w + (picture.range * scale * i) / 30, hole + picture.height * scale * (i / 30) ** 2]));
      words(`${formatNumber(picture.range)} m`, left + w + picture.range * scale, ground - 12 * k, 'center');
    }
  } else if (picture.kind === 'column') {
    const [w, top, h] = [0.2 * side, y0 + 0.06 * side, 0.88 * side];
    ctx.fillStyle = liquid;
    ctx.fillRect(cx - w / 2, top, w, h);
    vessel(cx - w / 2, top - 0.03 * side, w, h + 0.03 * side);
    disc(cx, top + 10 * k + (h - 20 * k) * Math.min(1, Math.abs(picture.fallen) / picture.tall), 9 * k, ink);
    words(`${formatNumber(picture.tall * 100)} cm of liquid`, cx + w / 2 + 12 * k, top + h / 2, 'left', muted);
  } else if (picture.kind === 'capillary') {
    const surface = y0 + 0.66 * side;
    ctx.fillStyle = liquid;
    ctx.fillRect(x0 + 0.06 * side, surface, 0.88 * side, 0.26 * side);
    vessel(x0 + 0.06 * side, surface - 0.05 * side, 0.88 * side, 0.31 * side);
    const [widest, highest] = [Math.max(...picture.tubes.map((t) => t[0])), Math.max(...picture.tubes.map((t) => Math.abs(t[1])), 1e-9)];
    picture.tubes.forEach(([radius, rise], i) => {
      const x = x0 + (0.24 + 0.26 * i) * side;
      const bore = (5 + 15 * (radius / widest)) * k;
      const up = (rise > 0 ? 0.52 : 0.2) * side * (rise / highest);
      ctx.fillStyle = cssVar('--canvas-bg');
      ctx.fillRect(x - bore, surface - 0.58 * side, 2 * bore, 0.78 * side);
      ctx.fillStyle = liquid;
      ctx.fillRect(x - bore, surface - up, 2 * bore, 0.2 * side + up);
      stroke(edge, 2);
      line([x - bore, surface - 0.58 * side], [x - bore, surface + 0.2 * side]);
      stroke(edge, 2);
      line([x + bore, surface - 0.58 * side], [x + bore, surface + 0.2 * side]);
      stroke(accent, 2);
      line([x - bore, surface - up], [x + bore, surface - up]);
      words(`${formatNumber(rise * 1000)} mm`, x, y0 + 0.03 * side);
    });
  } else if (picture.kind === 'rod') {
    const [length, cy, thick] = [0.62 * side, y0 + 0.5 * side, 22 * k];
    const left = x0 + 0.1 * side;
    const grown = length * Math.min(0.4, picture.share * GROWTH);
    box(left - 14 * k, cy - 2 * thick, 14 * k, 4 * thick, solid);
    box(left, cy - thick / 2, length + grown, thick, warmth(picture.share * 250));
    stroke(muted, 1.5, [5, 5]);
    line([left + length, cy - 1.6 * thick], [left + length, cy + 1.6 * thick]);
    words('its length when cold', left + length, cy + 2.2 * thick, 'center', muted);
    words(`growth shown × ${GROWTH}`, cx, y0 + side - 10 * k, 'center', muted);
  } else if (picture.kind === 'mixing') {
    const [left, w, top, h] = [x0 + 0.2 * side, 0.6 * side, y0 + 0.3 * side, 0.56 * side];
    const share = (t: number) => t / Math.max(picture.hottest, 1);
    ctx.fillStyle = warmth(share(picture.water));
    ctx.globalAlpha = 0.45;
    ctx.fillRect(left, top, w, h);
    ctx.globalAlpha = 1;
    vessel(left, top - 0.08 * side, w, h + 0.08 * side);
    const s = 0.2 * side;
    box(cx - s / 2, top + h - s - 4 * k, s, s, warmth(share(picture.block)), ink);
    words(`block ${formatNumber(picture.block)} °C`, cx, top + h - s - 20 * k);
    words(`water ${formatNumber(picture.water)} °C`, cx, top + 18 * k);
  } else if (picture.kind === 'beaker') {
    const [left, w, top, h] = [x0 + 0.24 * side, 0.52 * side, y0 + 0.3 * side, 0.42 * side];
    const level = h * (0.12 + 0.6 * picture.water);
    ctx.fillStyle = liquid;
    ctx.fillRect(left, top + h - level, w, level);
    const cubes = Math.ceil(picture.ice * 6);
    for (let i = 0; i < cubes; i++) box(left + 10 * k + (i % 3) * 0.16 * side, top + h - level - (Math.floor(i / 3) + 1) * 0.12 * side * (picture.water > 0 ? 0.6 : 1), 0.12 * side, 0.1 * side, cssVar('--surface'), accent);
    vessel(left, top, w, h);
    // Steam rising, more of it the more has boiled.
    stroke(muted, 2);
    for (let i = 0; i < Math.ceil(picture.steam * 5); i++) {
      const x = left + ((i + 0.5) * w) / 5;
      line(...Array.from({ length: 12 }, (_, j): Point => [x + 6 * k * Math.sin(j * 0.9 + i), top - 6 * k - j * 0.018 * side]));
      stroke(muted, 2);
    }
    // The heater under it.
    ctx.fillStyle = hot;
    for (let i = 0; i < 4; i++) {
      const x = left + ((i + 0.5) * w) / 4;
      ctx.beginPath();
      ctx.moveTo(x - 9 * k, top + h + 36 * k);
      ctx.quadraticCurveTo(x, top + h - 4 * k, x + 9 * k, top + h + 36 * k);
      ctx.fill();
    }
    words(`${formatNumber(picture.temperature)} °C`, cx, y0 + 0.08 * side);
  } else if (picture.kind === 'bar') {
    const [left, w, cy, thick] = [x0 + 0.14 * side, 0.72 * side, y0 + 0.5 * side, 0.12 * side];
    const span = Math.max(picture.hot - picture.cold, 1e-9);
    picture.temperatures.forEach((t, i) => {
      ctx.fillStyle = warmth((t - picture.cold) / span);
      ctx.fillRect(left + (i * w) / picture.temperatures.length, cy - thick / 2, w / picture.temperatures.length + 1, thick);
    });
    stroke(edge, 2);
    ctx.strokeRect(left, cy - thick / 2, w, thick);
    stroke(ink, 2, [4, 4]);
    line([left + w / 2, cy - thick], [left + w / 2, cy + thick]);
    box(left - 0.12 * side, cy - 1.4 * thick, 0.12 * side, 2.8 * thick, hot);
    box(left + w, cy - 1.4 * thick, 0.12 * side, 2.8 * thick, cold);
    words(`${formatNumber(picture.hot)} °C`, left - 0.06 * side, cy - 1.8 * thick);
    words(`${formatNumber(picture.cold)} °C`, left + w + 0.06 * side, cy - 1.8 * thick);
    words('first metal', left + w / 4, cy + 1.4 * thick, 'center', muted);
    words('second metal', left + (3 * w) / 4, cy + 1.4 * thick, 'center', muted);
  } else if (picture.kind === 'cup') {
    const share = (picture.temperature - picture.room) / Math.max(picture.start - picture.room, 1e-9);
    const [w, top, h] = [0.34 * side, y0 + 0.42 * side, 0.36 * side];
    ctx.fillStyle = warmth(share);
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, top);
    ctx.lineTo(cx + w / 2, top);
    ctx.lineTo(cx + 0.38 * w, top + h);
    ctx.lineTo(cx - 0.38 * w, top + h);
    ctx.closePath();
    ctx.fill();
    stroke(edge, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + w / 2 + 4 * k, top + 0.4 * h, 0.22 * h, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    // Steam, less of it as it cools.
    stroke(muted, 2);
    for (let i = 0; i < Math.round(share * 4); i++) {
      const x = cx + (i - 1.5) * 0.08 * side;
      line(...Array.from({ length: 12 }, (_, j): Point => [x + 5 * k * Math.sin(j * 0.9 + i), top - 8 * k - j * 0.02 * side]));
      stroke(muted, 2);
    }
    words(`${formatNumber(picture.temperature)} °C`, cx, top + h + 22 * k);
    words(`room at ${formatNumber(picture.room)} °C`, cx, top + h + 42 * k, 'center', muted);
  }
}
