import type { Insets } from '../modern/stage';
import { cssVar, formatNumber, stageFont, stageScale } from '../ui';

type Point = [number, number];

export type MagnetismPicture =
  | { kind: 'field'; wires: [number, number, number][]; needles: [number, number, number, number][]; half: Point; probe: Point | null; pushes: [number, number, number][] }
  | { kind: 'conductor'; angle: number; out: boolean; share: number }
  | { kind: 'meter'; deflection: number; full: number }
  | { kind: 'coil'; magnet: number; reach: number; emf: number }
  | { kind: 'rails'; travelled: number; speed: number }
  | { kind: 'frame'; top: number; band: Point; floor: number; current: number }
  | { kind: 'generator'; angle: number; emf: number }
  | { kind: 'solenoid'; current: number; emf: number; paired: boolean }
  | { kind: 'transformer'; primary: number; secondary: number }
  | { kind: 'chart' };

/** Draws whatever a currents-and-magnetism lesson has on its stage. `plain` is for a thumbnail. */
export function drawMagnetism(canvas: HTMLCanvasElement, picture: MagnetismPicture, insets: Insets, plain = false): void {
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
  const [cx, cy] = [x0 + side / 2, y0 + side / 2];
  const [ink, muted, edge, solid, surface] = [cssVar('--canvas-text'), cssVar('--muted'), cssVar('--canvas-static-edge'), cssVar('--canvas-static'), cssVar('--canvas-bg')];
  const [accent, soft, north, south] = [cssVar('--accent'), cssVar('--accent-soft'), cssVar('--pole-north'), cssVar('--pole-south')];
  const [fieldInk, forceInk] = [cssVar('--force-magnetic'), cssVar('--force-applied')];

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
  /** An arrow from one point to another, with a name beyond its head. */
  const arrow = (from: Point, to: Point, color: string, label = '', width = 3) => {
    const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
    const length = Math.hypot(dx, dy);
    if (length < 3 * k) return;
    const [ux, uy] = [dx / length, dy / length];
    const head = Math.min(10 * k, 0.5 * length);
    stroke(color, width);
    line(from, [to[0] - ux * head, to[1] - uy * head]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(to[0], to[1]);
    ctx.lineTo(to[0] - ux * head - uy * head * 0.55, to[1] - uy * head + ux * head * 0.55);
    ctx.lineTo(to[0] - ux * head + uy * head * 0.55, to[1] - uy * head - ux * head * 0.55);
    ctx.fill();
    if (label) words(label, to[0] + ux * 14 * k, to[1] + uy * 14 * k, 'center', color);
  };
  /** A wire or a vector seen end on: a dot for towards you, a cross for away. */
  const endOn = (x: number, y: number, r: number, towards: boolean, color = ink) => {
    ctx.fillStyle = surface;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
    stroke(color, Math.max(1.2, Math.min(2, r / (4 * k))));
    ctx.stroke();
    if (towards) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 0.3 * r, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      const d = 0.62 * r;
      line([x - d, y - d], [x + d, y + d]);
      line([x - d, y + d], [x + d, y - d]);
    }
  };
  /** A field going into the page over a rectangle, as rows of small crosses moved along by `shift`. */
  const crosses = (x: number, y: number, w: number, h: number, pitch: number, shift = 0) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    stroke(fieldInk, 1.4);
    ctx.globalAlpha = 0.55;
    const d = 0.14 * pitch;
    const start = x - (((shift % pitch) + pitch) % pitch) + pitch / 2;
    for (let py = y + pitch / 2; py < y + h; py += pitch) {
      for (let px = start; px < x + w + pitch; px += pitch) {
        line([px - d, py - d], [px + d, py + d]);
        line([px - d, py + d], [px + d, py - d]);
      }
    }
    ctx.restore();
  };
  /** A bar magnet, north pole towards `nose` (1 right, −1 left). */
  const magnet = (x: number, y: number, w: number, h: number, nose: number) => {
    box(x - w / 2, y - h / 2, w / 2, h, nose > 0 ? south : north, ink);
    box(x, y - h / 2, w / 2, h, nose > 0 ? north : south, ink);
    words(nose > 0 ? 'S' : 'N', x - w / 4, y, 'center', surface);
    words(nose > 0 ? 'N' : 'S', x + w / 4, y, 'center', surface);
  };
  /** A centre-zero gauge: a bar from the middle to `share` of the way to either end. */
  const gauge = (y: number, share: number, label: string, color: string) => {
    if (plain) return;
    const w = 0.3 * side;
    stroke(edge, 1.5);
    line([cx - w, y], [cx + w, y]);
    line([cx, y - 6 * k], [cx, y + 6 * k]);
    ctx.fillStyle = color;
    const reach = w * Math.max(-1, Math.min(1, share));
    ctx.fillRect(Math.min(cx, cx + reach), y - 4 * k, Math.abs(reach), 8 * k);
    words(label, cx - w - 10 * k, y, 'right', muted);
    words('−', cx - w, y + 16 * k, 'center', muted);
    words('+', cx + w, y + 16 * k, 'center', muted);
  };
  /** Turns of a coil seen from the side, as upright ovals from `left` to `right`. */
  const winding = (left: number, right: number, y: number, radius: number, turns: number, color: string, width = 2.2) => {
    stroke(color, width);
    const pitch = (right - left) / turns;
    for (let i = 0; i < turns; i += 1) {
      ctx.beginPath();
      ctx.ellipse(left + (i + 0.5) * pitch, y, Math.min(0.42 * pitch, 0.3 * radius), radius, 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
  };

  if (picture.kind === 'field') {
    const scale = Math.min(side / (2 * picture.half[0]), side / (2 * picture.half[1]));
    const at = (x: number, y: number): Point => [cx + x * scale, cy - y * scale];
    const gaps = picture.needles.slice(1).map((n, i) => Math.abs(n[0] - picture.needles[i]![0])).filter((g) => g > 0);
    const reach = 0.36 * scale * (gaps.length ? Math.min(...gaps) : picture.half[0] / 6);
    for (const [x, y, angle, strength] of picture.needles) {
      const [px, py] = at(x, y);
      const [ux, uy] = [Math.cos(angle) * reach, -Math.sin(angle) * reach];
      ctx.globalAlpha = strength;
      ctx.lineCap = 'round';
      stroke(south, 3);
      line([px - ux, py - uy], [px, py]);
      stroke(north, 3);
      line([px, py], [px + ux, py + uy]);
      ctx.lineCap = 'butt';
    }
    ctx.globalAlpha = 1;
    const size = Math.min(8 * k, picture.wires.length > 2 ? (0.4 * side) / picture.wires.length + 2 * k : 8 * k);
    for (const [x, y, sense] of picture.wires) endOn(...at(x, y), plain ? 0.7 * size : size, sense > 0);
    // Two wires pulled together have only the gap between them for their arrows.
    const between = picture.pushes.length === 2 ? Math.abs(picture.pushes[1]![0] - picture.pushes[0]![0]) * scale : side;
    for (const [x, y, direction] of picture.pushes) {
      const [px, py] = at(x, y);
      const reach = Math.min(0.12 * side, 0.38 * between);
      arrow([px + direction * 12 * k, py], [px + direction * (12 * k + reach), py], forceInk);
      words('F', px + direction * (12 * k + reach / 2), py - 14 * k, 'center', forceInk);
    }
    if (picture.probe && !plain) {
      const [px, py] = at(...picture.probe);
      stroke(accent, 2.5);
      ctx.beginPath();
      ctx.arc(px, py, 7 * k, 0, 2 * Math.PI);
      ctx.stroke();
      words('P', px, py - 18 * k, 'center', accent);
    }
    words('⊙ current towards you    ⊗ current away    needles: red end along the field', cx, y0 + side + 14 * k, 'center', muted);
  } else if (picture.kind === 'conductor') {
    for (let i = 0; i < 5; i += 1) {
      const y = y0 + (0.14 + 0.18 * i) * side;
      ctx.globalAlpha = 0.5;
      arrow([x0 + 0.04 * side, y], [x0 + 0.96 * side, y], fieldInk, '', 1.6);
      ctx.globalAlpha = 1;
    }
    words('B', x0 + 0.97 * side, y0 + 0.09 * side, 'center', fieldInk);
    const reach = 0.36 * side;
    const [ux, uy] = [Math.cos(picture.angle), -Math.sin(picture.angle)];
    stroke(ink, 5);
    line([cx - ux * reach, cy - uy * reach], [cx + ux * reach, cy + uy * reach]);
    // The current's arrow runs beside the wire, a little off it.
    const [ox, oy] = [-uy * 18 * k, ux * 18 * k];
    arrow([cx + ux * 0.12 * side + ox, cy + uy * 0.12 * side + oy], [cx + ux * 0.3 * side + ox, cy + uy * 0.3 * side + oy], accent, 'I');
    if (picture.share > 0.01) {
      endOn(cx, cy, (8 + 14 * picture.share) * k, picture.out, forceInk);
      words(picture.out ? 'force towards you' : 'force away from you', cx, cy + 0.44 * side, 'center', forceInk);
    } else {
      words('no force', cx, cy + 0.44 * side, 'center', muted);
    }
  } else if (picture.kind === 'meter') {
    const [px, py, radius] = [cx, y0 + 0.66 * side, 0.5 * side];
    const point = (angle: number, r: number): Point => [px + r * Math.sin(angle), py - r * Math.cos(angle)];
    stroke(edge, 2);
    ctx.beginPath();
    ctx.arc(px, py, radius, -Math.PI / 2 - picture.full, -Math.PI / 2 + picture.full);
    ctx.stroke();
    for (let i = -6; i <= 6; i += 1) {
      const angle = (picture.full * i) / 6;
      stroke(edge, i % 3 === 0 ? 2.5 : 1.5);
      line(point(angle, radius), point(angle, radius - (i % 3 === 0 ? 14 : 8) * k));
    }
    words('0', ...point(0, radius + 14 * k), 'center', muted);
    // The magnet's curved poles, and the coil between them turning with the pointer.
    const gap = 0.11 * side;
    box(px - gap - 0.2 * side, py - 0.09 * side, 0.2 * side, 0.18 * side, north, ink);
    box(px + gap, py - 0.09 * side, 0.2 * side, 0.18 * side, south, ink);
    words('N', px - gap - 0.1 * side, py, 'center', surface);
    words('S', px + gap + 0.1 * side, py, 'center', surface);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(picture.deflection);
    box(-0.035 * side, -0.075 * side, 0.07 * side, 0.15 * side, soft, accent);
    ctx.restore();
    stroke(accent, 3);
    line([px, py], point(picture.deflection, radius - 4 * k));
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(px, py, 5 * k, 0, 2 * Math.PI);
    ctx.fill();
    words(`${formatNumber((picture.deflection * 180) / Math.PI)}°`, px, y0 + 0.92 * side);
  } else if (picture.kind === 'coil') {
    const [radius, turns, pitch] = [0.2 * side, 5, 0.022 * side];
    const half = (front: boolean) => {
      stroke(accent, 2.6);
      for (let i = 0; i < turns; i += 1) {
        ctx.beginPath();
        // The far side of each turn is drawn before the magnet and the near side after, so it passes through.
        ctx.ellipse(cx + (i - (turns - 1) / 2) * pitch, cy, 0.05 * side, radius, 0, front ? Math.PI / 2 : -Math.PI / 2, front ? (3 * Math.PI) / 2 : Math.PI / 2);
        ctx.stroke();
      }
    };
    stroke(muted, 1.2, [5, 5]);
    line([x0, cy], [x0 + side, cy]);
    half(false);
    const mx = cx + (picture.magnet / picture.reach) * 0.4 * side;
    magnet(mx, cy, 0.16 * side, 0.07 * side, 1);
    half(true);
    arrow([mx - 0.05 * side, cy - 0.07 * side], [mx + 0.05 * side, cy - 0.07 * side], muted, 'v', 2);
    if (Math.abs(picture.emf) > 0.03) {
      // The current in the near side of the turns: up or down as the flux grows or falls.
      const [from, to] = picture.emf < 0 ? [cy + 0.17 * side, cy + 0.06 * side] : [cy + 0.06 * side, cy + 0.17 * side];
      ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, Math.abs(picture.emf));
      arrow([cx - 0.085 * side, from], [cx - 0.085 * side, to], forceInk);
      words('I', cx - 0.085 * side - 14 * k, cy + 0.115 * side, 'center', forceInk);
      ctx.globalAlpha = 1;
    }
    gauge(y0 + 0.9 * side, picture.emf, 'emf', forceInk);
  } else if (picture.kind === 'rails') {
    const [left, right, gap] = [x0 + 0.12 * side, x0 + side, 0.36 * side];
    const [top, bottom] = [cy - gap / 2, cy + gap / 2];
    crosses(left, top, right - left, gap, gap / 4, picture.travelled * gap);
    stroke(edge, 4);
    line([left, top], [right, top]);
    line([left, bottom], [right, bottom]);
    // The resistance joining the rails at the left.
    stroke(ink, 2.5);
    const zig: Point[] = [[left, top], [left, cy - 0.09 * side]];
    for (let i = 0; i < 6; i += 1) zig.push([left + (i % 2 === 0 ? 1 : -1) * 8 * k, cy - 0.09 * side + ((i + 0.5) * 0.18 * side) / 6]);
    zig.push([left, cy + 0.09 * side], [left, bottom]);
    line(...zig);
    words('R', left - 22 * k, cy);
    const rod = left + 0.6 * (right - left);
    stroke(ink, 6);
    line([rod, top - 10 * k], [rod, bottom + 10 * k]);
    arrow([rod + 6 * k, cy], [rod + 0.17 * side, cy], forceInk, 'pull');
    if (picture.speed > 0.02) {
      arrow([rod - 6 * k, cy], [rod - 6 * k - 0.17 * side * Math.min(1, picture.speed), cy], fieldInk, 'BIl');
      ctx.globalAlpha = 0.3 + 0.7 * Math.min(1, picture.speed);
      arrow([rod + 14 * k, bottom - 0.05 * side], [rod + 14 * k, top + 0.05 * side], accent, 'I', 2);
      arrow([rod - 0.1 * side, top - 12 * k], [left + 0.1 * side, top - 12 * k], accent, '', 2);
      ctx.globalAlpha = 1;
    }
    words('field into the page', (left + right) / 2, bottom + 0.1 * side, 'center', fieldInk);
    words(`speed ${formatNumber(100 * picture.speed)} % of terminal`, (left + right) / 2, top - 0.12 * side, 'center', muted);
  } else if (picture.kind === 'frame') {
    const unit = (0.96 * side) / picture.floor;
    const top = y0 + 0.02 * side;
    const [bandTop, bandHeight] = [top + picture.band[0] * unit, (picture.band[1] - picture.band[0]) * unit];
    ctx.fillStyle = soft;
    ctx.fillRect(x0 + 0.1 * side, bandTop, 0.8 * side, bandHeight);
    crosses(x0 + 0.1 * side, bandTop, 0.8 * side, bandHeight, unit / 2.5);
    words('field into the page', x0 + 0.12 * side, bandTop + bandHeight + 14 * k, 'left', fieldInk);
    const [lx, ly] = [cx - unit / 2, top + picture.top * unit];
    stroke(ink, 4);
    ctx.strokeRect(lx, ly, unit, unit);
    const strength = Math.abs(picture.current);
    if (strength > 0.02) {
      // Entering, the current runs anticlockwise, making a field out of the page against the growing flux:
      // to the right along the bottom edge, where the field then pushes it upwards.
      const turn = picture.current > 0 ? -1 : 1;
      ctx.globalAlpha = 0.3 + 0.7 * strength;
      arrow([cx + turn * 0.3 * unit, ly + unit + 12 * k], [cx - turn * 0.3 * unit, ly + unit + 12 * k], accent, '', 2);
      arrow([cx - turn * 0.3 * unit, ly - 12 * k], [cx + turn * 0.3 * unit, ly - 12 * k], accent, 'I', 2);
      ctx.globalAlpha = 1;
      arrow([lx - 14 * k, ly + unit / 2], [lx - 14 * k, ly + unit / 2 - 0.9 * unit * strength], fieldInk, 'braking');
    }
    arrow([lx + unit + 14 * k, ly + unit / 2], [lx + unit + 14 * k, ly + unit / 2 + 0.6 * unit], forceInk, 'mg');
  } else if (picture.kind === 'generator') {
    const w = 0.16 * side;
    box(x0, cy - 0.22 * side, w, 0.44 * side, north, ink);
    box(x0 + side - w, cy - 0.22 * side, w, 0.44 * side, south, ink);
    words('N', x0 + w / 2, cy, 'center', surface);
    words('S', x0 + side - w / 2, cy, 'center', surface);
    for (let i = -2; i <= 2; i += 1) {
      ctx.globalAlpha = 0.45;
      arrow([x0 + w + 6 * k, cy + i * 0.09 * side], [x0 + side - w - 6 * k, cy + i * 0.09 * side], fieldInk, '', 1.4);
      ctx.globalAlpha = 1;
    }
    // The coil seen along its axle: a line, with the two sides of each turn at its ends.
    const reach = 0.24 * side;
    const [nx, ny] = [Math.cos(picture.angle), -Math.sin(picture.angle)];
    const [px, py] = [-ny * reach, nx * reach];
    stroke(ink, 4);
    line([cx - px, cy - py], [cx + px, cy + py]);
    stroke(muted, 1.5, [5, 4]);
    line([cx, cy], [cx + nx * 0.16 * side, cy + ny * 0.16 * side]);
    words('n', cx + nx * 0.19 * side, cy + ny * 0.19 * side, 'center', muted);
    const size = (6 + 6 * Math.abs(picture.emf)) * k;
    endOn(cx - px, cy - py, size, picture.emf > 0, forceInk);
    endOn(cx + px, cy + py, size, picture.emf <= 0, forceInk);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(cx, cy, 4 * k, 0, 2 * Math.PI);
    ctx.fill();
    gauge(y0 + 0.92 * side, picture.emf, 'emf', forceInk);
  } else if (picture.kind === 'solenoid') {
    const [left, right, radius] = [x0 + 0.14 * side, x0 + 0.86 * side, 0.1 * side];
    const y = y0 + 0.36 * side;
    winding(left, right, y, radius, 16, ink);
    if (picture.paired) {
      winding(cx - 0.11 * side, cx + 0.11 * side, y, 1.45 * radius, 5, accent, 3);
      words('second coil', cx, y - 1.45 * radius - 14 * k, 'center', accent);
    }
    if (Math.abs(picture.current) > 0.02) {
      const reach = 0.3 * side * picture.current;
      arrow([cx - reach, y], [cx + reach, y], fieldInk, 'B');
    }
    stroke(ink, 2.2);
    line([left, y + radius], [left, y + radius + 0.08 * side]);
    line([right, y + radius], [right, y + radius + 0.08 * side]);
    gauge(y0 + 0.68 * side, picture.current, 'current', fieldInk);
    gauge(y0 + 0.86 * side, picture.emf, 'emf', forceInk);
  } else {
    const [w, h, limb] = [0.62 * side, 0.6 * side, 0.1 * side];
    const [left, top] = [cx - w / 2, cy - h / 2];
    box(left, top, w, h, solid);
    box(left + limb, top + limb, w - 2 * limb, h - 2 * limb, surface);
    // Sixteen turns drawn, shared out the way the real turns are.
    const first = Math.max(2, Math.min(14, Math.round((16 * picture.primary) / (picture.primary + picture.secondary))));
    const coil = (x: number, turns: number, color: string) => {
      stroke(color, 3.2);
      const run = h - 2 * limb - 16 * k;
      for (let i = 0; i < turns; i += 1) {
        const y = top + limb + 8 * k + ((i + 0.5) * run) / turns;
        line([x - 10 * k, y + 3 * k], [x + limb + 10 * k, y - 3 * k]);
      }
    };
    coil(left, first, ink);
    coil(left + w - limb, 16 - first, accent);
    words(`${formatNumber(picture.primary)} turns`, left - 14 * k, cy, 'right');
    words(`${formatNumber(picture.secondary)} turns`, left + w + 14 * k, cy, 'left', accent);
    words('generator', left - 14 * k, cy + 20 * k, 'right', muted);
    words('power line', left + w + 14 * k, cy + 20 * k, 'left', muted);
    words('iron core', cx, top + limb / 2, 'center', muted);
  }
}
