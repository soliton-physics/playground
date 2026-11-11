import { iconButton } from './controls';
import { icon } from './icons';
import { el, toggleTheme } from './ui';

export type Mode = 'mechanics' | 'waves';

/** The top bar, and the two things in it that belong to whichever mode is running. */
export interface Shell {
  root: HTMLElement;
  setTitle(group: string, title: string): void;
  onTitle(open: () => void): void;
  onShare(share: () => void): void;
}

export function buildShell(active: Mode): Shell {
  const group = el('small');
  const title = el('b');
  const titleButton = el('button', { type: 'button', class: 'title-button', title: 'Choose what to play with ( / )' }, [
    icon('search', 16),
    el('span', { class: 'title-text' }, [group, title]),
    icon('chevron', 16),
  ]);
  let open = () => {};
  let share = () => {};
  titleButton.addEventListener('click', () => open());

  const tab = (mode: Mode, text: string, name: 'atom' | 'wave') =>
    el('a', { href: `?mode=${mode}`, class: mode === active ? 'mode-tab active' : 'mode-tab' }, [icon(name, 16), el('span', { text })]);
  const docs = import.meta.env.VITE_DOCS_URL ?? 'https://soliton-docs.vercel.app';
  const shareButton = el('button', { type: 'button', class: 'text-button' }, [icon('share', 16), el('span', { class: 'wide-only', text: 'Share' })]);
  shareButton.addEventListener('click', () => share());

  const root = el('header', { class: 'topbar' }, [
    el('div', { class: 'topbar-left' }, [
      el('a', { class: 'brand', href: 'https://github.com/soliton-physics', title: 'Soliton Physics' }, [
        el('img', { src: './favicon.svg', alt: '', width: 26, height: 26 }),
        el('span', { text: 'Soliton' }),
      ]),
      el('nav', { class: 'modes' }, [tab('mechanics', 'Mechanics', 'atom'), tab('waves', 'Waves', 'wave')]),
    ]),
    titleButton,
    el('div', { class: 'topbar-right' }, [
      shareButton,
      el('a', { class: 'text-button', href: docs, title: 'Read the docs' }, [icon('docs', 16), el('span', { class: 'wide-only', text: 'Docs' })]),
      iconButton('theme', 'Light or dark', toggleTheme),
    ]),
  ]);

  return {
    root,
    setTitle(groupText, titleText) {
      group.textContent = groupText;
      title.textContent = titleText;
      document.title = `${titleText} · Soliton Playground`;
    },
    onTitle: (handler) => (open = handler),
    onShare: (handler) => (share = handler),
  };
}
