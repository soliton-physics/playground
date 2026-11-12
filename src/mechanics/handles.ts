import { VELOCITY_COLOR, forceColor, scales } from './stage/renderer';
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
      return [x + p.speed! * Math.cos(rad(p.angle!)) * scales.velocity, y + p.speed! * Math.sin(rad(p.angle!)) * scales.velocity];
    },
    drag: (at, p) => {
      const [x, y] = origin(p);
      const [dx, dy] = [at[0] - x, at[1] - y];
      return { speed: Math.hypot(dx, dy) / scales.velocity, angle: deg(Math.atan2(dy, dx)) };
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

// The Earth of the gravitation scenarios, for placing their knobs.
const EARTH_RADIUS = 6.371e6;
const EARTH_MU = 6.674e-11 * 5.972e24;
const KM = 1000;

/** A satellite's distance from the centre of the Earth, as a knob on the satellite itself. */
function altitude(param: string): Handle {
  return {
    label: (p) => `${p[param]} km up`,
    color: BODY,
    position: (p) => [EARTH_RADIUS + p[param]! * KM, 0],
    drag: (at) => ({ [param]: (Math.hypot(at[0], at[1]) - EARTH_RADIUS) / KM }),
  };
}

/** A speed along the x axis, drawn from `tail` towards `sign`: the knob is the tip of the velocity arrow. */
function speedAlong(param: string, tail: Vec, sign: 1 | -1): Handle {
  return {
    label: (p) => `${p[param]} m/s`,
    color: VELOCITY_COLOR,
    tail: () => tail,
    position: (p) => [tail[0] + sign * p[param]! * scales.velocity, tail[1]],
    drag: (at) => ({ [param]: (sign * (at[0] - tail[0])) / scales.velocity }),
  };
}

/** How far a block on a track starts from where it would rest, as a knob on the block. */
function pulledOut(param: string, rest: number): Handle {
  return { label: (p) => `${p[param]} m`, color: BODY, position: (p) => [rest + p[param]!, 0.25], drag: (at) => ({ [param]: at[0] - rest }) };
}

export const HANDLES: Record<string, Handle[]> = {
  'stopping-distance': [speedAlong('speed', [0, 0.25], 1)],
  'projectile-on-incline': [
    {
      label: (p) => `${p.speed} m/s, ${p.elevation}° above the slope`,
      color: VELOCITY_COLOR,
      tail: (p) => [-0.252 * Math.sin(rad(p.slope!)), 0.252 * Math.cos(rad(p.slope!))],
      position: (p) => {
        const angle = rad(p.slope! + Math.min(p.elevation!, 85 - p.slope!));
        return [-0.252 * Math.sin(rad(p.slope!)) + p.speed! * Math.cos(angle) * scales.velocity, 0.252 * Math.cos(rad(p.slope!)) + p.speed! * Math.sin(angle) * scales.velocity];
      },
      drag: (at, p) => {
        const [dx, dy] = [at[0] + 0.252 * Math.sin(rad(p.slope!)), at[1] - 0.252 * Math.cos(rad(p.slope!))];
        return { speed: Math.hypot(dx, dy) / scales.velocity, elevation: deg(Math.atan2(dy, dx)) - p.slope! };
      },
    },
  ],
  'circular-motion': [
    {
      label: (p) => `${p.speed} m/s`,
      color: VELOCITY_COLOR,
      tail: (p) => [p.radius!, 0],
      position: (p) => [p.radius!, p.speed! * scales.velocity],
      drag: (at) => ({ speed: at[1] / scales.velocity }),
    },
  ],
  'connected-blocks': [
    {
      label: (p) => `pull ${p.force} N`,
      color: forceColor('applied'),
      tail: () => [2.0, 0.25],
      position: (p) => [2.3 + p.force! * 0.04, 0.25],
      drag: (at) => ({ force: (at[0] - 2.3) / 0.04 }),
    },
  ],
  'spring-compression': [speedAlong('speed', [3.8, 0.25], -1)],
  'ball-on-spring': [{ label: (p) => `${p.height} m above the spring`, color: BODY, position: (p) => [0, 1.35 + p.height!], drag: (at) => ({ height: at[1] - 1.35 }) }],
  'oblique-collision': [
    { label: (p) => `off-centre by ${p.offset} of a diameter`, color: BODY, position: (p) => [-3, 0.6 * p.offset!], drag: (at) => ({ offset: at[1] / 0.6 }) },
  ],
  'torque-on-rod': [{ label: (p) => `${p.length} m`, color: BODY, position: (p) => [p.length!, 0], drag: (at) => ({ length: Math.hypot(at[0], at[1]) }) }],
  'springs-in-series': [pulledOut('amplitude', 3.3)],
  'springs-in-parallel': [pulledOut('amplitude', 2.3)],
  'circular-orbit': [altitude('altitude')],
  'elliptical-orbit': [
    {
      label: (p) => `${p.boost} × circular speed`,
      color: VELOCITY_COLOR,
      tail: (p) => [EARTH_RADIUS + p.perigee! * KM, 0],
      position: (p) => {
        const r = EARTH_RADIUS + p.perigee! * KM;
        return [r, p.boost! * Math.sqrt(EARTH_MU / r) * scales.velocity];
      },
      drag: (at, p) => ({ boost: at[1] / scales.velocity / Math.sqrt(EARTH_MU / (EARTH_RADIUS + p.perigee! * KM)) }),
    },
    altitude('perigee'),
  ],
  'escape-velocity': [
    {
      label: (p) => `${p.speed} km/s`,
      color: VELOCITY_COLOR,
      tail: () => [0, EARTH_RADIUS],
      position: (p) => [0, EARTH_RADIUS + p.speed! * KM * scales.velocity],
      drag: (at) => ({ speed: (at[1] - EARTH_RADIUS) / scales.velocity / KM }),
    },
  ],
  'coupled-oscillators': [
    { label: (p) => `${p.first} m from rest`, color: BODY, position: (p) => [2 + p.first!, 0.25], drag: (at) => ({ first: at[0] - 2 }) },
    { label: (p) => `${p.second} m from rest`, color: BODY, position: (p) => [4 + p.second!, 0.25], drag: (at) => ({ second: at[0] - 4 }) },
  ],
  'damped-oscillator': [{ label: (p) => `${p.amplitude} m`, color: BODY, position: (p) => [2 + p.amplitude!, 0.25], drag: (at) => ({ amplitude: at[0] - 2 }) }],
  'free-fall': [{ label: (p) => `${p.height} m`, color: BODY, position: (p) => [0, p.height! + 0.3], drag: (at) => ({ height: at[1] - 0.3 }) }],
  'thrown-upward': [
    {
      label: (p) => `${p.speed} m/s`,
      color: VELOCITY_COLOR,
      tail: () => [0, 0.3],
      position: (p) => [0, 0.3 + p.speed! * scales.velocity],
      drag: (at) => ({ speed: (at[1] - 0.3) / scales.velocity }),
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
      position: (p) => [p.speed! * scales.velocity, -p.length!],
      drag: (at) => ({ speed: at[0] / scales.velocity }),
    },
  ],
  'collision-1d': [
    { label: (p) => `${p.u1} m/s`, color: VELOCITY_COLOR, tail: () => [-3, 0.3], position: (p) => [-3 + p.u1! * scales.velocity, 0.3], drag: (at) => ({ u1: (at[0] + 3) / scales.velocity }) },
    { label: (p) => `${p.u2} m/s`, color: VELOCITY_COLOR, tail: () => [0, 0.3], position: (p) => [p.u2! * scales.velocity, 0.3], drag: (at) => ({ u2: at[0] / scales.velocity }) },
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
