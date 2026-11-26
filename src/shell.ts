import { iconButton, popover } from './controls';
import { icon, type IconName } from './icons';
import { el, presenting, setPresenting, toggleTheme } from './ui';

export type Mode = 'mechanics' | 'waves' | 'optics' | 'thermal' | 'circuits' | 'modern' | 'matter' | 'magnetism' | 'maths';

/** The subjects, in the order the syllabus meets them, with what each holds. */
const SUBJECTS: { mode: Mode; name: string; icon: IconName; holds: string }[] = [
  { mode: 'mechanics', name: 'Mechanics', icon: 'atom', holds: 'Motion, forces, energy, rotation, gravitation, charges and fields. Build your own.' },
  { mode: 'matter', name: 'Matter', icon: 'drop', holds: 'Stress and strain, pressure, floating, Bernoulli, viscosity, expansion, heat and change of state.' },
  { mode: 'waves', name: 'Waves', icon: 'wave', holds: 'Waves on strings and in air, light as a wave, interference and diffraction, solitons.' },
  { mode: 'thermal', name: 'Thermal', icon: 'flame', holds: 'Kinetic theory, thermodynamics and the Carnot engine, Monte Carlo and the Ising model.' },
  { mode: 'circuits', name: 'Circuits', icon: 'circuit', holds: 'Current electricity, capacitors and inductors, alternating current.' },
  { mode: 'magnetism', name: 'Magnetism', icon: 'magnet', holds: 'The field of a current, the force on a current, Faraday and Lenz, the generator and the transformer.' },
  { mode: 'optics', name: 'Optics', icon: 'lens', holds: 'Mirrors, refraction, lenses, the prism, the microscope and the telescope.' },
  { mode: 'modern', name: 'Modern', icon: 'orbits', holds: 'The photoelectric effect, matter waves, the Bohr atom, radioactivity and nuclei.' },
  { mode: 'maths', name: 'Maths', icon: 'graph', holds: 'Type any function: its graph, its derivative, the area under it and its integral, worked out.' },
];

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

  // One button for the subject in hand; the rest are a click away, however many there come to be.
  const here = SUBJECTS.find((s) => s.mode === active)!;
  const subject = el('button', { type: 'button', class: 'subject-button', title: 'Choose a subject' }, [icon(here.icon, 16), el('span', { text: here.name }), icon('chevron', 14)]);
  subject.addEventListener('click', () =>
    popover(
      subject,
      el(
        'nav',
        { class: 'subject-menu' },
        SUBJECTS.map((s) =>
          el('a', { href: `?mode=${s.mode}`, class: s.mode === active ? 'subject active' : 'subject' }, [icon(s.icon, 20), el('span', {}, [el('b', { text: s.name }), el('small', { text: s.holds })])]),
        ),
      ),
      'below',
    ),
  );
  const docs = import.meta.env.VITE_DOCS_URL ?? 'https://docs.solitonplay.com';
  const shareButton = el('button', { type: 'button', class: 'text-button' }, [icon('share', 16), el('span', { class: 'wide-only', text: 'Share' })]);
  shareButton.addEventListener('click', () => share());

  const root = el('header', { class: 'topbar' }, [
    el('div', { class: 'topbar-left' }, [
      el('a', { class: 'brand', href: '/', title: 'Soliton: home' }, [
        el('img', { src: '/favicon.svg', alt: '', width: 26, height: 26 }),
        el('span', { text: 'Soliton' }),
      ]),
      subject,
    ]),
    titleButton,
    el('div', { class: 'topbar-right' }, [
      shareButton,
      el('a', { class: 'text-button', href: docs, title: 'Read the docs' }, [icon('docs', 16), el('span', { class: 'wide-only', text: 'Docs' })]),
      iconButton('present', 'For a projector: bigger and bolder ( T )', () => setPresenting(!presenting())),
      iconButton('theme', 'Light or dark', toggleTheme),
    ]),
  ]);

  return {
    root,
    setTitle(groupText, titleText) {
      group.textContent = groupText;
      title.textContent = titleText;
      document.title = groupText ? `${titleText} · ${groupText} | Soliton physics simulation` : `${titleText} | Soliton physics simulation`;
    },
    onTitle: (handler) => (open = handler),
    onShare: (handler) => (share = handler),
  };
}
