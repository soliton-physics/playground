import { icon } from '../icons';
import { el } from '../ui';
import { drawChart } from './stage';
import type { LessonKit, LessonRun, ModernSpec, PlotData } from './types';

function thumbnail(kit: LessonKit, canvas: HTMLCanvasElement, id: string): void {
  let run: LessonRun | undefined;
  try {
    run = kit.start(id, {});
    // A little way in, so that there is something to see.
    run.advance(3.2);
    const picture = run.picture() as { kind: string };
    if (picture.kind === 'chart') drawChart(canvas, (run.plots() as PlotData[])[0]!);
    else kit.draw(canvas, picture, { left: 0, right: 0, top: 0, bottom: 0 }, true);
  } catch {
    /* a lesson the engine refuses simply has no picture */
  } finally {
    run?.free();
  }
}

/** A searchable grid of a subject's lessons, grouped by chapter. */
export function openLessonGallery(kit: LessonKit, catalogue: ModernSpec[], current: string, choose: (id: string) => void): void {
  const search = el('input', { type: 'search', placeholder: kit.search, 'aria-label': 'Search scenarios' });
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

  function card(spec: ModernSpec): HTMLButtonElement {
    const canvas = el('canvas');
    const button = el('button', { type: 'button', class: 'gallery-card' }, [canvas, el('span', { class: 'caption' }, [el('b', { text: spec.title }), el('small', { text: spec.description })])]);
    if (spec.id === current) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => {
      close();
      choose(spec.id);
    });
    requestAnimationFrame(() => thumbnail(kit, canvas, spec.id));
    return button;
  }

  function render(): void {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (spec: ModernSpec) => words.every((w) => `${spec.title} ${spec.description} ${spec.syllabus.chapter} ${spec.syllabus.topic}`.toLowerCase().includes(w));
    const groups = new Map<string, ModernSpec[]>();
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
