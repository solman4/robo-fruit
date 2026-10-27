import * as THREE from 'three';

// A separate, closed exterior for the same rigid joint hierarchy. Metres, +Z front.
// No mesh or material from the reference robot is reused by this design.
const roundedGeometryCache = new Map();

function roundedBoxGeometry(width, height, depth, radius, segments = 10) {
  segments = Math.max(4, segments - 2);
  const key = [width, height, depth, radius, segments].join(',');
  if (roundedGeometryCache.has(key)) return roundedGeometryCache.get(key);
  const geometry = new THREE.BoxGeometry(width, height, depth, segments, segments, segments);
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const point = new THREE.Vector3(), core = new THREE.Vector3(), outward = new THREE.Vector3();
  const r = Math.min(radius, width / 2 - 1e-6, height / 2 - 1e-6, depth / 2 - 1e-6);
  const half = new THREE.Vector3(width / 2 - r, height / 2 - r, depth / 2 - r);
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    core.set(
      THREE.MathUtils.clamp(point.x, -half.x, half.x),
      THREE.MathUtils.clamp(point.y, -half.y, half.y),
      THREE.MathUtils.clamp(point.z, -half.z, half.z)
    );
    outward.copy(point).sub(core).normalize();
    point.copy(core).addScaledVector(outward, r);
    position.setXYZ(i, point.x, point.y, point.z);
    normal.setXYZ(i, outward.x, outward.y, outward.z);
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  roundedGeometryCache.set(key, geometry);
  return geometry;
}

function tubeGeometry(points, radius, segments = 32) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  return new THREE.TubeGeometry(curve, segments, radius, 8, false);
}

function roundedLightGeometry(width, height, depth, radius) {
  const x = -width / 2, y = -height / 2, r = Math.min(radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y); shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r); shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height); shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: false, curveSegments: 12 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

