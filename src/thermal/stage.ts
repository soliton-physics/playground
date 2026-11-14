import { cssVar, formatNumber, stageFont, stageScale } from '../ui';
import { MOLECULE_STRIDE } from './types';

export interface GasFrame {
  /** `x, y, z, radius, species` for each molecule, nm. */
  molecules: Float64Array;
  /** The box now; x is where the piston stands. */
  size: Float64Array;
  /** The longest the box ever gets, so the cylinder can be drawn once and the piston moved in it. */
  longest: number;
  /** Temperature of each wall in K, NaN for an insulated one. */
  walls: Float64Array;
  partition?: number;
  /** +1 moving out, −1 in, 0 at rest. */
  piston: number;
  /** Whether the far end ever moves; if not it is drawn as a wall like the others. */
  hasPiston: boolean;
  /** The temperatures between which a wall is drawn from cold to hot. */
  coldest: number;
  hottest: number;
  /** Where a marked molecule has been, for Brownian motion: `x, y` pairs. */
  trail?: number[];
}

/** The theme token for the colour of one kind of molecule. */
export const speciesToken = (species: number) => `--molecule-${(species % 4) + 1}`;

type Rgb = [number, number, number];

/** A colour from the stylesheet as red, green and blue, so that shades of it can be worked out. */
function rgbOf(color: string): Rgb {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1]!.slice(i, i + 2), 16)) as Rgb;
  const parts = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  return parts?.length === 3 ? (parts as Rgb) : [128, 128, 128];
}

