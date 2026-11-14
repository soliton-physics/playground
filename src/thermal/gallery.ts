import { StatRun, ThermalGas } from '../engine';
import { icon } from '../icons';
import { el } from '../ui';
import { gasFrame } from './app';
import { GasStage } from './stage';
import { drawStatistics } from './statistics';
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

function statThumbnail(canvas: HTMLCanvasElement, id: string): void {
  let run: StatRun | undefined;
  try {
    run = new StatRun(id, {});
    // A little way in, so that there is something to see.
    run.advance(id === 'phase-transition' ? 3000 : 40);
    drawStatistics(canvas, run, { left: 0, right: 0, top: 0, bottom: 0 }, true);
  } catch {
    /* a scene the engine refuses simply has no picture */
  } finally {
    run?.free();
  }
}

/**
 * A searchable grid of everything in the thermal tab: the gas scenarios grouped by chapter, then the statistical
 * ones. The page showing one kind opens the other by following a link, since each has a stage of its own.
 */
export function openThermalGallery(gases: ThermalSpec[], statistical: ThermalSpec[], current: string, choose: (id: string) => void): void {
  const here = (gases.some((s) => s.id === current) ? gases : statistical).map((s) => s.id);
  const catalogue = [...gases, ...statistical];
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
      if (here.includes(spec.id)) choose(spec.id);
      else location.search = `?mode=thermal&scenario=${spec.id}`;
    });
    requestAnimationFrame(() => (statistical.includes(spec) ? statThumbnail : thumbnail)(canvas, spec.id));
    return button;
  }

  function render(): void {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (spec: ThermalSpec) => words.every((w) => `${spec.title} ${spec.description} ${spec.syllabus.chapter} ${spec.syllabus.topic}`.toLowerCase().includes(w));
    const groups = new Map<string, ThermalSpec[]>();
    for (const spec of catalogue.filter(matches)) {
      const key = spec.syllabus.class ? `Class ${spec.syllabus.class} · ${spec.syllabus.chapter}` : `Beyond the textbook · ${spec.syllabus.chapter}`;
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
