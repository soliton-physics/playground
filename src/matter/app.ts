import { MatterRun, matter_catalogue } from '../engine';
import { mountLessons } from '../modern/app';
import type { ModernSpec } from '../modern/types';
import type { Shell } from '../shell';
import { drawMatter, type MatterPicture } from './stage';

/** The properties of matter: solids under stress, fluids at rest and in flow, heat and temperature. */
export function mountMatter(main: HTMLElement, query: URLSearchParams, embedded: boolean, shell: Shell): void {
  mountLessons(main, query, embedded, shell, {
    mode: 'matter',
    catalogue: () => matter_catalogue() as ModernSpec[],
    start: (id, params) => new MatterRun(id, params),
    draw: (canvas, picture, insets, plain) => drawMatter(canvas, picture as MatterPicture, insets, plain),
    search: 'Search: stress, pressure, Bernoulli, viscosity, latent heat…',
  });
}
