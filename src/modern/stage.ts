import { drawPlot, type Plot } from '../thermal/graphs';
import { cssVar, formatNumber, stageFont, stageScale } from '../ui';
import { colourOf } from '../waves/pattern';
import type { Picture, PlotData } from './types';

export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const TONES = ['--molecule-1', '--molecule-2', '--muted'];
const SERIES = ['Lyman', 'Balmer', 'Paschen', 'Brackett', 'Pfund'];

/** The colour of light of a wavelength as the eye sees it; beyond either end of the visible, a neutral grey. */
const lightColour = (nm: number) => (nm < 380 || nm > 750 ? cssVar('--muted') : `rgb(${colourOf(nm).join(' ')})`);

/** A graph from the engine, in the playground's colours. */
export function toPlot(data: PlotData): Plot {
  return {
    xLabel: data.x_label,
    yLabel: data.y_label,
    fromZero: data.from_zero,
    ladder: data.ladder,
    now: data.marker ?? undefined,
    curves: data.curves.map((c) => ({
      x: c.x,
      y: c.y,
      color: cssVar(TONES[c.tone] ?? '--muted'),
      dashed: c.style === 'dashed',
      points: c.style === 'points',
      width: c.style === 'points' ? 3.5 : c.tone === 2 ? 1.5 : 2.25,
      label: data.ladder && c.name.startsWith('n = ') ? c.name : undefined,
    })),
  };
}

