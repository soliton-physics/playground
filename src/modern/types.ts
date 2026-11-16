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
