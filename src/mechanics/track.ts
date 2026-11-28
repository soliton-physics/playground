// Smooth tracks: lines and circular arcs joined end to end. The engine collides with them exactly; the playground
// only needs to draw them, hit-test them and build the sandbox's curved ramp.

import type { BodySpec, TrackPiece, TrackSegmentInfo, Vec } from './types';

/** Points along the centre line in the track's own frame, no further apart than `step` along any arc. */
export function centreLine(segments: TrackSegmentInfo[], step: number): Vec[] {
  const points: Vec[] = [];
  for (const segment of segments) {
    if (segment.kind === 'line') {
      if (points.length === 0) points.push(segment.from);
      points.push(segment.to);
      continue;
    }
    const { center, radius, start, sweep } = segment;
    // At least a few points on any arc, and a step of at most 5° so a big arc stays round on screen.
    const n = Math.max(4, Math.ceil(Math.abs(sweep) / Math.min(5 * (Math.PI / 180), step / radius)));
    for (let k = points.length === 0 ? 0 : 1; k <= n; k++) {
      const a = start + (sweep * k) / n;
      points.push([center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)]);
    }
  }
  return points;
}

/** Points in a body's frame carried into the world by its position and angle. */
export function placed(points: Vec[], x: number, y: number, angle: number): Vec[] {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return points.map(([px, py]): Vec => [x + px * cos - py * sin, y + px * sin + py * cos]);
}

