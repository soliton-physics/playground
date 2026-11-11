import { el, formatNumber } from '../ui';
import type { Session } from './session';
import { STATE_STRIDE, type ForceInfo } from './types';

interface Chip {
  name: string;
  unit: string;
  predicted: number;
  measured: HTMLSpanElement;
  measure?: (session: Session, forces: ForceInfo[], state: Float64Array) => number | undefined;
}

const forceOf = (label: string) => (_: Session, forces: ForceInfo[]) => {
  const f = forces.find((x) => x.label === label && !x.impulsive);
  return f ? Math.hypot(f.force[0], f.force[1]) : 0;
};

/** How a textbook answer can be read off the running engine, when it can. */
function measureFor(name: string): Chip['measure'] {
  const n = name.toLowerCase();
  if (n.startsWith('acceleration')) return (s, _f, state) => Math.hypot(state[s.focus * STATE_STRIDE + 6]!, state[s.focus * STATE_STRIDE + 7]!);
  if (n.startsWith('tension') && !n.includes('top') && !n.includes('bottom') && !n.includes('left') && !n.includes('right')) return forceOf('tension');
  if (n.startsWith('normal force')) return forceOf('normal');
  if (n.startsWith('friction (')) return forceOf('friction');
  if (n.startsWith('time of flight') || n.startsWith('time to reach')) return (s) => s.finishes.find((f) => f.reason.includes('touched'))?.time;
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
      this.chips.push({ name, unit, predicted: answer.value, measured, measure: measureFor(answer.name) });
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
      const value = chip.measure?.(session, forces, state);
      if (value === undefined || session.steps === 0) {
        chip.measured.textContent = '';
        continue;
      }
      const agrees = Math.abs(value - chip.predicted) <= 0.01 * Math.max(Math.abs(chip.predicted), 0.01);
      chip.measured.textContent = `${agrees ? '✓ ' : ''}now ${formatNumber(value)}`;
      chip.measured.classList.toggle('agrees', agrees);
    }
  }
}
