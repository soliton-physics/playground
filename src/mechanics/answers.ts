import { el, formatNumber } from '../ui';
import type { Session } from './session';
import { STATE_STRIDE, type ForceInfo } from './types';

type Measure = (session: Session, forces: ForceInfo[], state: Float64Array) => number | undefined;

interface Chip {
  name: string;
  unit: string;
  predicted: number;
  measured: HTMLSpanElement;
  measure?: Measure;
  /** Can be read before anything has moved: a field at a point, a flux through a surface. */
  still?: boolean;
}

/**
 * The recorded sample to read a steady quantity from: the present while the problem is running, and just before
 * its end once it has ended, so that a landing or a string going slack does not replace the answer with zero.
 * The very first sample is skipped: reactions at `t = 0` are solved for a body not yet moving.
 */
function steadySample(s: Session): number {
  const times = s.world.series_time();
  const end = s.finishes[0]?.time ?? Infinity;
  const index = sampleAt(times, Math.min(s.time, end)) - (end <= s.time ? 2 : 0);
  return Math.max(Math.min(1, times.length - 1), index);
}

const recordedForce = (s: Session, body: number, label: string): number | undefined => {
  const flat = s.world.series_force(body, label);
  const i = 2 * steadySample(s);
  return i + 1 < flat.length ? Math.hypot(flat[i]!, flat[i + 1]!) : undefined;
};
const forceOf = (label: string): Measure => (s) => recordedForce(s, s.focus, label);

/** The same force on a body other than the focused one, named by its label in the scene. */
const forceOn = (body: string, label: string): Measure => (s) => {
  const index = s.bodies.findIndex((b) => b.label === body);
  return index < 0 ? undefined : recordedForce(s, index, label);
};

const acceleration: Measure = (s) => {
  const i = steadySample(s);
  const [ax, ay] = [s.world.series(s.focus, 'ax'), s.world.series(s.focus, 'ay')];
  return i < ax.length ? Math.hypot(ax[i]!, ay[i]!) : undefined;
};

/** When the problem ended by something landing or colliding, if it has. */
const impact = (s: Session) => s.finishes.find((f) => f.reason.includes('touched'))?.time;

/** The last recorded sample at or before `time`. */
function sampleAt(times: Float64Array, time: number): number {
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid]! <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const peak = (values: Float64Array) => values.reduce((best, v) => Math.max(best, v), -Infinity);

/** A recorded quantity of the focused body at the moment of impact. */
const atImpact = (quantity: string, relative = false): Measure => (s) => {
  const time = impact(s);
  if (time === undefined) return undefined;
  const values = s.world.series(s.focus, quantity);
  const value = values[sampleAt(s.world.series_time(), time)]!;
  return relative ? value - values[0]! : value;
};

/** The largest value a recorded quantity has reached so far, measured from where it started if `relative`. */
const largest = (quantity: string, relative = false): Measure => (s) => {
  const values = s.world.series(s.focus, quantity);
  return values.length ? peak(values) - (relative ? values[0]! : 0) : undefined;
};

/** The time of the highest point, once the body has started back down. */
const timeOfTop: Measure = (s) => {
  const y = s.world.series(s.focus, 'y');
  const top = y.indexOf(peak(y));
  return top > 0 && top < y.length - 1 ? s.world.series_time()[top] : undefined;
};

/** The period, from successive moments the body turns round the same way; needs two of them. */
const period: Measure = (s) => {
  const times = s.world.series_time();
  // Whichever way the body mostly moves: side to side for a block on a table, up and down for one on a hanging spring.
  const [sideways, upright] = [s.world.series(s.focus, 'vx'), s.world.series(s.focus, 'vy')];
  const swing = (v: Float64Array) => v.reduce((most, x) => Math.max(most, Math.abs(x)), 0);
  const vx = swing(sideways) >= swing(upright) ? sideways : upright;
  const turns: number[] = [];
  for (let i = 1; i < vx.length; i++) {
    if (vx[i - 1]! > 0 && vx[i]! <= 0) turns.push(times[i - 1]! + ((times[i]! - times[i - 1]!) * vx[i - 1]!) / (vx[i - 1]! - vx[i]!));
  }
  return turns.length >= 2 ? (turns[turns.length - 1]! - turns[0]!) / (turns.length - 1) : undefined;
};

