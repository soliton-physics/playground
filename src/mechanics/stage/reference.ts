// The reference circle: simple harmonic motion drawn as the shadow of a point going round a circle at a steady rate,
// beside a body on a spring, with the displacement–time graph that the shadow writes.

import { cssVar, formatNumber, stageFont, stageScale } from '../../ui';
import { STATE_STRIDE, type AnchorSpec, type BodyInfo, type SceneFile, type Vec } from '../types';
import type { Painter } from './renderer';

/** A body that oscillates on a single spring tied to something that does not move. */
export interface Oscillator {
  body: number;
  /** N/m. */
  stiffness: number;
  /** The spring's natural length, m. */
  rest: number;
  /** The fixed end, in the world. */
  anchor: Vec;
  /** Where the spring holds the body, in the body's own frame. */
  local: Vec;
  /** Unit vector from the fixed end towards the body: the line it oscillates along. */
  axis: Vec;
}

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1];

function bodyPoint(state: Float64Array, i: number, local: Vec): Vec {
  const [x, y, angle] = [state[i * STATE_STRIDE]!, state[i * STATE_STRIDE + 1]!, state[i * STATE_STRIDE + 2]!];
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  return [x + local[0] * c - local[1] * s, y + local[0] * s + local[1] * c];
}

/**
 * Every moving body held by exactly one spring whose other end is fixed, and by nothing else but slots that keep it
 * on a line. That is a body in simple harmonic motion; a rope, rod or pin on it, or a second spring, makes it
 * something else. `scene` must carry the springs' natural lengths, as the engine's account of a scene does.
 */
export function findOscillators(scene: SceneFile, bodies: BodyInfo[], state: Float64Array): Oscillator[] {
  const ids = scene.bodies.map((b) => b.id);
  const springs = (scene.forces ?? []).flatMap((f) => ('spring' in f ? [f.spring] : []));
  const tied = new Set<string>();
  for (const c of scene.constraints ?? []) {
    if ('slot' in c || 'fixed_angle' in c) continue;
    for (const id of ids) if (JSON.stringify(c).includes(`"${id}"`)) tied.add(id);
  }
  const fixedEnd = (a: AnchorSpec): Vec | undefined => {
    if ('fixed' in a) return a.fixed;
    const i = ids.indexOf(a.body.id);
    return i >= 0 && bodies[i]?.kind === 'static' ? bodyPoint(state, i, a.body.local ?? [0, 0]) : undefined;
  };
  const found: Oscillator[] = [];
  bodies.forEach((body, i) => {
    if (body.kind === 'static' || tied.has(ids[i]!)) return;
    const own = springs.filter((s) => [s.a, s.b].some((a) => 'body' in a && a.body.id === ids[i]));
    if (own.length !== 1) return;
    const spring = own[0]!;
    const [mine, other] = 'body' in spring.a && spring.a.body.id === ids[i] ? [spring.a, spring.b] : [spring.b, spring.a];
    const anchor = fixedEnd(other);
    if (!anchor || !('body' in mine) || spring.rest_length === undefined || spring.pushes_only) return;
    const local = mine.body.local ?? [0, 0];
    const held = bodyPoint(state, i, local);
    const along: Vec = [held[0] - anchor[0], held[1] - anchor[1]];
    const length = Math.hypot(...along);
    if (length < 1e-9) return;
    found.push({ body: i, stiffness: spring.stiffness, rest: spring.rest_length, anchor, local, axis: scale(along, 1 / length) });
  });
  return found;
}

/** The angle, amplitude and graph of one oscillator, drawn beside it as it runs. */
export class ReferenceCircle {
  /** `[time, displacement]`, oldest first. */
  private history: Vec[] = [];
  /** The largest amplitude seen, so the drawing stays put while the swing dies away. */
  private reach = 0;
  private body = -1;

  /** Forgets the graph: after a restart, a seek back, or a change of body. */
  reset(): void {
    this.history = [];
    this.reach = 0;
  }

