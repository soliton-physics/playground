import { MagnetismRun, magnetism_catalogue } from '../engine';
import { mountLessons } from '../modern/app';
import type { ModernSpec } from '../modern/types';
import type { Shell } from '../shell';
import { drawMagnetism, type MagnetismPicture } from './stage';

/** Currents and magnetism: the field a current makes, the force on a current, electromagnetic induction. */
export function mountMagnetism(main: HTMLElement, query: URLSearchParams, embedded: boolean, shell: Shell): void {
  mountLessons(main, query, embedded, shell, {
    mode: 'magnetism',
    catalogue: () => magnetism_catalogue() as ModernSpec[],
    start: (id, params) => new MagnetismRun(id, params),
    draw: (canvas, picture, insets, plain) => drawMagnetism(canvas, picture as MagnetismPicture, insets, plain),
    search: 'Search: solenoid, Faraday, Lenz, generator, transformer…',
  });
}
