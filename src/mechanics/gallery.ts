import { MechanicsWorld } from '../engine';
import { icon } from '../icons';
import { el } from '../ui';
import { emptySandbox } from './editor';
import { Renderer } from './stage/renderer';
import type { BodyInfo, ScenarioSpec, SketchInfo, View } from './types';

export interface GalleryChoice {
  scenario?: string;
  sandbox?: 'new' | 'saved';
}

/** Draws a scenario, or a scene given as JSON, at rest into a card. */
function thumbnail(canvas: HTMLCanvasElement, source: { id: string } | { json: string }): void {
  let world: MechanicsWorld | undefined;
  try {
    world = 'id' in source ? new MechanicsWorld(source.id, {}, 1000) : MechanicsWorld.from_scene(source.json, 1000);
    const renderer = new Renderer(canvas, false);
    renderer.camera.fit(world.view() as View);
    renderer.draw(
      {
        bodies: world.bodies() as BodyInfo[],
        state: world.state(),
        sketches: world.sketches() as SketchInfo[],
        forces: [],
        time: 0,
        focus: -1,
        showForces: false,
        showVelocity: false,
        showAcceleration: false,
        showTrail: false,
        plain: true,
      },
      false,
    );
  } catch {
    /* a scene the engine refuses simply has no picture */
  } finally {
    world?.free();
  }
}

/** A searchable grid of everything there is to open, grouped by chapter. */
export function openGallery(catalogue: ScenarioSpec[], current: string | undefined, saved: string | undefined, choose: (choice: GalleryChoice) => void): void {
  const search = el('input', { type: 'search', placeholder: 'Search scenarios: pendulum, friction, collision…', 'aria-label': 'Search scenarios' });
  const list = el('div', { class: 'gallery-list' });
  const panel = el('div', { class: 'gallery glass', role: 'dialog', 'aria-label': 'Scenarios' }, [el('div', { class: 'gallery-search' }, [icon('search'), search]), list]);
  const backdrop = el('div', { class: 'gallery-backdrop' }, [panel]);

  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  };
  const pick = (choice: GalleryChoice) => {
    close();
    choose(choice);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') (list.querySelector('.gallery-card') as HTMLButtonElement | null)?.click();
  };

  function card(title: string, text: string, choice: GalleryChoice, draw?: (canvas: HTMLCanvasElement) => void, isCurrent = false): HTMLButtonElement {
    const canvas = el('canvas');
    const button = el('button', { type: 'button', class: 'gallery-card' }, [canvas, el('span', { class: 'caption' }, [el('b', { text: title }), el('small', { text })])]);
    if (isCurrent) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => pick(choice));
    if (draw) requestAnimationFrame(() => draw(canvas));
    return button;
  }

  function render(): void {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (spec: ScenarioSpec) =>
      words.every((w) => `${spec.title} ${spec.description} ${spec.syllabus.chapter} ${spec.syllabus.topic}`.toLowerCase().includes(w));
    list.replaceChildren();
    if (words.length === 0) {
      const own = [card('Empty sandbox', 'Start from bare ground. Add balls, boxes, ropes and springs and see what happens.', { sandbox: 'new' }, (canvas) => thumbnail(canvas, { json: JSON.stringify(emptySandbox()) }))];
      if (saved) own.push(card('Your sandbox', 'Carry on with the world you were building.', { sandbox: 'saved' }, (canvas) => thumbnail(canvas, { json: saved })));
      list.append(el('h4', { text: 'Build your own' }), el('div', { class: 'gallery-grid' }, own));
    }
    const groups = new Map<string, ScenarioSpec[]>();
    for (const spec of catalogue.filter(matches)) {
      const key = `Class ${spec.syllabus.class} · ${spec.syllabus.chapter}`;
      groups.set(key, [...(groups.get(key) ?? []), spec]);
    }
    for (const [group, specs] of groups) {
      list.append(
        el('h4', { text: group }),
        el('div', { class: 'gallery-grid' }, specs.map((spec) => card(spec.title, spec.description, { scenario: spec.id }, (canvas) => thumbnail(canvas, { id: spec.id }), spec.id === current))),
      );
    }
    if (groups.size === 0) list.append(el('p', { class: 'empty', text: 'Nothing matches that. Try a chapter name or a single word.' }));
  }

  search.addEventListener('input', render);
  backdrop.addEventListener('pointerdown', (e) => e.target === backdrop && close());
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  render();
  search.focus();
}