/** Distance from a point to the centre line, both in the track's own frame. */
export function distanceTo(segments: TrackSegmentInfo[], [x, y]: Vec): number {
  let best = Infinity;
  for (const s of segments) {
    if (s.kind === 'line') {
      const [ex, ey] = [s.to[0] - s.from[0], s.to[1] - s.from[1]];
      const t = Math.min(1, Math.max(0, ((x - s.from[0]) * ex + (y - s.from[1]) * ey) / (ex * ex + ey * ey)));
      best = Math.min(best, Math.hypot(x - s.from[0] - ex * t, y - s.from[1] - ey * t));
      continue;
    }
    const polar = Math.atan2(y - s.center[1], x - s.center[0]);
    const turned = (((Math.sign(s.sweep) * (polar - s.start)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (turned <= Math.abs(s.sweep)) {
      best = Math.min(best, Math.abs(Math.hypot(x - s.center[0], y - s.center[1]) - s.radius));
    } else {
      for (const a of [s.start, s.start + s.sweep]) {
        best = Math.min(best, Math.hypot(x - s.center[0] - s.radius * Math.cos(a), y - s.center[1] - s.radius * Math.sin(a)));
      }
    }
  }
  return best;
}

/** How one side of the sandbox's ramp rises from the floor: a smooth curve, or a vertical wall in a sharp corner. */
export type Side = 'curve' | 'wall';

/**
 * The sandbox's curved ramp: a valley with a flat floor and a side rising from each end. A curved side is a circular
 * arc turning through `side` radians: a quarter turn ends vertical, less makes a shallow dish. A vertical side is a
 * wall as high as a curved side would be, `radius (1 − cos side)`.
 */
export interface Valley {
  /** The lowest point of the centre line, the middle of the floor. */
  bottom: Vec;
  radius: number;
  side: number;
  flat: number;
  left: Side;
  right: Side;
}

const QUARTER = Math.PI / 2;

/** How high both sides rise above the floor. */
export function valleyHeight(v: Pick<Valley, 'radius' | 'side'>): number {
  return v.radius * (1 - Math.cos(v.side));
}

/** The track pieces and placement for a valley. The track starts at the top of the left side, heading down into it. */
export function valleyBody(valley: Valley): Pick<BodySpec, 'position' | 'angle'> & { pieces: TrackPiece[] } {
  const { bottom, radius, side, left, right } = valley;
  const height = valleyHeight(valley);
  // Two vertical walls cannot meet in one corner: a floor keeps them apart.
  const flat = left === 'wall' && right === 'wall' ? Math.max(valley.flat, 0.05 * radius) : valley.flat;
  const curve: TrackPiece = { arc: { radius, angle: side } };
  const pieces: TrackPiece[] = [];
  if (left === 'curve') pieces.push(curve);
  else pieces.push({ line: height }, { corner: QUARTER });
  if (flat > 0) pieces.push({ line: flat });
  if (right === 'curve') pieces.push(curve);
  else pieces.push({ corner: QUARTER }, { line: height });
  const position: Vec =
    left === 'curve' ? [bottom[0] - flat / 2 - radius * Math.sin(side), bottom[1] + height] : [bottom[0] - flat / 2, bottom[1] + height];
  return { position, angle: left === 'curve' ? -side : -QUARTER, pieces };
}

/** A track body read back as a valley, if that is what it is; otherwise undefined. */
export function asValley(spec: BodySpec): Valley | undefined {
  if (!('track' in spec.shape)) return undefined;
  const p = spec.shape.track.pieces;
  const isCorner = (q: TrackPiece | undefined) => q !== undefined && 'corner' in q && Math.abs(q.corner - QUARTER) < 1e-9;
  let [from, to] = [0, p.length];
  let left: Side, right: Side;
  const curves: { radius: number; angle: number }[] = [];
  const first = p[0];
  if (first && 'arc' in first) [left, from] = ['curve', 1];
  else if (first && 'line' in first && isCorner(p[1])) [left, from] = ['wall', 2];
  else return undefined;
  const last = p[p.length - 1];
  if (last && 'arc' in last) [right, to] = ['curve', p.length - 1];
  else if (last && 'line' in last && isCorner(p[p.length - 2])) [right, to] = ['wall', p.length - 2];
  else return undefined;
  if (from > to) return undefined;
  const middle = p.slice(from, to);
  if (middle.length > 1 || (middle[0] && !('line' in middle[0]))) return undefined;
  const flat = middle[0] && 'line' in middle[0] ? middle[0].line : 0;
  if (left === 'curve' && first && 'arc' in first) curves.push(first.arc);
  if (right === 'curve' && last && 'arc' in last) curves.push(last.arc);
  let radius: number, side: number;
  if (curves.length > 0) {
    ({ radius, angle: side } = curves[0]!);
    if (side <= 0 || curves.some((c) => c.radius !== radius || c.angle !== side)) return undefined;
  } else {
    // Two walls: read their height as a quarter circle's.
    radius = first && 'line' in first ? first.line : 0;
    side = QUARTER;
  }
  const height = valleyHeight({ radius, side });
  if (left === 'wall' && first && 'line' in first && Math.abs(first.line - height) > 1e-9 * Math.max(1, height)) return undefined;
  if (right === 'wall' && last && 'line' in last && Math.abs(last.line - height) > 1e-9 * Math.max(1, height)) return undefined;
  const angle = spec.angle ?? 0;
  if (Math.abs(angle - (left === 'curve' ? -side : -QUARTER)) > 1e-9) return undefined;
  const [x, y] = spec.position ?? [0, 0];
  const across = left === 'curve' ? flat / 2 + radius * Math.sin(side) : flat / 2;
  return { bottom: [x + across, y - height], radius, side, flat, left, right };
}

/** A track's pieces laid out in its own frame, as the engine does: from the origin heading along +x. */
export function layout(pieces: TrackPiece[]): TrackSegmentInfo[] {
  const segments: TrackSegmentInfo[] = [];
  let [x, y, heading] = [0, 0, 0];
  for (const piece of pieces) {
    if ('corner' in piece) {
      heading += piece.corner;
      continue;
    }
    if ('line' in piece) {
      const to: Vec = [x + piece.line * Math.cos(heading), y + piece.line * Math.sin(heading)];
      segments.push({ kind: 'line', from: [x, y], to });
      [x, y] = to;
      continue;
    }
    const { radius, angle } = piece.arc;
    // The centre is on the side the arc turns towards.
    const side = Math.sign(angle);
    const center: Vec = [x - Math.sin(heading) * radius * side, y + Math.cos(heading) * radius * side];
    const start = Math.atan2(y - center[1], x - center[0]);
    segments.push({ kind: 'arc', center, radius, start, sweep: angle });
    [x, y] = [center[0] + radius * Math.cos(start + angle), center[1] + radius * Math.sin(start + angle)];
    heading += angle;
  }
  return segments;
}

/** A place on a track: which segment, how far along it from 0 to 1, and how far off its centre line to the left. */
interface Spot {
  segment: number;
  along: number;
  offset: number;
}

/** The point on a segment `along` of the way, and the unit normal to the left of travel there. */
function pointOn(s: TrackSegmentInfo, along: number): { point: Vec; left: Vec } {
  if (s.kind === 'line') {
    const [ex, ey] = [s.to[0] - s.from[0], s.to[1] - s.from[1]];
    const length = Math.hypot(ex, ey);
    return { point: [s.from[0] + ex * along, s.from[1] + ey * along], left: [-ey / length, ex / length] };
  }
  const a = s.start + s.sweep * along;
  const out: Vec = [Math.cos(a), Math.sin(a)];
  // Turning left, the left is towards the centre; turning right, away from it.
  const left: Vec = s.sweep > 0 ? [-out[0], -out[1]] : out;
  return { point: [s.center[0] + s.radius * out[0], s.center[1] + s.radius * out[1]], left };
}

function locate(segments: TrackSegmentInfo[], [x, y]: Vec): Spot {
  let best: Spot & { distance: number } = { segment: 0, along: 0, offset: 0, distance: Infinity };
  segments.forEach((s, segment) => {
    let along: number;
    if (s.kind === 'line') {
      const [ex, ey] = [s.to[0] - s.from[0], s.to[1] - s.from[1]];
      along = Math.min(1, Math.max(0, ((x - s.from[0]) * ex + (y - s.from[1]) * ey) / (ex * ex + ey * ey)));
    } else {
      const polar = Math.atan2(y - s.center[1], x - s.center[0]);
      const turned = (((Math.sign(s.sweep) * (polar - s.start)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const sweep = Math.abs(s.sweep);
      // Past either end, the nearer end.
      along = turned <= sweep ? turned / sweep : turned - sweep < 2 * Math.PI - turned ? 1 : 0;
    }
    const { point, left } = pointOn(s, along);
    const distance = Math.hypot(x - point[0], y - point[1]);
    if (distance < best.distance) best = { segment, along, offset: (x - point[0]) * left[0] + (y - point[1]) * left[1], distance };
  });
  return best;
}

function segmentLength(s: TrackSegmentInfo): number {
  return s.kind === 'line' ? Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]) : s.radius * Math.abs(s.sweep);
}

/** A valley's segments named by the part of the ramp each one is. */
function roles(pieces: TrackPiece[]): ('left' | 'floor' | 'right')[] {
  return layout(pieces).length === 3 ? ['left', 'floor', 'right'] : ['left', 'right'];
}

/** What a valley's shape is, as far as following its surface goes. */
export interface Placement {
  pieces: TrackPiece[];
  thickness: number;
}

/**
 * Carries a point stuck to a valley through a change of its shape: it stays on the same part of the ramp and on the
 * same face, the same fraction of the way along a curve or the floor, and the same height up a vertical wall. A point on the floor of a ramp whose floor goes away lands where
 * the two sides now meet. Points are in the track's own frame before and after.
 */
export function followValley(before: Placement, after: Placement, local: Vec): Vec {
  const [old, now] = [layout(before.pieces), layout(after.pieces)];
  const [was, will] = [roles(before.pieces), roles(after.pieces)];
  // Points are kept in the track's own frame, so the spot is found and placed there, whatever the frame does.
  const spot = locate(old, local);
  const role = was[spot.segment]!;
  let segment = will.indexOf(role);
  let along = spot.along;
  if (segment < 0) [segment, along] = [0, 1];
  else if (role !== 'floor' && old[spot.segment]!.kind === 'line' && now[segment]!.kind === 'line') {
    // On a vertical wall, the same height above the floor: a spring tied level with a block stays level. The left
    // wall runs down to the floor and the right one up from it.
    const [from, to] = [segmentLength(old[spot.segment]!), segmentLength(now[segment]!)];
    const height = role === 'left' ? (1 - along) * from : along * from;
    const kept = Math.min(height, to) / to;
    along = role === 'left' ? 1 - kept : kept;
  }
  // A point on the surface stays on the surface when the track gets thicker or thinner.
  const [half0, half1] = [before.thickness / 2, after.thickness / 2];
  const offset = Math.abs(Math.abs(spot.offset) - half0) < 1e-6 + 0.02 * half0 ? Math.sign(spot.offset) * half1 : spot.offset;
  const { point, left } = pointOn(now[segment]!, along);
  return [point[0] + left[0] * offset, point[1] + left[1] * offset];
}

/** Points `step` apart along a path, measured along it, keeping both ends. */
function resample(points: Vec[], step: number): Vec[] {
  const out: Vec[] = [points[0]!];
  let carried = 0;
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1]!, points[i]!];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let along = step - carried;
    while (along <= length) {
      out.push([a[0] + ((b[0] - a[0]) * along) / length, a[1] + ((b[1] - a[1]) * along) / length]);
      along += step;
    }
    carried = length - (along - step);
  }
  const last = points[points.length - 1]!;
  const end = out[out.length - 1]!;
  if (Math.hypot(last[0] - end[0], last[1] - end[1]) > 0.25 * step) out.push(last);
  else out[out.length - 1] = last;
  return out;
}

/** A hand-drawn path with its wobble taken out: each point averaged with its neighbours, the ends kept. */
function smooth(points: Vec[], passes: number): Vec[] {
  let p = points;
  for (let k = 0; k < passes; k++) {
    p = p.map((q, i) => (i === 0 || i === p.length - 1 ? q : [(p[i - 1]![0] + 2 * q[0] + p[i + 1]![0]) / 4, (p[i - 1]![1] + 2 * q[1] + p[i + 1]![1]) / 4]));
  }
  return p;
}

/** A drawn turn sharper than this, over a short stretch, is a corner, not a curve. */
const SHARP = (55 * Math.PI) / 180;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const heading = (a: Vec, b: Vec) => Math.atan2(b[1] - a[1], b[0] - a[0]);

/**
 * Where a drawn path turns sharply: the sharpest point of each stretch where the direction over a short span changes
 * by more than `SHARP`. Found before any smoothing, which would round them off.
 */
function corners(points: Vec[]): number[] {
  const span = 2;
  const turn = (i: number) => Math.abs(wrap(heading(points[i]!, points[i + span]!) - heading(points[i - span]!, points[i]!)));
  const found: number[] = [];
  for (let i = span; i + span < points.length; i++) {
    if (turn(i) <= SHARP) continue;
    const previous = found[found.length - 1];
    if (previous !== undefined && i - previous <= 2 * span) {
      if (turn(i) > turn(previous)) found[found.length - 1] = i;
    } else found.push(i);
  }
  return found;
}

/**
 * A track through a path drawn by hand. Sharp turns become corners; each stretch between them is smoothed and laid as
 * a chain of circular arcs, each leaving in the direction the last one arrived and passing exactly through the next
 * point. `step` is the spacing of the points the track passes through.
 */
export function trackThrough(drawn: Vec[], step: number): { position: Vec; angle: number; pieces: TrackPiece[] } | undefined {
  if (drawn.length < 2) return undefined;
  const fine = resample(drawn, step / 2);
  if (fine.length < 2) return undefined;
  const cuts = [0, ...corners(fine), fine.length - 1];
  const stretches = cuts
    .slice(1)
    .map((end, k) => fine.slice(cuts[k]!, end + 1))
    .filter((part) => part.length >= 2)
    .map((part) => resample(smooth(part, 3), step));
  const pieces: TrackPiece[] = [];
  const first = stretches[0]!;
  const startHeading = heading(first[0]!, first[1]!);
  let direction = startHeading;
  for (const points of stretches) {
    for (let i = 0; i + 1 < points.length; i++) {
      const [a, b] = [points[i]!, points[i + 1]!];
      const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (chord < 1e-9) continue;
      let turn = wrap(heading(a, b) - direction);
      // The first chord after a corner sets the new direction: the corner turns onto it.
      if (i === 0 && pieces.length > 0 && Math.abs(turn) > 1e-4) {
        if (Math.abs(turn) < Math.PI - 1e-3) {
          pieces.push({ corner: turn });
          direction += turn;
        }
        turn = 0;
      }
      if (Math.abs(turn) < 1e-4) {
        const last = pieces[pieces.length - 1];
        if (last && 'line' in last) last.line += chord;
        else pieces.push({ line: chord });
      } else {
        // The circle that leaves along the heading and passes through the next point turns twice the chord's angle.
        pieces.push({ arc: { radius: chord / (2 * Math.sin(Math.abs(turn))), angle: 2 * turn } });
        direction += 2 * turn;
      }
    }
  }
  // A track cannot end on a corner.
  while (pieces.length && 'corner' in pieces[pieces.length - 1]!) pieces.pop();
  return pieces.length ? { position: first[0]!, angle: startHeading, pieces } : undefined;
}
