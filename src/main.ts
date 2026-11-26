import './styles/tokens.css';
import './styles/app.css';
import { loadEngine } from './engine';
import { mountCircuits } from './circuits/app';
import { mountMagnetism } from './magnetism/app';
import { mountMatter } from './matter/app';
import { mountMaths } from './maths/app';
import { mountMechanics } from './mechanics/app';
import { mountModern } from './modern/app';
import { mountOptics } from './optics/app';
import { mountThermal, thermalCatalogue } from './thermal/app';
import { mountStatistics, statisticalCatalogue } from './thermal/statistics';
import { trackScenes } from './analytics';
import { buildShell, type Mode } from './shell';
import { el, presenting, setPresenting } from './ui';
import { mountWaves } from './waves/app';

const query = new URLSearchParams(location.search);
const embedded = query.has('embed');
document.body.classList.toggle('embed', embedded);
if (query.has('present')) setPresenting(true);
document.addEventListener('keydown', (e) => {
  const typing = e.target instanceof HTMLElement && e.target.matches('input, textarea, select, [contenteditable]');
  if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 't') setPresenting(!presenting());
});

const root = document.querySelector<HTMLDivElement>('#app')!;
const asked = query.get('mode');
const mode: Mode = asked === 'optics' || asked === 'thermal' || asked === 'circuits' || asked === 'modern' || asked === 'matter' || asked === 'magnetism' || asked === 'maths' ? asked : query.get('mode') === 'waves' || query.has('preset') ? 'waves' : 'mechanics';

await loadEngine();
const shell = buildShell(mode);
const main = el('main', { class: `mode mode-${mode}` });
root.replaceChildren(shell.root, main);
if (mode === 'waves') mountWaves(main, query, embedded, shell);
else if (mode === 'optics') mountOptics(main, query, embedded, shell);
else if (mode === 'thermal') {
  // The thermal tab holds two kinds of thing, each with a stage of its own: the gas, and models run by chance.
  if (statisticalCatalogue().some((s) => s.id === query.get('scenario'))) mountStatistics(main, query, embedded, shell, thermalCatalogue());
  else mountThermal(main, query, embedded, shell);
}
else if (mode === 'circuits') mountCircuits(main, query, embedded, shell);
else if (mode === 'modern') mountModern(main, query, embedded, shell);
else if (mode === 'matter') mountMatter(main, query, embedded, shell);
else if (mode === 'magnetism') mountMagnetism(main, query, embedded, shell);
else if (mode === 'maths') mountMaths(main, query, embedded, shell);
else await mountMechanics(main, query, embedded, shell);
// Counted once the subject has put its scene in the address, and again each time it moves to another.
trackScenes();
