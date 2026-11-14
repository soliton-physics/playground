import { cssVar } from '../ui';
import type { FormulaGroup } from './formulas';
import type { Fact, Lesson, Mark } from './lessons';
import type { Reading, Series, WaveScene } from './scene';

/** What stands under the graph of a pattern on a screen. */
export type Picture =
  /** The pattern as it would look on the screen: a band whose brightness follows the graph, in the light's own colour. */
  | { kind: 'fringes'; values: Float64Array; color: string }
  /** Two polaroids in a row, the second turned by `angle` degrees, and how much of the light gets through each. */
  | { kind: 'polaroids'; angle: number; afterFirst: number; afterSecond: number };

/** Everything a pattern lesson works out from its parameters. */
export interface Pattern {
  /** Positions across the screen, or angles of a polaroid, in the unit of the axis. */
  x: Float64Array;
  xUnit: string;
  xLabel: string;
  /** Brightness at each `x`, as a share of the brightest there could be. */
  intensity: Float64Array;
  /** A second curve drawn faintly behind: the envelope that a single slit puts on two. */
  envelope?: Float64Array;
  /** What the brightness is a share of, and the top of the graph, when not the brightest point and one. */
  yUnit?: string;
  top?: number;
  facts: Fact[];
  marks: Mark[];
  picture: Picture;
  /** What a clicked point says about itself. */
  read(x: number): Fact[];
}

/**
 * A pattern that does not change with time: the brightness across a screen, or against the angle of a polaroid.
 * It is drawn from its formula, like the other textbook waves, and any point of it can be read.
 */
export class PatternScene implements WaveScene {
  readonly range: [number, number];
  readonly yUnit: string;
  readonly yLabel = 'intensity';
  readonly factsTitle = 'Worth knowing';
  readonly medium = 'screen';
  readonly layerGain = 0;
  readonly partCount = 1;
  readonly showsParts = false;

  constructor(private readonly lesson: Lesson, private readonly pattern: Pattern) {
    this.range = [0, pattern.top ?? 1.12];
    this.yUnit = pattern.yUnit ?? 'of the brightest';
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
  get x() {
    return this.pattern.x;
  }
  get xUnit() {
    return this.pattern.xUnit;
  }
  get xLabel() {
    return this.pattern.xLabel;
  }

  time(): number {
    return 0;
  }

  clock(): string {
    return 'a steady pattern';
  }

  /** Nothing here moves; the pattern is there for as long as the light is on. */
  advance(): boolean {
    return true;
  }

  nudge(): void {}

  series(): Series[] {
    const curve: Series = { values: this.pattern.intensity, color: cssVar('--accent'), width: 2.5, fill: cssVar('--accent-soft') };
    return this.pattern.envelope ? [{ values: this.pattern.envelope, color: cssVar('--muted'), width: 1.5 }, curve] : [curve];
  }

  facts(): Fact[] {
    return this.pattern.facts;
  }

  formulas(): FormulaGroup[] {
    return [{ title: 'Formulas', formulas: this.lesson.formulas }];
  }

  marks(): Mark[] {
    return this.pattern.marks;
  }

  picture(): Picture {
    return this.pattern.picture;
  }

  probe(x: number): Reading {
    const { x: xs, intensity } = this.pattern;
    const s = Math.min(Math.max((x - xs[0]!) / (xs[1]! - xs[0]!), 0), xs.length - 1 - 1e-9);
    const i = Math.floor(s);
    return { y: intensity[i]! + (s - i) * (intensity[i + 1]! - intensity[i]!), rows: this.pattern.read(x) };
  }

  dispose(): void {}
}

/** The colour the eye sees for light of a wavelength in nanometres, as red, green and blue from 0 to 255. */
export function colourOf(nanometres: number): [number, number, number] {
  const w = nanometres;
  let [r, g, b] = [0, 0, 0];
  if (w < 440) [r, g, b] = [(440 - w) / 60, 0, 1];
  else if (w < 490) [r, g, b] = [0, (w - 440) / 50, 1];
  else if (w < 510) [r, g, b] = [0, 1, (510 - w) / 20];
  else if (w < 580) [r, g, b] = [(w - 510) / 70, 1, 0];
  else if (w < 645) [r, g, b] = [1, (645 - w) / 65, 0];
  else [r, g, b] = [1, 0, 0];
  // The eye is less sensitive towards either end of the spectrum.
  const fade = w < 420 ? 0.35 + (0.65 * (w - 380)) / 40 : w > 700 ? 0.35 + (0.65 * (780 - w)) / 80 : 1;
  const out = (v: number) => Math.round(255 * Math.max(0, Math.min(1, v * Math.max(fade, 0.35))) ** 0.8);
  return [out(r), out(g), out(b)];
}
