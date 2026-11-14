import { ThermalGas } from '../engine';
import { icon } from '../icons';
import { el } from '../ui';
import { gasFrame } from './app';
import { GasStage } from './stage';
import type { ThermalSceneFile, ThermalSpec } from './types';

function thumbnail(canvas: HTMLCanvasElement, id: string): void {
  let gas: ThermalGas | undefined;
  try {
    gas = new ThermalGas(id, {});
    const stage = new GasStage(canvas, false);
    stage.insets = { left: 2, right: 2, top: 2, bottom: 2 };
    stage.draw(gasFrame(gas, JSON.parse(gas.scene_json()) as ThermalSceneFile), true);
  } catch {
    /* a scene the engine refuses simply has no picture */
  } finally {
    gas?.free();
  }
}

/** A searchable grid of the thermal scenarios, grouped by chapter. */
export function openThermalGallery(catalogue: ThermalSpec[], current: string, choose: (id: string) => void): void {
  const search = el('input', { type: 'search', placeholder: 'Search: pressure, Maxwell, adiabatic, Carnot…', 'aria-label': 'Search scenarios' });
  const list = el('div', { class: 'gallery-list' });
  const panel = el('div', { class: 'gallery glass', role: 'dialog', 'aria-label': 'Scenarios' }, [el('div', { class: 'gallery-search' }, [icon('search'), search]), list]);
  const backdrop = el('div', { class: 'gallery-backdrop' }, [panel]);
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') (list.querySelector('.gallery-card') as HTMLButtonElement | null)?.click();
  };

  function card(spec: ThermalSpec): HTMLButtonElement {
    const canvas = el('canvas');
    const button = el('button', { type: 'button', class: 'gallery-card' }, [canvas, el('span', { class: 'caption' }, [el('b', { text: spec.title }), el('small', { text: spec.description })])]);
    if (spec.id === current) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => {
      close();
      choose(spec.id);
    });
    requestAnimationFrame(() => thumbnail(canvas, spec.id));
    return button;
  }

  function render(): void {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (spec: ThermalSpec) => words.every((w) => `${spec.title} ${spec.description} ${spec.syllabus.chapter} ${spec.syllabus.topic}`.toLowerCase().includes(w));
    const groups = new Map<string, ThermalSpec[]>();
    for (const spec of catalogue.filter(matches)) {
      const key = `Class ${spec.syllabus.class} · ${spec.syllabus.chapter}`;
      groups.set(key, [...(groups.get(key) ?? []), spec]);
    }
    list.replaceChildren();
    for (const [group, specs] of groups) list.append(el('h4', { text: group }), el('div', { class: 'gallery-grid' }, specs.map(card)));
    if (groups.size === 0) list.append(el('p', { class: 'empty', text: 'Nothing matches that. Try a single word.' }));
  }

  search.addEventListener('input', render);
  backdrop.addEventListener('pointerdown', (e) => e.target === backdrop && close());
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  render();
  search.focus();
}
