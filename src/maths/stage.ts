import { cssVar, formatNumber, stageFont, stageScale } from '../ui';
import { Plane } from './plane';

/** What a matrix stage draws, besides the matrix itself. */
export interface Show {
  grid: boolean;
  eigen: boolean;
  circle: boolean;
}

type Point = [number, number];

function arrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, colour: string, label: string): void {
  const s = stageScale();
  const [x0, y0] = from;
  const [x1, y1] = to;
  const length = Math.hypot(x1 - x0, y1 - y0);
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  if (length > 1) {
    const ux = (x1 - x0) / length;
    const uy = (y1 - y0) / length;
    // the head never shrinks below a size that can be seen from the back of a classroom
    const head = 14 * s;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 - ux * head * 0.8, y1 - uy * head * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - ux * head - uy * head * 0.5, y1 - uy * head + ux * head * 0.5);
    ctx.lineTo(x1 - ux * head + uy * head * 0.5, y1 - uy * head - ux * head * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  plate(ctx, label, x1 + 10 * s, y1 - 10 * s, colour);
}

/** A label on a plate with a bar of its colour, as the physics arrows are labelled. */
function plate(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour: string): void {
  const s = stageScale();
  ctx.font = stageFont(14, 600);
  const w = ctx.measureText(text).width + 16 * s;
  const h = 24 * s;
  const left = Math.min(Math.max(x, 4), ctx.canvas.clientWidth - w - 4);
  const top = Math.min(Math.max(y - h, 4), ctx.canvas.clientHeight - h - 4);
  ctx.fillStyle = cssVar('--surface');
  ctx.strokeStyle = cssVar('--border-strong');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, 6 * s);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.fillRect(left, top + 4 * s, 4 * s, h - 8 * s);
  ctx.fillStyle = cssVar('--text');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + 9 * s, top + h / 2);
}

/** Real eigenpairs of a 2×2 matrix of numbers, for drawing. */
function eigen2(m: number[]): { value: number; direction: Point }[] {
  const [a, b, c, d] = m as [number, number, number, number];
  const trace = a + d;
  const det = a * d - b * c;
  const disc = trace * trace - 4 * det;
  if (disc < -1e-12) return [];
  const root = Math.sqrt(Math.max(0, disc));
  const values = root < 1e-12 ? [trace / 2] : [(trace + root) / 2, (trace - root) / 2];
  const pairs: { value: number; direction: Point }[] = [];
  for (const value of values) {
    // a row of A − λI is perpendicular to the eigenvector
    const rows: Point[] = [[a - value, b], [c, d - value]];
    const row = rows.reduce((p, q) => (Math.hypot(...q) > Math.hypot(...p) ? q : p));
    if (Math.hypot(...row) < 1e-12) {
      // A = λI: every direction is kept
      pairs.push({ value, direction: [1, 0] }, { value, direction: [0, 1] });
      continue;
    }
    const direction: Point = [-row[1], row[0]];
    const size = Math.hypot(...direction);
    pairs.push({ value, direction: [direction[0] / size, direction[1] / size] });
  }
  return pairs;
}

