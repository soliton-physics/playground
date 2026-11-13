import { OpticsBench } from '../engine';
import { icon } from '../icons';
import { el } from '../ui';
import { BenchRenderer } from './renderer';
import type { BenchFrame, OpticsSpec, OpticsView } from './types';

/** Everything the stage draws of a traced bench. */
export function frameOf(bench: OpticsBench): BenchFrame {
  return { elements: bench.elements(), rays: bench.rays(), objects: bench.objects(), marks: bench.marks(), axis: bench.axis() ?? undefined };
}

function thumbnail(canvas: HTMLCanvasElement, id: string): void {
  let bench: OpticsBench | undefined;
  try {
    bench = new OpticsBench(id, {});
    const renderer = new BenchRenderer(canvas, false);
    const view = bench.view() as OpticsView | undefined;
    if (view) renderer.camera.fit(view);
    renderer.draw(frameOf(bench), [], true);
  } catch {
    /* a scene the engine refuses simply has no picture */
  } finally {
    bench?.free();
  }
}

/** A searchable grid of the optics scenarios, grouped by topic. */
export function openOpticsGallery(catalogue: OpticsSpec[], current: string, choose: (id: string) => void): void {
  const search = el('input', { type: 'search', placeholder: 'Search optics: mirror, lens, prism, critical angle…', 'aria-label': 'Search scenarios' });
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

  function card(spec: OpticsSpec): HTMLButtonElement {
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
    const matches = (spec: OpticsSpec) => words.every((w) => `${spec.title} ${spec.description} ${spec.syllabus.chapter} ${spec.syllabus.topic}`.toLowerCase().includes(w));
    const found = catalogue.filter(matches);
    list.replaceChildren();
    if (found.length) list.append(el('h4', { text: `Class ${found[0]!.syllabus.class} · ${found[0]!.syllabus.chapter}` }), el('div', { class: 'gallery-grid' }, found.map(card)));
    else list.append(el('p', { class: 'empty', text: 'Nothing matches that. Try a single word.' }));
  }

  search.addEventListener('input', render);
  backdrop.addEventListener('pointerdown', (e) => e.target === backdrop && close());
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  render();
  search.focus();
}
