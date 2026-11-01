import './style.css';
import { loadEngine } from './engine';
import { mountMechanics } from './mechanics/app';
import { mountWaves } from './waves/app';
import { el, toggleTheme } from './ui';

type Mode = 'mechanics' | 'waves';

const query = new URLSearchParams(location.search);
const embedded = query.has('embed');
document.body.classList.toggle('embed', embedded);

const root = document.querySelector<HTMLDivElement>('#app')!;
const mode: Mode = query.get('mode') === 'waves' || query.has('preset') ? 'waves' : 'mechanics';

function header(active: Mode): HTMLElement {
  const link = (m: Mode, text: string) =>
    el('a', { href: `?mode=${m}`, class: m === active ? 'tab active' : 'tab', text });
  const theme = el('button', { class: 'icon-button', type: 'button', title: 'Toggle light and dark', text: '◐' });
  theme.addEventListener('click', toggleTheme);
  return el('header', { class: 'header' }, [
    el('a', { class: 'brand', href: 'https://github.com/soliton-physics' }, [
      el('img', { src: './favicon.svg', alt: '', width: 28, height: 28 }),
      el('span', { text: 'Soliton Playground' }),
    ]),
    el('nav', { class: 'tabs' }, [link('mechanics', 'Mechanics'), link('waves', 'Waves')]),
    el('nav', { class: 'links' }, [
      el('a', { href: import.meta.env.VITE_DOCS_URL ?? 'https://soliton-docs.vercel.app', text: 'Docs' }),
      el('a', { href: 'https://github.com/soliton-physics/soliton', text: 'Engine' }),
      theme,
    ]),
  ]);
}

await loadEngine();
root.replaceChildren(header(mode));
const main = el('main', { class: `mode mode-${mode}` });
root.append(main);
if (mode === 'waves') mountWaves(main, query);
else mountMechanics(main, query, embedded);