/** A 2×2 matrix acting on the plane. */
export class PlaneStage {
  readonly plane: Plane;
  private ctx: CanvasRenderingContext2D;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.plane = new Plane(canvas);
    this.ctx = canvas.getContext('2d')!;
  }

  /** The screen position of the tips of the two column arrows. */
  tips(m: number[]): [Point, Point] {
    return [this.plane.toScreen(m[0]!, m[2]!), this.plane.toScreen(m[1]!, m[3]!)];
  }

  draw(m: number[], show: Show): void {
    const { ctx, plane } = this;
    plane.draw({ curves: [], areas: [], markers: [] });
    const [a, b, c, d] = m as [number, number, number, number];
    const map = (x: number, y: number): Point => plane.toScreen(a * x + b * y, c * x + d * y);
    const s = stageScale();
    const det = a * d - b * c;

    if (show.grid) {
      const reach = 24;
      ctx.lineWidth = 1.2 * s;
      for (let k = -reach; k <= reach; k++) {
        ctx.strokeStyle = cssVar('--accent');
        ctx.globalAlpha = k === 0 ? 0.6 : 0.22;
        ctx.beginPath();
        let [x, y] = map(k, -reach);
        ctx.moveTo(x, y);
        [x, y] = map(k, reach);
        ctx.lineTo(x, y);
        [x, y] = map(-reach, k);
        ctx.moveTo(x, y);
        [x, y] = map(reach, k);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // the unit square before (dashed) and after (shaded), its colour saying whether it was turned over
    const square: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    ctx.setLineDash([5 * s, 5 * s]);
    ctx.strokeStyle = cssVar('--canvas-axis');
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    square.forEach(([x, y], i) => {
      const [px, py] = plane.toScreen(x, y);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    const flipped = det < 0;
    const shade = flipped ? cssVar('--series-2') : cssVar('--series-1');
    ctx.fillStyle = shade;
    ctx.strokeStyle = shade;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    square.forEach(([x, y], i) => {
      const [px, py] = map(x, y);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    const [cx, cy] = map(0.5, 0.5);
    ctx.font = stageFont(13, 600);
    ctx.fillStyle = cssVar('--text');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (Math.abs(det) > 1e-9) ctx.fillText(`area ${formatNumber(Math.abs(det))}${flipped ? ', turned over' : ''}`, cx, cy);
    else ctx.fillText('area 0: flattened', cx, cy);

    if (show.circle) {
      ctx.lineWidth = 2 * s;
      for (const [colour, dashed, apply] of [
        [cssVar('--canvas-axis'), true, (x: number, y: number) => plane.toScreen(x, y)],
        [cssVar('--series-4'), false, map],
      ] as const) {
        ctx.strokeStyle = colour;
        ctx.setLineDash(dashed ? [5 * s, 5 * s] : []);
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const angle = (i / 120) * Math.PI * 2;
          const [px, py] = apply(Math.cos(angle), Math.sin(angle));
          if (i) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    if (show.eigen) {
      const b2 = plane.bounds();
      const far = 4 * Math.max(b2.right - b2.left, b2.top - b2.bottom);
      for (const { value, direction } of eigen2(m)) {
        const [ux, uy] = direction;
        const [x0, y0] = plane.toScreen(-ux * far, -uy * far);
        const [x1, y1] = plane.toScreen(ux * far, uy * far);
        ctx.strokeStyle = cssVar('--series-5');
        ctx.lineWidth = 2 * s;
        ctx.setLineDash([10 * s, 6 * s]);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.setLineDash([]);
        // where on screen to put the label: along the line, inside the view
        const reach = 0.42 * Math.min(b2.right - b2.left, b2.top - b2.bottom);
        const [lx, ly] = plane.toScreen(plane.camera.x + ux * reach, plane.camera.y + uy * reach);
        plate(ctx, `λ = ${Number(value.toFixed(3))}`.replace('-', '−'), lx, ly, cssVar('--series-5'));
      }
    }

    const origin = plane.toScreen(0, 0);
    const [i, j] = this.tips(m);
    arrow(ctx, origin, i, cssVar('--series-1'), 'A î');
    arrow(ctx, origin, j, cssVar('--series-3'), 'A ĵ');
  }
}

type Vec3 = [number, number, number];

/** A 3×3 matrix acting on space: the unit cube and its image, turned by dragging. */
export class SpaceStage {
  yaw = -0.6;
  pitch = 0.45;
  zoom = 1;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(): void {
    const ratio = devicePixelRatio || 1;
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  /** Where the middle of the free space is, so the picture sits between the panels. */
  centre: [number, number] = [0, 0];

  private project([x, y, z]: Vec3): [number, number, number] {
    // z up, as in the textbook's figures
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const rx = cy * x - sy * y;
    const ry = sy * x + cy * y;
    const depth = cp * ry + sp * z;
    const up = -sp * ry + cp * z;
    const scale = 70 * this.zoom * stageScale();
    return [this.centre[0] + rx * scale, this.centre[1] - up * scale, depth];
  }

  draw(m: number[]): void {
    const { ctx } = this;
    const s = stageScale();
    ctx.clearRect(0, 0, this.width, this.height);
    const apply = ([x, y, z]: Vec3): Vec3 => [
      m[0]! * x + m[1]! * y + m[2]! * z,
      m[3]! * x + m[4]! * y + m[5]! * z,
      m[6]! * x + m[7]! * y + m[8]! * z,
    ];

    // axes, with their letters
    const reach = 3.2;
    ctx.lineWidth = 1.5 * s;
    ctx.strokeStyle = cssVar('--canvas-axis');
    ctx.fillStyle = cssVar('--canvas-text');
    ctx.font = stageFont(13, 600);
    for (const [axis, name] of [[[1, 0, 0], 'x'], [[0, 1, 0], 'y'], [[0, 0, 1], 'z']] as [Vec3, string][]) {
      const [x0, y0] = this.project(axis.map((v) => -v * reach) as Vec3);
      const [x1, y1] = this.project(axis.map((v) => v * reach) as Vec3);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.fillText(name, x1 + 6 * s, y1);
    }

    const corners: Vec3[] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
    const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

    // the unit cube, dashed
    ctx.setLineDash([4 * s, 4 * s]);
    ctx.strokeStyle = cssVar('--canvas-axis');
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    for (const [p, q] of edges) {
      const [x0, y0] = this.project(corners[p!]!);
      const [x1, y1] = this.project(corners[q!]!);
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // its image, faces painted back to front
    const det =
      m[0]! * (m[4]! * m[8]! - m[5]! * m[7]!) - m[1]! * (m[3]! * m[8]! - m[5]! * m[6]!) + m[2]! * (m[3]! * m[7]! - m[4]! * m[6]!);
    const shade = det < 0 ? cssVar('--series-2') : cssVar('--series-1');
    const image = corners.map((c) => this.project(apply(c)));
    const ordered = faces
      .map((f) => ({ f, depth: f.reduce((sum, k) => sum + image[k]![2], 0) / 4 }))
      .sort((a, b) => b.depth - a.depth);
    for (const { f } of ordered) {
      ctx.beginPath();
      f.forEach((k, i) => {
        const [x, y] = image[k]!;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = shade;
      ctx.globalAlpha = 0.13;
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = shade;
      ctx.lineWidth = 1.6 * s;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const origin = this.project([0, 0, 0]);
    const columns: [Vec3, string, string][] = [
      [[m[0]!, m[3]!, m[6]!], cssVar('--series-1'), 'A î'],
      [[m[1]!, m[4]!, m[7]!], cssVar('--series-3'), 'A ĵ'],
      [[m[2]!, m[5]!, m[8]!], cssVar('--series-4'), 'A k̂'],
    ];
    for (const [column, colour, label] of columns) {
      const [x, y] = this.project(column);
      arrow(ctx, [origin[0], origin[1]], [x, y], colour, label);
    }
    ctx.font = stageFont(14, 600);
    ctx.fillStyle = cssVar('--text');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const [vx, vy] = this.project(apply([0.5, 0.5, 0.5]));
    ctx.textAlign = 'center';
    ctx.fillText(Math.abs(det) > 1e-9 ? `volume ${formatNumber(Math.abs(det))}${det < 0 ? ', turned over' : ''}` : 'volume 0: flattened', vx, vy);
  }
}
