// Finding the edge of a body near a point, so a rope, rod or spring end clicked just beside a body joins it.

import { STATE_STRIDE, type BodyInfo, type ShapeInfo, type TrackSegmentInfo, type Vec } from './types';

/** The point of a track's centre line nearest `p`, both in the track's own frame. */
function nearestOnTrack(segments: TrackSegmentInfo[], [x, y]: Vec): Vec {
  let best: Vec = [Infinity, Infinity];
  const consider = (q: Vec) => {
    if (Math.hypot(q[0] - x, q[1] - y) < Math.hypot(best[0] - x, best[1] - y)) best = q;
  };
  for (const s of segments) {
    if (s.kind === 'line') {
      const [ex, ey] = [s.to[0] - s.from[0], s.to[1] - s.from[1]];
      const t = Math.min(1, Math.max(0, ((x - s.from[0]) * ex + (y - s.from[1]) * ey) / (ex * ex + ey * ey)));
      consider([s.from[0] + ex * t, s.from[1] + ey * t]);
      continue;
    }
    const polar = Math.atan2(y - s.center[1], x - s.center[0]);
    const turned = (((Math.sign(s.sweep) * (polar - s.start)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const angles = turned <= Math.abs(s.sweep) ? [polar] : [s.start, s.start + s.sweep];
    for (const a of angles) consider([s.center[0] + s.radius * Math.cos(a), s.center[1] + s.radius * Math.sin(a)]);
  }
  return best;
}

/** The point on a shape's surface nearest `p`, in the shape's own frame. */
function nearestOnSurface(shape: ShapeInfo, [x, y]: Vec): Vec {
  switch (shape.kind) {
    case 'circle': {
      const d = Math.hypot(x, y);
      return d === 0 ? [shape.radius, 0] : [(x / d) * shape.radius, (y / d) * shape.radius];
    }
    case 'polygon': {
      let best: Vec = [Infinity, Infinity];
      const v = shape.vertices;
      v.forEach((a, i) => {
        const b = v[(i + 1) % v.length]!;
        const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
        const t = Math.min(1, Math.max(0, ((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey)));
        const q: Vec = [a[0] + ex * t, a[1] + ey * t];
        if (Math.hypot(q[0] - x, q[1] - y) < Math.hypot(best[0] - x, best[1] - y)) best = q;
      });
      return best;
    }
    case 'track': {
      // Onto the face of the band on the side the point is.
      const c = nearestOnTrack(shape.segments, [x, y]);
      const d = Math.hypot(x - c[0], y - c[1]);
      const half = shape.thickness / 2;
      return d === 0 ? c : [c[0] + ((x - c[0]) / d) * half, c[1] + ((y - c[1]) / d) * half];
    }
    case 'halfplane': {
      const [nx, ny] = shape.normal;
      const h = nx * x + ny * y - shape.offset;
      return [x - nx * h, y - ny * h];
    }
  }
}

/**
 * The body whose surface passes nearest `at`, if it is within `reach`, and the point on that surface. A click that
 * misses a small ball or a thin wall by a few pixels was still meant for it.
 */
export function nearestBody(bodies: BodyInfo[], state: Float64Array, at: Vec, reach: number): { body: number; at: Vec } | undefined {
  let found: { body: number; at: Vec; distance: number } | undefined;
  bodies.forEach((body, i) => {
    const [x, y, angle] = [state[i * STATE_STRIDE]!, state[i * STATE_STRIDE + 1]!, state[i * STATE_STRIDE + 2]!];
    // Into the body's frame, onto its surface, and back out.
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    const [dx, dy] = body.shape.kind === 'halfplane' ? at : [at[0] - x, at[1] - y];
    const local: Vec = body.shape.kind === 'halfplane' ? [dx, dy] : [dx * cos + dy * sin, -dx * sin + dy * cos];
    const [sx, sy] = nearestOnSurface(body.shape, local);
    const point: Vec = body.shape.kind === 'halfplane' ? [sx, sy] : [x + sx * cos - sy * sin, y + sx * sin + sy * cos];
    const distance = Math.hypot(point[0] - at[0], point[1] - at[1]);
    if (distance <= reach && (!found || distance < found.distance)) found = { body: i, at: point, distance };
  });
  return found && { body: found.body, at: found.at };
}
