import { cssVar, stageFont, stageScale } from '../ui';

export interface Curve {
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  color: string;
  width?: number;
  dashed?: boolean;
  /** Drawn as bars from the axis, for a histogram. */
  bars?: boolean;
}

export interface Plot {
  xLabel: string;
  yLabel: string;
  curves: Curve[];
  /** A point to mark: where the gas is now. */
  now?: [number, number];
  /** Keep zero on the y axis. */
  fromZero?: boolean;
}

function ticks(min: number, max: number, count: number): number[] {
  const raw = (max - min) / count;
  if (!(raw > 0)) return [min];
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

const short = (value: number) => (Math.abs(value) >= 10000 || (Math.abs(value) < 0.01 && value !== 0) ? value.toExponential(0) : String(+value.toPrecision(3)));

/** A small graph in the side panel: lines, a histogram, and a dot for the present. */
export function drawPlot(canvas: HTMLCanvasElement, plot: Plot): void {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const k = Math.min(stageScale(), 1.25);
  const [w, h] = [rect.width, rect.height];
  const pad = { left: 44 * k, right: 10, top: 10, bottom: 34 * k };
  ctx.clearRect(0, 0, w, h);

  let [x0, x1, y0, y1] = [Infinity, -Infinity, plot.fromZero ? 0 : Infinity, -Infinity];
  for (const curve of plot.curves) {
    for (let i = 0; i < curve.x.length; i++) {
      const [x, y] = [curve.x[i]!, curve.y[i]!];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
    }
  }
  if (!(x1 > x0)) [x0, x1] = [Number.isFinite(x0) ? x0 - 1 : 0, Number.isFinite(x0) ? x0 + 1 : 1];
  if (!(y1 > y0)) [y0, y1] = [Number.isFinite(y0) ? y0 - 1 : 0, Number.isFinite(y0) ? y0 + 1 : 1];
  const room = 0.06 * (y1 - y0);
  y1 += room;
  if (!plot.fromZero) y0 -= room;
  const toX = (x: number) => pad.left + ((x - x0) / (x1 - x0)) * (w - pad.left - pad.right);
  const toY = (y: number) => h - pad.bottom - ((y - y0) / (y1 - y0)) * (h - pad.top - pad.bottom);

  ctx.font = stageFont((10.5 * k) / stageScale());
  ctx.fillStyle = cssVar('--muted');
  ctx.lineWidth = 1;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (const tick of ticks(y0, y1, 4)) {
    const y = Math.round(toY(tick)) + 0.5;
    ctx.strokeStyle = cssVar('--canvas-grid-major');
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillText(short(tick), pad.left - 5, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const tick of ticks(x0, x1, 5)) ctx.fillText(short(tick), toX(tick), h - pad.bottom + 13 * k);
  ctx.fillText(plot.xLabel, (pad.left + w - pad.right) / 2, h - 4);
  ctx.save();
  ctx.translate(11 * k, (pad.top + h - pad.bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(plot.yLabel, 0, 0);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.left, pad.top - 2, w - pad.left - pad.right, h - pad.top - pad.bottom + 3);
  ctx.clip();
  for (const curve of plot.curves) {
    ctx.strokeStyle = curve.color;
    ctx.fillStyle = curve.color;
    if (curve.bars) {
      const width = curve.x.length > 1 ? Math.abs(toX(curve.x[1]!) - toX(curve.x[0]!)) : 6;
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < curve.x.length; i++) ctx.fillRect(toX(curve.x[i]!) - width / 2 + 0.5, toY(curve.y[i]!), Math.max(width - 1, 1), toY(0) - toY(curve.y[i]!));
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.lineWidth = (curve.width ?? 2) * k;
    ctx.lineJoin = 'round';
    ctx.setLineDash(curve.dashed ? [5, 4] : []);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < curve.x.length; i++) {
      const [x, y] = [curve.x[i]!, curve.y[i]!];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      started ? ctx.lineTo(toX(x), toY(y)) : ctx.moveTo(toX(x), toY(y));
      started = true;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (plot.now && plot.now.every(Number.isFinite)) {
    ctx.fillStyle = cssVar('--text');
    ctx.beginPath();
    ctx.arc(toX(plot.now[0]), toY(plot.now[1]), 4.5 * k, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}
