import type { ThermalSpec } from '../thermal/types';

/** A scenario of the modern physics catalogue; it has the shape every catalogue entry has. */
export type ModernSpec = ThermalSpec;

export interface Reading {
  label: string;
  value: number;
  unit: string;
  /** Words in place of the number. */
  text: string;
}

export interface PlotData {
  title: string;
  x_label: string;
  y_label: string;
  curves: { name: string; x: number[]; y: number[]; style: 'solid' | 'dashed' | 'points'; tone: number }[];
  marker: [number, number] | null;
  from_zero: boolean;
  ladder: boolean;
}

export interface Answer {
  name: string;
  value: number;
  measured: number | null;
  within: number;
}

type Point = [number, number];

export type Picture =
  | { kind: 'tube'; photons: Point[]; electrons: Point[]; wavelength: number; voltage: number; emitting: boolean }
  | { kind: 'wave'; wavelength: number; spacing: number }
  | { kind: 'crystal'; lobe: Point[]; peak: number | null }
  | { kind: 'scattering'; tracks: { points: Point[]; marked: boolean }[]; half: number; closest: number }
  | { kind: 'orbits'; radii: number[]; level: number; angle: number; upper: number; lower: number; photon: Point | null }
  | { kind: 'spectrum'; lines: { wavelength: number; lower: number; upper: number }[]; chosen: Point }
  | { kind: 'sample'; columns: number; decayed: number[] }
  | { kind: 'chart' };

/** A lesson running in the engine, whichever subject it belongs to. */
export interface LessonRun {
  advance(seconds: number): void;
  finished(): boolean;
  still(): boolean;
  clock(): string;
  picture(): unknown;
  readings(): unknown;
  plots(): unknown;
  answers(): unknown;
  free(): void;
}

/** What a subject made of such lessons brings to the page they share. */
export interface LessonKit {
  mode: string;
  catalogue(): ModernSpec[];
  start(id: string, params: Record<string, number>): LessonRun;
  /** Draws a lesson's picture; `plain` is for a thumbnail. One of kind `chart` is only a cleared stage. */
  draw(canvas: HTMLCanvasElement, picture: unknown, insets: { left: number; right: number; top: number; bottom: number }, plain?: boolean): void;
  /** What the gallery's search box suggests. */
  search: string;
}
