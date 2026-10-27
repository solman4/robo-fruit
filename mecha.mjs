import * as THREE from 'three';

// A complete alternate body, not an overlay on the reference robot. Metres;
// +Y is up and +Z is forward. Existing joint pivots remain the motion contract.
export function createMechaDesign(rig) {
  const roots = [], animatedNodes = [], panels = [], geometryCache = new Map();
  let serial = 0, armorValue = 0;
  const ivory = new THREE.MeshStandardMaterial({ name: 'Mecha ceramic white', color: 0xe7ecee, roughness: .29, metalness: .38, flatShading: true });
  const pale = new THREE.MeshStandardMaterial({ name: 'Mecha bevel silver', color: 0x9faeb9, roughness: .32, metalness: .68, flatShading: true });
  const graphite = new THREE.MeshStandardMaterial({ name: 'Mecha graphite structure', color: 0x25313c, roughness: .37, metalness: .65, flatShading: true });
  const rubber = new THREE.MeshStandardMaterial({ name: 'Mecha flexible joint seals', color: 0x101820, roughness: .74, metalness: .12 });
  const visor = new THREE.MeshStandardMaterial({ name: 'Mecha optical visor', color: 0x07151e, roughness: .14, metalness: .55 });
  const orange = new THREE.MeshStandardMaterial({ name: 'Mecha signal orange', color: 0xde692c, roughness: .37, metalness: .22, flatShading: true });
  const cyan = new THREE.MeshBasicMaterial({ name: 'Mecha cyan emitters', color: 0x66e5f2, toneMapped: false });
  const warm = new THREE.MeshBasicMaterial({ name: 'Mecha amber emitters', color: 0xffb557, toneMapped: false });

  const cache = (key, factory) => { if (!geometryCache.has(key)) geometryCache.set(key, factory()); return geometryCache.get(key); };
  function group(parent, name, x = 0, y = 0, z = 0) {
    const node = new THREE.Group(); node.name = `Mecha_${name}_${serial++}`;
    node.position.set(x, y, z); parent.add(node); return node;
  }
  function mount(joint, name) {
    const parent = rig.joints[joint];
    if (!parent) throw new Error(`Mecha requires joint ${joint}`);
    const root = group(parent, name); root.visible = false; roots.push(root); return root;
  }
  function mesh(parent, geo, mat, name, x = 0, y = 0, z = 0) {
    const node = new THREE.Mesh(geo, mat); node.name = `Mecha_${name}_${serial++}`;
    node.position.set(x, y, z); node.castShadow = true; node.receiveShadow = true; parent.add(node); return node;
  }
  function shape(points) { return new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))); }
  function plate(parent, name, points, depth, mat = ivory, x = 0, y = 0, z = 0, bevel = .00055) {
    const geo = new THREE.ExtrudeGeometry(shape(points), { depth, steps: 1, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 3 });
    geo.translate(0, 0, -depth / 2); return mesh(parent, geo, mat, name, x, y, z);
  }
  // Closed eight-sided section loft. Width/depth taper independently, giving
  // each shell a sculpted silhouette instead of stacked primitive boxes.
  function loft(parent, name, sections, mat = ivory, x = 0, y = 0, z = 0, chamfer = .18) {
    const positions = [], indices = [];
    for (const [yy, width, depth, dz = 0] of sections) {
      const w = width / 2, d = depth / 2, c = Math.min(width, depth) * chamfer;
      for (const [xx, zz] of [[-w+c,-d],[w-c,-d],[w,-d+c],[w,d-c],[w-c,d],[-w+c,d],[-w,d-c],[-w,-d+c]]) positions.push(xx, yy, zz + dz);
    }
    for (let ring = 0; ring < sections.length - 1; ring++) for (let i = 0; i < 8; i++) {
      const a = ring * 8 + i, next = ring * 8 + (i + 1) % 8, b = a + 8, bn = next + 8;
      indices.push(a,b,next,next,b,bn);
    }
    for (let i = 1; i < 7; i++) indices.push(0,i,i+1);
    const last = (sections.length - 1) * 8;
    for (let i = 1; i < 7; i++) indices.push(last,last+i+1,last+i);
    const indexed = new THREE.BufferGeometry(); indexed.setAttribute('position', new THREE.Float32BufferAttribute(positions,3)); indexed.setIndex(indices);
    const geo = indexed.toNonIndexed(); geo.computeVertexNormals(); indexed.dispose();
    return mesh(parent,geo,mat,name,x,y,z);
  }
  function cylinder(parent,name,radius,length,mat,x=0,y=0,z=0,axis='z',segments=20) {
    const geo=cache(`c:${radius}:${length}:${segments}`,()=>new THREE.CylinderGeometry(radius,radius,length,segments));
    const node=mesh(parent,geo,mat,name,x,y,z); if(axis==='z')node.rotation.x=Math.PI/2; else if(axis==='x')node.rotation.z=Math.PI/2; return node;
  }
  function torus(parent,name,radius,tube,mat,x=0,y=0,z=0,axis='z') {
    const geo=cache(`t:${radius}:${tube}`,()=>new THREE.TorusGeometry(radius,tube,6,20));
    const node=mesh(parent,geo,mat,name,x,y,z);if(axis==='x')node.rotation.y=Math.PI/2;else if(axis==='y')node.rotation.x=Math.PI/2;return node;
  }
  function capsule(parent,name,radius,length,x,y,z,axis='y') {
    const geo=cache(`cap:${radius}:${length}`,()=>new THREE.CapsuleGeometry(radius,Math.max(.0001,length-2*radius),3,10));
    const node=mesh(parent,geo,rubber,name,x,y,z);if(axis==='x')node.rotation.z=Math.PI/2;if(axis==='z')node.rotation.x=Math.PI/2;return node;
  }
  function fastener(parent,x,y,z) {
    cylinder(parent,'Recessed fastener',.00125,.00055,graphite,x,y,z,'z',6);
    cylinder(parent,'Fastener centre',.00045,.00065,pale,x,y,z+.0001,'z',6);
  }
  function seam(parent,name,points,mat=graphite,r=.0006) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    return mesh(parent,new THREE.TubeGeometry(curve,Math.max(8,points.length*3),r,4,false),mat,name);
  }
  function opening(parent,name,{x=0,y=0,z=0,shift=[0,0,0],turn=[0,0,0],stage=.1,deployShift}={}) {
    const node=group(parent,name,x,y,z);
    panels.push({node,position:node.position.clone(),rotation:node.rotation.clone(),shift:new THREE.Vector3(...shift),turn:new THREE.Vector3(...turn),stage,deployShift:new THREE.Vector3(...(deployShift||shift.map(v=>v*2.0)))});
    animatedNodes.push(node);return node;
  }

  const body=mount('waist','Torso');
  // The core remains fully enclosed when armor opens. Ribs, hatch and rear
  // thrusters are part of this new body, never inherited from the original.
  loft(body,'Internal torso',[[-.014,.060,.041],[.012,.074,.052],[.061,.106,.061],[.081,.110,.052],[.088,.076,.041]],graphite);
  loft(body,'Abdominal seal',[[-.025,.056,.039],[-.009,.065,.045],[.019,.065,.045]],rubber);
  for(let i=0;i<4;i++) {
    const yy=-.014+i*.007;
    plate(body,'Segmented abdomen',[[-.030,0],[-.023,-.004],[.023,-.004],[.030,0],[.026,.003],[-.026,.003]],.003,pale,0,yy,.024,.00025);
  }
  for(const s of [-1,1]) {
    capsule(body,'Shoulder joint bridge',.010,.036,s*.065,.072,0,'x');
    torus(body,'Shoulder bridge cuff',.0107,.0018,graphite,s*.072,.072,0,'x');
  }
  const sternum=opening(body,'Central chest lock',{y:.050,z:.034,shift:[0,.005,.018],turn:[-.20,0,0],stage:.15});
  plate(sternum,'Sternum armour',[[-.016,.026],[0,.032],[.016,.026],[.014,-.009],[0,-.027],[-.014,-.009]],.006,ivory);
  plate(sternum,'Sternum inset',[[-.009,.015],[.009,.015],[.010,-.001],[0,-.012],[-.010,-.001]],.0016,graphite,0,0,.0042);
  plate(sternum,'Sternum core',[[-.005,.009],[.005,.009],[.005,-.001],[0,-.006],[-.005,-.001]],.001,cyan,0,0,.0053,.0002);
  // Lower core stays visible after the centre lock swings away.
  cylinder(body,'Reactor recess',.011,.004,rubber,0,.047,.030);
  cylinder(body,'Reactor outer collar',.0095,.004,pale,0,.047,.033,'z',10);
  cylinder(body,'Reactor lens',.007,.004,cyan,0,.047,.036,'z',10);
  for(const s of [-1,1]) {
    const breast=opening(body,`${s}Pectoral`,{x:s*.025,y:.062,z:.034,shift:[s*.018,.006,.007],turn:[0,s*.40,s*.10],stage:.24});
    const pts=[[-.019,-.005],[-.015,.018],[.004,.024],[.034,.014],[.031,-.006],[.013,-.020]];
    plate(breast,'Pectoral shield',pts.map(([x,y])=>[s*x,y]),.009,ivory);
    plate(breast,'Pectoral orange accent',[[-.012,.014],[.003,.019],[.029,.010],[.028,.005],[.003,.013],[-.012,.009]].map(([x,y])=>[s*x,y]),.0012,orange,0,0,.0055,.0002);
    seam(breast,'Pectoral panel line',[[s*-.009,.003,.0054],[s*.010,-.009,.0054],[s*.027,-.002,.0054]]);
    fastener(breast,s*.024,.008,.0061);
    const flank=opening(body,`${s}Rib armour`,{x:s*.040,y:.028,z:.008,shift:[s*.014,0,.001],turn:[0,0,-s*.25],stage:.32});
    loft(flank,'Tapered rib shell',[[-.018,.020,.043],[-.005,.028,.050],[.017,.033,.052],[.025,.024,.044]],ivory);
    for(let i=0;i<3;i++) plate(flank,'Rib intake',[[-.009,0],[.010,-.001],[.009,-.003],[-.008,-.002]],.0008,graphite,0,-.006+i*.007,.026,.0001);
    const clavicle=plate(body,'Collar wedge',[[-.026,0],[.023,0],[.020,.010],[-.014,.014]],.015,pale,s*.028,.079,-.004);
    clavicle.rotation.z=s*-.13;
    const rear=opening(body,`${s}Back shell`,{x:s*.026,y:.053,z:-.032,shift:[s*.011,.003,-.014],turn:[0,-s*.36,0],stage:.35});
    loft(rear,'Rear armor pod',[[-.028,.039,.013],[-.016,.046,.019],[.020,.045,.020],[.032,.030,.012]],ivory);
    for(let i=0;i<4;i++) plate(rear,'Rear ventilation',[[-.014,-.001],[.014,-.001],[.014,.001],[-.014,.001]],.001,graphite,0,-.008+i*.006,-.011,.0001);
    const exhaust=cylinder(body,'Rear thruster shroud',.011,.019,graphite,s*.032,.007,-.031);
    cylinder(exhaust,'Thruster ceramic ring',.0079,.002,pale,0,-.010,0,'y',12);
    cylinder(exhaust,'Thruster emitter',.0058,.002,cyan,0,-.011,0,'y',12);
  }
  // Compact pelvic armor leaves the hip mechanisms free to articulate.
  loft(body,'Pelvic central shell',[[-.039,.028,.031],[-.025,.054,.041],[-.014,.061,.042],[-.008,.051,.034]],graphite,0,0,-.002);
  plate(body,'Pelvic centre plate',[[-.023,.003],[.023,.003],[.017,-.024],[0,-.031],[-.017,-.024]],.005,ivory,0,-.015,.024);
  plate(body,'Waist orange chevron',[[-.018,0],[0,-.005],[.018,0],[.016,.004],[0,0],[-.016,.004]],.0012,orange,0,-.017,.0275,.0002);

  const head=mount('neckPitch','Helmet');
  cylinder(head,'Neck sealed collar',.011,.015,rubber,0,.003,0,'y');
  for(const yy of [-.002,.004,.010])torus(head,'Neck ring',.011,.001,pale,0,yy,0,'y');
  loft(head,'Helmet sealed inner shell',[[.012,.040,.034],[.021,.063,.047],[.057,.064,.049],[.071,.043,.036]],graphite);
  const helmet=opening(head,'Crown shell',{shift:[0,.016,-.006],turn:[-.18,0,0],stage:.54});
  loft(helmet,'Angular helmet crown',[[.050,.069,.052],[.066,.071,.054],[.079,.046,.038]],ivory);
  plate(helmet,'Crown forehead crest',[[-.008,0],[.008,0],[.006,.023],[0,.030],[-.006,.023]],.004,pale,0,.053,.027);
  plate(helmet,'Crown crest orange',[[-.003,0],[.003,0],[.003,.017],[0,.021],[-.003,.017]],.001,orange,0,.060,.030,.00015);
  // Deep full-width visor behind the brow creates a distinct mecha face.
  const facePlate=plate(head,'Visor',[[-.030,.009],[-.022,.016],[.022,.016],[.030,.009],[.025,-.010],[.013,-.014],[-.013,-.014],[-.025,-.010]],.003,visor,0,.045,.0275,.0008);
  plate(head,'Brow ridge',[[-.034,.004],[-.025,.012],[0,.008],[.025,.012],[.034,.004],[.029,-.001],[0,.003],[-.029,-.001]],.005,ivory,0,.054,.029);
  for(const s of [-1,1]) {
    const cheek=opening(head,`${s}Cheek`,{x:s*.023,y:.030,z:.020,shift:[s*.010,-.002,.005],turn:[0,s*.34,s*.10],stage:.57});
    plate(cheek,'Cheek jaw armour',[[-.010,.011],[.008,.021],[.013,.014],[.011,-.010],[.001,-.019],[-.008,-.011]].map(([x,y])=>[x*s,y]),.016,ivory);
    plate(cheek,'Cheek orange slash',[[-.003,.004],[.003,.010],[.005,.006],[.001,-.004]].map(([x,y])=>[x*s,y]),.001,orange,0,0,.009,.00015);
    const ear=cylinder(head,'Helmet temple disc',.0105,.008,pale,s*.034,.050,0,'x',10);
    cylinder(ear,'Temple dark insert',.007,.009,graphite,0,0,0,'y',10);
    const antenna=plate(head,'Short swept sensor fin',[[-.004,-.012],[.003,-.011],[.005,.019],[.001,.024]],.004,graphite,s*.034,.060,-.004);
    antenna.rotation.z=-s*.13;
    plate(head,'Temple cyan tab',[[-.0015,-.006],[.0015,-.006],[.0015,.006],[-.0015,.006]],.001,cyan,s*.039,.054,.004,.0001);
  }
  plate(head,'Nose armour',[[-.004,.010],[.004,.010],[.007,-.009],[0,-.013],[-.007,-.009]],.004,pale,0,.040,.031);
  plate(head,'Chin guard',[[-.013,.006],[.013,.006],[.009,-.007],[0,-.011],[-.009,-.007]],.005,ivory,0,.024,.023);
  const face={mouthBars:[]};
  for(const [key,s] of [['leftEyeLed',1],['rightEyeLed',-1]]) {
    const eye=plate(head,'Sharp cyan eye',[[-.010,.003],[.010,.005],[.007,-.002],[-.008,-.003]].map(([x,y])=>[x*s,y]),.00065,cyan,s*.015,.047,.0302,.0001);
    face[key]=eye;animatedNodes.push(eye);
  }
  face.mouth=group(head,'Mouth',0,.026,.0285);face.mouth.scale.setScalar(.001);animatedNodes.push(face.mouth);
  for(let i=0;i<5;i++) {
    const bar=plate(face.mouth,'Mouth bar',[[-.0006,-.0018],[.0006,-.0018],[.0006,.0018],[-.0006,.0018]],.0005,cyan,(i-2)*.0027,0,0,.0001);
    face.mouthBars.push(bar);animatedNodes.push(bar);
  }

  for(const [side,s] of [['left',1],['right',-1]]) {
    const shoulder=mount(`${side}ShoulderRoll`,`${side}Shoulder`);
    capsule(shoulder,'Shoulder articulated seal',.014,.030,0,-.007,0);
    const pauldron=opening(shoulder,`${side}Pauldron`,{x:s*.004,y:.001,shift:[s*.016,.013,-.003],turn:[0,0,-s*.40],stage:.42});
    loft(pauldron,'Shoulder angular shell',[[-.017,.041,.041],[-.010,.054,.054],[.013,.058,.052],[.025,.036,.038]],ivory,s*.005,0,0);
    plate(pauldron,'Shoulder front inset',[[-.019,.010],[.021,.010],[.026,-.003],[.013,-.015],[-.016,-.012]],.003,graphite,s*.005,0,.028);
    plate(pauldron,'Shoulder orange blade',[[-.021,.010],[.018,.013],[.022,.007],[-.019,.004]],.002,orange,s*.005,.003,.030,.0002);
    for(let i=0;i<3;i++)plate(pauldron,'Shoulder vent',[[-.005,-.001],[.006,-.001],[.006,.001],[-.005,.001]],.001,pale,s*.005,-.005+i*.004,.0305,.0001);
    const upper=mount(`${side}ShoulderPitch`,`${side}UpperArm`);
    capsule(upper,'Upper arm sealed structure',.011,.040,0,-.018,0);
    const upperPanel=opening(upper,`${side}UpperArm armour`,{y:-.021,shift:[s*.012,0,.005],turn:[0,0,-s*.20],stage:.34});
    loft(upperPanel,'Upper arm tapered sleeve',[[-.015,.023,.027],[.004,.031,.033],[.016,.027,.028]],ivory);
    plate(upperPanel,'Bicep graphite insert',[[-.006,.011],[.006,.011],[.007,-.007],[0,-.012],[-.007,-.007]],.0016,graphite,0,0,.0175);
    plate(upperPanel,'Bicep cyan line',[[-.001,.006],[.001,.006],[.001,-.006],[-.001,-.006]],.0006,cyan,0,0,.019,.0001);
    const elbow=mount(`${side}Elbow`,`${side}Forearm`);
    cylinder(elbow,'Elbow bearing',.0105,.031,graphite,0,0,0,'x');
    for(const ss of [-1,1]){cylinder(elbow,'Elbow hub',.0065,.002,pale,ss*.0162,0,0,'x',10);cylinder(elbow,'Elbow amber plug',.003,.0025,orange,ss*.017,0,0,'x',6);}
    loft(elbow,'Forearm sealed core',[[-.032,.021,.024],[-.010,.024,.028],[.005,.021,.024]],rubber);
    const forearm=opening(elbow,`${side}Gauntlet`,{y:-.018,z:.001,shift:[s*.013,0,.010],turn:[0,s*.20,-s*.16],stage:.28});
    loft(forearm,'Gauntlet shaped shell',[[-.016,.029,.030],[-.005,.036,.039],[.011,.032,.034]],ivory,0,0,.003);
    plate(forearm,'Forearm face insert',[[-.011,.009],[.010,.009],[.012,-.007],[0,-.014],[-.012,-.007]],.003,graphite,0,0,.024);
    plate(forearm,'Forearm orange slash',[[-.008,.006],[.009,.004],[.009,.000],[-.008,.002]],.0012,orange,0,0,.0262,.0002);
    for(const x of [-.011,.011])fastener(forearm,x,-.008,.025);
    const hand=mount(`${side}Wrist`,`${side}Hand`);
    cylinder(hand,'Wrist swivel',.009,.010,graphite,0,-.001,0,'y');
    loft(hand,'Closed articulated fist',[[-.033,.022,.024],[-.026,.029,.029],[-.010,.029,.028],[-.004,.019,.020]],graphite,0,0,.004);
    plate(hand,'Fist dorsal shield',[[-.012,.008],[.012,.008],[.011,-.008],[.006,-.013],[-.007,-.013],[-.012,-.008]],.003,ivory,0,-.018,.020);
    for(let i=0;i<3;i++)seam(hand,'Knuckle separator',[[-.010,-.022-i*.004,.0206],[.010,-.022-i*.004,.0206]],rubber,.00045);
    loft(hand,'Armored thumb',[[-.027,.009,.014],[-.012,.011,.017],[-.006,.008,.013]],pale,-s*.015,0,.009);

    const hipRoll=mount(`${side}HipRoll`,`${side}Hip`);
    capsule(hipRoll,'Hip sealed ball',.014,.033,0,-.010,0);
    const hipPanel=opening(hipRoll,`${side}Hip skirt`,{x:s*.006,y:-.014,z:.012,shift:[s*.014,.002,.007],turn:[0,s*.21,-s*.26],stage:.19});
    loft(hipPanel,'Hip side shell',[[-.022,.031,.035],[-.010,.045,.042],[.010,.039,.037]],ivory);
    plate(hipPanel,'Hip orange inset',[[-.013,.004],[.013,.004],[.009,-.002],[-.011,-.004]],.0012,orange,0,-.005,.022,.0002);
    const thigh=mount(`${side}HipPitch`,`${side}Thigh`);
    cylinder(thigh,'Hip lateral bearing',.011,.035,graphite,0,0,0,'x');
    loft(thigh,'Thigh sealed internal strut',[[-.063,.025,.028],[-.009,.030,.034],[.007,.027,.029]],graphite);
    const thighPanel=opening(thigh,`${side}Thigh armour`,{y:-.031,shift:[s*.013,0,.010],turn:[0,s*.18,0],stage:.12});
    loft(thighPanel,'Thigh aerodynamic armor',[[-.025,.029,.031],[-.015,.037,.039],[.019,.044,.041],[.027,.031,.033]],ivory,0,0,.003);
    plate(thighPanel,'Thigh side accent',[[-.016,.018],[-.010,.019],[-.010,-.010],[-.013,-.017],[-.017,-.009]].map(([x,y])=>[x*s,y]),.0018,orange,0,0,.025,.0003);
    plate(thighPanel,'Thigh central chamfer',[[-.006,.020],[.006,.020],[.005,-.016],[0,-.020],[-.005,-.016]],.002,pale,0,0,.024);
    for(const x of [-.012,.012])fastener(thighPanel,x,.015,.025);
    const shin=mount(`${side}Knee`,`${side}Shin`);
    cylinder(shin,'Knee transverse bearing',.011,.037,graphite,0,0,0,'x');
    for(const ss of [-1,1])cylinder(shin,'Knee side cover',.007,.0025,pale,ss*.0195,0,0,'x',10);
    loft(shin,'Calf sealed core',[[-.052,.023,.028],[-.012,.030,.033],[.006,.027,.030]],graphite);
    const kneeShield=opening(shin,`${side}Knee shield`,{y:-.003,z:.020,shift:[0,.003,.015],turn:[-.25,0,0],stage:.08});
    plate(kneeShield,'Pentagonal knee plate',[[-.018,.007],[0,.017],[.018,.007],[.016,-.012],[0,-.020],[-.016,-.012]],.008,ivory);
    plate(kneeShield,'Knee orange crest',[[-.010,.004],[0,.011],[.010,.004],[.009,-.001],[0,.004],[-.009,-.001]],.0012,orange,0,0,.0055,.0002);
    const shinPanel=opening(shin,`${side}Shin armour`,{y:-.034,shift:[s*.010,-.001,.012],turn:[-.15,s*.12,0],stage:.03});
    loft(shinPanel,'Greave sculpted armor',[[-.019,.031,.033],[-.004,.041,.042],[.016,.034,.035]],ivory,0,0,.005);
    plate(shinPanel,'Shin graphite spine',[[-.006,.012],[.006,.012],[.007,-.010],[0,-.017],[-.007,-.010]],.003,graphite,0,0,.027);
    plate(shinPanel,'Shin cyan inset',[[-.0015,.007],[.0015,.007],[.0015,-.009],[-.0015,-.009]],.001,cyan,0,0,.029,.0001);
    for(let i=0;i<3;i++)plate(shinPanel,'Calf cooling vent',[[-.006,-.001],[.006,-.001],[.005,.001],[-.005,.001]],.001,graphite,s*.014,-.002+i*.005,-.018,.0001);
    const ankle=mount(`${side}AnklePitch`,`${side}Ankle`);
    capsule(ankle,'Ankle sealed actuator',.012,.041,0,-.015,0);
    cylinder(ankle,'Ankle bearing collar',.011,.029,pale,0,0,0,'x',12);
    const foot=mount(`${side}AnkleRoll`,`${side}Boot`);
    // Offset matches the wider stance while preserving the roll pivot itself.
    const offset=s*.010;
    loft(foot,'Boot dark continuous sole',[[-.017,.063,.084,.013],[-.011,.068,.089,.013],[-.007,.066,.086,.013]],rubber,offset);
    loft(foot,'Boot enclosed armored body',[[-.010,.061,.080,.013],[.005,.060,.079,.012],[.022,.041,.050,.002],[.027,.030,.034,-.002]],graphite,offset);
    // Toe and heel plates open without exposing the original foot beneath.
    const toe=opening(foot,`${side}Toe armour`,{x:offset,y:.001,z:.024,shift:[0,.006,.014],turn:[-.25,0,0],stage:0});
    loft(toe,'Chamfered armored toe',[[-.008,.059,.051,.002],[.002,.059,.051,.002],[.014,.043,.035,-.004]],ivory);
    plate(toe,'Toe orange strike',[[-.022,.002],[.022,.002],[.019,-.002],[-.020,-.002]],.0012,orange,0,-.002,.028,.0002);
    for(const x of [-.020,.020])fastener(toe,x,.003,.0285);
    const heel=opening(foot,`${side}Heel armour`,{x:offset,y:.005,z:-.020,shift:[0,.004,-.009],turn:[.18,0,0],stage:0});
    loft(heel,'Heel wedge',[[-.014,.052,.029],[.002,.050,.029],[.022,.031,.022]],ivory);
    plate(heel,'Heel amber reflector',[[-.011,-.0015],[.011,-.0015],[.011,.0015],[-.011,.0015]],.001,warm,0,0,-.0155,.0001);
  }

  const clamp=value=>THREE.MathUtils.clamp(Number.isFinite(value)?value:0,0,1);
  const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
  function update(state={},context={}) {
    const armor=clamp(context.armor===undefined?armorValue:context.armor);
    const deploy=context.deploy===undefined?1:clamp(context.deploy);
    for(const p of panels) {
      // Lower sections assemble first, followed by torso, shoulder and crown.
      const missing=1-smooth((deploy-p.stage)/.42);
      p.node.position.copy(p.position).addScaledVector(p.shift,armor).addScaledVector(p.deployShift,missing);
      p.node.rotation.set(p.rotation.x+p.turn.x*(armor+missing*1.35),p.rotation.y+p.turn.y*(armor+missing*1.35),p.rotation.z+p.turn.z*(armor+missing*1.35));
    }
    const blink=context.blinkEnabled===false?1:THREE.MathUtils.clamp(Number.isFinite(state.blink)?state.blink:1,.025,1);
    face.leftEyeLed.scale.set(1,blink,1);face.rightEyeLed.scale.set(1,blink,1);
    const speaking=context.mouthEnabled===true;
    face.mouth.scale.setScalar(speaking?1:.001);
    const time=Number.isFinite(context.time)?context.time:0;
    const level=Number.isFinite(state.mouth)?state.mouth:0;
    for(const [i,bar] of face.mouthBars.entries())bar.scale.set(1,.18+(speaking?Math.max(level,.12):0)*(.6+.4*Math.abs(Math.sin(time*14+i*.8))),1);
  }
  update({}, {armor:0,deploy:1,blinkEnabled:false,mouthEnabled:false});
  return {id:'mecha',roots,face,animatedNodes,update,setArmor(value){armorValue=clamp(value);},capabilities:{armor:true,expressions:false}};
}