const largestForce = (label: string): Measure => (s) => {
  const flat = s.world.series_force(s.focus, label);
  let best = -Infinity;
  for (let i = 0; i + 1 < flat.length; i += 2) best = Math.max(best, Math.hypot(flat[i]!, flat[i + 1]!));
  return Number.isFinite(best) ? best : undefined;
};

/** A force at the start of the run: the first sample after the initial one, which is solved at rest. */
const firstForce = (label: string): Measure => (s) => {
  const flat = s.world.series_force(s.focus, label);
  return flat.length >= 4 ? Math.hypot(flat[2]!, flat[3]!) : undefined;
};

/** The horizontal velocity of a named body, once the collision has happened. */
const speedAfterImpact = (body: string): Measure => (s, _f, state) => {
  const index = s.bodies.findIndex((b) => b.label === body);
  return index < 0 || impact(s) === undefined ? undefined : state[index * STATE_STRIDE + 3];
};

const smallest = (quantity: string): Measure => (s) => {
  const values = s.world.series(s.focus, quantity);
  return values.length ? values.reduce((least, v) => Math.min(least, v), Infinity) : undefined;
};

const speedNow: Measure = (s) => {
  const speed = s.world.series(s.focus, 'speed');
  return speed[steadySample(s)];
};

/** The farthest the focused body has been from the centre of a fixed round body, measured from its surface. */
const farthestAbove = (planet: string): Measure => (s) => {
  const index = s.bodies.findIndex((b) => b.label === planet);
  const shape = s.bodies[index]?.shape;
  if (!shape || shape.kind !== 'circle') return undefined;
  const [x, y] = [s.world.series(s.focus, 'x'), s.world.series(s.focus, 'y')];
  let far = 0;
  for (let i = 0; i < x.length; i++) far = Math.max(far, Math.hypot(x[i]!, y[i]!));
  return far - shape.radius;
};

/** Half the swing over the last quarter of the run, once the problem's time is up: the steady state of a driven oscillator. */
const steadyAmplitude: Measure = (s) => {
  if (s.finishes.length === 0) return undefined;
  const x = s.world.series(s.focus, 'x');
  const tail = x.subarray(Math.floor(0.75 * x.length));
  let [low, high] = [Infinity, -Infinity];
  for (const v of tail) {
    low = Math.min(low, v);
    high = Math.max(high, v);
  }
  return tail.length ? 0.5 * (high - low) : undefined;
};

const index = (s: Session, label: string) => s.bodies.findIndex((b) => b.label === label);

/** When everything came to rest, if it has. */
const cameToRest: Measure = (s) => s.finishes.find((f) => f.reason.includes('came to rest'))?.time;

/** How far the focused body is from where it started, once the problem has ended. */
const travelled: Measure = (s) => {
  if (s.finishes.length === 0) return undefined;
  const [x, y] = [s.world.series(s.focus, 'x'), s.world.series(s.focus, 'y')];
  const i = sampleAt(s.world.series_time(), s.finishes[0]!.time);
  return Math.hypot(x[i]! - x[0]!, y[i]! - y[0]!);
};

/** The speed of a named body now, once the problem has reached `after`: an impact, or its end. */
const speedOf = (label: string, after: (s: Session) => number | undefined): Measure => (s, _f, state) => {
  const i = index(s, label);
  return i < 0 || after(s) === undefined ? undefined : Math.hypot(state[i * STATE_STRIDE + 3]!, state[i * STATE_STRIDE + 4]!);
};
const ended = (s: Session) => s.finishes[0]?.time;

