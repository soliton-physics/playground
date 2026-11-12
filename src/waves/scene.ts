import { WaveSimulation } from '../engine';
import { cssVar, formatNumber, formatQuantity } from '../ui';
import { formulasFor, type FormulaGroup } from './formulas';
import type { Fact, Lesson, Mark, Values } from './lessons';
import { acceleration, commonFrequency, commonWavelength, displacement, naturalTime, oscillationAt, total, velocity, type Component } from './model';
import type { Preset } from './presets';

export interface Series {
  values: Float64Array;
  color: string;
  width: number;
  fill?: string;
}

/** What a clicked point says about itself. */
export interface Reading {
  /** Height of the curve there, for the marker. */
  y: number;
  rows: Fact[];
  /** Where in its cycle the point is, when it has one. */
  phase?: number;
  /** The point's own displacement over the recent past, oldest first. */
  history?: { values: Float64Array; span: number; limit: number };
}

/** Whatever is on the plot: a textbook wave worked out from its formula, or a soliton the engine is integrating. */
export interface WaveScene {
  readonly id: string;
  readonly group: string;
  readonly title: string;
  readonly description: string;
  readonly x: Float64Array;
  readonly range: [number, number];
  readonly xUnit: string;
  readonly yUnit: string;
  readonly factsTitle: string;
  /** One wavelength shared by everything on the plot, if there is one. */
  readonly wavelength?: number;
  readonly medium: 'string' | 'air' | 'field';
  readonly layerGain: number;
  /** How many waves are added together here, and whether they are worth showing one by one from the start. */
  readonly partCount: number;
  readonly showsParts: boolean;
  time(): number;
  clock(): string;
  /** Moves time on by a frame; false once the story has ended. */
  advance(realSeconds: number, speed: number): boolean;
  /** One small step forward, for looking closely while paused. */
  nudge(): void;
  series(showParts: boolean): Series[];
  facts(): Fact[];
  formulas(): FormulaGroup[];
  marks(): Mark[];
  probe(x: number): Reading;
  dispose(): void;
}

/** A textbook wave with every number filled in. */
export interface Resolved {
  id: string;
  group: string;
  title: string;
  description: string;
  domain: [number, number];
  parts: Component[];
  height: number;
  facts: Fact[];
  marks(t: number): Mark[];
  formulas: FormulaGroup[];
  medium: 'string' | 'air';
  yUnit: string;
  showParts: boolean;
  duration?: number;
}

export const CHAPTER = 'Class 11 · Waves';

export function resolve(lesson: Lesson, values: Values): Resolved {
  return {
    id: lesson.id,
    group: CHAPTER,
    title: lesson.title,
    description: lesson.description,
    domain: lesson.domain(values),
    parts: lesson.parts(values),
    height: lesson.height(values),
    facts: lesson.facts(values),
    marks: (t) => lesson.marks?.(values, t) ?? [],
    formulas: [{ title: 'Formulas', formulas: lesson.formulas }],
    medium: lesson.medium,
    yUnit: lesson.yUnit,
    showParts: lesson.showParts ?? false,
    duration: lesson.duration?.(values),
  };
}

const SAMPLES = 900;
/** One cycle of the quickest part takes this long on screen at normal speed. */
const SECONDS_PER_CYCLE = 3;
const PART_COLORS = ['rgba(167, 139, 250, 0.8)', 'rgba(251, 191, 36, 0.8)', 'rgba(244, 114, 182, 0.8)', 'rgba(74, 222, 128, 0.8)', 'rgba(248, 113, 113, 0.8)'];

export const partColor = (index: number) => PART_COLORS[index % PART_COLORS.length]!;

const degrees = (radians: number) => `${formatNumber((radians * 180) / Math.PI)}° (${(radians / Math.PI).toFixed(2)}π rad)`;

export class TextbookScene implements WaveScene {
  readonly x: Float64Array;
  readonly range: [number, number];
  readonly xUnit = 'm';
  readonly factsTitle = 'Worth knowing';
  readonly wavelength?: number;
  /** Layers of air are drawn this many metres off their place per unit of displacement: enough to see them crowd, never enough to cross. */
  readonly layerGain: number;
  /** Seconds of the wave's own time shown in one second of ours. */
  readonly pace: number;
  private t: number;