const blend = (a: Rgb, b: Rgb, share: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * share)).join(' ')})`;

/** Draws the gas: a cylinder seen from the side, its piston on the right, molecules nearer the viewer drawn larger and darker. */
export class GasStage {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  /** Screen pixels the floating panels cover on each side. */
  insets = { left: 16, right: 16, top: 16, bottom: 16 };

  constructor(private readonly canvas: HTMLCanvasElement, observe = true) {
    this.ctx = canvas.getContext('2d')!;
    if (observe) new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  resize(): void {
    const ratio = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  draw(frame: GasFrame, plain = false): void {
    const { ctx } = this;
    const k = stageScale();
    ctx.fillStyle = cssVar('--canvas-bg');
    ctx.fillRect(0, 0, this.width, this.height);
    const [length, tall, deep] = [frame.size[0]!, frame.size[1]!, frame.size[2]!];
    const { left, right, top, bottom } = this.insets;
    // Room on the right for the piston and its rod, and all round for the walls and their labels.
    const margin = plain ? 6 : 34 * k;
    const rod = plain || !frame.hasPiston ? 0 : 40 * k;
    const free = { w: Math.max(60, this.width - left - right - 2 * margin - rod), h: Math.max(60, this.height - top - bottom - 2 * margin) };
    const scale = Math.min(free.w / frame.longest, free.h / tall);
    const x0 = left + margin + (free.w - frame.longest * scale) / 2;
    const y0 = top + margin + (free.h - tall * scale) / 2;
    const toX = (x: number) => x0 + x * scale;
    const toY = (y: number) => y0 + (tall - y) * scale;
    const [x1, y1, piston] = [toX(frame.longest), toY(0), toX(length)];

    // The inside of the cylinder, and the part the piston has not reached.
    ctx.fillStyle = cssVar('--surface');
    ctx.fillRect(x0, y0, piston - x0, y1 - y0);

    const wall = (index: number) => {
      const t = frame.walls[index]!;
      if (Number.isNaN(t)) return cssVar('--canvas-static-edge');
      if (frame.hottest - frame.coldest < 1) return cssVar('--bath');
      return cssVar(t > (frame.hottest + frame.coldest) / 2 ? '--bath-hot' : '--bath-cold');
    };
    const thick = (plain ? 3 : 6) * k;
    ctx.lineCap = 'butt';
    ctx.lineWidth = thick;
    const line = (ax: number, ay: number, bx: number, by: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    };
    // Top and bottom run the whole cylinder; the left end closes it.
    line(x0 - thick / 2, y0 - thick / 2, x1, y0 - thick / 2, wall(3));
    line(x0 - thick / 2, y1 + thick / 2, x1, y1 + thick / 2, wall(2));
    line(x0 - thick / 2, y0 - thick, x0 - thick / 2, y1 + thick, wall(0));

    // The piston: a block with a rod, and an arrow while it moves.
    const block = frame.hasPiston ? (plain ? 5 : 12) * k : thick;
    ctx.fillStyle = Number.isNaN(frame.walls[1]!) || frame.piston !== 0 ? cssVar('--canvas-static-edge') : wall(1);
    ctx.fillRect(piston, y0, block, y1 - y0);
    if (!plain && frame.hasPiston) {
      ctx.fillStyle = cssVar('--canvas-static-edge');
      ctx.fillRect(piston + block, (y0 + y1) / 2 - 4 * k, Math.max(x1 + rod - piston - block, 14 * k), 8 * k);
      if (frame.piston !== 0) {
        const [ax, ay] = [piston + block + 26 * k, (y0 + y1) / 2 - 20 * k];
        const way = frame.piston;
        ctx.strokeStyle = cssVar('--text');
        ctx.lineWidth = 2.5 * k;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ax - way * 14 * k, ay);
        ctx.lineTo(ax + way * 14 * k, ay);
        ctx.moveTo(ax + way * 6 * k, ay - 6 * k);
        ctx.lineTo(ax + way * 14 * k, ay);
        ctx.lineTo(ax + way * 6 * k, ay + 6 * k);
        ctx.stroke();
      }
    }

    if (frame.partition !== undefined) {
      ctx.lineCap = 'butt';
      ctx.lineWidth = 4 * k;
      line(toX(frame.partition), y0, toX(frame.partition), y1, cssVar('--canvas-static-edge'));
    }

    if (frame.trail && frame.trail.length >= 4) {
      ctx.strokeStyle = cssVar(speciesToken(0));
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5 * k;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < frame.trail.length; i += 2) {
        const [px, py] = [toX(frame.trail[i]!), toY(frame.trail[i + 1]!)];
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Molecules, the far ones first. Depth is shown by size and strength of colour.
    const m = frame.molecules;
    const count = m.length / MOLECULE_STRIDE;
    const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => m[a * MOLECULE_STRIDE + 2]! - m[b * MOLECULE_STRIDE + 2]!);
    // Solid balls, lit from the upper left. A far one is paler and smaller, not see-through: see-through
    // balls lying over one another turn to mud.
    const inside = rgbOf(cssVar('--surface'));
    const light: Rgb = [255, 255, 255];
    const dark: Rgb = [0, 0, 0];
    const bases = new Map<number, Rgb>();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, piston - x0, y1 - y0);
    ctx.clip();
    for (const i of order) {
      const o = i * MOLECULE_STRIDE;
      const species = m[o + 4]!;
      if (!bases.has(species)) bases.set(species, rgbOf(cssVar(speciesToken(species))));
      const base = bases.get(species)!;
      const near = Math.min(1, Math.max(0, m[o + 2]! / deep));
      // A molecule is never drawn smaller than a dot that can be seen, whatever its real size.
      const r = Math.max(m[o + 3]! * scale, plain ? 1.3 : 3 * k) * (0.78 + 0.44 * near);
      const [cx, cy] = [toX(m[o]!), toY(m[o + 1]!)];
      const faded = 0.5 * (1 - near);
      const body = rgbOf(blend(base, inside, faded));
      if (r >= 3.2 && !plain) {
        const shade = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.08, cx, cy, r);
        shade.addColorStop(0, blend(body, light, 0.5));
        shade.addColorStop(0.45, blend(body, light, 0));
        shade.addColorStop(1, blend(body, dark, 0.28));
        ctx.fillStyle = shade;
      } else {
        ctx.fillStyle = blend(body, light, 0);
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
    if (plain) return;

    // What the walls are doing, in words under the cylinder.
    const baths = [...new Set(Array.from(frame.walls).filter((t) => !Number.isNaN(t)))];
    const words = baths.length === 0 ? 'walls insulated: no heat passes' : baths.length === 1 ? `walls held at ${formatNumber(baths[0]!)} K` : `left end at ${formatNumber(frame.walls[0]!)} K, right end at ${formatNumber(frame.walls[1]!)} K`;
    ctx.font = stageFont(13, 600);
    ctx.fillStyle = cssVar('--canvas-text');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(words, x0, y1 + thick + 20 * k);
    const used = ctx.measureText(words).width;
    ctx.font = stageFont(12);
    const sizes = `${formatNumber(length)} nm × ${formatNumber(tall)} nm × ${formatNumber(deep)} nm`;
    // Beside the first caption when the cylinder is wide enough for both, under it when not.
    const beside = used + ctx.measureText(sizes).width + 24 * k < x1 - x0;
    ctx.textAlign = beside ? 'right' : 'left';
    ctx.fillText(sizes, beside ? x1 : x0, y1 + thick + (beside ? 20 : 38) * k);
  }
}
