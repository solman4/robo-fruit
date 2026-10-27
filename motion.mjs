import * as THREE from 'three';

const DEG = Math.PI / 180;
const TAU = 2 * Math.PI;
const DEFAULT_DIMENSIONS = Object.freeze({ thigh: .067, shin: .056, ankleHeight: .057, hipHeight: .180, hipRollHeight: .223 });
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const smooth = n => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
const phaseOf = (time, duration) => ((Number.isFinite(time) ? time : 0) % duration + duration) % duration / duration;

export const JOINTS = [
  { key: 'neckYaw', label: 'Quay đầu', axis: 'y', min: -60, max: 60, defaultValue: 0 },
  { key: 'neckPitch', label: 'Gật đầu', axis: 'x', min: -30, max: 30, defaultValue: 0 },
  { key: 'waist', label: 'Xoay thân', axis: 'y', min: -35, max: 35, defaultValue: 0 },
  ...[['left', 'trái', 1], ['right', 'phải', -1]].flatMap(([side, label, sign]) => [
    { key: `${side}ShoulderRoll`, label: `Dang tay ${label}`, axis: 'z', min: sign > 0 ? 0 : -135, max: sign > 0 ? 135 : 0, defaultValue: 12 * sign },
    { key: `${side}ShoulderPitch`, label: `Nâng tay ${label}`, axis: 'x', min: -150, max: 65, defaultValue: 0 },
    { key: `${side}Elbow`, label: `Khuỷu tay ${label}`, axis: 'x', min: -145, max: 15, defaultValue: 0 },
    { key: `${side}Wrist`, label: `Cổ tay ${label}`, axis: 'y', min: -80, max: 80, defaultValue: 0 },
    { key: `${side}HipYaw`, label: `Xoay hông ${label}`, axis: 'y', min: -35, max: 35, defaultValue: 0 },
    { key: `${side}HipRoll`, label: `Dang chân ${label}`, axis: 'z', min: -30, max: 30, defaultValue: 0 },
    { key: `${side}HipPitch`, label: `Nâng chân ${label}`, axis: 'x', min: -90, max: 45, defaultValue: 0 },
    { key: `${side}Knee`, label: `Đầu gối ${label}`, axis: 'x', min: 0, max: 125, defaultValue: 0 },
    { key: `${side}AnklePitch`, label: `Gập cổ chân ${label}`, axis: 'x', min: -75, max: 55, defaultValue: 0 },
    { key: `${side}AnkleRoll`, label: `Nghiêng bàn chân ${label}`, axis: 'z', min: -25, max: 25, defaultValue: 0 }
  ])
];

export const MOTIONS = [
  { key: 'idle', label: 'Đứng yên', duration: 4 },
  { key: 'walk', label: 'Đi bộ', duration: 1.6 },
  { key: 'run', label: 'Chạy', duration: .9 },
  { key: 'jump', label: 'Nhảy', duration: 2.4 },
  { key: 'wave', label: 'Vẫy tay', duration: 2.8 },
  { key: 'dance', label: 'Nhún nhảy', duration: 3.2 },
  { key: 'talk', label: 'Nói chuyện', duration: 3.6 }
];

/** Applies a complete neutral pose plus finite, clamped degree overrides. */
export function applyPose(rig, pose = {}) {
  for (const joint of JOINTS) {
    const node = rig.joints[joint.key];
    if (!node) continue;
    const neutral = Number.isFinite(rig.restPose?.[joint.key]) ? rig.restPose[joint.key] : joint.defaultValue;
    const value = Number.isFinite(pose?.[joint.key]) ? pose[joint.key] : neutral;
    node.rotation.set(0, 0, 0);
    node.rotation[joint.axis] = clamp(value, joint.min, joint.max) * DEG;
  }
  return rig;
}

// Two-link sagittal IK. Local -Y is down; knee flexion rotates the shin toward -Z.
// Flat soles stay at the requested height because ankle pitch cancels leg pitch.
function placeFoot(pose, side, forward, lift, rootY, dimensions) {
  const a = dimensions.thigh, b = dimensions.shin;
  const down = dimensions.hipHeight + rootY - dimensions.ankleHeight - lift;
  const length = Math.hypot(down, forward);
  const reachable = clamp(length, Math.abs(a - b) + 1e-7, a + b);
  const knee = Math.acos(clamp((reachable * reachable - a * a - b * b) / (2 * a * b), -1, 1));
  const hip = Math.atan2(-forward, down) - Math.atan2(b * Math.sin(knee), a + b * Math.cos(knee));
  pose[`${side}HipPitch`] = hip / DEG;
  pose[`${side}Knee`] = knee / DEG;
  pose[`${side}AnklePitch`] = -(hip + knee) / DEG;
}

function blinkAt(p) {
  const distance = Math.abs(p - .76);
  return distance > .035 ? 1 : 1 - .98 * Math.cos(distance / .035 * Math.PI / 2) ** 2;
}