  constructor(private readonly spec: Resolved, startAt = 0) {
    const [from, to] = spec.domain;
    this.x = Float64Array.from({ length: SAMPLES }, (_, i) => from + ((to - from) * i) / (SAMPLES - 1));
    const limit = Math.max(spec.height, 1e-12) * 1.6;
    this.range = [-limit, limit];
    this.pace = naturalTime(spec.parts, to - from) / SECONDS_PER_CYCLE;
    this.wavelength = commonWavelength(spec.parts);
    const steepest = spec.parts.reduce((sum, c) => sum + Math.abs(c.amplitude) * (c.kind === 'sine' ? (2 * Math.PI) / c.wavelength : 0.86 / c.width), 0);
    this.layerGain = steepest > 0 ? 0.7 / steepest : 0;
    this.t = spec.duration === undefined ? startAt : Math.min(startAt, spec.duration);
  }

  get id() {
    return this.spec.id;
  }
  get group() {
    return this.spec.group;
  }
  get title() {
    return this.spec.title;
  }
  get description() {
    return this.spec.description;
  }
  get yUnit() {
    return this.spec.yUnit;
  }
  get medium() {
    return this.spec.medium;
  }
  get partCount() {
    return this.spec.parts.length;
  }
  get showsParts() {
    return this.spec.showParts;
  }

  time(): number {
    return this.t;
  }

  clock(): string {
    const quick = this.pace < 0.05;
    const time = quick ? `${(this.t * 1000).toFixed(2)} ms` : `${this.t.toFixed(2)} s`;
    if (this.pace < 0.8) return `t = ${time} · ${formatNumber(1 / this.pace, 2)}× slower`;
    if (this.pace > 1.25) return `t = ${time} · ${formatNumber(this.pace, 2)}× faster`;
    return `t = ${time}`;
  }

  advance(realSeconds: number, speed: number): boolean {
    this.t += realSeconds * this.pace * speed;
    if (this.spec.duration !== undefined && this.t >= this.spec.duration) {
      this.t = this.spec.duration;
      return false;
    }
    return true;
  }

  nudge(): void {
    this.advance(SECONDS_PER_CYCLE / 24, 1);
  }

  private sample(parts: Component[]): Float64Array {
    return this.x.map((x) => total(displacement, parts, x, this.t));
  }

  series(showParts: boolean): Series[] {
    const { parts } = this.spec;
    const each = showParts && parts.length > 1 ? parts.map((c, i) => ({ values: this.sample([c]), color: partColor(i), width: 1.25 })) : [];
    return [...each, { values: this.sample(parts), color: cssVar('--accent'), width: 2.5, fill: cssVar('--accent-soft') }];
  }

  facts(): Fact[] {
    return this.spec.facts;
  }

  formulas(): FormulaGroup[] {
    return this.spec.formulas;
  }

  marks(): Mark[] {
    return this.spec.marks(this.t);
  }

  probe(x: number): Reading {
    const { parts, yUnit, medium } = this.spec;
    const what = medium === 'air' ? 'the air' : 'the string';
    const y = total(displacement, parts, x, this.t);
    const rows: Fact[] = [
      { label: 'Displacement', value: formatQuantity(y, yUnit) },
      { label: `Velocity of ${what} here`, value: formatQuantity(total(velocity, parts, x, this.t), `${yUnit}/s`) },
      { label: 'Acceleration', value: formatQuantity(total(acceleration, parts, x, this.t), `${yUnit}/s²`) },
    ];
    const swing = oscillationAt(parts, x, this.t);
    if (swing) {
      rows.push({ label: 'Amplitude here', value: formatQuantity(swing.amplitude, yUnit) });
      if (swing.amplitude > 1e-9 * this.spec.height) rows.push({ label: 'Phase', value: degrees(swing.phase) });
      else rows.push({ label: 'Phase', value: 'none: this point never moves' });
    }

    // Long enough to show the pattern the point goes through: three cycles, two beats, or the pulse going by.
    const frequency = commonFrequency(parts);
    const sines = parts.filter((c) => c.kind === 'sine');
    const [from, to] = this.spec.domain;
    let span = (to - from) / Math.max(...parts.map((c) => (c.kind === 'pulse' ? c.speed : 1e-12)), 1e-12);
    if (frequency !== undefined) span = 3 / frequency;
    else if (sines.length === parts.length && sines.length > 0) {
      const frequencies = sines.map((c) => c.frequency);
      const spread = Math.max(...frequencies) - Math.min(...frequencies);
      span = Math.min(2 / spread, 60 / Math.max(...frequencies));
    }
    // A pulse has a beginning: there is nothing to show from before it was sent.
    if (this.spec.duration !== undefined) span = Math.max(Math.min(span, this.t), 1e-9);
    const count = 240;
    const values = Float64Array.from({ length: count }, (_, i) => total(displacement, parts, x, this.t - span + (span * i) / (count - 1)));
    return { y, rows, phase: swing?.phase, history: { values, span, limit: this.range[1] } };
  }

