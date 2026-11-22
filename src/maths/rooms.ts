import { el } from '../ui';

export type Room = 'functions' | 'matrices';

const ROOMS: { room: Room; name: string }[] = [
  { room: 'functions', name: 'Functions' },
  { room: 'matrices', name: 'Matrices' },
];

/** The rooms of the Maths subject, side by side at the top of the panel; each is its own page. */
export function roomTabs(active: Room): HTMLElement {
  return el(
    'nav',
    { class: 'choice maths-rooms', 'aria-label': 'Rooms' },
    ROOMS.map((r) => {
      const link = el('a', { href: `?mode=maths&room=${r.room}`, text: r.name });
      if (r.room === active) link.setAttribute('aria-current', 'page');
      return link;
    }),
  );
}
