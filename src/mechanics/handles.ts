import { VELOCITY_SCALE, VELOCITY_COLOR, forceColor } from './stage/renderer';
import type { Vec } from './types';

type Values = Record<string, number>;

/** A knob on the stage that stands for one or two of a scenario's parameters. */
export interface Handle {
  label: (p: Values) => string;
  color: string;
  position: (p: Values) => Vec;
  /** The parameters a pointer at `at` asks for; the caller clamps and snaps them. */
  drag: (at: Vec, p: Values) => Values;
  /** A line from here to the knob, for a velocity or a force. */
  tail?: (p: Values) => Vec;
}

const S = VELOCITY_SCALE;
const deg = (radians: number) => (radians * 180) / Math.PI;
const rad = (degrees: number) => (degrees * Math.PI) / 180;
const BODY = '#38d6f5';

/** A launch velocity drawn from `origin`: the knob sits at the arrow's tip. */
function launch(origin: (p: Values) => Vec): Handle {
  return {
    label: (p) => `${p.speed} m/s at ${p.angle}°`,
    color: VELOCITY_COLOR,
    tail: origin,
    position: (p) => {
      const [x, y] = origin(p);
      return [x + p.speed! * Math.cos(rad(p.angle!)) * S, y + p.speed! * Math.sin(rad(p.angle!)) * S];
    },
    drag: (at, p) => {
      const [x, y] = origin(p);
      const [dx, dy] = [at[0] - x, at[1] - y];
      return { speed: Math.hypot(dx, dy) / S, angle: deg(Math.atan2(dy, dx)) };
    },
  };
}

function inclineTop(length: number): Handle {
  return {
    label: (p) => `${p.angle}°`,
    color: BODY,
    position: (p) => [0, length * Math.tan(rad(p.angle!))],
    drag: (at) => ({ angle: deg(Math.atan2(Math.max(at[1], 0), length)) }),
  };
}

export const HANDLES: Record<string, Handle[]> = {
  'free-fall': [{ label: (p) => `${p.height} m`, color: BODY, position: (p) => [0, p.height! + 0.3], drag: (at) => ({ height: at[1] - 0.3 }) }],
  'thrown-upward': [
    {
      label: (p) => `${p.speed} m/s`,
      color: VELOCITY_COLOR,
      tail: () => [0, 0.3],
      position: (p) => [0, 0.3 + p.speed! * S],
      drag: (at) => ({ speed: (at[1] - 0.3) / S }),
    },
  ],
  projectile: [launch(() => [0, 0.25])],
  'projectile-from-height': [
    launch((p) => [0, p.height! + 0.25]),
    { label: (p) => `${p.height} m`, color: BODY, position: (p) => [-1, p.height!], drag: (at) => ({ height: at[1] }) },
  ],
  'incline-friction': [inclineTop(6)],
  rolling: [inclineTop(8)],
  'pushed-block': [
    {
      label: (p) => `push ${p.push} N`,
      color: forceColor('applied'),
      tail: () => [-0.4, 0.25],
      position: (p) => [-0.7 - p.push! * 0.04, 0.25],
      drag: (at) => ({ push: (-0.7 - at[0]) / 0.04 }),
    },
  ],
  atwood: [{ label: (p) => `${p.height} m below the pulley`, color: BODY, position: (p) => [0, -p.height!], drag: (at) => ({ height: -at[1] }) }],
  'vertical-circle': [
    {
      label: (p) => `${p.speed} m/s`,
      color: VELOCITY_COLOR,
      tail: (p) => [0, -p.length!],
      position: (p) => [p.speed! * S, -p.length!],
      drag: (at) => ({ speed: at[0] / S }),
    },
  ],
  'collision-1d': [
    { label: (p) => `${p.u1} m/s`, color: VELOCITY_COLOR, tail: () => [-3, 0.3], position: (p) => [-3 + p.u1! * S, 0.3], drag: (at) => ({ u1: (at[0] + 3) / S }) },
    { label: (p) => `${p.u2} m/s`, color: VELOCITY_COLOR, tail: () => [0, 0.3], position: (p) => [p.u2! * S, 0.3], drag: (at) => ({ u2: at[0] / S }) },
  ],
  seesaw: [
    { label: (p) => `${p.d1} m`, color: BODY, position: (p) => [-p.d1!, 1.2 + 0.03 * p.m1!], drag: (at) => ({ d1: -at[0] }) },
    { label: (p) => `${p.d2} m`, color: BODY, position: (p) => [p.d2!, 1.2 + 0.03 * p.m2!], drag: (at) => ({ d2: at[0] }) },
  ],
  'spring-mass': [{ label: (p) => `${p.amplitude} m`, color: BODY, position: (p) => [2 + p.amplitude!, 0.25], drag: (at) => ({ amplitude: at[0] - 2 }) }],
  'simple-pendulum': [
    {
      label: (p) => `${p.length} m, ${p.amplitude}°`,
      color: BODY,
      position: (p) => [p.length! * Math.sin(rad(p.amplitude!)), -p.length! * Math.cos(rad(p.amplitude!))],
      drag: (at) => ({ length: Math.hypot(at[0], at[1]), amplitude: Math.abs(deg(Math.atan2(at[0], -at[1]))) }),
    },
  ],
};
