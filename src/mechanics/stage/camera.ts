import type { View } from '../types';

/** A body's footprint in world metres: its centre and a radius that covers its shape. */
export interface Box {
  x: number;
  y: number;
  radius: number;
}

/** Maps world metres to canvas pixels. Y points up in the world and down on the canvas. */
export class Camera {
  centerX = 0;
  centerY = 0;
  scale = 50;
  following = true;

  constructor(private width = 1, private height = 1) {}

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /** Screen pixels the floating panels cover on each side; framing keeps the action clear of them. */
  insets = { left: 0, right: 0, top: 0, bottom: 0 };

  private get usable(): { width: number; height: number; dx: number; dy: number } {
    const { left, right, top, bottom } = this.insets;
    const width = Math.max(80, this.width - left - right);
    const height = Math.max(80, this.height - top - bottom);
    return { width, height, dx: (left - right) / 2, dy: (top - bottom) / 2 };
  }

  /** Frames the suggested view and resumes following the action. */
  fit(view: View): void {
    const usable = this.usable;
    this.scale = usable.height / (2 * view.half_height);
    if (view.half_width) this.scale = Math.min(this.scale, usable.width / (2 * view.half_width));
    this.centerX = view.center[0] - usable.dx / this.scale;
    // When the width decides the scale there is height to spare: keep the bottom of the view at the bottom of the
    // stage, so the spare room is sky above the action and not ground below it.
    const spare = usable.height / (2 * this.scale) - view.half_height;
    this.centerY = view.center[1] + spare + usable.dy / this.scale;
    this.following = true;
  }

  /**
   * Keeps every moving body in frame: zooms out when they spread wider than the view and pans when one
   * reaches the edge. Never zooms in on its own, and stops once the user pans or zooms by hand.
   */
  follow(boxes: Box[]): void {
    if (!this.following || boxes.length === 0) return;
    const margin = 0.08;
    let left = Infinity;
    let right = -Infinity;
    let bottom = Infinity;
    let top = -Infinity;
    for (const b of boxes) {
      left = Math.min(left, b.x - b.radius);
      right = Math.max(right, b.x + b.radius);
      bottom = Math.min(bottom, b.y - b.radius);
      top = Math.max(top, b.y + b.radius);
    }
    const usableWidth = this.width * (1 - 2 * margin);
    const usableHeight = this.height * (1 - 2 * margin);
    const needed = Math.min(usableWidth / Math.max(right - left, 1e-9), usableHeight / Math.max(top - bottom, 1e-9));
    const targetScale = Math.min(this.scale, needed);
    const halfW = this.width / (2 * targetScale);
    const halfH = this.height / (2 * targetScale);
    const padX = halfW * margin * 2;
    const padY = halfH * margin * 2;
    let targetX = this.centerX;
    let targetY = this.centerY;
    if (left - padX < targetX - halfW) targetX = left - padX + halfW;
    if (right + padX > targetX + halfW) targetX = right + padX - halfW;
    if (bottom - padY < targetY - halfH) targetY = bottom - padY + halfH;
    if (top + padY > targetY + halfH) targetY = top + padY - halfH;
    const ease = 0.2;
    this.scale += (targetScale - this.scale) * ease;
    this.centerX += (targetX - this.centerX) * ease;
    this.centerY += (targetY - this.centerY) * ease;
  }

  toScreen(x: number, y: number): [number, number] {
    return [this.width / 2 + (x - this.centerX) * this.scale, this.height / 2 - (y - this.centerY) * this.scale];
  }

  toWorld(sx: number, sy: number): [number, number] {
    return [this.centerX + (sx - this.width / 2) / this.scale, this.centerY - (sy - this.height / 2) / this.scale];
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    this.following = false;
    const [wx, wy] = this.toWorld(sx, sy);
    this.scale *= factor;
    const [nx, ny] = this.toWorld(sx, sy);
    this.centerX += wx - nx;
    this.centerY += wy - ny;
  }

  pan(dx: number, dy: number): void {
    this.following = false;
    this.centerX -= dx / this.scale;
    this.centerY += dy / this.scale;
  }

  get bounds(): { left: number; right: number; top: number; bottom: number } {
    const [left, top] = this.toWorld(0, 0);
    const [right, bottom] = this.toWorld(this.width, this.height);
    return { left, right, top, bottom };
  }
}
