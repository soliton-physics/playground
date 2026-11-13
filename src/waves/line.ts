import { cssVar, paint, stageFont, stageScale } from '../ui';
import type { Mark } from './lessons';
import type { Series } from './scene';

export type { Series };

export interface ProbeMark {
  x: number;
  y: number;
  label: string;
  color: string;
}

export interface Frame {
  x: Float64Array;
  series: Series[];
  range: [number, number];
  xUnit: string;
  yUnit: string;
  marks: Mark[];
  probes: ProbeMark[];
  medium: 'string' | 'air' | 'field';
  /** How far a layer of air is drawn from its place for each unit of displacement, in units of x. */
  layerGain: number;
}

/** Space for the axis numbers and, under a sound wave, the strip of air layers; all grow with the stage scale. */
const margin = () => ({ left: 58 * stageScale(), top: 32 * stageScale() });
const stripHeight = () => 58 * stageScale();
const axisFont = () => stageFont(11.5);
const labelFont = () => stageFont(12.5, 600);

/** The wave against position, with a fixed vertical range so heights can be read off and compared. */
export class LinePlot {
  private readonly context: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private x0 = 0;
  private x1 = 1;
  private y0 = 0;
  private y1 = 1;
  private strip = 0;
  /** Pixels kept clear on the right, for the panel that floats there. */
  right = 16;
  /** Pixels kept clear below, for the dock and whatever sits above it. */
  bottom = 92;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  private get plotWidth(): number {
    return this.width - margin().left - this.right;
  }

  private get plotHeight(): number {
    // The two rows of axis text under the plot grow with the stage scale; `bottom` allows for them at the usual size.
    return this.height - margin().top - this.bottom - 31 * (stageScale() - 1) - this.strip;
  }

  /** The field coordinates under a canvas pixel. */
  toField(px: number, py: number): [number, number] {
    return [this.x0 + ((px - margin().left) / this.plotWidth) * (this.x1 - this.x0), this.y1 - ((py - margin().top) / this.plotHeight) * (this.y1 - this.y0)];
  }

  toPixelX(x: number): number {
    return margin().left + ((x - this.x0) / (this.x1 - this.x0)) * this.plotWidth;
  }