/** Pure deterministic motion sampler. Distances are metres; joint values are degrees. */
export function evaluateMotion(name, time, dimensions = DEFAULT_DIMENSIONS) {
  const motion = MOTIONS.find(item => item.key === name) || MOTIONS[0];
  const p = phaseOf(time, motion.duration), angle = p * TAU;
  const d = { ...DEFAULT_DIMENSIONS, ...dimensions };
  const state = { pose: {}, rootY: 0, rootZ: 0, rootYaw: 0, blink: blinkAt(p), mouth: 0 };
  const pose = state.pose;
  if (motion.key === 'walk' || motion.key === 'run') {
    const run = motion.key === 'run';
    state.rootY = run ? -.018 + .006 * Math.cos(angle * 2) : -.010 + .002 * Math.cos(angle * 2);
    for (const [side, offset] of [['left', 0], ['right', .5]]) {
      const phase = (p + offset) % 1;
      const swing = run ? .66 : .5;
      const forward = phase < swing
        ? -(run ? .022 : .016) * Math.cos(Math.PI * phase / swing)
        : (run ? .022 : .016) * Math.cos(Math.PI * (phase - swing) / (1 - swing));
      const lift = phase < swing ? (run ? .025 : .012) * Math.sin(Math.PI * phase / swing) ** 2 : 0;
      placeFoot(pose, side, forward, lift, state.rootY, d);
      const armWave = Math.sin((p + offset) * TAU);
      pose[`${side}ShoulderPitch`] = (run ? 30 : 18) * armWave - (run ? 15 : 0);
      pose[`${side}Elbow`] = run ? -64 - 14 * armWave : -10 - 6 * armWave;
    }
    pose.waist = (run ? 5 : 3) * Math.sin(angle);
    pose.neckYaw = -pose.waist * .5;
  } else if (motion.key === 'jump') {
    let airborne = false, tuck = 0;
    if (p < .18) state.rootY = -.024 * smooth(p / .18);
    else if (p < .29) state.rootY = -.024 * (1 - smooth((p - .18) / .11));
    else if (p < .65) {
      const flight = (p - .29) / .36;
      state.rootY = .075 * Math.sin(Math.PI * flight);
      tuck = 22 * Math.sin(Math.PI * flight);
      airborne = true;
    } else if (p < .78) state.rootY = -.018 * smooth((p - .65) / .13);
    else if (p < .92) state.rootY = -.018 * (1 - smooth((p - .78) / .14));
    for (const side of ['left', 'right']) {
      if (airborne) {
        pose[`${side}HipPitch`] = -tuck * .5;
        pose[`${side}Knee`] = tuck;
        pose[`${side}AnklePitch`] = -tuck * .5;
      } else placeFoot(pose, side, 0, 0, state.rootY, d);
      const reach = Math.sin(Math.PI * clamp((p - .1) / .65, 0, 1));
      pose[`${side}ShoulderPitch`] = -75 * reach;
      pose[`${side}Elbow`] = -15 * reach;
    }
  } else if (motion.key === 'wave') {
    const envelope = smooth(p / .18) * smooth((1 - p) / .18);
    pose.leftShoulderPitch = -82 * envelope;
    pose.leftShoulderRoll = 12 + 34 * envelope;
    pose.leftElbow = -65 * envelope;
    pose.leftWrist = 48 * Math.sin(angle * 3) * envelope;
    pose.neckYaw = 8 * envelope;
  } else if (motion.key === 'dance') {
    state.rootY = -.009 * (1 - Math.cos(angle * 2));
    for (const side of ['left', 'right']) placeFoot(pose, side, 0, 0, state.rootY, d);
    pose.waist = 16 * Math.sin(angle);
    pose.leftShoulderRoll = 28 + 16 * Math.sin(angle);
    pose.rightShoulderRoll = -28 + 16 * Math.sin(angle);
    pose.leftShoulderPitch = -25 - 22 * Math.cos(angle);
    pose.rightShoulderPitch = -25 + 22 * Math.cos(angle);
    pose.leftElbow = -34 - 25 * Math.sin(angle);
    pose.rightElbow = -34 + 25 * Math.sin(angle);
    pose.neckYaw = -12 * Math.sin(angle);
  } else if (motion.key === 'talk') {
    pose.neckYaw = 6 * Math.sin(angle);
    pose.neckPitch = 3 * Math.sin(angle * 2);
    pose.leftShoulderPitch = -12 * (1 - Math.cos(angle));
    pose.rightShoulderPitch = -8 * (1 - Math.cos(angle));
    pose.leftElbow = -18 * (1 - Math.cos(angle));
    pose.rightElbow = -10 * (1 - Math.cos(angle));
    state.mouth = .2 + .8 * Math.abs(Math.sin(angle * 5)) * (.6 + .4 * Math.sin(angle * 2) ** 2);
  } else {
    pose.neckYaw = 2 * Math.sin(angle);
    pose.neckPitch = .8 * Math.sin(angle * 2);
  }
  return state;
}

