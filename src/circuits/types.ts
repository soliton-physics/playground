import type { Param } from '../mechanics/types';

export type Vec = [number, number];

export interface CircuitSpec {
  id: string;
  title: string;
  description: string;
  syllabus: { class: number; chapter: string; topic: string };
  params: Param[];
}

/** A component as the scene's JSON names it. */
export type KindSpec =
  | 'wire'
  | 'ammeter'
  | 'voltmeter'
  | { resistor: { resistance: number; length_of_wire?: boolean } }
  | { battery: { emf: number; internal?: number } }
  | { capacitor: { capacitance: number; initial_voltage?: number } }
  | { inductor: { inductance: number; initial_current?: number } }
  | { source: { amplitude: number; frequency: number; phase?: number } }
  | { switch: { closed?: boolean; flips_at?: number } }
  | { galvanometer: { resistance: number } };

export interface ElementSpec {
  name: string;
  /** Junctions it joins. Its voltage is that of `a` above `b`; its current runs from `a` to `b`. */
  a: number;
  b: number;
  kind: KindSpec;
}

export interface CircuitSceneFile {
  nodes: Vec[];
  elements: ElementSpec[];
  watch?: string[];
}

export interface CircuitAnswer {
  name: string;
  value: number;
  measured: number | null;
}

export type Analysis = 'steady' | 'transient' | 'alternating';

/** The one word for what a component is. */
export const kindOf = (kind: KindSpec): string => (typeof kind === 'string' ? kind : Object.keys(kind)[0]!);
