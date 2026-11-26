import '../landing/landing.css';
import './sim.css';

/*
 * A simulation page loads quickly and reads as a page: the playground, with its engine, is only fetched when someone
 * asks to run it. Then it takes the poster's place, embedded, and gets the keyboard at once.
 */
for (const stage of document.querySelectorAll<HTMLElement>('.sim-stage')) {
  const run = stage.querySelector<HTMLButtonElement>('.sim-run');
  run?.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.src = stage.dataset.src!;
    frame.title = document.querySelector('h1')?.textContent ?? 'Simulation';
    frame.allow = 'fullscreen';
    frame.addEventListener('load', () => frame.focus());
    stage.replaceChildren(frame);
    stage.classList.add('running');
  });
}
