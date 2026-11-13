import { cssVar, formatPrefixed } from '../ui';
import type { FormulaGroup } from './formulas';
import type { Fact, Lesson, Mark } from './lessons';
import { slowdown, type Reading, type Series, type WaveScene } from './scene';

const EPSILON_0 = 8.854_187_8128e-12;
const MU_0 = 4e-7 * Math.PI;
const SAMPLES = 400;
/** The charging is watched for this many time constants, by when it is all but over. */
const SPAN = 5;
/** Seconds on screen for the whole of it at normal speed. */
const SECONDS = 12;

export interface Circuit {
  /** Battery, V. */
  voltage: number;
  /** Ω. */
  resistance: number;
  /** Radius of the round plates, m. */
  radius: number;
  /** Distance between them, m. */
  gap: number;
}

/** What is going on in a charging capacitor at one moment, for the drawing under the graph. */
export interface CapacitorPicture {
  /** Charge on the plates as a fraction of what they end with. */
  charge: number;
  /** Current as a fraction of what it starts at: in the wires and, as displacement current, in the gap. */
  current: number;
}

/**
 * A capacitor charging through a resistance. Not a wave: the graph is the current against time, the same curve
 * for the current in the wires and for the displacement current between the plates, which is the point.
 */
export class CapacitorScene implements WaveScene {
  readonly x: Float64Array;
  readonly range: [number, number];
  readonly xUnit: string;
  readonly yUnit = 'μA';
  readonly xLabel = 'time';
  readonly yLabel = 'current';
  readonly factsTitle = 'Now';
  readonly liveFacts = true;
  readonly medium = 'capacitor';
  readonly layerGain = 0;
  readonly partCount = 1;
  readonly showsParts = false;
  private readonly capacitance: number;
  private readonly tau: number;
  private readonly peak: number;
  /** Seconds in one unit of the time axis. */
  private readonly unit: number;
  private t: number;

  constructor(private readonly circuit: Circuit, private readonly lesson: Lesson, startAt = 0) {
    const area = Math.PI * circuit.radius ** 2;
    this.capacitance = (EPSILON_0 * area) / circuit.gap;
    this.tau = circuit.resistance * this.capacitance;
    this.peak = circuit.voltage / circuit.resistance;
    const [scale, prefix] = prefixOf(SPAN * this.tau);
    this.unit = scale;
    this.xUnit = `${prefix}s`;
    this.x = Float64Array.from({ length: SAMPLES }, (_, i) => (SPAN * this.tau * i) / (SAMPLES - 1) / scale);
    this.range = [0, (1.15 * this.peak) / 1e-6];
    this.t = Math.min(startAt, SPAN * this.tau);
  }

  get id() {
    return this.lesson.id;
  }
  get group() {
    return this.lesson.chapter ?? '';
  }
  get title() {
    return this.lesson.title;
  }
  get description() {
    return this.lesson.description;
  }

  private current(t: number): number {
    return this.peak * Math.exp(-t / this.tau);
  }

  private charge(t: number): number {
    return this.capacitance * this.circuit.voltage * (1 - Math.exp(-t / this.tau));
  }

  time(): number {
    return this.t;
  }

  clock(): string {
    return `t = ${formatPrefixed(this.t, 's')} · slowed ${slowdown(SECONDS / (SPAN * this.tau))} times`;
  }

  advance(realSeconds: number, speed: number): boolean {
    this.t += (realSeconds * speed * SPAN * this.tau) / SECONDS;
    if (this.t >= SPAN * this.tau) {
      this.t = SPAN * this.tau;
      return false;
    }
    return true;
  }

  nudge(): void {
    this.advance(SECONDS / 60, 1);
  }

  series(): Series[] {
    const values = this.x.map((x) => this.current(x * this.unit) / 1e-6);
    // One curve drawn twice: a broad band for the displacement current and a line on it for the current in the wires.
    return [
      { values, color: cssVar('--force-electric'), width: 9, faint: true },
      { values, color: cssVar('--accent'), width: 2.5 },
    ];
  }

  picture(): CapacitorPicture {
    return { charge: this.charge(this.t) / (this.capacitance * this.circuit.voltage), current: this.current(this.t) / this.peak };
  }

  facts(): Fact[] {
    return this.rows(this.t);
  }

  private rows(t: number): Fact[] {
    const { radius } = this.circuit;
    const [current, charge] = [this.current(t), this.charge(t)];
    return [
      { label: 'Current in the wires, i꜀', value: formatPrefixed(current, 'A') },
      { label: 'Displacement current in the gap, ε₀ dΦ/dt', value: formatPrefixed(current, 'A') },
      { label: 'Charge on the plates', value: formatPrefixed(charge, 'C') },
      { label: 'Electric field between them, q/ε₀A', value: formatPrefixed(charge / (EPSILON_0 * Math.PI * radius * radius), 'V/m') },
      { label: 'Magnetic field at the rim, μ₀i/2πR', value: formatPrefixed((MU_0 * current) / (2 * Math.PI * radius), 'T') },
      { label: 'Capacitance, ε₀A/d', value: formatPrefixed(this.capacitance, 'F') },
      { label: 'Time constant, RC', value: formatPrefixed(this.tau, 's') },
    ];
  }

  formulas(): FormulaGroup[] {
    return [{ title: 'Formulas', formulas: this.lesson.formulas }];
  }

  marks(): Mark[] {
    return [{ kind: 'now', x: this.t / this.unit }];
  }

  probe(x: number): Reading {
    const t = x * this.unit;
    return { y: this.current(t) / 1e-6, rows: this.rows(t).slice(0, 5) };
  }

  dispose(): void {}
}

function prefixOf(value: number): [number, string] {
  const steps: [number, string][] = [[1, ''], [1e-3, 'm'], [1e-6, 'μ'], [1e-9, 'n'], [1e-12, 'p']];
  return steps.find(([scale]) => value >= scale) ?? steps[steps.length - 1]!;
}