  draw(frame: Frame): void {
    const { context, width, height } = this;
    const { x, series, range } = frame;
    const k = stageScale();
    this.strip = frame.medium === 'air' ? stripHeight() : 0;
    [this.x0, this.x1] = [x[0] ?? 0, x[x.length - 1] ?? 1];
    [this.y0, this.y1] = range;
    const { x0, x1, y0, y1, plotHeight } = this;
    const toX = (v: number) => this.toPixelX(v);
    const toY = (v: number) => margin().top + ((y1 - v) / (y1 - y0)) * plotHeight;
    const floor = margin().top + plotHeight;
    const text = cssVar('--canvas-text');

    context.fillStyle = cssVar('--canvas-bg');
    context.fillRect(0, 0, width, height);
    context.lineWidth = 1;
    context.fillStyle = text;
    context.font = axisFont();
    context.textAlign = 'right';
    context.textBaseline = 'alphabetic';
    context.setLineDash([]);
    const ySteps = ticks(y0, y1, 6);
    for (const tick of ySteps.values) {
      const y = Math.round(toY(tick)) + 0.5;
      context.strokeStyle = tick === 0 ? cssVar('--canvas-axis') : cssVar('--canvas-grid-major');
      context.beginPath();
      context.moveTo(margin().left, y);
      context.lineTo(width - this.right, y);
      context.stroke();
      context.fillText(tick.toFixed(ySteps.decimals), margin().left - 8, y + 4 * k);
    }
    context.textAlign = 'center';
    const xSteps = ticks(x0, x1, 10);
    const labelRow = floor + this.strip + 16 * k;
    for (const tick of xSteps.values) {
      const px = Math.round(toX(tick)) + 0.5;
      context.strokeStyle = cssVar('--canvas-grid');
      context.beginPath();
      context.moveTo(px, margin().top);
      context.lineTo(px, floor);
      context.stroke();
      context.fillText(tick.toFixed(xSteps.decimals), px, labelRow);
    }
    if (frame.yUnit) {
      context.textAlign = 'left';
      context.fillText(`displacement (${frame.yUnit})`, margin().left, margin().top - 12 * k);
    }
    if (frame.xUnit) {
      context.textAlign = 'right';
      context.fillText(`position (${frame.xUnit})`, width - this.right, labelRow + 15 * k);
    }

    const sum = series[series.length - 1]?.values;
    const at = (position: number): number => {
      if (!sum) return 0;
      const s = Math.min(Math.max(((position - x0) / (x1 - x0)) * (x.length - 1), 0), x.length - 1 - 1e-9);
      const i = Math.floor(s);
      return sum[i]! + (s - i) * (sum[i + 1]! - sum[i]!);
    };

    for (const { values, color, width: lineWidth, fill } of series) {
      const trace = () => {
        context.beginPath();
        for (let i = 0; i < values.length; i++) {
          const px = toX(x[i]!);
          const py = toY(values[i]!);
          i === 0 ? context.moveTo(px, py) : context.lineTo(px, py);
        }
      };
      if (fill) {
        trace();
        context.lineTo(toX(x1), toY(0));
        context.lineTo(toX(x0), toY(0));
        context.closePath();
        context.fillStyle = fill;
        context.fill();
      }
      trace();
      context.strokeStyle = color;
      context.lineWidth = lineWidth * stageScale();
      context.lineJoin = 'round';
      context.stroke();
    }

    // Beads on a string: each stays at its own x and only rides up and down.
    if (frame.medium === 'string') {
      context.fillStyle = cssVar('--accent');
      const count = 24;
      for (let i = 0; i <= count; i++) {
        const position = x0 + ((x1 - x0) * i) / count;
        context.beginPath();
        context.arc(toX(position), toY(at(position)), 3 * k, 0, 2 * Math.PI);
        context.fill();
      }
    }

    // Layers of air: each is drawn shifted along the wave by its displacement, so they crowd and thin out.
    if (frame.medium === 'air') {
      const top = floor + 10;
      const bottom = floor + stripHeight() - 14;
      const count = Math.max(40, Math.round(this.plotWidth / 9));
      context.strokeStyle = cssVar('--accent');
      context.lineWidth = 1.5 * stageScale();
      context.globalAlpha = 0.75;
      context.beginPath();
      for (let i = 0; i <= count; i++) {
        const position = x0 + ((x1 - x0) * i) / count;
        const px = toX(position + frame.layerGain * at(position));
        context.moveTo(px, top);
        context.lineTo(px, bottom);
      }
      context.stroke();
      context.globalAlpha = 1;
      const ends = frame.marks.filter((m) => m.kind === 'end');
      if (ends.length) {
        context.strokeStyle = text;
        context.lineWidth = 2 * stageScale();
        context.beginPath();
        context.moveTo(toX(x0), top - 3);
        context.lineTo(toX(x1), top - 3);
        context.moveTo(toX(x0), bottom + 3);
        context.lineTo(toX(x1), bottom + 3);
        for (const end of ends) {
          if (end.kind !== 'end' || end.type !== 'closed') continue;
          context.moveTo(toX(end.x), top - 3);
          context.lineTo(toX(end.x), bottom + 3);
        }
        context.stroke();
      }
    }

    for (const mark of frame.marks) this.mark(mark, toX, toY, floor, at);

    for (const probe of frame.probes) {
      const px = Math.round(toX(probe.x)) + 0.5;
      context.strokeStyle = paint(probe.color);
      context.lineWidth = 1;
      context.setLineDash([4, 4]);
      context.beginPath();
      context.moveTo(px, margin().top);
      context.lineTo(px, floor + this.strip);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = paint(probe.color);
      context.beginPath();
      context.arc(px, toY(probe.y), 5.5 * k, 0, 2 * Math.PI);
      context.fill();
      context.strokeStyle = cssVar('--canvas-bg');
      context.lineWidth = 2 * stageScale();
      context.stroke();
      context.beginPath();
      context.roundRect(px - 10 * k, margin().top - 20 * k, 20 * k, 18 * k, 5);
      context.fill();
      context.fillStyle = cssVar('--probe-ink');
      context.font = labelFont();
      context.textAlign = 'center';
      context.fillText(probe.label, px, margin().top - 7 * k);
    }
  }

