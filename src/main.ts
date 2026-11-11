import './styles/tokens.css';
import './styles/app.css';
import { loadEngine } from './engine';
import { mountMechanics } from './mechanics/app';
import { buildShell, type Mode } from './shell';
import { el } from './ui';
import { mountWaves } from './waves/app';

const query = new URLSearchParams(location.search);
const embedded = query.has('embed');
document.body.classList.toggle('embed', embedded);

const root = document.querySelector<HTMLDivElement>('#app')!;
const mode: Mode = query.get('mode') === 'waves' || query.has('preset') ? 'waves' : 'mechanics';

await loadEngine();
const shell = buildShell(mode);
const main = el('main', { class: `mode mode-${mode}` });
root.replaceChildren(shell.root, main);
if (mode === 'waves') mountWaves(main, query, embedded, shell);
else await mountMechanics(main, query, embedded, shell);
