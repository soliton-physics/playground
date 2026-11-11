import { closePopover, iconButton, popover, toggleButton } from '../controls';
import { icon } from '../icons';
import { el } from '../ui';
import type { Session } from './session';

export interface ViewOptions {
  forces: boolean;
  velocity: boolean;
  acceleration: boolean;
  trail: boolean;
}

export interface DockHandlers {
  toggle(): void;
  step(): void;
  restart(): void;
  seek(time: number): void;
  seekStart(): void;
  fit(): void;
  speed(value: number): void;
}

const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4];

/** The transport: restart, play, step, a timeline you can scrub, the clock, the speed and what to draw. */
export class Dock {
  readonly root: HTMLDivElement;
  private readonly play: HTMLButtonElement;
  private readonly fill = el('div', { class: 'timeline-fill' });
  private readonly reached = el('div', { class: 'timeline-reached' });
  private readonly thumb = el('div', { class: 'timeline-thumb' });
  private readonly ticks = el('div');
  private readonly clock = el('output', { class: 'clock' });
  private readonly speedChip: HTMLButtonElement;
  private readonly timeline: HTMLDivElement;
  private playing: boolean | undefined;
  private tickKey = '';
  private span = 1;

  constructor(readonly view: ViewOptions, private readonly handlers: DockHandlers) {
    this.play = iconButton('play', 'Play (Space)', handlers.toggle, 'play');
    this.timeline = el('div', { class: 'timeline', role: 'slider', tabindex: 0, 'aria-label': 'Time' }, [
      el('div', { class: 'timeline-track' }),
      this.reached,
      this.fill,
      this.ticks,
      this.thumb,
    ]);
    this.speedChip = el('button', { type: 'button', class: 'speed-chip wide-only', title: 'Playback speed', text: '×1' });
    this.speedChip.addEventListener('click', () => this.openSpeeds());

    const toggles = (['forces', 'velocity', 'acceleration', 'trail'] as const).map((key) =>
      toggleButton(key, `Show ${key}`, view[key], (on) => (view[key] = on)),
    );
    toggles.forEach((t) => t.classList.add('wide-only'));

    this.root = el('div', { class: 'dock glass overlay' }, [
      iconButton('restart', 'Restart (R)', handlers.restart),
      this.play,
      iconButton('step', 'Step (→)', handlers.step, 'wide-only'),
      this.timeline,
      this.clock,
      this.speedChip,
      el('span', { class: 'dock-divider' }),
      ...toggles,
      iconButton('fit', 'Fit view (F)', handlers.fit),
    ]);
    this.bindTimeline();
  }

  private bindTimeline(): void {
    const at = (e: PointerEvent) => {
      const rect = this.timeline.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * this.span;
    };
    let dragging = false;
    this.timeline.addEventListener('pointerdown', (e) => {
      dragging = true;
      this.timeline.setPointerCapture(e.pointerId);
      this.handlers.seekStart();
      this.handlers.seek(at(e));
    });
    this.timeline.addEventListener('pointermove', (e) => dragging && this.handlers.seek(at(e)));
    const end = () => (dragging = false);
    this.timeline.addEventListener('pointerup', end);
    this.timeline.addEventListener('pointercancel', end);
  }

  private openSpeeds(): void {
    const menu = el('div', { class: 'menu' });
    for (const speed of SPEEDS) {
      const row = el('button', { type: 'button', text: speed === 1 ? '×1  real time' : `×${speed}` });
      if (this.speedChip.textContent === `×${speed}`) row.setAttribute('aria-current', 'true');
      row.addEventListener('click', () => {
        this.handlers.speed(speed);
        this.speedChip.textContent = `×${speed}`;
        closePopover();
      });
      menu.append(row);
    }
    popover(this.speedChip, menu, 'above');
  }

  update(session: Session): void {
    if (this.playing !== session.running) {
      this.playing = session.running;
      this.play.replaceChildren(icon(session.running ? 'pause' : 'play', 20));
      this.play.title = session.running ? 'Pause (Space)' : 'Play (Space)';
    }
    const span = (this.span = session.span);
    const percent = (t: number) => `${Math.min(100, (t / span) * 100)}%`;
    this.fill.style.width = percent(session.time);
    this.thumb.style.left = percent(session.time);
    this.reached.style.width = percent(session.reached * session.dt);
    this.clock.textContent = `${session.time.toFixed(2)} s`;
    this.timeline.setAttribute('aria-valuenow', session.time.toFixed(2));

    const finish = session.finishes[0];
    const key = `${session.events.length}|${finish?.time ?? ''}|${span.toFixed(3)}`;
    if (key !== this.tickKey) {
      this.tickKey = key;
      const marks = session.events.slice(-60).map((event) => {
        const tick = el('div', { class: 'timeline-tick', title: `${event.time.toFixed(2)} s  ${session.describe(event)}` });
        tick.style.left = percent(event.time);
        return tick;
      });
      if (finish) {
        const tick = el('div', { class: 'timeline-tick finish', title: `${finish.time.toFixed(2)} s  ${finish.reason}` });
        tick.style.left = percent(finish.time);
        marks.push(tick);
      }
      this.ticks.replaceChildren(...marks);
    }
  }
}
