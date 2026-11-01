import type { View } from './types';

/** Maps world metres to canvas pixels. Y points up in the world and down on the canvas. */
export class Camera {
  centerX = 0;
  centerY = 0;
  scale = 50;

  constructor(private width = 1, private height = 1) {}

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  fit(view: View): void {
    this.centerX = view.center[0];
    this.centerY = view.center[1];
    this.scale = this.height / (2 * view.half_height);
  }

  toScreen(x: number, y: number): [number, number] {
    return [this.width / 2 + (x - this.centerX) * this.scale, this.height / 2 - (y - this.centerY) * this.scale];
  }

  toWorld(sx: number, sy: number): [number, number] {
    return [this.centerX + (sx - this.width / 2) / this.scale, this.centerY - (sy - this.height / 2) / this.scale];
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const [wx, wy] = this.toWorld(sx, sy);
    this.scale *= factor;
    const [nx, ny] = this.toWorld(sx, sy);
    this.centerX += wx - nx;
    this.centerY += wy - ny;
  }

  pan(dx: number, dy: number): void {
    this.centerX -= dx / this.scale;
    this.centerY += dy / this.scale;
  }

  get bounds(): { left: number; right: number; top: number; bottom: number } {
    const [left, top] = this.toWorld(0, 0);
    const [right, bottom] = this.toWorld(this.width, this.height);
    return { left, right, top, bottom };
  }
}