/** The first recorded sample at which a spring is pushing on the focused body: the moment it is met. */
function firstTouch(s: Session): number {
  const flat = s.world.series_force(s.focus, 'spring');
  for (let i = 0; 2 * i + 1 < flat.length; i++) if (flat[2 * i] !== 0 || flat[2 * i + 1] !== 0) return i;
  return -1;
}

/**
 * How far the focused body squeezes a spring it runs into. Samples are a few milliseconds apart, so where exactly
 * the two met is not recorded. The spring's own force is: it grows by k for every metre of squeeze, which two
 * samples early in the squeeze give, and then the hardest push says how deep it went.
 */
const compression: Measure = (s) => {
  const met = firstTouch(s);
  const flat = s.world.series_force(s.focus, 'spring');
  const push = (i: number) => Math.hypot(flat[2 * i] ?? 0, flat[2 * i + 1] ?? 0);
  if (met < 0 || push(met + 1) === 0) return undefined;
  const [x, y] = [s.world.series(s.focus, 'x'), s.world.series(s.focus, 'y')];
  const moved = Math.hypot(x[met + 1]! - x[met]!, y[met + 1]! - y[met]!);
  const stiffness = (push(met + 1) - push(met)) / moved;
  if (!(stiffness > 0) || !Number.isFinite(stiffness)) return undefined;
  let hardest = 0;
  let last = met;
  for (let i = met; i < x.length && push(i) > 0; i++) {
    hardest = Math.max(hardest, push(i));
    last = i;
  }
  // It is the greatest compression only once the body has started back, or has gone.
  return last < x.length - 1 || push(last) < hardest ? hardest / stiffness : undefined;
};

const speedOnMeeting: Measure = (s) => {
  const met = firstTouch(s);
  return met < 1 ? undefined : s.world.series(s.focus, 'speed')[met - 1];
};

/** How far below its starting height the focused body has been, once it has started back up. */
const deepestDrop: Measure = (s) => {
  const y = s.world.series(s.focus, 'y');
  const lowest = y.reduce((least, v) => Math.min(least, v), Infinity);
  return y.length > 2 && y[y.length - 1]! > lowest + 1e-9 ? y[0]! - lowest : undefined;
};

/** The angle between the velocities of two named bodies, in degrees, after they have collided. */
const angleBetween = (a: string, b: string): Measure => (s, _f, state) => {
  const [i, j] = [index(s, a), index(s, b)];
  if (i < 0 || j < 0 || impact(s) === undefined) return undefined;
  const v = (k: number): [number, number] => [state[k * STATE_STRIDE + 3]!, state[k * STATE_STRIDE + 4]!];
  const [p, q] = [v(i), v(j)];
  const product = Math.hypot(...p) * Math.hypot(...q);
  return product < 1e-12 ? undefined : (Math.acos(Math.max(-1, Math.min(1, (p[0] * q[0] + p[1] * q[1]) / product))) * 180) / Math.PI;
};

/** The angle a named body's velocity makes with the x axis, in degrees and without sign, after an impact. */
const headingOf = (label: string): Measure => (s, _f, state) => {
  const i = index(s, label);
  if (i < 0 || impact(s) === undefined) return undefined;
  return (Math.abs(Math.atan2(state[i * STATE_STRIDE + 4]!, state[i * STATE_STRIDE + 3]!)) * 180) / Math.PI;
};

/**
 * How fast a named body's spin is growing: its angular speed over the time taken, for a body spun up steadily from
 * rest. The engine's own figure for the angular acceleration at an instant is less exact for a body turning about a pin.
 */
const spinRate = (label: string | undefined): Measure => (s) => {
  const i = label === undefined ? s.focus : index(s, label);
  if (i < 0) return undefined;
  const k = steadySample(s);
  const time = s.world.series_time()[k]!;
  return time > 0 ? Math.abs(s.world.series(i, 'omega')[k]!) / time : undefined;
};

/** A recorded quantity of the focused body when the problem's time is up. */
const atTheEnd = (quantity: string, scale = 1): Measure => (s) => {
  const end = s.finishes.find((f) => f.reason.includes('time window'))?.time;
  if (end === undefined) return undefined;
  return Math.abs(s.world.series(s.focus, quantity)[sampleAt(s.world.series_time(), end)]!) * scale;
};

