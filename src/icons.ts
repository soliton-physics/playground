/** A small stroke icon set, drawn on a 24 px grid so every button shares one visual weight. */
const paths = {
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
  step: '<path d="M6 5.5v13l9-6.5z" fill="currentColor" stroke="none"/><path d="M18 5v14"/>',
  restart: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  forces: '<path d="M12 20V5M6.5 10.5 12 5l5.5 5.5"/>',
  velocity: '<path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5"/>',
  acceleration: '<path d="M3 12h9M8 7l5 5-5 5M13 7l5 5-5 5"/>',
  trail: '<path d="M3 17c3-9 6 3 9-4s5-6 9-7" stroke-dasharray="2.5 3"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  share: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 13v6h14v-6"/>',
  theme: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  docs: '<path d="M6 4h9l4 4v12H6z"/><path d="M14 4v5h5M9 13h7M9 16.5h7"/>',
  panel: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M14.5 5v14"/>',
  cursor: '<path d="m5 3 6 16 2.5-6.5L20 10z"/>',
  ball: '<circle cx="12" cy="12" r="7.5"/>',
  box: '<rect x="4.5" y="6.5" width="15" height="11" rx="1"/>',
  polygon: '<path d="M12 3.5 20.5 9.7 17.3 19.5H6.7L3.5 9.7z"/>',
  incline: '<path d="M3.5 19.5h17v-13z"/>',
  wall: '<path d="M9.5 3.5h5v17h-5z"/><path d="M9.5 9h5M9.5 15h5"/>',
  platform: '<path d="M3 15h18v4H3z"/><path d="M5 19l-2 2M10 19l-2 2M15 19l-2 2M20 19l-2 2"/>',
  rope: '<path d="M5 5c6 0 2 14 14 14"/><circle cx="5" cy="5" r="1.6" fill="currentColor"/><circle cx="19" cy="19" r="1.6" fill="currentColor"/>',
  rod: '<path d="M6 18 18 6"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/>',
  spring: '<path d="M3 12h3l1.5-5 3 10 3-10 3 10L18 12h3"/>',
  pin: '<circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
  erase: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12"/>',
  redo: '<path d="m15 7 5 5-5 5"/><path d="M20 12H10a6 6 0 0 0 0 12"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 19h14"/>',
  remix: '<path d="M4 7h4l8 10h4M4 17h4l2.5-3M13.5 10 16 7h4"/><path d="m18 5 2 2-2 2M18 15l2 2-2 2"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5V4.5a1.5 1.5 0 0 1 3 0V11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 6.5-6 6.5-3 0-4.500-1.500-6.500-5L5 12.500A1.500 1.500 0 0 1 8 12z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  parts: '<path d="M2 9c2.500-5 5 5 7.500 0s5 5 7.500 0 2.500-2 5 0"/><path d="M2 16c3.300-5 6.700 5 10 0s6.700 5 10 0" opacity=".55"/>',
  wave: '<path d="M2 14c3 0 3-7 6-7s3 10 6 10 3-7 6-7"/>',
  atom: '<circle cx="12" cy="12" r="1.8" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(120 12 12)"/>',
} as const;

export type IconName = keyof typeof paths;

export function icon(name: IconName, size = 18): SVGSVGElement {
  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
  return holder.firstElementChild as SVGSVGElement;
}