export function createAssistantDesign(rig) {
  if (!rig?.joints?.waist || !rig.joints.neckPitch) throw new Error('Assistant design requires the robot joint hierarchy.');
  const roots = [], animatedNodes = [];
  let serial = 0;
  const material = (name, color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ name: `Assistant ${name}`, color, roughness, metalness });
  const ivory = material('ceramic shell', 0xeeeae0, .29, .06);
  const inset = material('warm ceramic inset', 0xdcded3, .37, .04);
  const teal = material('soft teal joint covers', 0x477f77, .76);
  const deepTeal = material('deep teal seals', 0x315b58, .72);
  const visor = new THREE.MeshPhysicalMaterial({ name: 'Assistant dark glass display', color: 0x101e26, metalness: .12, roughness: .23, clearcoat: .4, clearcoatRoughness: .2 });
  const cyan = new THREE.MeshBasicMaterial({ name: 'Assistant cyan expression light', color: 0x75ebdd, toneMapped: false });
  const paleCyan = new THREE.MeshBasicMaterial({ name: 'Assistant cyan accent light', color: 0x48c8bd, toneMapped: false });
  const coral = material('small coral accents', 0xd58d79, .5);

  function group(parent, name, x = 0, y = 0, z = 0, isRoot = false) {
    const object = new THREE.Group(); object.name = `Assistant${name}`; object.position.set(x, y, z); parent.add(object);
    if (isRoot) { object.visible = false; roots.push(object); }
    return object;
  }
  function mesh(parent, geometry, surface, name, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, surface); object.name = `Assistant${name}${serial++}`;
    object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  function box(parent, name, width, height, depth, radius, surface, x = 0, y = 0, z = 0, segments = 10) {
    return mesh(parent, roundedBoxGeometry(width, height, depth, radius, segments), surface, name, x, y, z);
  }
  function cylinder(parent, name, radius, length, surface, x = 0, y = 0, z = 0, axis = 'x') {
    const object = mesh(parent, new THREE.CylinderGeometry(radius, radius, length, 32, 1, false), surface, name, x, y, z);
    if (axis === 'x') object.rotation.z = Math.PI / 2;
    if (axis === 'z') object.rotation.x = Math.PI / 2;
    return object;
  }
  function animated(object, exactName) {
    object.name = `Assistant${exactName}`; animatedNodes.push(object); return object;
  }

  // The shell is rounded across all three axes, including its back and underside.
  const body = group(rig.joints.waist, 'TorsoShell', 0, 0, 0, true);
  box(body, 'ContinuousTorso', .120, .092, .073, .022, ivory, 0, .043, -.001, 16);
  box(body, 'LowerTorsoSeal', .096, .027, .063, .012, deepTeal, 0, -.006, -.001, 10);
  box(body, 'PelvisCover', .095, .030, .066, .013, ivory, 0, -.019, 0, 12);
  box(body, 'NeckCollar', .057, .017, .043, .008, teal, 0, .089, 0, 10);
  box(body, 'ChestInset', .053, .020, .0014, .0006, inset, 0, .041, .0359, 8);
  box(body, 'ChestStatusBezel', .039, .012, .005, .0023, deepTeal, 0, .060, .0368, 10);
  for (let i = 0; i < 3; i++) box(body, 'ChestStatusLight', .0048, .0030, .0010, .00045, paleCyan, (i - 1) * .008, .060, .0396, 6);
  box(body, 'ChestCoralMark', .0040, .0100, .0014, .00065, coral, .042, .040, .0355, 6);
  // A rear access panel makes the back read as a finished enclosure, not an empty shell.
  box(body, 'RearServicePanel', .062, .044, .0028, .0012, inset, 0, .044, -.0380, 8);
  for (let i = 0; i < 3; i++) box(body, 'RearVent', .026, .0014, .0008, .00035, teal, 0, .037 + i * .006, -.0397, 6);

  const head = group(rig.joints.neckPitch, 'HeadShell', 0, 0, 0, true);
  cylinder(head, 'NeckGaiter', .014, .019, deepTeal, 0, .0045, 0, 'y');
  box(head, 'TVHeadEnclosure', .105, .075, .065, .022, ivory, 0, .050, 0, 18);
  box(head, 'VisorGasket', .094, .057, .014, .0068, deepTeal, 0, .051, .0275, 14);
  box(head, 'ContinuousDarkVisor', .090, .053, .013, .0063, visor, 0, .051, .0300, 16);
  for (const side of [-1, 1]) {
    cylinder(head, 'EarSoftRing', .014, .008, teal, side * .052, .051, -.002);
    cylinder(head, 'EarCap', .011, .003, ivory, side * .057, .051, -.002);
    cylinder(head, 'EarInset', .0032, .0032, coral, side * .058, .051, -.002);
  }

  const eyeZ = .0376;
  const eyeGeometry = roundedLightGeometry(.012, .018, .0018, .006);
  const leftEyeLed = animated(mesh(head, eyeGeometry, cyan, 'EyeLeft', .022, .056, eyeZ), 'EyeLeft');
  const rightEyeLed = animated(mesh(head, eyeGeometry, cyan, 'EyeRight', -.022, .056, eyeZ), 'EyeRight');
  // Rounded light capsules are intentionally separate nodes for exported expressions.
  const leftBrow = animated(box(head, 'BrowLeft', .013, .0020, .0013, .0006, cyan, .022, .071, eyeZ, 8), 'BrowLeft');
  const rightBrow = animated(box(head, 'BrowRight', .013, .0020, .0013, .0006, cyan, -.022, .071, eyeZ, 8), 'BrowRight');
  const cheeks = [-1, 1].map(side => box(head, 'CheekLight', .0055, .0017, .0010, .00045, coral, side * .031, .041, eyeZ, 6));
  const mouth = animated(group(head, 'MouthDisplay', 0, .038, eyeZ), 'MouthDisplay');
  const smilePoints = Array.from({ length: 17 }, (_, i) => { const t = i / 16 * 2 - 1; return [t * .012, -.005 * (1 - t * t), 0]; });
  const smile = animated(mesh(mouth, tubeGeometry(smilePoints, .00105, 32), cyan, 'Smile'), 'Smile');
  const openMouth = animated(mesh(mouth, new THREE.TorusGeometry(.0048, .00105, 8, 40), cyan, 'OpenMouth', 0, -.002, 0), 'OpenMouth');
  const mouthBars = Array.from({ length: 7 }, (_, i) => animated(
    box(mouth, 'MouthBar', .0016, .006, .001, .00045, cyan, (i - 3) * .0028, -.0024, .00015, 6), `MouthBar${i}`
  ));

  for (const [side, sign] of [['left', 1], ['right', -1]]) {
    const label = side === 'left' ? 'Left' : 'Right';
    const shoulder = group(rig.joints[`${side}ShoulderRoll`], `${label}ShoulderShell`, 0, 0, 0, true);
    box(shoulder, `${label}ShoulderCoupling`, .029, .027, .037, .012, teal, -sign * .012, -.005, 0, 10);
    box(shoulder, `${label}ShoulderCap`, .038, .039, .046, .016, ivory, sign * .002, -.008, 0, 12);
    cylinder(shoulder, `${label}ShoulderInset`, .007, .0015, inset, sign * .0215, -.008, 0);

    const upper = group(rig.joints[`${side}ShoulderPitch`], `${label}UpperArmShell`, 0, 0, 0, true);
    box(upper, `${label}UpperArm`, .031, .035, .036, .012, ivory, 0, -.018, 0, 10);
    box(upper, `${label}UpperArmUnderside`, .025, .008, .031, .0038, teal, 0, -.034, 0, 8);

    const lower = group(rig.joints[`${side}Elbow`], `${label}ForearmShell`, 0, 0, 0, true);
    cylinder(lower, `${label}ElbowCover`, .0113, .028, teal);
    box(lower, `${label}Forearm`, .032, .029, .037, .012, ivory, 0, -.018, .001, 10);
    box(lower, `${label}ForearmAccent`, .004, .016, .0015, .0007, inset, sign * .009, -.018, .0195, 6);

    const hand = group(rig.joints[`${side}Wrist`], `${label}HandShell`, 0, 0, 0, true);
    box(hand, `${label}WristCuff`, .026, .012, .027, .0055, teal, 0, -.002, 0, 8);
    box(hand, `${label}Mittens`, .033, .044, .035, .015, ivory, sign * .001, -.026, .002, 12);
    const thumb = box(hand, `${label}Thumb`, .015, .023, .024, .007, ivory, -sign * .014, -.021, .012, 10);
    thumb.rotation.z = -sign * .42;
    // One shallow crease suggests the mitten grip without hard mechanical fingers.
    mesh(hand, tubeGeometry([[-.009,-.035,.0182],[0,-.037,.019],[.009,-.035,.0182]], .00045, 14), inset, `${label}GripCrease`);

    const hip = group(rig.joints[`${side}HipRoll`], `${label}HipShell`, 0, 0, 0, true);
    box(hip, `${label}HipGaiter`, .044, .042, .044, .014, teal, 0, -.022, 0, 10);
    const thigh = group(rig.joints[`${side}HipPitch`], `${label}ThighShell`, 0, 0, 0, true);
    cylinder(thigh, `${label}HipBearingCover`, .0155, .044, deepTeal);
    box(thigh, `${label}ThighSleeve`, .047, .055, .049, .014, ivory, 0, -.031, 0, 12);
    box(thigh, `${label}ThighOuterInset`, .0025, .024, .023, .0011, inset, sign * .0235, -.031, 0, 6);

    const shin = group(rig.joints[`${side}Knee`], `${label}ShinShell`, 0, 0, 0, true);
    cylinder(shin, `${label}KneeGaiter`, .016, .044, teal);
    box(shin, `${label}KneeCap`, .042, .028, .013, .0063, ivory, 0, -.001, .022, 10);
    box(shin, `${label}ShinSleeve`, .044, .042, .046, .012, ivory, 0, -.026, 0, 12);
    box(shin, `${label}ShinSeal`, .040, .008, .041, .0038, teal, 0, -.046, 0, 8);
    const ankle = group(rig.joints[`${side}AnklePitch`], `${label}AnkleShell`, 0, 0, 0, true);
    cylinder(ankle, `${label}AnkleGaiter`, .014, .040, deepTeal);

    const boot = group(rig.joints[`${side}AnkleRoll`], `${label}BootShell`, sign * .0125, 0, .018, true);
    box(boot, `${label}BootSole`, .074, .008, .102, .0038, deepTeal, 0, -.0135, .004, 12);
    box(boot, `${label}BootUpper`, .071, .037, .100, .014, ivory, 0, .007, .004, 14);
    box(boot, `${label}BootCuff`, .046, .020, .052, .009, teal, -sign * .006, .024, -.010, 10);
    box(boot, `${label}BootToeInset`, .043, .006, .0025, .0011, inset, 0, -.001, .054, 8);
    box(boot, `${label}HeelAccent`, .006, .011, .0015, .0007, coral, sign * .022, .004, -.0465, 6);
  }

  const expressions = [
    { id: 'happy', label: 'Vui' },
    { id: 'curious', label: 'Tò mò' },
    { id: 'surprised', label: 'Ngạc nhiên' },
    { id: 'sleepy', label: 'Buồn ngủ' }
  ];
  const face = { leftEyeLed, rightEyeLed, mouth, mouthBars };
  function update(state = {}, context = {}) {
    const time = Number.isFinite(context.time) ? context.time : 0;
    const expression = expressions.some(item => item.id === context.expression) ? context.expression : 'happy';
    const blink = context.blinkEnabled === false ? 1 : THREE.MathUtils.clamp(Number.isFinite(state.blink) ? state.blink : 1, .035, 1);
    const talking = context.motion === 'talk' || context.mouthEnabled === true;
    const voiced = Number.isFinite(state.mouth) && state.mouth > 0 ? state.mouth : .4 + .6 * Math.sin(time * 9) ** 2;
    const talk = talking ? THREE.MathUtils.clamp(voiced, 0, 1) : 0;

    // Always start from explicit local transforms; pausing/scrubbing never accumulates rotations.
    leftEyeLed.position.set(.022, .056, eyeZ); rightEyeLed.position.set(-.022, .056, eyeZ);
    leftEyeLed.rotation.set(0, 0, -.06); rightEyeLed.rotation.set(0, 0, .06);
    leftEyeLed.scale.set(1, blink, 1); rightEyeLed.scale.set(1, blink, 1);
    leftBrow.position.set(.022, .071, eyeZ); rightBrow.position.set(-.022, .071, eyeZ);
    leftBrow.rotation.set(0, 0, -.10); rightBrow.rotation.set(0, 0, .10);
    leftBrow.scale.set(1, 1, 1); rightBrow.scale.set(1, 1, 1);
    mouth.position.set(0, .038, eyeZ); mouth.rotation.set(0, 0, 0); mouth.scale.set(1, 1, 1);
    smile.scale.set(1, 1 - talk * .35, 1); smile.position.set(0, 0, 0);
    openMouth.scale.set(.001, .001, .001); openMouth.position.set(0, -.002, 0);
    if (expression === 'curious') {
      leftEyeLed.scale.set(.90, .75 * blink, 1); rightEyeLed.scale.set(1.04, 1.13 * blink, 1);
      leftEyeLed.rotation.z = -.13; rightEyeLed.rotation.z = .03;
      leftBrow.position.y = .0685; leftBrow.rotation.z = -.23;
      rightBrow.position.y = .075; rightBrow.rotation.z = .18;
      smile.scale.set(.68, .6, 1); mouth.rotation.z = -.13;
    } else if (expression === 'surprised') {
      leftEyeLed.scale.set(1.17, 1.12 * blink, 1); rightEyeLed.scale.set(1.17, 1.12 * blink, 1);
      leftEyeLed.rotation.z = 0; rightEyeLed.rotation.z = 0;
      leftBrow.position.y = .077; rightBrow.position.y = .077;
      leftBrow.rotation.z = -.18; rightBrow.rotation.z = .18;
      smile.scale.set(.001, .001, .001); openMouth.scale.set(.82, 1 + talk * .35, 1);
    } else if (expression === 'sleepy') {
      leftEyeLed.scale.set(1.10, .19 * blink, 1); rightEyeLed.scale.set(1.10, .19 * blink, 1);
      leftEyeLed.rotation.z = .05; rightEyeLed.rotation.z = -.05;
      leftBrow.position.y = .066; rightBrow.position.y = .066;
      leftBrow.rotation.z = .02; rightBrow.rotation.z = -.02;
      smile.scale.set(.60, .16, 1); smile.position.y = -.001;
    }
    if (talking && expression !== 'surprised') {
      openMouth.scale.set(.75 + talk * .25, .28 + talk * .7, 1);
      smile.scale.multiplyScalar(.001);
    }
    for (let i = 0; i < mouthBars.length; i++) {
      const bar = mouthBars[i];
      // A restrained central sound trace sits inside the open mouth only while speaking.
      const amount = talking ? .08 + .24 * talk * (.45 + .55 * Math.sin(time * 10 + i * .8) ** 2) : .001;
      bar.position.set((i - 3) * .0008, -.0024, .00015);
      bar.scale.set(talking ? .35 : .001, amount, talking ? 1 : .001);
      bar.rotation.set(0, 0, 0);
    }
  }
  update({ blink: 1, mouth: 0 }, { expression: 'happy', blinkEnabled: true, mouthEnabled: false, time: 0 });
  return { id: 'assistant', roots, face, animatedNodes, update, capabilities: { armor: false, expressions: true }, expressions };
}