// ---- class 12: charges and fields ----

/** A force on the focused body at the very start, before anything has moved. */
const forceAtStart = (label: string): Measure => (s) => {
  const flat = s.world.series_force(s.focus, label);
  return s.steps > 0 && flat.length >= 2 ? Math.hypot(flat[0]!, flat[1]!) : undefined;
};

/** The electric field, N/C, where the focused body is. */
const electricFieldHere: Measure = (s) => {
  const [ex, ey] = s.world.field_on(s.focus);
  return Math.hypot(ex!, ey!);
};

const potentialHere: Measure = (s) => s.world.field_on(s.focus)[2];

/** The magnetic field in the plane, T, at the compass if the scene has one and at the focused body if not, leaving out the body's own. */
const magneticFieldHere: Measure = (s) => {
  const compass = s.bodies.findIndex((b) => b.label === 'compass');
  const values = s.world.field_on(compass < 0 ? s.focus : compass);
  return Math.hypot(values[4]!, values[5]!);
};

/** The magnetic field in the plane, T, at the place the focused body started from. */
const magneticFieldAtStart: Measure = (s, _f, state) => {
  const [xs, ys] = [s.world.series(s.focus, 'x'), s.world.series(s.focus, 'y')];
  const [x, y] = xs.length ? [xs[0]!, ys[0]!] : [state[s.focus * STATE_STRIDE]!, state[s.focus * STATE_STRIDE + 1]!];
  const values = s.world.field_at(x, y);
  return Math.hypot(values[4]!, values[5]!);
};

/** The flux out of the scene's closed surface, summed by the engine over the sphere. */
const fluxThroughSurface: Measure = (s) => (s.surface ? s.world.flux_through(s.surface.centre[0], s.surface.centre[1], s.surface.radius) : undefined);

/** When a force with this label first acts on the focused body: the moment it leaves a region with no field. */
const timeFirstFelt = (label: string): Measure => (s) => {
  const flat = s.world.series_force(s.focus, label);
  for (let i = 0; i + 1 < flat.length; i += 2) {
    if (flat[i] !== 0 || flat[i + 1] !== 0) return i > 0 ? s.world.series_time()[i / 2] : undefined;
  }
  return undefined;
};

/** The period of something that turns to and fro where it is, from the moments its spin reverses the same way. */
const spinPeriod: Measure = (s) => {
  const [times, spin] = [s.world.series_time(), s.world.series(s.focus, 'omega')];
  const turns: number[] = [];
  for (let i = 1; i < spin.length; i++) {
    if (spin[i - 1]! > 0 && spin[i]! <= 0) turns.push(times[i - 1]! + ((times[i]! - times[i - 1]!) * spin[i - 1]!) / (spin[i - 1]! - spin[i]!));
  }
  return turns.length >= 2 ? (turns[turns.length - 1]! - turns[0]!) / (turns.length - 1) : undefined;
};

const fastestSpin: Measure = (s) => {
  const spin = s.world.series(s.focus, 'omega');
  // The answer is the speed through the middle of the swing, which has to have been reached.
  let [fastest, turned] = [0, false];
  for (let i = 1; i < spin.length; i++) {
    fastest = Math.max(fastest, Math.abs(spin[i]!));
    turned ||= Math.abs(spin[i]!) < Math.abs(spin[i - 1]!);
  }
  return turned ? fastest : undefined;
};

const STILL = new Set<Measure>([electricFieldHere, potentialHere, magneticFieldHere, magneticFieldAtStart, fluxThroughSurface]);

const accelerationAtStart: Measure = (s) => (s.steps > 0 ? Math.hypot(s.world.series(s.focus, 'ax')[0]!, s.world.series(s.focus, 'ay')[0]!) : undefined);