/** Draws whatever a modern physics lesson has on its stage. `plain` is for a thumbnail: no words, thinner lines. */
export function drawPicture(canvas: HTMLCanvasElement, picture: Picture, insets: Insets, plain = false): void {
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

  const margin = plain ? 6 : 34 * k;
  const [roomW, roomH] = [rect.width - insets.left - insets.right - 2 * margin, rect.height - insets.top - insets.bottom - 2 * margin];
  const side = Math.max(40, Math.min(roomW, roomH));
  const x0 = insets.left + margin + (roomW - side) / 2;
  const y0 = insets.top + margin + (roomH - side) / 2;
  const [cx, cy] = [x0 + side / 2, y0 + side / 2];
  const [ink, muted, teal, amber] = [cssVar('--canvas-text'), cssVar('--muted'), cssVar('--molecule-1'), cssVar('--molecule-2')];
  const words = (text: string, x: number, y: number, align: CanvasTextAlign = 'center', color = ink) => {
    if (plain) return;
    ctx.font = stageFont(12.5, 600);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  };
  const dot = (x: number, y: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
  };

  if (picture.kind === 'tube') {
    const [top, height] = [y0 + 0.12 * side, 0.76 * side];
    // The evacuated tube, with the plate the light falls on at the left and the collector at the right.
    ctx.fillStyle = cssVar('--surface');
    ctx.strokeStyle = cssVar('--canvas-static-edge');
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.roundRect(x0 - 14 * k, top - 14 * k, side + 28 * k, height + 28 * k, 18 * k);
    ctx.fill();
    ctx.stroke();
    const at = (p: [number, number]): [number, number] => [x0 + p[0] * side, y0 + side - p[1] * side];
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0 - margin + 4, side, side + margin);
    ctx.clip();
    const light = lightColour(picture.wavelength);
    for (const p of picture.photons) {
      const [x, y] = at(p);
      // A short stroke along the way it is going, so that it reads as light arriving and not as a particle at rest.
      ctx.strokeStyle = light;
      ctx.lineWidth = 3 * k;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 9.6 * k, y - 7.2 * k);
      ctx.stroke();
    }
    ctx.restore();
    for (const p of picture.electrons) dot(...at(p), 3.2 * k, teal);
    ctx.fillStyle = ink;
    ctx.fillRect(x0 - 5 * k, top, 5 * k, height);
    ctx.fillRect(x0 + side, top, 5 * k, height);
    words('metal plate', x0, top + height + 30 * k, 'left');
    words(`collector at ${picture.voltage > 0 ? '+' : ''}${formatNumber(picture.voltage)} V`, x0 + side, top + height + 30 * k, 'right');
    words(picture.emitting ? 'light in · electrons out' : 'light in · no electrons: each photon has too little energy', x0, y0 - 8 * k, 'left');
  } else if (picture.kind === 'wave') {
    // Eight atoms across, and the wave drawn to the same scale above them.
    const scale = side / (8 * picture.spacing);
    const [rowY, waveY, amplitude] = [y0 + 0.78 * side, y0 + 0.36 * side, 0.16 * side];
    for (let i = 0; i <= 8; i++) dot(x0 + i * picture.spacing * scale, rowY, 9 * k, muted);
    ctx.strokeStyle = teal;
    ctx.lineWidth = 2.5 * k;
    ctx.beginPath();
    for (let px = 0; px <= side; px++) {
      const y = waveY - amplitude * Math.sin((2 * Math.PI * px) / (picture.wavelength * scale));
      px === 0 ? ctx.moveTo(x0, y) : ctx.lineTo(x0 + px, y);
    }
    ctx.stroke();
    const span = (from: number, to: number, y: number, text: string) => {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5 * k;
      ctx.beginPath();
      ctx.moveTo(from, y - 5 * k);
      ctx.lineTo(from, y + 5 * k);
      ctx.moveTo(from, y);
      ctx.lineTo(to, y);
      ctx.moveTo(to, y - 5 * k);
      ctx.lineTo(to, y + 5 * k);
      ctx.stroke();
      words(text, (from + to) / 2, y + 16 * k);
    };
    const quarter = (picture.wavelength * scale) / 4;
    span(x0 + quarter, x0 + 5 * quarter, waveY + amplitude + 18 * k, `one wavelength, ${formatNumber(picture.wavelength)} nm`);
    span(x0, x0 + picture.spacing * scale, rowY + 26 * k, `${formatNumber(picture.spacing)} nm between atoms`);
  } else if (picture.kind === 'crystal') {
    const [ox, oy] = [cx, y0 + 0.74 * side];
    const reach = 0.7 * side;
    for (let row = 0; row < 3; row++) for (let i = -5; i <= 5; i++) dot(ox + i * 0.07 * side, oy + (row + 0.5) * 0.06 * side, 5 * k, muted);
    // The beam comes straight down onto the crystal.
    ctx.strokeStyle = teal;
    ctx.lineWidth = 3 * k;
    ctx.beginPath();
    ctx.moveTo(ox, y0);
    ctx.lineTo(ox, oy - 4 * k);
    ctx.stroke();
    // How many electrons come off in each direction, as a distance from the crystal.
    for (const sign of [1, -1]) {
      ctx.beginPath();
      picture.lobe.forEach(([degrees, strength], i) => {
        const a = (degrees * Math.PI) / 180;
        const [x, y] = [ox + sign * reach * strength * Math.sin(a), oy - reach * strength * Math.cos(a)];
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.lineTo(ox, oy);
      ctx.fillStyle = amber;
      ctx.globalAlpha = 0.18;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = amber;
      ctx.lineWidth = 2 * k;
      ctx.stroke();
    }
    if (picture.peak !== null) {
      const a = (picture.peak * Math.PI) / 180;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5 * k;
      ctx.setLineDash([6 * k, 5 * k]);
      ctx.beginPath();
      // Out to a little beyond the tip of the hump it points at.
      const tip = reach * Math.max(...picture.lobe.filter(([d]) => Math.abs(d - picture.peak!) < 3).map(([, s]) => s)) + 26 * k;
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + tip * Math.sin(a), oy - tip * Math.cos(a));
      ctx.stroke();
      ctx.setLineDash([]);
      words(`${formatNumber(picture.peak)}°`, ox + (tip + 20 * k) * Math.sin(a), oy - (tip + 20 * k) * Math.cos(a));
    }
    words('electron beam', ox + 10 * k, y0 + 12 * k, 'left');
    words('nickel crystal', ox, oy + 0.24 * side);
  } else if (picture.kind === 'scattering') {
    const scale = side / (2 * picture.half);
    ctx.fillStyle = cssVar('--surface');
    ctx.fillRect(x0, y0, side, side);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, side, side);
    ctx.clip();
    for (const track of picture.tracks) {
      if (track.points.length === 0) continue;
      ctx.strokeStyle = track.marked ? amber : teal;
      ctx.lineWidth = (track.marked ? 3 : 1.5) * k;
      ctx.beginPath();
      track.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(cx + x * scale, cy - y * scale) : ctx.lineTo(cx + x * scale, cy - y * scale)));
      ctx.stroke();
      const [hx, hy] = track.points[track.points.length - 1]!;
      dot(cx + hx * scale, cy - hy * scale, (track.marked ? 4.5 : 3) * k, track.marked ? amber : teal);
    }
    // Nothing gets inside this circle: it is as near as a head-on alpha comes.
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.25 * k;
    ctx.setLineDash([4 * k, 4 * k]);
    ctx.beginPath();
    ctx.arc(cx, cy, picture.closest * scale, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
    dot(cx, cy, 4 * k, ink);
    ctx.restore();
    ctx.strokeStyle = cssVar('--canvas-static-edge');
    ctx.lineWidth = (plain ? 1 : 2) * k;
    ctx.strokeRect(x0, y0, side, side);
    if (!plain) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2 * k;
      ctx.beginPath();
      ctx.moveTo(x0 + 14 * k, y0 + side - 16 * k);
      ctx.lineTo(x0 + 14 * k + 100 * scale, y0 + side - 16 * k);
      ctx.stroke();
      words('100 fm', x0 + 14 * k + 50 * scale, y0 + side - 30 * k);
      words('amber: the marked alpha · dashed: nearest a head-on alpha gets', x0, y0 + side + 20 * k, 'left');
    }
  } else if (picture.kind === 'orbits') {
    const outer = picture.radii[picture.radii.length - 1]!;
    const scale = (0.46 * side) / outer;
    picture.radii.forEach((radius, i) => {
      const n = i + 1;
      ctx.strokeStyle = n === picture.level ? teal : muted;
      ctx.lineWidth = (n === picture.level ? 2.5 : 1) * k;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * scale, 0, 2 * Math.PI);
      ctx.stroke();
      if (radius * scale > 14 * k) words(`n = ${n}`, cx - radius * scale * Math.SQRT1_2 - 4 * k, cy - radius * scale * Math.SQRT1_2 - 8 * k, 'right', n === picture.level ? ink : muted);
    });
    dot(cx, cy, 5 * k, amber);
    const r = picture.radii[picture.level - 1]! * scale;
    dot(cx + r * Math.cos(picture.angle), cy - r * Math.sin(picture.angle), 5.5 * k, teal);
    if (picture.photon) {
      const [flown, nm] = picture.photon;
      // A short train of waves leaving the atom, in the colour of the light it is.
      const from = picture.radii[picture.lower - 1]! * scale;
      const at = from + flown * (0.5 * side - from);
      const [ux, uy] = [Math.SQRT1_2, -Math.SQRT1_2];
      ctx.strokeStyle = lightColour(nm);
      ctx.lineWidth = 3 * k;
      ctx.beginPath();
      for (let s = 0; s <= 44; s++) {
        const along = at + (s - 44) * k;
        const across = 6 * k * Math.sin((s / 44) * 6 * Math.PI) * Math.sin((s / 44) * Math.PI);
        const [x, y] = [cx + along * ux - across * uy, cy + along * uy + across * ux];
        s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      words(`photon, ${formatNumber(nm)} nm`, cx + (at - 22 * k) * ux - 14 * k, cy + (at - 22 * k) * uy - 14 * k, 'right');
    }
  } else if (picture.kind === 'spectrum') {
    // Wavelength on a scale of ratios, from the far ultraviolet to the infrared.
    const [low, high] = [Math.log(80), Math.log(9000)];
    const [left, width] = plain ? [x0, side] : [insets.left + margin, roomW];
    const toX = (nm: number) => left + ((Math.log(nm) - low) / (high - low)) * width;
    const [top, height] = [cy - 0.16 * side, 0.32 * side];
    ctx.fillStyle = cssVar('--dark-room');
    ctx.fillRect(left, top, width, height);
    for (const line of picture.lines) {
      const mine = line.lower === picture.chosen[0];
      const visible = line.wavelength >= 380 && line.wavelength <= 750;
      ctx.strokeStyle = visible ? `rgb(${colourOf(line.wavelength).join(' ')})` : cssVar('--dark-room-ink');
      ctx.globalAlpha = mine ? 1 : 0.3;
      ctx.lineWidth = (mine ? 2.5 : 1.5) * k;
      const x = toX(line.wavelength);
      ctx.beginPath();
      ctx.moveTo(x, top + (mine ? 0 : 0.25 * height));
      ctx.lineTo(x, top + height);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (plain) return;
    const chosen = picture.lines.find((l) => l.lower === picture.chosen[0] && l.upper === picture.chosen[1]);
    if (chosen) {
      const x = toX(chosen.wavelength);
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(x, top - 3 * k);
      ctx.lineTo(x - 7 * k, top - 15 * k);
      ctx.lineTo(x + 7 * k, top - 15 * k);
      ctx.fill();
      words(`${formatNumber(chosen.wavelength)} nm`, x, top - 28 * k);
    }
    SERIES.forEach((name, i) => {
      const first = picture.lines.find((l) => l.lower === i + 1);
      if (first) words(name, toX(first.wavelength), top + height + (i % 2 ? 40 : 20) * k, 'right', i + 1 === picture.chosen[0] ? ink : muted);
    });
    for (const nm of [100, 200, 500, 1000, 2000, 5000]) words(`${nm}`, toX(nm), top + height + 66 * k, 'center', muted);
    words('wavelength (nm)', left + width / 2, top + height + 86 * k, 'center', muted);
    for (const [name, from, to] of [['ultraviolet', 80, 380], ['visible', 380, 750], ['infrared', 750, 9000]] as const) {
      words(name, (toX(from) + toX(to)) / 2, top - 56 * k, 'center', muted);
    }
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    for (const nm of [380, 750]) {
      ctx.beginPath();
      ctx.moveTo(toX(nm), top - 64 * k);
      ctx.lineTo(toX(nm), top - 44 * k);
      ctx.stroke();
    }
  } else if (picture.kind === 'sample') {
    const cell = side / picture.columns;
    picture.decayed.forEach((gone, i) => {
      const [x, y] = [x0 + ((i % picture.columns) + 0.5) * cell, y0 + (Math.floor(i / picture.columns) + 0.5) * cell];
      if (gone) {
        ctx.strokeStyle = muted;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 0.3 * cell, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else dot(x, y, 0.36 * cell, teal);
    });
    words('filled: not yet decayed', x0, y0 + side + 20 * k, 'left');
  }
}

/** A lesson that is all graph has it drawn large, on a canvas of its own laid over the stage. */
export function drawChart(canvas: HTMLCanvasElement, data: PlotData): void {
  drawPlot(canvas, toPlot(data));
}