  dispose(): void {}
}

const interpolate = (values: Float64Array, x: Float64Array, at: number): number => {
  const dx = x[1]! - x[0]!;
  const s = Math.min(Math.max((at - x[0]!) / dx, 0), x.length - 1 - 1e-9);
  const i = Math.floor(s);
  return values[i]! + (s - i) * (values[i + 1]! - values[i]!);
};

/** A soliton preset: the engine integrates the field, and the conserved quantities are watched for drift. */
export class SolitonScene implements WaveScene {
  readonly sim: WaveSimulation;
  readonly x: Float64Array;
  readonly xUnit = '';
  readonly yUnit = '';
  readonly factsTitle = 'Conserved quantities, now';
  readonly medium = 'field';
  readonly layerGain = 0;
  readonly partCount = 1;
  readonly showsParts = false;
  private initial: Record<string, number>;

  constructor(readonly preset: Preset) {
    this.sim = new WaveSimulation(preset.model, preset.points, preset.length, preset.dt);
    this.x = this.sim.positions();
    preset.setup(this.sim, this.x);
    this.initial = { ...(this.sim.invariants() as Record<string, number>) };
  }

  get id() {
    return this.preset.id;
  }
  get group() {
    return this.preset.model === 'kdv' ? 'Solitons · Korteweg–de Vries' : 'Solitons · Nonlinear Schrödinger';
  }
  get title() {
    return this.preset.title.replace(/^(KdV|NLS): /, '');
  }
  get description() {
    return this.preset.description;
  }
  get range() {
    return this.preset.range;
  }

  time(): number {
    return this.sim.time();
  }

  clock(): string {
    return `t = ${this.sim.time().toFixed(2)}`;
  }

  advance(_realSeconds: number, speed: number): boolean {
    this.sim.step(Math.max(1, Math.round(this.preset.stepsPerFrame * speed)));
    return true;
  }

  nudge(): void {
    this.sim.step(this.preset.stepsPerFrame);
  }

  series(): Series[] {
    const accent = cssVar('--accent');
    const fill = cssVar('--accent-soft');
    if (this.preset.model === 'kdv') return [{ values: this.sim.real(), color: accent, width: 2.5, fill }];
    return [
      { values: this.sim.real(), color: 'rgba(167, 139, 250, 0.6)', width: 1.25 },
      { values: this.sim.magnitude(), color: accent, width: 2.5, fill },
    ];
  }

  facts(): Fact[] {
    return Object.entries(this.sim.invariants() as Record<string, number>).map(([name, value]) => {
      const drift = Math.abs(value - this.initial[name]!) / Math.max(Math.abs(this.initial[name]!), 1);
      return { label: name, value: `${formatNumber(value, 5)}  ±${drift.toExponential(0)}` };
    });
  }

  formulas(): FormulaGroup[] {
    return formulasFor(this.preset);
  }

  marks(): Mark[] {
    return [];
  }

  probe(x: number): Reading {
    const re = interpolate(this.sim.real(), this.x, x);
    if (this.preset.model === 'kdv') {
      return { y: re, rows: [{ label: 'Height, u', value: formatNumber(re, 4) }, { label: 'If this is the peak, the soliton’s speed, c = 2u', value: re > 0.05 ? formatNumber(2 * re) : '–' }] };
    }
    const im = interpolate(this.sim.imag(), this.x, x);
    const size = Math.hypot(re, im);
    const phase = (Math.atan2(im, re) + 2 * Math.PI) % (2 * Math.PI);
    return {
      y: size,
      phase: size > 1e-6 ? phase : undefined,
      rows: [
        { label: 'Envelope, |ψ|', value: formatNumber(size, 4) },
        { label: 'Real part', value: formatNumber(re, 4) },
        { label: 'Imaginary part', value: formatNumber(im, 4) },
        { label: 'Phase of ψ', value: size > 1e-6 ? degrees(phase) : 'none: nothing here' },
      ],
    };
  }

  /** Replaces the field with a profile drawn by hand and takes its invariants as the new reference. */
  setProfile(u: Float64Array): void {
    this.sim.clear();
    this.sim.set_state(u, new Float64Array(u.length));
    this.initial = { ...(this.sim.invariants() as Record<string, number>) };
  }

  dispose(): void {
    this.sim.free();
  }
}