/** The first time a force with this label acts on the focused body, as on entering a field. */
const forceOnEntering = (label: string): Measure => (s) => {
  const flat = s.world.series_force(s.focus, label);
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const size = Math.hypot(flat[i]!, flat[i + 1]!);
    if (size > 0) return size;
  }
  return undefined;
};

/** Distance of the focused body from a named one at each recorded sample. */
function distancesFrom(s: Session, body: string): Float64Array | undefined {
  const other = index(s, body);
  if (other < 0) return undefined;
  const [x, y] = [s.world.series(s.focus, 'x'), s.world.series(s.focus, 'y')];
  const [ox, oy] = [s.world.series(other, 'x'), s.world.series(other, 'y')];
  return x.map((v, i) => Math.hypot(v - ox[i]!, y[i]! - oy[i]!));
}

/** The speed of the focused body when it is first `factor` times as far from a named body as it began. */
const speedAtMultiple = (body: string, factor: number): Measure => (s) => {
  const distance = distancesFrom(s, body);
  const at = distance?.findIndex((d) => d >= factor * distance[0]!) ?? -1;
  return at < 0 ? undefined : s.world.series(s.focus, 'speed')[at];
};

/** The nearest the focused body has come to a named one, once it is on its way out again. */
const nearestTo = (body: string): Measure => (s) => {
  const distance = distancesFrom(s, body);
  if (!distance || distance.length < 3) return undefined;
  const least = distance.reduce((best, d) => Math.min(best, d), Infinity);
  return distance[distance.length - 1]! > least * (1 + 1e-6) ? least : undefined;
};

/** The largest angle a hanging body has swung from straight below the origin, in degrees. */
const widestSwing: Measure = (s) => {
  const [x, y] = [s.world.series(s.focus, 'x'), s.world.series(s.focus, 'y')];
  let widest = 0;
  for (let i = 0; i < x.length; i++) widest = Math.max(widest, Math.abs(Math.atan2(x[i]!, -y[i]!)));
  return s.steps > 0 ? (widest * 180) / Math.PI : undefined;
};

/** Half the height of the path so far, once the body has come back up from its lowest point: a circle's radius. */
const halfHeight: Measure = (s) => {
  const y = s.world.series(s.focus, 'y');
  const [low, high] = [y.reduce((a, v) => Math.min(a, v), Infinity), peak(y)];
  return y.length > 2 && y[y.length - 1]! > low + 0.05 * (high - low) && y.indexOf(low) > 0 ? (high - low) / 2 : undefined;
};

const upwardAcceleration: Measure = (s) => s.world.series(s.focus, 'ay')[steadySample(s)];

/** The sideways acceleration of the focused body when a field first takes hold of it. */
const sidewaysOnEntering: Measure = (s) => s.world.series(s.focus, 'ay').find((a) => a !== 0);

/** The work done on the system from outside so far: by the supply that keeps a pair of plates charged. */
const workFromOutside: Measure = (s) => (s.finishes.length ? (s.world.energy() as { external_work: number }).external_work : undefined);

/** What one of an answer's units is in the SI units the engine records. */
// A scale shows kilograms for the newtons pressed on it: the one answer in kg that is measured is that reading.
const UNIT_SCALE: Record<string, number> = {
  km: 1000,
  'km/s': 1000,
  min: 60,
  h: 3600,
  kg: 9.8,
  mN: 1e-3,
  μN: 1e-6,
  mJ: 1e-3,
  μJ: 1e-6,
  'kN/C': 1000,
  kV: 1000,
  'kN·m²/C': 1000,
  mT: 1e-3,
  μT: 1e-6,
  'mm/s²': 1e-3,
};

