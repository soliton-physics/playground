import { cssVar, paint, stageFont, stageScale } from '../ui';
import type { CapacitorPicture } from './capacitor';
import type { Picture } from './pattern';
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
  medium: 'string' | 'air' | 'field' | 'light' | 'capacitor' | 'screen';
  /** How far a layer of air is drawn from its place for each unit of displacement, in units of x. */
  layerGain: number;
  /** What the axes measure, when it is not displacement against position. */
  xLabel?: string;
  yLabel?: string;
  /** The magnetic field of a light wave, in the units of the electric one. */
  companion?: Float64Array;
  /** The state of a charging capacitor, or a pattern as it looks on a screen, drawn under the graph. */
  picture?: CapacitorPicture | Picture;
}

/** Space for the axis numbers and, under a sound wave, the strip of air layers; all grow with the stage scale. */
const margin = () => ({ left: 58 * stageScale(), top: 32 * stageScale() });
const stripHeight = () => 58 * stageScale();
const pictureHeight = () => 132 * stageScale();
/** The magnetic field points out of the page; on the page that axis is drawn slanting down and to the left. */
const SLANT: [number, number] = [-0.5, 0.42];
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
    const spectrum = frame.marks.find((m) => m.kind === 'spectrum');
    const polaroids = frame.picture && 'kind' in frame.picture && frame.picture.kind === 'polaroids';
    this.strip = frame.medium === 'air' || spectrum || (frame.medium === 'screen' && !polaroids) ? stripHeight() : frame.medium === 'capacitor' || polaroids ? pictureHeight() : 0;
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
      context.fillText(`${frame.yLabel ?? 'displacement'} (${frame.yUnit})`, margin().left, margin().top - 12 * k);
    }
    if (frame.xUnit) {
      context.textAlign = 'right';
      context.fillText(`${frame.xLabel ?? 'position'} (${frame.xUnit})`, width - this.right, labelRow + 15 * k);
    }

    const sum = series[series.length - 1]?.values;
    const at = (position: number): number => {
      if (!sum) return 0;
      const s = Math.min(Math.max(((position - x0) / (x1 - x0)) * (x.length - 1), 0), x.length - 1 - 1e-9);
      const i = Math.floor(s);
      return sum[i]! + (s - i) * (sum[i + 1]! - sum[i]!);
    };

    if (frame.medium === 'light' && frame.companion) this.magnetic(frame, toX, toY);

    for (const { values, color, width: lineWidth, fill, faint } of series) {
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
      context.globalAlpha = faint ? 0.3 : 1;
      context.stroke();
      context.globalAlpha = 1;
    }

    // The electric field as arrows from the axis, the way the textbook draws the wave.
    if (frame.medium === 'light' && frame.companion) {
      context.strokeStyle = cssVar('--accent');
      context.fillStyle = cssVar('--accent');
      context.lineWidth = 1.5 * k;
      const count = 48;
      for (let i = 0; i <= count; i++) {
        const position = x0 + ((x1 - x0) * i) / count;
        this.fieldArrow(toX(position), toY(0), 0, toY(at(position)) - toY(0));
      }
      const crest = this.firstCrest(sum, x);
      if (crest !== undefined) {
        context.font = labelFont();
        context.textAlign = 'left';
        context.fillText('E', toX(x[crest]!) + 8 * k, toY(sum![crest]!) - 6 * k);
      }
    }
    if (frame.medium === 'capacitor' && frame.picture && !('kind' in frame.picture)) this.capacitor(frame.picture, floor + 30 * k);
    if (frame.picture && 'kind' in frame.picture) {
      if (frame.picture.kind === 'fringes') this.fringes(frame.picture.values, frame.picture.color, floor + 26 * k);
      else this.polaroids(frame.picture, floor + 34 * k);
    }
    if (spectrum && spectrum.kind === 'spectrum') this.spectrum(spectrum, floor + 26 * k);

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

  /** The index of the first crest that has room for a letter beside it. */
  private firstCrest(values: Float64Array | undefined, x: Float64Array): number | undefined {
    if (!values) return undefined;
    for (let i = Math.floor(values.length * 0.04); i < values.length - 2; i++) {
      if (values[i]! > 0 && values[i]! >= values[i - 1]! && values[i]! > values[i + 1]! && x[i] !== undefined) return i;
    }
    return undefined;
  }

  /** A thin arrow from a point on the axis, `dx, dy` pixels long; nothing when it would be shorter than its head. */
  private fieldArrow(px: number, py: number, dx: number, dy: number): void {
    const { context } = this;
    const length = Math.hypot(dx, dy);
    const head = 5 * stageScale();
    context.beginPath();
    context.moveTo(px, py);
    context.lineTo(px + dx, py + dy);
    context.stroke();
    if (length < 2.2 * head) return;
    const [ux, uy] = [dx / length, dy / length];
    context.beginPath();
    context.moveTo(px + dx, py + dy);
    context.lineTo(px + dx - ux * head - uy * head * 0.5, py + dy - uy * head + ux * head * 0.5);
    context.lineTo(px + dx - ux * head + uy * head * 0.5, py + dy - uy * head - ux * head * 0.5);
    context.closePath();
    context.fill();
  }

  /**
   * The magnetic field of a light wave. It points out of the page, at right angles to the electric field and to
   * the direction of travel, so it is drawn along a slanting axis as a textbook draws the third dimension.
   */
  private magnetic(frame: Frame, toX: (v: number) => number, toY: (v: number) => number): void {
    const { context } = this;
    const { x } = frame;
    const b = frame.companion!;
    const k = stageScale();
    const pixels = this.plotHeight / (this.y1 - this.y0);
    const place = (i: number): [number, number] => [toX(x[i]!) + SLANT[0] * b[i]! * pixels, toY(0) + SLANT[1] * b[i]! * pixels];
    const color = cssVar('--force-magnetic');
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineJoin = 'round';
    context.lineWidth = 1.5 * k;
    const count = 48;
    for (let n = 0; n <= count; n++) {
      const i = Math.round(((x.length - 1) * n) / count);
      const [px, py] = place(i);
      this.fieldArrow(toX(x[i]!), toY(0), px - toX(x[i]!), py - toY(0));
    }
    context.lineWidth = 2.25 * k;
    context.beginPath();
    for (let i = 0; i < x.length; i++) {
      const [px, py] = place(i);
      i === 0 ? context.moveTo(px, py) : context.lineTo(px, py);
    }
    context.stroke();
    const crest = this.firstCrest(b, x);
    if (crest !== undefined) {
      const [px, py] = place(crest);
      context.font = labelFont();
      context.textAlign = 'right';
      context.fillText('B', px - 8 * k, py + 12 * k);
    }
  }

  /**
   * A capacitor charging, seen from the side: current in the wires, the plates filling with charge, the electric
   * field growing between them, and round the gap the magnetic field that the growing field makes.
   */
  private capacitor(picture: CapacitorPicture, top: number): void {
    const { context } = this;
    const k = stageScale();
    const middle = margin().left + this.plotWidth / 2;
    const [height, gap] = [84 * k, 200 * k];
    const y = top + height / 2;
    const [left, right] = [middle - gap / 2, middle + gap / 2];
    const wire = Math.min(this.plotWidth / 2 - gap / 2 - 10 * k, 230 * k);
    const ink = cssVar('--canvas-text');
    context.setLineDash([]);
    context.lineCap = 'butt';

    // Wires and the current in them.
    context.strokeStyle = cssVar('--canvas-rope');
    context.lineWidth = 2 * k;
    context.beginPath();
    context.moveTo(left - wire, y);
    context.lineTo(left, y);
    context.moveTo(right, y);
    context.lineTo(right + wire, y);
    context.stroke();
    const arrow = (from: number, to: number, color: string, dashed: boolean) => {
      context.strokeStyle = color;
      context.fillStyle = color;
      context.lineWidth = (1.5 + 3.5 * picture.current) * k;
      context.setLineDash(dashed ? [7 * k, 5 * k] : []);
      context.globalAlpha = 0.25 + 0.75 * picture.current;
      context.beginPath();
      context.moveTo(from, y - 14 * k);
      context.lineTo(to - 9 * k, y - 14 * k);
      context.stroke();
      context.setLineDash([]);
      context.beginPath();
      context.moveTo(to, y - 14 * k);
      context.lineTo(to - 11 * k, y - 20 * k);
      context.lineTo(to - 11 * k, y - 8 * k);
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
    };
    arrow(left - wire * 0.8, left - wire * 0.25, cssVar('--accent'), false);
    arrow(right + wire * 0.25, right + wire * 0.8, cssVar('--accent'), false);
    arrow(left + 16 * k, right - 16 * k, cssVar('--force-electric'), true);

    // The electric field between the plates, more of it as they charge.
    context.strokeStyle = cssVar('--force-electric');
    context.fillStyle = cssVar('--force-electric');
    context.lineWidth = 1.5 * k;
    context.globalAlpha = 0.15 + 0.75 * picture.charge;
    for (const offset of [0.12, 0.3, 0.72, 0.9]) {
      const row = top + height * offset;
      this.fieldArrow(left + 8 * k, row, (gap - 16 * k) * (0.25 + 0.75 * picture.charge), 0);
    }
    context.globalAlpha = 1;

    // The plates, and the charge on them.
    for (const [px, token, sign] of [[left, '--charge-positive', '+'], [right, '--charge-negative', '−']] as const) {
      context.strokeStyle = cssVar(token);
      context.fillStyle = cssVar(token);
      context.lineWidth = 5 * k;
      context.beginPath();
      context.moveTo(px, top);
      context.lineTo(px, top + height);
      context.stroke();
      context.font = stageFont(13, 700);
      context.textAlign = 'center';
      const shown = Math.round(picture.charge * 5);
      for (let i = 0; i < shown; i++) context.fillText(sign, px + (px === left ? -12 : 12) * k, top + ((i + 0.75) * height) / 5);
    }

    // The magnetic field circling the current, in the wire and in the gap alike: seen from the side, out of the
    // page above and into it below.
    context.strokeStyle = cssVar('--force-magnetic');
    context.fillStyle = cssVar('--force-magnetic');
    context.lineWidth = 1.5 * k;
    context.globalAlpha = 0.25 + 0.75 * picture.current;
    for (const px of [left - wire * 0.5, middle, right + wire * 0.5]) {
      const r = 5 * k;
      context.beginPath();
      context.arc(px, top - 2 * k, r, 0, 2 * Math.PI);
      context.stroke();
      context.beginPath();
      context.arc(px, top - 2 * k, 1.6 * k, 0, 2 * Math.PI);
      context.fill();
      context.beginPath();
      context.moveTo(px - r * 0.7, top + height + 2 * k - r * 0.7);
      context.lineTo(px + r * 0.7, top + height + 2 * k + r * 0.7);
      context.moveTo(px + r * 0.7, top + height + 2 * k - r * 0.7);
      context.lineTo(px - r * 0.7, top + height + 2 * k + r * 0.7);
      context.stroke();
    }
    context.globalAlpha = 1;

    context.fillStyle = ink;
    context.font = axisFont();
    context.textAlign = 'center';
    context.fillText('current', left - wire * 0.52, y + 18 * k);
    context.fillText('current', right + wire * 0.52, y + 18 * k);
    context.fillText('displacement current', middle, y + 5 * k);
    context.fillText('B circles wire and gap alike', middle, top + height + 17 * k);
  }

  /** The pattern as the eye would see it on the screen: bright where the graph is high, in the light's own colour. */
  private fringes(values: Float64Array, color: string, top: number): void {
    const { context } = this;
    const k = stageScale();
    const [left, width, height] = [margin().left, this.plotWidth, 24 * k];
    context.fillStyle = cssVar('--dark-room');
    context.fillRect(left, top, width, height);
    context.fillStyle = color;
    const columns = Math.max(1, Math.round(width));
    for (let c = 0; c < columns; c++) {
      const value = values[Math.min(values.length - 1, Math.round((c / columns) * (values.length - 1)))]!;
      // The eye and a screen both flatter faint light, so the side bands are shown a little brighter than they are.
      context.globalAlpha = Math.min(1, Math.max(0, value) ** 0.6);
      context.fillRect(left + c, top, 1.5, height);
    }
    context.globalAlpha = 1;
  }

  /** Light going through two polaroids: each a disc with its axis marked, and a patch showing how bright the light is after it. */
  private polaroids(picture: Extract<Picture, { kind: 'polaroids' }>, top: number): void {
    const { context } = this;
    const k = stageScale();
    const middle = top + 34 * k;
    const [left, width] = [margin().left, this.plotWidth];
    const stops = [0.12, 0.38, 0.64, 0.9].map((share) => left + share * width);
    const ink = cssVar('--canvas-text');
    const beam = (from: number, to: number, share: number) => {
      // Brightness as a thickness and a strength of colour, so that no light is plainly no beam.
      if (share <= 0.002) return;
      context.strokeStyle = cssVar('--accent');
      context.globalAlpha = 0.25 + 0.75 * Math.sqrt(share);
      context.lineWidth = (2 + 14 * share) * k;
      context.lineCap = 'butt';
      context.beginPath();
      context.moveTo(from, middle);
      context.lineTo(to, middle);
      context.stroke();
      context.globalAlpha = 1;
    };
    beam(stops[0]!, stops[1]!, 1);
    beam(stops[1]!, stops[2]!, picture.afterFirst);
    beam(stops[2]!, stops[3]!, picture.afterSecond);
    const disc = (x: number, degrees: number, label: string) => {
      const r = 26 * k;
      context.fillStyle = cssVar('--surface');
      context.strokeStyle = ink;
      context.lineWidth = 2 * k;
      context.beginPath();
      context.ellipse(x, middle, r * 0.45, r, 0, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
      // The axis the polaroid lets vibrations through along, turned from the vertical.
      const turn = (degrees * Math.PI) / 180;
      context.strokeStyle = cssVar('--text');
      context.lineWidth = 2.5 * k;
      context.beginPath();
      context.moveTo(x - Math.sin(turn) * r * 0.42, middle - Math.cos(turn) * r * 0.92);
      context.lineTo(x + Math.sin(turn) * r * 0.42, middle + Math.cos(turn) * r * 0.92);
      context.stroke();
      context.fillStyle = ink;
      context.font = axisFont();
      context.textAlign = 'center';
      context.fillText(label, x, middle + r + 15 * k);
    };
    disc(stops[1]!, 0, 'first polaroid');
    disc(stops[2]!, picture.angle, `second, turned ${Math.round(picture.angle)}°`);
    context.fillStyle = ink;
    context.font = axisFont();
    context.textAlign = 'center';
    context.fillText('unpolarised light', stops[0]!, middle - 18 * k);
    const percent = (share: number) => `${Math.round(share * 100)} %`;
    context.fillText(percent(picture.afterFirst), (stops[1]! + stops[2]!) / 2, middle - 18 * k);
    context.fillText(percent(picture.afterSecond), (stops[2]! + stops[3]!) / 2 + 20 * k, middle - 18 * k);
  }

  /** The whole spectrum on one line, a power of ten at a time, with a pointer at the frequency in hand. */
  private spectrum(mark: Extract<Mark, { kind: 'spectrum' }>, top: number): void {
    const { context } = this;
    const k = stageScale();
    const [from, to] = [4, 22];
    const [left, width] = [margin().left, this.plotWidth];
    const place = (power: number) => left + ((Math.min(Math.max(power, from), to) - from) / (to - from)) * width;
    const height = 14 * k;
    context.setLineDash([]);
    context.font = axisFont();
    context.textBaseline = 'alphabetic';
    mark.bands.forEach((band, i) => {
      const [a, b] = [place(band.from > 0 ? Math.log10(band.from) : from), place(mark.bands[i + 1] ? Math.log10(mark.bands[i + 1]!.from) : to)];
      const current = mark.power >= (band.from > 0 ? Math.log10(band.from) : from) && (!mark.bands[i + 1] || mark.power < Math.log10(mark.bands[i + 1]!.from));
      if (band.name === 'Visible light') {
        // The one band the eye sorts by colour: red at the low-frequency end, violet at the high.
        const gradient = context.createLinearGradient(a, 0, b, 0);
        for (let s = 0; s <= 6; s++) gradient.addColorStop(s / 6, `hsl(${(s / 6) * 270} 85% 50%)`);
        context.fillStyle = gradient;
      } else {
        context.fillStyle = cssVar(i % 2 ? '--canvas-grid-major' : '--canvas-grid');
      }
      context.fillRect(a, top, Math.max(b - a, 3 * k), height);
      context.strokeStyle = cssVar('--canvas-axis');
      context.lineWidth = 1;
      context.strokeRect(a + 0.5, top + 0.5, Math.max(b - a, 3 * k), height);
      context.fillStyle = cssVar(current ? '--text' : '--canvas-text');
      context.font = current ? labelFont() : axisFont();
      context.textAlign = 'center';
      const name = band.name.replace(' waves', '').replace(' light', '').replace(' rays', '');
      // The visible band is a sliver: its name goes above it, clear of its neighbours.
      context.fillText(name, (a + b) / 2, band.name === 'Visible light' ? top - 5 * k : top + height + 14 * k);
    });
    const px = place(mark.power);
    context.fillStyle = cssVar('--text');
    context.beginPath();
    context.moveTo(px, top + height + 1);
    context.lineTo(px - 6 * k, top + height + 9 * k);
    context.lineTo(px + 6 * k, top + height + 9 * k);
    context.closePath();
    context.fill();
    context.fillRect(px - k, top - 3 * k, 2 * k, height + 4 * k);
  }

  private mark(mark: Mark, toX: (v: number) => number, toY: (v: number) => number, floor: number, at: (x: number) => number): void {
    const { context } = this;
    const ink = cssVar('--text');
    context.font = labelFont();
    context.lineWidth = 1.5 * stageScale();
    context.setLineDash([]);
    if (mark.kind === 'spectrum') return;
    if (mark.kind === 'now') {
      const px = toX(mark.x);
      context.strokeStyle = ink;
      context.fillStyle = ink;
      context.beginPath();
      context.moveTo(px, margin().top);
      context.lineTo(px, floor);
      context.stroke();
      context.beginPath();
      context.arc(px, toY(at(mark.x)), 5.5 * stageScale(), 0, 2 * Math.PI);
      context.fill();
      context.textAlign = px > margin().left + this.plotWidth - 60 ? 'right' : 'left';
      context.fillText('now', px + (context.textAlign === 'left' ? 8 : -8), margin().top + 14 * stageScale());
      return;
    }
    if (mark.kind === 'heading') {
      // Which way the wave is going, and at what speed, in the corner clear of the curve.
      const k = stageScale();
      const [tip, y] = [margin().left + this.plotWidth - 8 * k, margin().top + 14 * k];
      const tail = tip - 64 * k;
      const [a, b] = mark.direction > 0 ? [tail, tip] : [tip, tail];
      context.strokeStyle = ink;
      context.fillStyle = ink;
      context.lineWidth = 2 * k;
      context.beginPath();
      context.moveTo(a, y);
      context.lineTo(b, y);
      context.moveTo(b - mark.direction * 8 * k, y - 5 * k);
      context.lineTo(b, y);
      context.lineTo(b - mark.direction * 8 * k, y + 5 * k);
      context.stroke();
      context.textAlign = 'right';
      context.fillText(mark.label, tail - 8 * k, y + 4 * k);
      return;
    }
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