const faceScales = new WeakMap();
function initialScale(object) {
  if (!faceScales.has(object)) faceScales.set(object, object.scale.clone());
  return faceScales.get(object);
}

export function applyMotion(rig, name, time, { blinkEnabled = true, mouthEnabled = false } = {}) {
  const state = evaluateMotion(name, time, rig.dimensions);
  applyPose(rig, state.pose);
  rig.root.position.set(0, state.rootY, state.rootZ);
  rig.root.rotation.set(0, state.rootYaw, 0);
  for (const eye of [rig.face?.leftEyeLed, rig.face?.rightEyeLed]) {
    if (!eye) continue;
    const scale = initialScale(eye);
    eye.scale.copy(scale); eye.scale.y *= blinkEnabled ? state.blink : 1;
  }
  if (rig.face?.mouth) {
    rig.face.mouth.visible = true;
    rig.face.mouth.scale.setScalar(mouthEnabled ? 1 : .001);
    const localPhase = phaseOf(time, MOTIONS.find(item => item.key === name)?.duration || 4) * TAU;
    for (const [index, bar] of (rig.face.mouthBars || []).entries()) {
      const base = initialScale(bar);
      bar.scale.copy(base);
      bar.scale.y *= .18 + (state.mouth || .15) * (.4 + .6 * Math.abs(Math.sin(localPhase * 5 + index * .7)));
    }
  }
  rig.afterMotion?.(state, { name, time, blinkEnabled, mouthEnabled });
  return state;
}

function animationBindings(rig) {
  const byId = new Map();
  function add(node, properties) {
    if (!node) return;
    if (!byId.has(node.uuid)) byId.set(node.uuid, { node, properties: new Set() });
    for (const property of properties) byId.get(node.uuid).properties.add(property);
  }
  add(rig.root, ['position', 'quaternion']);
  for (const node of Object.values(rig.joints)) add(node, ['quaternion']);
  for (const node of [rig.face?.leftEyeLed, rig.face?.rightEyeLed, rig.face?.mouth, ...(rig.face?.mouthBars || [])]) add(node, ['scale']);
  for (const node of rig.animationNodes || []) add(node, ['position', 'quaternion', 'scale']);
  const names = new Map();
  rig.root.traverse(node => { if (node.name) names.set(node.name, (names.get(node.name) || 0) + 1); });
  return [...byId.values()].map(binding => ({
    ...binding,
    // UUID targeting also works in glTFExporter and avoids ambiguous duplicate names.
    target: binding.node.name && names.get(binding.node.name) === 1 ? binding.node.name : binding.node.uuid
  }));
}

/** Bakes a custom local-transform sampler at 30 fps and restores the live rig. */
export function bakeCustomClip(rig, name, duration, sample) {
  if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Animation duration must be a finite positive number.');
  if (typeof sample !== 'function') throw new TypeError('Animation sample must be a function.');
  const bindings = animationBindings(rig);
  const snapshot = bindings.map(({ node }) => ({
    node, position: node.position.clone(), quaternion: node.quaternion.clone(),
    scale: node.scale.clone(), visible: node.visible,
    faceScale: faceScales.has(node) ? faceScales.get(node).clone() : undefined
  }));
  const channels = bindings.flatMap(({ node, properties, target }) => [...properties].map(property => ({ node, property, name: `${target}.${property}`, values: [] })));
  const samples = Math.max(1, Math.round(duration * 30));
  const times = [];
  try {
    for (let i = 0; i <= samples; i++) {
      const time = duration * i / samples;
      times.push(time);
      sample(time, rig);
      for (const channel of channels) channel.values.push(...channel.node[channel.property].toArray());
    }
    const tracks = channels.map(channel => channel.property === 'quaternion'
      ? new THREE.QuaternionKeyframeTrack(channel.name, times, channel.values)
      : new THREE.VectorKeyframeTrack(channel.name, times, channel.values));
    return new THREE.AnimationClip(name, duration, tracks);
  } finally {
    for (const state of snapshot) {
      state.node.position.copy(state.position); state.node.quaternion.copy(state.quaternion);
      state.node.scale.copy(state.scale); state.node.visible = state.visible;
      if (state.faceScale) faceScales.set(state.node, state.faceScale);
      else faceScales.delete(state.node);
    }
    rig.root.updateMatrixWorld(true);
  }
}

/** Includes the active design's afterMotion hook and additional animated nodes. */
export function createAnimationClips(rig) {
  return MOTIONS.map(motion => bakeCustomClip(rig, motion.key, motion.duration,
    time => applyMotion(rig, motion.key, time, { blinkEnabled: true, mouthEnabled: motion.key === 'talk' })));
}