/** How a textbook answer can be read off the running engine, when it can. Thresholds and conditions cannot. */
function measureFor(name: string): Chip['measure'] {
  const n = name.toLowerCase();
  if (n.startsWith('force at the start')) return (s, f, state) => forceAtStart(s.magnets ? 'magnetic' : 'electric')(s, f, state);
  if (n.startsWith('force on the test charge')) return forceAtStart('electric');
  if (n.startsWith('field at the test charge') || n.startsWith('field at the bead')) return electricFieldHere;
  if (n.startsWith('potential at the test charge')) return potentialHere;
  if (n.startsWith('field at the compass')) return magneticFieldHere;
  if (n.startsWith('field at the sample')) return magneticFieldAtStart;
  if (n.startsWith('flux out of the surface')) return fluxThroughSurface;
  if (n.startsWith('force on the bead')) return forceOf('electric');
  if (n.startsWith('speed that keeps a circle')) return speedNow;
  if (n.startsWith('time to go through and come back')) return period;
  if (n.startsWith('time it spends inside')) return timeFirstFelt('electric');
  if (n.startsWith('period of small swings of the needle')) return spinPeriod;
  if (n.startsWith('fastest it turns')) return fastestSpin;
  if (n.startsWith('acceleration at the start')) return accelerationAtStart;
  if (n.startsWith('speed at twice the separation')) return speedAtMultiple('fixed charge', 2);
  if (n.startsWith('furthest it swings')) return widestSwing;
  if (n.startsWith('electric force, upward')) return forceOnEntering('electric');
  if (n.startsWith('electric force')) return forceOf('electric');
  if (n.startsWith('magnetic force at this speed')) return forceOnEntering('magnetic');
  if (n.startsWith('magnetic force')) return forceOf('magnetic');
  if (n.startsWith('force on each end')) return forceOf('electric');
  if (n.startsWith('weight (')) return forceOf('gravity');
  if (n.startsWith('acceleration, upward')) return upwardAcceleration;
  if (n.startsWith('sideways acceleration')) return sidewaysOnEntering;
  if (n.startsWith('where it meets the screen')) return atImpact('y');
  if (n.startsWith('closest distance')) return nearestTo('fixed charge');
  if (n.startsWith('speed on leaving') || n.startsWith('most speed the magnet')) return atTheEnd('speed');
  if (n.startsWith('kinetic energy gained')) return workFromOutside;
  if (n.startsWith('radius of the circle')) return halfHeight;
  if (n.startsWith('time for one turn') || n.startsWith('period of small swings (')) return period;
  if (n.startsWith('acceleration') || n.startsWith('deceleration') || n.startsWith('centripetal acceleration')) return acceleration;
  if (n.startsWith('stopping distance')) return travelled;
  if (n.startsWith('time to stop')) return cameToRest;
  if (n.startsWith('range along the slope')) return travelled;
  if (n.startsWith('apparent weight') || n.startsWith('scale reading')) return forceOf('normal');
  if (n.startsWith('true weight')) return forceOf('gravity');
  if (n.startsWith('recoil speed')) return speedOf('gun', (s) => (s.time > 0.05 ? s.time : undefined));
  if (n.startsWith('greatest compression')) return compression;
  if (n.startsWith('greatest force of the spring')) return largestForce('spring');
  if (n.startsWith('speed it comes back with')) return speedOf('block', ended);
  if (n.startsWith('speed on reaching the spring')) return speedOnMeeting;
  if (n.startsWith('speed of the struck disc')) return speedOf('struck disc', impact);
  if (n.startsWith('speed of the incoming disc')) return speedOf('incoming disc', impact);
  if (n.startsWith('angle of the struck disc')) return headingOf('struck disc');
  if (n.startsWith('angle between the two')) return angleBetween('incoming disc', 'struck disc');
  if (n.startsWith('angular acceleration of the pulley')) return spinRate('pulley');
  if (n.startsWith('angular acceleration of the wheel')) return spinRate('wheel');
  if (n.startsWith('angular acceleration (')) return spinRate(undefined);
  if (n.startsWith('angular speed after')) return atTheEnd('omega');
  if (n.startsWith('turns made')) return atTheEnd('angle', 1 / (2 * Math.PI));
  if (n.startsWith('lowest point below')) return deepestDrop;
  if (n.startsWith('greatest speed')) return largest('speed');
  if (n.startsWith('tension on the left')) return forceOn('m1', 'tension');
  if (n.startsWith('tension on the right')) return forceOn('m2', 'tension');
  if (n.startsWith('tension at the bottom')) return firstForce('tension');
  if (n.startsWith('tension (')) return forceOf('tension');
  if (n.startsWith('normal force')) return forceOf('normal');
  if (n.startsWith('friction (')) return forceOf('friction');
  if (n.startsWith('time of flight') || n.startsWith('time to reach')) return impact;
  if (n.startsWith('time to the top')) return timeOfTop;
  if (n.startsWith('orbital speed')) return speedNow;
  if (n.startsWith('farthest altitude')) return farthestAbove('Earth');
  if (n.startsWith('speed at the nearest')) return largest('speed');
  if (n.startsWith('speed at the farthest')) return smallest('speed');
  if (n.startsWith('steady amplitude')) return steadyAmplitude;
  if (n.startsWith('range') || n.startsWith('horizontal range')) return atImpact('x', true);
  if (n.startsWith('maximum height')) return largest('y', true);
  if (n.startsWith('speed on impact') || n.startsWith('speed on landing')) return atImpact('speed');
  if (n.startsWith('maximum speed') || n.startsWith('speed at the bottom')) return largest('speed');
  if (n.startsWith('maximum force')) return largestForce('spring');
  if (n.startsWith('period (') || n.startsWith('period,')) return period;
  if (n.startsWith('final speed 1')) return speedAfterImpact('mass 1');
  if (n.startsWith('final speed 2')) return speedAfterImpact('mass 2');
  if (n.startsWith('kinetic energy lost')) return (s) => (impact(s) === undefined ? undefined : (s.world.energy() as { dissipated: number }).dissipated);
  return undefined;
}

