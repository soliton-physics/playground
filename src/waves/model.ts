/**
 * Textbook waves: sums of sine waves and pulses, each a closed form. Nothing here is integrated in time, so a wave
 * can be evaluated at any instant and at any point exactly, which is what lets a clicked point be read off.
 */

export interface Sine {
  kind: 'sine';
  amplitude: number;
  wavelength: number;
  frequency: number;
  /** Phase at x = 0, t = 0, in radians. */
  phase: number;
  /** +1 travels towards +x, −1 towards −x. */
  direction: 1 | -1;
}

export interface Pulse {
  kind: 'pulse';
  amplitude: number;
  /** Half-width: the pulse falls to 1/e of its height this far from its centre. */
  width: number;
  /** Where its centre is at t = 0. */
  centre: number;
  speed: number;
  direction: 1 | -1;
}

export type Component = Sine | Pulse;

const TAU = 2 * Math.PI;

/** kx + φ − (direction) ωt: the argument of the sine. */
function angle(c: Sine, x: number, t: number): number {
  return (TAU / c.wavelength) * x + c.phase - c.direction * TAU * c.frequency * t;
}

export function displacement(c: Component, x: number, t: number): number {
  if (c.kind === 'sine') return c.amplitude * Math.sin(angle(c, x, t));
  const s = (x - c.centre - c.direction * c.speed * t) / c.width;
  return c.amplitude * Math.exp(-s * s);
}

/** ∂y/∂t: how fast the medium itself is moving at x, which is not the speed of the wave. */
export function velocity(c: Component, x: number, t: number): number {
  if (c.kind === 'sine') return -c.direction * TAU * c.frequency * c.amplitude * Math.cos(angle(c, x, t));
  const s = (x - c.centre - c.direction * c.speed * t) / c.width;
  return ((2 * s * c.direction * c.speed) / c.width) * c.amplitude * Math.exp(-s * s);
}

export function acceleration(c: Component, x: number, t: number): number {
  if (c.kind === 'sine') return -((TAU * c.frequency) ** 2) * displacement(c, x, t);
  const s = (x - c.centre - c.direction * c.speed * t) / c.width;
  return (c.speed / c.width) ** 2 * (4 * s * s - 2) * c.amplitude * Math.exp(-s * s);
}

export const total = (f: (c: Component, x: number, t: number) => number, parts: Component[], x: number, t: number) =>
  parts.reduce((sum, c) => sum + f(c, x, t), 0);

export const waveSpeed = (c: Component) => (c.kind === 'sine' ? c.wavelength * c.frequency : c.speed);

/** The one frequency every part shares, if they are all sines of the same frequency. */
export function commonFrequency(parts: Component[]): number | undefined {
  const [first] = parts;
  if (!first || first.kind !== 'sine') return undefined;
  return parts.every((c) => c.kind === 'sine' && Math.abs(c.frequency - first.frequency) < 1e-9 * first.frequency) ? first.frequency : undefined;
}

export function commonWavelength(parts: Component[]): number | undefined {
  const [first] = parts;
  if (!first || first.kind !== 'sine') return undefined;
  return parts.every((c) => c.kind === 'sine' && Math.abs(c.wavelength - first.wavelength) < 1e-9 * first.wavelength) ? first.wavelength : undefined;
}

export interface Oscillation {
  /** How far this point swings either side of rest. */
  amplitude: number;
  /** Where in its cycle the point is, 0 to 2π, in the convention y = a sin(phase). */
  phase: number;
}

/**
 * The motion of one point when every part has the same frequency: it is then simple harmonic, whatever mixture
 * of directions is passing through. Each part is P cos ωt + Q sin ωt at a fixed x, and the parts add.
 *
 * For waves all travelling towards +x the phase is reported as kx − ωt + φ, the textbook's own, which falls as
 * time passes; otherwise as ωt + δ.
 */
export function oscillationAt(parts: Component[], x: number, t: number): Oscillation | undefined {
  const frequency = commonFrequency(parts);
  if (frequency === undefined) return undefined;
  let p = 0;
  let q = 0;
  for (const c of parts as Sine[]) {
    const a = (TAU / c.wavelength) * x + c.phase;
    p += c.amplitude * Math.sin(a);
    q -= c.direction * c.amplitude * Math.cos(a);
  }
  const amplitude = Math.hypot(p, q);
  const rising = Math.atan2(p, q) + TAU * frequency * t;
  const forward = parts.every((c) => c.direction === 1);
  const phase = forward ? Math.PI - rising : rising;
  return { amplitude, phase: ((phase % TAU) + TAU) % TAU };
}

/** Amplitude and phase of several same-direction, same-wavelength sines added together: A sin(θ + phase). */
export function resultant(parts: Sine[]): { amplitude: number; phase: number } {
  let re = 0;
  let im = 0;
  for (const c of parts) {
    re += c.amplitude * Math.cos(c.phase);
    im += c.amplitude * Math.sin(c.phase);
  }
  return { amplitude: Math.hypot(re, im), phase: Math.atan2(im, re) };
}

/** A time that suits the eye: the shortest repeat among the parts, or most of the time a pulse takes to cross `span`. */
export function naturalTime(parts: Component[], span: number): number {
  const times = parts.map((c) => (c.kind === 'sine' ? 1 / c.frequency : (0.6 * span) / c.speed));
  return times.length ? Math.min(...times) : 1;
}
