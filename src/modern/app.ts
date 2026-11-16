import { choice, closePopover, iconButton, popover, slider, toast } from '../controls';
import { ModernRun, modern_catalogue } from '../engine';
import { icon } from '../icons';
import type { Shell } from '../shell';
import { drawPlot } from '../thermal/graphs';
import { clamp, el, formatNumber, layoutPx } from '../ui';
import { openModernGallery } from './gallery';
import { drawChart, drawPicture, toPlot, type Insets } from './stage';
import type { Answer, ModernSpec, Picture, PlotData, Reading } from './types';

/** The modern physics tab: photons, matter waves, atoms and nuclei, each lesson run by the engine. */
export function mountModern(main: HTMLElement, query: URLSearchParams, embedded: boolean, shell: Shell): void {
  const catalogue = modern_catalogue() as ModernSpec[];
  const canvas = el('canvas', { class: 'stage-canvas' });
  // A lesson that is all graph has it drawn large here, over the stage.
  const chart = el('canvas', { class: 'modern-chart overlay' });
  const description = el('p');
  const actions = el('div', { class: 'info-actions' });
  const info = el('section', { class: 'info glass overlay' }, [description, actions]);
  const answers = el('div', { class: 'answers overlay' });
  const notes = el('div', { class: 'stage-notes overlay' }, [answers]);
  const readout = el('dl', { class: 'readout circuit-readout' });
  const plot = el('canvas', { class: 'thermal-plot' });
  const legend = el('p', { class: 'formula-note' });
  const graphPicker = el('div');
  const panel = el('aside', { class: 'wave-readout glass overlay' }, [el('h4', { class: 'panel-title', text: 'Readings' }), readout, graphPicker, plot, legend]);
  const clock = el('output', { class: 'clock' });
  const play = iconButton('play', 'Play (Space)', () => toggle(), 'play');
  let speed = 1;
  const speedSlider = slider({ label: 'Speed', min: 0.1, max: 4, step: 0.1, value: speed, format: (v) => `×${formatNumber(v, 2)}`, onInput: (v) => (speed = v) });
  const speedChip = el('button', { type: 'button', class: 'speed-chip wide-only', title: 'Speed', text: 'Speed' });
  speedChip.addEventListener('click', () => popover(speedChip, el('div', { class: 'params' }, [speedSlider.root]), 'above'));
  const dock = el('div', { class: 'dock glass overlay' }, [iconButton('restart', 'Start again (R)', () => rebuild()), play, clock, speedChip]);
  main.append(canvas, chart, info, notes, panel, dock);

  let spec = catalogue[0]!;
  let values: Record<string, number> = {};
  let run: ModernRun | undefined;
  let running = false;
  let graph = 0;
  let lastPanel = 0;
  let charted = false;
  let insets: Insets = { left: 16, right: 16, top: 16, bottom: 16 };

  const current = (): Record<string, number> => Object.fromEntries(spec.params.map((p) => [p.name, values[p.name] ?? p.default]));

  function layout(): void {
    const wide = main.clientWidth >= 1180;
    const phone = main.clientWidth <= 700;
    insets = embedded
      ? { left: 8, right: 8, top: 8, bottom: layoutPx(52) }
      : { left: wide ? layoutPx(344) : 16, right: phone ? 16 : panel.offsetWidth + 24, top: wide ? 16 : info.offsetHeight + 24, bottom: phone && panel.offsetTop > 0 ? main.clientHeight - panel.offsetTop + 8 : layoutPx(84) };
    Object.assign(chart.style, { left: `${insets.left + 16}px`, top: `${insets.top + 16}px`, width: `${Math.max(120, main.clientWidth - insets.left - insets.right - 32)}px`, height: `${Math.max(120, main.clientHeight - insets.top - insets.bottom - 32)}px` });
  }

  function setRunning(next: boolean): void {
    running = next;
    play.replaceChildren(icon(running ? 'pause' : 'play', 20));
    play.title = running ? 'Pause (Space)' : 'Play (Space)';
  }

  function toggle(): void {
    if (!run || run.still()) return;
    if (!running && run.finished()) rebuild();
    setRunning(!running);
  }

  function rebuild(): void {
    let next: ModernRun;
    try {
      next = new ModernRun(spec.id, current());
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
      return;
    }
    run?.free();
    run = next;
    setRunning(false);
    // A formula and its graph have nothing to play.
    dock.style.display = run.still() ? 'none' : '';
    if (!embedded) {
      let url = `?mode=modern&scenario=${spec.id}`;
      for (const p of spec.params) if (values[p.name] !== undefined && values[p.name] !== p.default) url += `&${p.name}=${Number(values[p.name]!.toPrecision(6))}`;
      history.replaceState(null, '', url);
    }
    refreshPanel();
  }

  function renderAnswers(list: Answer[]): void {
    answers.replaceChildren(
      ...list.map((answer) => {
        const parts = /^(.*?)\s*\(([^()]*)\)$/.exec(answer.name);
        const [name, unit] = parts ? [parts[1]!, parts[2]!] : [answer.name, ''];
        const nodes = [el('span', { class: 'name', text: name }), el('span', { class: 'value', text: `${formatNumber(answer.value, 4)}${unit ? ` ${unit}` : ''}` })];
        if (answer.measured !== null && Number.isFinite(answer.measured)) {
          const agrees = Math.abs(answer.measured - answer.value) <= answer.within;
          nodes.push(el('span', { class: agrees ? 'measured agrees' : 'measured', text: `${agrees ? '✓ ' : ''}found ${formatNumber(answer.measured, 4)}` }));
        }
        return el('div', { class: 'answer glass', title: 'The textbook answer, and what this run has found so far' }, nodes);
      }),
    );
  }

  function refreshPanel(): void {
    if (!run) return;
    clock.textContent = run.clock();
    renderAnswers(run.answers() as Answer[]);
    const plots = run.plots() as PlotData[];
    charted = (run.picture() as Picture).kind === 'chart';
    chart.style.display = charted ? '' : 'none';
    if (charted && plots[0]) drawChart(chart, plots[0]);
    if (embedded) return;
    readout.replaceChildren(
      ...(run.readings() as Reading[]).flatMap((r) => [el('dt', { text: r.label }), el('dd', { text: r.text || `${!r.unit && Number.isInteger(r.value) ? r.value : formatNumber(r.value, 4)}${r.unit ? ` ${r.unit}` : ''}` })]),
    );
    const shown = charted ? undefined : plots[Math.min(graph, plots.length - 1)];
    plot.style.display = shown ? '' : 'none';
    legend.textContent = shown ? shown.curves.map((c) => `${['Teal', 'Amber', 'Grey'][c.tone] ?? 'Grey'}${c.style === 'dashed' ? ', dashed' : c.style === 'points' ? ' dots' : ''}: ${c.name}`).filter((_, i) => !shown.ladder || i === shown.curves.length - 1).join(' · ') : '';
    if (shown) drawPlot(plot, toPlot(shown));
  }

  function action(name: 'sliders' | 'restart', label: string, onClick: (button: HTMLButtonElement) => void): HTMLButtonElement {
    const button = el('button', { type: 'button', class: 'text-button outlined' }, [icon(name, 16), label]);
    button.addEventListener('click', () => onClick(button));
    return button;
  }

  let pending: number | undefined;
  function openParameters(anchor: HTMLElement): void {
    const box = el('div', { class: 'params' }, [el('h4', { text: 'Parameters' })]);
    for (const p of spec.params) {
      box.append(
        slider({
          label: p.label,
          min: p.min,
          max: p.max,
          step: p.step,
          value: values[p.name] ?? p.default,
          format: (v) => `${formatNumber(v)}${p.unit ? ` ${p.unit}` : ''}`,
          onInput: (v) => {
            values[p.name] = v;
            clearTimeout(pending);
            pending = window.setTimeout(() => {
              // A lesson that was playing goes on playing with the new setting.
              const was = running;
              rebuild();
              setRunning(was && !run!.still());
            }, 120);
          },
        }).root,
      );
    }
    popover(anchor, box, 'below');
  }

  function show(next: ModernSpec, chosen: Record<string, number> = {}): void {
    closePopover();
    spec = next;
    values = chosen;
    graph = 0;
    shell.setTitle(`Class ${spec.syllabus.class} · ${spec.syllabus.chapter}`, spec.title);
    description.textContent = spec.description;
    actions.replaceChildren(action('sliders', 'Parameters', openParameters), action('restart', 'Reset', () => show(spec)));
    rebuild();
    const titles = (run!.plots() as PlotData[]).map((p) => p.title);
    graphPicker.replaceChildren(
      ...(titles.length > 1
        ? [
            choice('Graph', titles.map((label, value) => ({ label, value })), 0, (v) => {
              graph = v;
              refreshPanel();
            }),
          ]
        : []),
    );
    layout();
    refreshPanel();
  }

  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLElement && e.target.matches('input, textarea, select, [contenteditable]');
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ') {
      e.preventDefault();
      toggle();
    } else if (e.key.toLowerCase() === 'r') rebuild();
    else if (e.key === '/') {
      e.preventDefault();
      openGallery();
    }
  });

  const openGallery = () => openModernGallery(catalogue, spec.id, (id) => show(catalogue.find((s) => s.id === id) ?? spec));
  shell.onTitle(openGallery);
  shell.onShare(async () => {
    const url = new URL(location.href).toString();
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied. Anyone who opens it gets exactly this.');
    } catch {
      prompt('Copy this link', url);
    }
  });
  new ResizeObserver(() => {
    layout();
    refreshPanel();
  }).observe(main);

  let last = performance.now();
  function loop(now: number): void {
    const elapsed = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (run) {
      if (running && !run.finished()) {
        run.advance(elapsed * speed);
        if (run.finished()) setRunning(false);
      }
      if (!charted) drawPicture(canvas, run.picture() as Picture, insets);
      else drawPicture(canvas, { kind: 'chart' }, insets);
      if (now - lastPanel > 200) {
        lastPanel = now;
        if (running || charted === false) refreshPanel();
      }
    }
    requestAnimationFrame(loop);
  }

  const wanted = catalogue.find((s) => s.id === query.get('scenario')) ?? catalogue[0]!;
  const chosen: Record<string, number> = {};
  for (const p of wanted.params) {
    const given = query.get(p.name);
    if (given !== null && Number.isFinite(Number(given))) chosen[p.name] = clamp(Number(given), p.min, p.max);
  }
  show(wanted, chosen);
  requestAnimationFrame(loop);
}