/** Textbook answers as chips: the predicted value and, where the engine can show it, the measured one. */
export class Answers {
  readonly root = el('div', { class: 'answers overlay' });
  private chips: Chip[] = [];

  reset(session: Session): void {
    this.chips = [];
    const nodes: HTMLElement[] = [];
    for (const answer of session.exact) {
      const yesNo = /^(.*)\?\s*\(1 = yes\)$/.exec(answer.name);
      if (yesNo) {
        nodes.push(el('div', { class: 'answer glass' }, [el('span', { class: 'name', text: `${yesNo[1]}?` }), el('span', { class: 'value', text: answer.value ? 'yes' : 'no' })]));
        continue;
      }
      const parts = /^(.*?)\s*\(([^()]*)\)$/.exec(answer.name);
      const name = parts ? parts[1]! : answer.name;
      const unit = parts ? parts[2]! : '';
      const measured = el('span', { class: 'measured' });
      const measure = measureFor(answer.name);
      this.chips.push({ name, unit, predicted: answer.value, measured, measure, still: measure !== undefined && STILL.has(measure) });
      nodes.push(
        el('div', { class: 'answer glass', title: 'The textbook value, and what the engine measures' }, [
          el('span', { class: 'name', text: name }),
          el('span', { class: 'value', text: `${formatNumber(answer.value)}${unit ? ` ${unit}` : ''}` }),
          measured,
        ]),
      );
    }
    this.root.replaceChildren(...nodes);
  }

  update(session: Session, forces: ForceInfo[], state: Float64Array): void {
    for (const chip of this.chips) {
      const raw = session.live ? undefined : chip.measure?.(session, forces, state);
      const value = raw === undefined ? undefined : raw / (UNIT_SCALE[chip.unit] ?? 1);
      // Once a hand has pulled on the system it is no longer the textbook's problem, and nothing measured is its answer.
      if (value === undefined || !Number.isFinite(value) || (session.steps === 0 && !chip.still) || session.live) {
        chip.measured.textContent = '';
        continue;
      }
      const agrees = Math.abs(value - chip.predicted) <= 0.01 * Math.max(Math.abs(chip.predicted), chip.still ? 1 : 0.01);
      chip.measured.textContent = `${agrees ? '✓ ' : ''}measured ${formatNumber(value)}`;
      chip.measured.classList.toggle('agrees', agrees);
    }
  }
}