  draw(painter: Painter, osc: Oscillator, body: BodyInfo, state: Float64Array, gravity: Vec, time: number): void {
    if (osc.body !== this.body) {
      this.body = osc.body;
      this.reset();
    }
    const { ctx, camera } = painter;
    const i = osc.body;
    const u = osc.axis;
    const omega = Math.sqrt(osc.stiffness / body.mass);
    // Where the spring's pull balances gravity's along the line, and how far from there the body is and how fast.
    const balance = osc.rest + (body.mass * dot(gravity, u)) / osc.stiffness;
    const held = bodyPoint(state, i, osc.local);
    const x = dot([held[0] - osc.anchor[0], held[1] - osc.anchor[1]], u) - balance;
    const v = dot([state[i * STATE_STRIDE + 3]!, state[i * STATE_STRIDE + 4]!], u);
    const amplitude = Math.hypot(x, v / omega);
    if (!Number.isFinite(amplitude) || amplitude < 1e-6) return;

    const last = this.history[this.history.length - 1];
    if (last && time < last[0]) this.reset();
    if (!last || time > last[0]) this.history.push([time, x]);
    this.reach = Math.max(this.reach, amplitude);
    const period = (2 * Math.PI) / omega;
    // A period and a half of graph; older samples are dropped.
    const window = 1.5 * period;
    while (this.history.length > 2 && time - this.history[0]![0] > window) this.history.shift();

    // Beside the body, on its right or above it: the circle level with the balance point, the graph beyond it.
    let n: Vec = [-u[1], u[0]];
    if (n[0] + n[1] < 0) n = scale(n, -1);
    const centre = add(bodyPoint(state, i, [0, 0]), scale(u, -x));
    const size = body.shape.kind === 'circle' ? body.shape.radius : body.shape.kind === 'polygon' ? Math.max(...body.shape.vertices.map((p) => Math.hypot(...p))) : 0;
    const gap = Math.max(0.08, 0.4 * this.reach);
    const C = add(centre, scale(n, size + gap + this.reach));
    const P = add(add(C, scale(u, x)), scale(n, -v / omega));
    const G = add(C, scale(n, this.reach + gap));
    // The graph takes the room there is on the stage beyond the circle, clear of the panels over its edges, up to
    // two and a half amplitudes of time axis.
    const view = camera.bounds;
    const inset = camera.insets;
    const margin = 24 / camera.scale;
    const edge = {
      left: view.left + inset.left / camera.scale + margin,
      right: view.right - inset.right / camera.scale - margin,
      top: view.top - inset.top / camera.scale - margin,
      bottom: view.bottom + inset.bottom / camera.scale + margin,
    };
    const room = Math.min(
      n[0] > 1e-9 ? (edge.right - G[0]) / n[0] : n[0] < -1e-9 ? (edge.left - G[0]) / n[0] : Infinity,
      n[1] > 1e-9 ? (edge.top - G[1]) / n[1] : n[1] < -1e-9 ? (edge.bottom - G[1]) / n[1] : Infinity,
    );
    const width = Math.max(Math.min(2.5 * this.reach, room), this.reach);

    const k = stageScale();
    const colour = cssVar('--force-other');
    const screen = (p: Vec) => camera.toScreen(p[0], p[1]);
    const line = (points: Vec[]) => {
      ctx.beginPath();
      points.forEach((p, j) => {
        const [sx, sy] = screen(p);
        j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      });
    };
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = 1.5 * k;

    // The circle, faint, and its radius to the moving point.
    const [cx, cy] = screen(C);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(cx, cy, amplitude * camera.scale, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
    line([C, P]);
    ctx.stroke();
    const [px, py] = screen(P);
    ctx.beginPath();
    ctx.arc(px, py, 4.5 * k, 0, 2 * Math.PI);
    ctx.fill();

    // The balance line through the body, the circle's centre and the graph's time axis.
    painter.dashed([add(centre, scale(n, -size)), add(G, scale(n, width))], colour);
    // The point's shadow: level with the body, and with the newest point of the graph.
    painter.dashed([bodyPoint(state, i, [0, 0]), add(G, scale(u, x))], colour);

    // The graph: displacement along the spring's line, time running away from the circle.
    if (this.history.length > 1) {
      line(this.history.map(([t, d]) => add(add(G, scale(n, ((time - t) / window) * width)), scale(u, d))));
      ctx.stroke();
    }

    ctx.font = stageFont(11.5);
    ctx.textAlign = 'center';
    // Under the circle, clear of it however large the swing has been.
    ctx.fillText(`A ${formatNumber(amplitude)} m · ω ${formatNumber(omega)} rad/s · T ${formatNumber(period)} s`, cx, cy + this.reach * camera.scale + 20 * k);
    const [tx, ty] = screen(add(G, scale(n, width)));
    ctx.fillText('t', tx + 8 * k, ty);
    ctx.restore();
  }
}