  private mark(mark: Mark, toX: (v: number) => number, toY: (v: number) => number, floor: number, at: (x: number) => number): void {
    const { context } = this;
    const ink = cssVar('--text');
    context.font = labelFont();
    context.lineWidth = 1.5 * stageScale();
    context.setLineDash([]);
    if (mark.kind === 'span') {
      const [a, b, y] = [toX(mark.from), toX(mark.to), toY(mark.at)];
      context.strokeStyle = ink;
      context.fillStyle = ink;
      context.beginPath();
      context.moveTo(a, y);
      context.lineTo(b, y);
      for (const [tip, back] of [[a, 1], [b, -1]] as const) {
        context.moveTo(tip + back * 7, y - 4);
        context.lineTo(tip, y);
        context.lineTo(tip + back * 7, y + 4);
      }
      context.stroke();
      context.textAlign = 'center';
      context.fillText(mark.label, (a + b) / 2, y - 8);
    } else if (mark.kind === 'rise') {
      const [px, base, tip] = [toX(mark.x), toY(0), toY(mark.to)];
      context.strokeStyle = ink;
      context.fillStyle = ink;
      context.beginPath();
      context.moveTo(px, base);
      context.lineTo(px, tip + 4);
      context.moveTo(px - 4, tip + 11);
      context.lineTo(px, tip + 4);
      context.lineTo(px + 4, tip + 11);
      context.stroke();
      context.textAlign = 'left';
      context.fillText(mark.label, px + 8, (base + tip) / 2 + 4);
    } else if (mark.kind === 'point') {
      const px = toX(mark.x);
      const color = cssVar(mark.tone === 'node' ? '--muted' : '--text');
      context.fillStyle = color;
      if (mark.label === 'N') {
        context.beginPath();
        context.arc(px, toY(0), 4, 0, 2 * Math.PI);
        context.fill();
      }
      context.textAlign = 'center';
      context.fillText(mark.label, px, floor - 8);
    } else if (mark.type === 'fixed') {
      const px = toX(mark.x);
      const [top, bottom] = [toY(0) - 46, toY(0) + 46];
      context.strokeStyle = cssVar('--canvas-text');
      context.lineWidth = 3 * stageScale();
      context.beginPath();
      context.moveTo(px, top);
      context.lineTo(px, bottom);
      context.stroke();
      context.lineWidth = 1;
      context.beginPath();
      const away = mark.x > (this.x0 + this.x1) / 2 ? 1 : -1;
      for (let y = top + 4; y < bottom; y += 9) {
        context.moveTo(px, y);
        context.lineTo(px + away * 8, y + 7);
      }
      context.stroke();
    } else if (mark.type === 'free') {
      const px = toX(mark.x);
      context.strokeStyle = cssVar('--canvas-text');
      context.lineWidth = 2 * stageScale();
      context.beginPath();
      context.moveTo(px, margin().top + 10);
      context.lineTo(px, floor - 10);
      context.stroke();
      context.strokeStyle = cssVar('--accent');
      context.lineWidth = 2.5 * stageScale();
      context.beginPath();
      context.arc(px, toY(at(mark.x)), 7, 0, 2 * Math.PI);
      context.stroke();
    }
  }

  private resize(): void {
    const scale = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * scale);
    this.canvas.height = Math.round(rect.height * scale);
    this.context.setTransform(scale, 0, 0, scale, 0, 0);
  }
}

/** Draws a wave small, with no axes: a card in the gallery, or a point's own history. */
export function sparkline(canvas: HTMLCanvasElement, lines: { values: Float64Array; color: string; width: number }[], limit: number): void {
  const scale = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  const context = canvas.getContext('2d')!;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  const middle = rect.height / 2;
  context.strokeStyle = cssVar('--canvas-axis');
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, middle + 0.5);
  context.lineTo(rect.width, middle + 0.5);
  context.stroke();
  for (const { values, color, width } of lines) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineJoin = 'round';
    context.beginPath();
    for (let i = 0; i < values.length; i++) {
      const px = (i / (values.length - 1)) * rect.width;
      const py = middle - (values[i]! / limit) * (middle - 4);
      i === 0 ? context.moveTo(px, py) : context.lineTo(px, py);
    }
    context.stroke();
  }
}

function ticks(min: number, max: number, count: number): { values: number[]; decimals: number } {
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const values: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) values.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return { values, decimals: Math.min(6, Math.max(0, -Math.floor(Math.log10(step) + 1e-9))) };
}
