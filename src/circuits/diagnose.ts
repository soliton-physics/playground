// Why a circuit being built has no answer, in words a student can act on, and which parts to point at. The engine
// only knows that Kirchhoff's laws do not settle it; this finds the loop that makes it so.

import { kindOf, type ElementSpec, type KindSpec } from './types';

export interface Diagnosis {
  message: string;
  /** The parts to highlight, by index. */
  culprits: number[];
}

interface Circuit {
  nodes: unknown[];
  elements: ElementSpec[];
}

/** Whether a part has no resistance at all in this kind of solution: current passes through it freely. */
function free(kind: KindSpec, steady: boolean): boolean {
  if (kind === 'wire' || kind === 'ammeter') return true;
  if (typeof kind !== 'string' && 'switch' in kind) return kind.switch.closed !== false;
  // In a steady circuit an inductor has long since stopped opposing the current: it is a wire.
  if (typeof kind !== 'string' && 'inductor' in kind) return steady;
  return false;
}

/** A source that holds a voltage across itself whatever the current: a cell with no internal resistance, or an AC source. */
function stiff(kind: KindSpec): boolean {
  if (typeof kind === 'string') return false;
  if ('battery' in kind) return !kind.battery.internal;
  return 'source' in kind;
}

/** A path from node `from` to node `to` along the parts allowed, as their indices, or undefined. Breadth first, so the shortest. */
function path(circuit: Circuit, from: number, to: number, allowed: (i: number) => boolean): number[] | undefined {
  const via = new Map<number, [number, number]>([[from, [-1, -1]]]);
  const queue = [from];
  while (queue.length) {
    const node = queue.shift()!;
    if (node === to) break;
    circuit.elements.forEach((e, i) => {
      if (!allowed(i)) return;
      const next = e.a === node ? e.b : e.b === node ? e.a : undefined;
      if (next === undefined || via.has(next)) return;
      via.set(next, [node, i]);
      queue.push(next);
    });
  }
  if (!via.has(to)) return undefined;
  const parts: number[] = [];
  for (let node = to; node !== from; ) {
    const [previous, part] = via.get(node)!;
    parts.push(part);
    node = previous;
  }
  return parts;
}

const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/**
 * The reason a circuit cannot be solved, if it is one a student is likely to make: a cell shorted by wire, by an
 * ammeter, or by an inductor in a steady circuit; or a capacitor charged through no resistance at all.
 */
export function diagnose(circuit: Circuit, steady: boolean): Diagnosis | undefined {
  const { elements } = circuit;
  const kinds = elements.map((e) => kindOf(e.kind));
  const isFree = (i: number) => free(elements[i]!.kind, steady);

  // A cell or source whose two ends are joined by parts with no resistance.
  for (let s = 0; s < elements.length; s++) {
    const source = elements[s]!;
    if (!stiff(source.kind)) continue;
    const loop = path(circuit, source.a, source.b, (i) => i !== s && isFree(i));
    if (!loop) continue;
    const culprits = [s, ...loop];
    const name = source.name;
    const ammeters = loop.filter((i) => kinds[i] === 'ammeter').map((i) => elements[i]!.name);
    const inductors = loop.filter((i) => kinds[i] === 'inductor').map((i) => elements[i]!.name);
    if (ammeters.length) {
      return {
        culprits,
        message: `Short circuit through the ammeter ${list(ammeters)}. An ammeter has no resistance, so placed across a part it carries all the current and the part gets none: here nothing is left to limit the current from ${name}. Put the ammeter in the path of the current, in line with the part.`,
      };
    }
    if (inductors.length) {
      return {
        culprits,
        message: `Short circuit through ${list(inductors)}. Once the current is steady an inductor no longer opposes it, so it is just a wire across ${name}. Add a resistor in series with it.`,
      };
    }
    return {
      culprits,
      message: `Short circuit: the highlighted wire joins the two ends of ${name} with nothing to resist the current, so it would have no limit. Put a resistor in that path, or remove the wire.`,
    };
  }

  // A capacitor charged from a cell through nothing that resists: it would charge in no time at all, and the current
  // would have no limit. Capacitors side by side with no resistance between them are fine (they share one voltage),
  // and so is a capacitor on an alternating source, which is solved with phasors.
  const cell = (i: number) => kinds[i] === 'battery' && stiff(elements[i]!.kind);
  for (let c = 0; c < elements.length; c++) {
    if (kinds[c] !== 'capacitor') continue;
    const capacitor = elements[c]!;
    const loop = path(circuit, capacitor.a, capacitor.b, (i) => i !== c && (isFree(i) || kinds[i] === 'capacitor' || cell(i)));
    const cells = loop?.filter(cell).map((i) => elements[i]!.name) ?? [];
    if (!loop || cells.length === 0) continue;
    return {
      culprits: [c, ...loop],
      message: `${capacitor.name} is joined straight across ${list(cells)} with no resistance between them, so it would charge in no time at all and the current would have no limit. Put a resistor in series with ${capacitor.name}.`,
    };
  }
  return undefined;
}
