import * as THREE from 'three';

// Rigid mechanical reconstruction. Metres, Y up, Z forward.
// The 383 mm envelope and foot plates follow Hiwonder's orthographic Tonybot
// drawing. The custom chest display, electronics and finish follow the supplied
// photograph. Occluded surfaces and joint offsets are estimates, not factory CAD.
const G = new Map();
const PAINTED_PANELS = new Set(['Chest front folded aluminium','Chest side folded aluminium','Chest top deck','Ventilated rear cover','Head face aluminium','Head rear enclosure','Head angled side cheek','Head crown crosspiece','Upper head rim','Shoulder cheek plate','Forearm plate','Thigh bridge plate','Shin front cross strap','Aluminium foot plate']);
let serial = 0;
function cached(key, make) { if (!G.has(key)) G.set(key, make()); return G.get(key); }
function rectangle(w, h, r = .001) {
  r = Math.min(r, w / 2, h / 2);
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function hole(s, x, y, r) { const p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); s.holes.push(p); }
function slot(s, x, y, w, h) { const p = rectangle(w, h, Math.min(w, h) / 2); const path = new THREE.Path(p.getPoints(12).map(v => new THREE.Vector2(v.x + x, v.y + y))); s.holes.push(path); }
function extrusion(s, depth = .0015, bevel = .00025) {
  const g = new THREE.ExtrudeGeometry(s, { depth, steps: 1, bevelEnabled: bevel > 0, bevelSegments: 2, bevelSize: bevel, bevelThickness: bevel, curveSegments: 16 });
  g.translate(0, 0, -depth / 2); return g;
}
function poly(points, holes = []) { const s = new THREE.Shape(points.map(p => new THREE.Vector2(...p))); for (const h of holes) hole(s, ...h); return s; }
function canvasTexture(draw, w = 256, h = w) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function createRobot() {
  serial = 0;
  const root = new THREE.Group(); root.name = 'RobotRoot';
  root.userData = { reference: 'User photograph and Hiwonder Tonybot dimension drawing', sourceImage: 'reference.png', dimensionReference: 'dimensions.jpg', accuracy: 'Reference reconstruction, not factory CAD; hidden geometry inferred', cameraOmitted: true, mouth: 'Optional added LED animation, not present in photograph', units: 'metres' };
  const joints = {}, restPose = {};
  const silver = new THREE.MeshStandardMaterial({ name: 'Satin coated aluminium', color: 0xc4cbd0, metalness: .48, roughness: .38 });
  const paint = silver.clone(); paint.name = 'Robot painted panels';
  const edge = new THREE.MeshStandardMaterial({ name: 'Cut aluminium edges', color: 0x8b949e, metalness: .8, roughness: .27 });
  const black = new THREE.MeshStandardMaterial({ name: 'Black servo housing', color: 0x101318, metalness: .05, roughness: .48 });
  const dark = new THREE.MeshStandardMaterial({ name: 'Black rubber and wire', color: 0x090c10, roughness: .78 });
  const steel = new THREE.MeshStandardMaterial({ name: 'Steel fasteners', color: 0x8d949b, metalness: .88, roughness: .23 });
  const greenBoard = new THREE.MeshStandardMaterial({ name: 'PCB', color: 0x26382d, metalness: .12, roughness: .65 });
  const cream = new THREE.MeshStandardMaterial({ name: 'Connector plastic', color: 0xdadbd1, roughness: .58 });
  const red = new THREE.MeshStandardMaterial({ color: 0x9e201d, roughness: .6 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xad9d5c, metalness: .7, roughness: .33 });
  const sensorTexture = canvasTexture((ctx, w) => {
    ctx.fillStyle = '#1bcc38'; ctx.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 9) for (let x = 0; x < w; x += 8) {
      const xx = x + (Math.floor(y / 9) % 2) * 4;
      ctx.strokeStyle = '#116c2c'; ctx.lineWidth = 1.3; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const px = xx + Math.cos(a) * 4, py = y + Math.sin(a) * 4; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.stroke();
    }
    ctx.strokeStyle = '#74ff8d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(w / 2, w / 2, 104, 0, Math.PI * 2); ctx.stroke();
  });
  const led = new THREE.MeshBasicMaterial({ name: 'Green RGB sensor LEDs', color: 0x5dff64, map: sensorTexture, toneMapped: false });
  const mouthMat = new THREE.MeshBasicMaterial({ name: 'Added mouth LEDs', color: 0x38e75c });
  const labelTexture = canvasTexture((c, w, h) => {
    c.fillStyle = '#121519'; c.fillRect(0, 0, w, h); c.strokeStyle = '#5b6062'; c.lineWidth = 3; c.strokeRect(4, 4, w - 8, h - 8);
    c.fillStyle = '#d6d6bd'; c.font = 'bold 39px Arial'; c.fillText('LX-824HV', 15, 54);
    c.font = '17px Arial'; c.fillText('SERIAL BUS SERVO', 15, 82);
    for (let i = 0; i < 38; i++) { c.fillRect(16 + i * 5.6, 96, i % 3 === 0 ? 3 : 1, 18); }
  }, 256, 128);
  const labelMat = new THREE.MeshStandardMaterial({ name: 'LX824HV label', map: labelTexture, roughness: .7 });
  const screenTexture = canvasTexture((c, w) => {
    c.fillStyle = '#080d11'; c.fillRect(0, 0, w, w); c.fillStyle = '#c4e2e5'; c.textAlign = 'center';
    c.font = 'bold 25px Arial'; c.fillText('TonyBot', w / 2, 72); c.font = '18px Arial'; c.fillText('ROBOT READY', w / 2, 111);
    c.strokeStyle = '#68bc9c'; c.lineWidth = 3; c.beginPath(); c.moveTo(51, 156); c.lineTo(91, 156); c.lineTo(104, 144); c.lineTo(118, 177); c.lineTo(130, 137); c.lineTo(144, 156); c.lineTo(204, 156); c.stroke();
  });
  const screenMat = new THREE.MeshStandardMaterial({ name: 'Round chest display', map: screenTexture, emissiveMap: screenTexture, emissive: 0x6b868a, emissiveIntensity: .3, roughness: .28 });

  function group(parent, name, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; }
  function joint(parent, name, x = 0, y = 0, z = 0) { const g = group(parent, name, x, y, z); joints[name] = g; restPose[name] = 0; return g; }
  function mesh(parent, geometry, material, name, x = 0, y = 0, z = 0) {
    if (material === silver && PAINTED_PANELS.has(name)) material = paint;
    const m = new THREE.Mesh(geometry, material); m.name = `${name}_${serial++}`; m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function box(parent, name, w, h, d, x, y, z, material = silver, radius = .001) {
    return mesh(parent, cached(`b${w},${h},${d},${radius}`, () => extrusion(rectangle(w, h, radius), d, Math.min(radius / 3, .0004))), material, name, x, y, z);
  }
  function plate(parent, name, shape, depth, x = 0, y = 0, z = 0, material = silver) { return mesh(parent, extrusion(shape, depth), material, name, x, y, z); }
  function cyl(parent, name, r, length, x, y, z, material = steel, axis = 'z', segments = 32) {
    const m = mesh(parent, cached(`c${r},${length},${segments}`, () => new THREE.CylinderGeometry(r, r, length, segments)), material, name, x, y, z);
    if (axis === 'z') m.rotation.x = Math.PI / 2; if (axis === 'x') m.rotation.z = Math.PI / 2; return m;
  }
  function ring(parent, name, r, tube, x, y, z, material = steel, axis = 'z') {
    const m = mesh(parent, cached(`r${r},${tube}`, () => new THREE.TorusGeometry(r, tube, 8, 40)), material, name, x, y, z); if (axis === 'x') m.rotation.y = Math.PI / 2; if (axis === 'y') m.rotation.x = Math.PI / 2; return m;
  }
  function screw(parent, x, y, z, radius = .00135, axis = 'z') {
    const g = group(parent, `Fastener_${serial++}`, x, y, z); if (axis === 'x') g.rotation.y = Math.PI / 2; if (axis === 'y') g.rotation.x = -Math.PI / 2;
    cyl(g, 'Steel screw head', radius, .0008, 0, 0, 0, steel, 'z', 16);
    box(g, 'Phillips slot', radius * 1.2, radius * .20, .0001, 0, 0, .00045, dark, .00005);
    box(g, 'Phillips slot', radius * .20, radius * 1.2, .0001, 0, 0, .00045, dark, .00005);
    return g;
  }
  function cable(parent, points, radius = .0009, material = dark) {
    return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v => new THREE.Vector3(...v))), 24, radius, 6, false), material, 'Servo cable');
  }
  function horn(parent, x, y, z, radius = .009, axis = 'z') {
    const g = group(parent, `ServoHorn_${serial++}`, x, y, z); if (axis === 'x') g.rotation.y = Math.PI / 2;
    const s = new THREE.Shape(); s.absarc(0, 0, radius, 0, Math.PI * 2);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; hole(s, Math.cos(a) * radius * .68, Math.sin(a) * radius * .68, .0011); }
    plate(g, 'Servo aluminium horn', s, .0015); cyl(g, 'Black axle hub', .0038, .002, 0, 0, .0013, black);
    screw(g, 0, 0, .0025, .00155);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; screw(g, Math.cos(a) * radius * .68, Math.sin(a) * radius * .68, .0013, .00105); }
    return g;
  }
  function servo(parent, x, y, z, name = 'Bus servo', facing = 'front') {
    const g = group(parent, `${name}_${serial++}`, x, y, z);
    box(g, 'Servo black case', .039, .028, .021, 0, 0, 0, black, .0018);
    box(g, 'Servo rear cover', .0395, .022, .002, 0, 0, -.0114, dark, .0009);
    for (const sign of [-1, 1]) {
      box(g, 'Servo mounting ear', .005, .033, .004, sign * .021, 0, 0, black, .0005);
      for (const yy of [-.012, .012]) screw(g, sign * .021, yy, .0026, .00115);
      cyl(g, 'Servo side bearing', .0078, .005, sign * .022, 0, 0, dark, 'x');
    }
    const label = mesh(g, cached('servoLabel', () => new THREE.PlaneGeometry(.026, .013)), labelMat, 'Servo identification', 0, -.001, .0115);
    if (facing === 'side') label.rotation.z = Math.PI / 2;
    box(g, 'Cable socket', .0075, .003, .004, .010, .014, -.004, cream, .0003);
    return g;
  }
  // "Đồ thể thao" costume set: cap, collar, short sleeves and shorts, shown only when that skin is selected.
  // Hems are deliberately short so bare chassis still shows below the sleeve/short cuffs, reading as worn
  // clothing rather than a full-body cover (which left no silhouette and just looked like a recolour).
  const shirtFabric = new THREE.MeshStandardMaterial({ name: 'Sport shirt fabric', color: 0x3569c4, roughness: .78, metalness: .02 });
  const shortsFabric = new THREE.MeshStandardMaterial({ name: 'Sport shorts fabric', color: 0xeef0ea, roughness: .8, metalness: .02 });
  const costume = [];
  function wear(parent, geometry, material, name, x = 0, y = 0, z = 0) {
    const m = mesh(parent, geometry, material, name, x, y, z);
    m.visible = false; costume.push(m); return m;
  }
  function wearBox(parent, name, w, h, d, x, y, z, material, radius = .01) {
    return wear(parent, cached(`wb${w},${h},${d},${radius}`, () => extrusion(rectangle(w, h, radius), d, Math.min(radius / 3, .0004))), material, name, x, y, z);
  }

  // "Áo BDU" costume: a draped red piqué polo. Every piece is a soft cloth shell (no hard boxes): the weave is a
  // procedural height map, so the shirt reads as fabric (matte, sheen at grazing angles) instead of coloured plastic.
  // Red sampled from the supplied uniform photo (~rgb 172,3,43).
  function piqueWeave() {
    const n = 128, h = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const grain = Math.sin(x * Math.PI / 4) * Math.sin(y * Math.PI / 4), hash = Math.abs((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1);
      h[y * n + x] = .5 + .36 * grain + .14 * hash;
    }
    const colour = canvasTexture((c, w, hh) => {
      const d = c.createImageData(w, hh);
      for (let i = 0; i < w * hh; i++) d.data.set([Math.round(205 + h[i] * 50), Math.round(205 + h[i] * 50), Math.round(205 + h[i] * 50), 255], i * 4);
      c.putImageData(d, 0, 0);
    }, n, n);
    const normal = canvasTexture((c, w, hh) => {
      const d = c.createImageData(w, hh), at = (x, y) => h[((y + n) % n) * n + ((x + n) % n)];
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        const nx = (at(x - 1, y) - at(x + 1, y)) * 1.6, ny = (at(x, y - 1) - at(x, y + 1)) * 1.6, l = Math.hypot(nx, ny, 1);
        d.data.set([Math.round((nx / l * .5 + .5) * 255), Math.round((ny / l * .5 + .5) * 255), Math.round((1 / l * .5 + .5) * 255), 255], (y * w + x) * 4);
      }
      c.putImageData(d, 0, 0);
    }, n, n);
    normal.colorSpace = THREE.NoColorSpace;
    for (const t of [colour, normal]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(170, 170); } // UVs are metres, so ~6 mm per weave tile
    return { colour, normal };
  }
  const weave = piqueWeave();
  const clothMat = (name, color) => new THREE.MeshPhysicalMaterial({ name, color, map: weave.colour, normalMap: weave.normal, normalScale: new THREE.Vector2(.6, .6), roughness: 1, metalness: 0, sheen: 1, sheenRoughness: .55, sheenColor: new THREE.Color(0xc8324a), specularIntensity: .15, envMapIntensity: .4, side: THREE.DoubleSide });
  const bduRed = clothMat('BDU polo fabric', 0x860820), bduPlacket = clothMat('BDU polo placket', 0x740619);
  const bduButton = new THREE.MeshStandardMaterial({ name: 'BDU polo button', color: 0xf1ece4, roughness: .4, metalness: .05 });
  const bduLogoTexture = canvasTexture((c, w, h) => {
    c.clearRect(0, 0, w, h); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 96px "Arial Black", Arial, sans-serif';
    c.fillStyle = 'rgba(70,0,16,.5)'; c.fillText('BDU', w / 2 + 2, h / 2 + 4);
    c.fillStyle = '#f7f1ea'; c.fillText('BDU', w / 2, h / 2 + 1);
    c.globalCompositeOperation = 'destination-out'; c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1; // satin-stitch grain
    for (let x = -h; x < w; x += 3) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + h, 0); c.stroke(); }
  }, 256, 128);
  const bduLogoMat = new THREE.MeshStandardMaterial({ name: 'BDU embroidery', map: bduLogoTexture, transparent: true, roughness: .85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const bduCostume = [], shirtCovered = [];
  function wearBdu(parent, geometry, material, name, x = 0, y = 0, z = 0) {
    const m = mesh(parent, geometry, material, name, x, y, z);
    m.visible = false; bduCostume.push(m); return m;
  }

  const pelvis = group(root, 'PelvisFrame', 0, .223, 0);
  const waist = joint(pelvis, 'waist');
  // Faceted, folded sheet metal chest. The photograph has a custom round screen.
  shirtCovered.push(box(waist, 'Interior electronics chassis', .100, .056, .052, 0, .049, -.004, black, .002));
  const front = poly([[-.055,.087],[-.023,.087],[0,.078],[.023,.087],[.055,.087],[.054,.027],[.043,.018],[0,.003],[-.043,.018],[-.054,.027]], [[0,.060,.0038],[0,.035,.0182],[-.026,.035,.0015],[.026,.035,.0015]]);
  shirtCovered.push(plate(waist, 'Chest front folded aluminium', front, .0016, 0, 0, .032));
  for (const sign of [-1,1]) {
    const side = plate(waist, 'Chest side folded aluminium', poly([[-.026,.086],[.029,.086],[.029,.025],[.015,.017],[-.026,.024]]), .0016, sign*.055, 0, .003);
    side.rotation.y = sign*Math.PI/2; shirtCovered.push(side);
    for (const yy of [.032,.077]) shirtCovered.push(screw(waist,sign*.0563,yy,.009,.0012,'x'));
  }
  const top = plate(waist,'Chest top deck',rectangle(.112,.067,.003),.0016,0,.088,0);top.rotation.x=-Math.PI/2;shirtCovered.push(top);
  for(const x of [-.021,.021]) shirtCovered.push(screw(waist,x,.0895,.015,.0013,'y'));
  const backShape=rectangle(.107,.065,.004);for(let i=0;i<7;i++)slot(backShape,-.030+i*.010,.007,.004,.027);
  shirtCovered.push(plate(waist,'Ventilated rear cover',backShape,.0014,0,.052,-.031));
  for(const x of [-.047,.047])for(const y of [.027,.079])shirtCovered.push(screw(waist,x,y,-.0323,.0012));
  cyl(waist,'Chest display body',.0184,.004,0,.035,.031,black);
  ring(waist,'Display rim',.0186,.00065,0,.035,.0331,edge);
  mesh(waist,cached('displayCircle',()=>new THREE.CircleGeometry(.0178,64)),screenMat,'Round status screen',0,.035,.0338);
  cyl(waist,'Upper status aperture',.0036,.002,0,.060,.033,dark);
  for(const x of [-.026,.026])screw(waist,x,.035,.0335,.00145);
  plate(pelvis,'Hip support front',poly([[-.042,.014],[.042,.014],[.037,-.008],[.026,-.017],[-.026,-.017],[-.037,-.008]],[[-.030,-.005,.0015],[.030,-.005,.0015],[0,-.010,.0012]]),.0016,0,0,.017);
  box(pelvis,'Pelvis frame crossmember',.073,.018,.029,0,-.006,-.002,edge,.001);

  // Shoulder-mounted hardware visible in the photograph, separate from omitted camera.
  const moduleL=group(waist,'Round shoulder module',-.038,.094,.002);
  box(moduleL,'Module base',.026,.008,.025,0,0,0,black,.0007);
  cyl(moduleL,'Module round grille',.010,.009,0,.007,0,black,'y');
  for(let i=0;i<6;i++){const a=i*Math.PI/3;cyl(moduleL,'Grille perforation',.0013,.0002,Math.cos(a)*.006,.0117,Math.sin(a)*.006,dark,'y',10);}
  box(moduleL,'USB socket',.009,.0032,.001,0,0,.013,edge,.0007);box(moduleL,'USB opening',.007,.0017,.001,0,0,.0136,dark,.0004);
  const board=group(waist,'Shoulder circuit board',.040,.094,0);
  box(board,'PCB raised base',.027,.007,.026,0,0,0,black,.0006);
  box(board,'PCB laminate',.026,.0016,.025,0,.0048,0,greenBoard,.0003);
  box(board,'Main IC',.009,.002,.009,-.001,.0066,0,black,.0003);
  box(board,'White cable connector',.011,.005,.006,0,.008,-.007,cream,.0003);
  box(board,'USB-C connector',.008,.003,.005,.001,.007,.009,steel,.0006);
  for(const x of [-.010,.010])for(const z of [-.009,.009])screw(board,x,.006,z,.001,'y');
  for(let i=0;i<6;i++)box(board,'Gold pin header',.0008,.002,.002,-.009+i*.002,.0065,-.002,gold,.0001);
  shirtCovered.push(moduleL,board);
  for(let i=0;i<4;i++)shirtCovered.push(cable(waist,[[.036+i*.0015,.104,-.007],[.035+i*.0015,.119,-.018],[.027+i*.0015,.126,-.025],[.018+i*.0015,.104,-.028]],.0006));

  const collar=ring(waist,'Shirt collar',.017,.0035,0,.086,-.002,shirtFabric,'y');collar.visible=false;costume.push(collar);

  // ---- BDU polo, torso ----
  // Section table (y, half-width, half-depth): fitted chest, broad shoulder line that carries into the sleeves, neck opening.
  const TAU=Math.PI*2,BN=2.5,BCZ=-.001;
  const PROFILE=[[-.010,.060,.041],[.004,.058,.040],[.028,.056,.0385],[.052,.060,.040],[.068,.074,.039],[.080,.066,.033],[.088,.040,.024],[.094,.022,.0175]];
  function profileAt(y){
    const P=PROFILE,last=P.length-1;
    if(y<=P[0][0])return [P[0][1],P[0][2]];if(y>=P[last][0])return [P[last][1],P[last][2]];
    let i=0;while(y>P[i+1][0])i++;
    const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(last,i+2)],u=(y-p1[0])/(p2[0]-p1[0]);
    const cr=k=>.5*(2*p1[k]+(p2[k]-p0[k])*u+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*u*u+(3*p1[k]-p0[k]-3*p2[k]+p3[k])*u**3);
    return [cr(1),cr(2)];
  }
  // Soft creases: a few interfering folds, stronger near the hem and fading out at the neckline.
  const wrinkle=(t,y)=>(.0007*Math.sin(5*t+38*y)+.0004*Math.sin(11*t-55*y+1.7)+.0003*Math.sin(3*t+90*y))*(1+1.4*Math.max(0,(.03-y)/.04))*(y>.082?Math.max(0,1-(y-.082)/.012):1);
  function bodyPoint(t,y,lift=0){
    const [rx,rz]=profileAt(y),e=2/BN,sn=Math.sin(t),cs=Math.cos(t);
    const x=rx*Math.sign(sn)*Math.abs(sn)**e,z=rz*Math.sign(cs)*Math.abs(cs)**e,len=Math.hypot(x,z)||1,k=(len+lift+wrinkle(t,y))/len;
    return [x*k,y,z*k+BCZ];
  }
  const tForX=(x,y)=>Math.sign(x)*Math.asin(Math.min(1,(Math.abs(x)/profileAt(y)[0])**(BN/2)));
  const surfaceZ=(x,y,lift=0)=>{const [rx,rz]=profileAt(y),r=Math.min(.985,Math.abs(x)/rx);return rz*(1-r**BN)**(1/BN)+BCZ+lift;};
  // rows x (cols+1) grid -> indexed cloth. UVs are arc length in metres (weave scale is the same everywhere) unless a box is given.
  function clothShell(rows,cols,point,uvBox=null){
    const P=[],uv=[],idx=[];
    for(let j=0;j<rows;j++)for(let i=0;i<=cols;i++)P.push(point(j,i));
    const U=new Float32Array(P.length),V=new Float32Array(P.length),d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
    for(let j=0;j<rows;j++)for(let i=0;i<=cols;i++){
      const n=j*(cols+1)+i;U[n]=i?U[n-1]+d(P[n],P[n-1]):0;V[n]=j?V[n-cols-1]+d(P[n],P[n-cols-1]):0;
      uv.push(uvBox?(P[n][0]-uvBox[0])/(uvBox[1]-uvBox[0]):U[n],uvBox?(P[n][1]-uvBox[2])/(uvBox[3]-uvBox[2]):V[n]);
    }
    for(let j=0;j<rows-1;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1,dd=c+1;idx.push(a,b,c,b,dd,c);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P.flat(),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
  }
  // Body rows: a rolled hem (tucked lip, outer fold, then up the shirt), wavy so it does not read as a cut ring.
  const bodyRows=[[-.0075,-.0030],[-.0105,.0008],[-.0070,.0006]];
  for(let j=0;j<=26;j++)bodyRows.push([-.004+j*.098/26,0]);
  const BODY_COLS=72;
  wearBdu(waist,clothShell(bodyRows.length,BODY_COLS,(j,i)=>{
    const t=i/BODY_COLS*TAU,[y,lift]=bodyRows[j];
    return bodyPoint(t,y+(j<3?.0014*Math.sin(7*t+.6)+.0008*Math.sin(13*t):0),lift);
  }),bduRed,'BDU polo body');
  // Button placket, 15 mm wide, lying on the cloth.
  const PH=.0075,placketYs=[];for(let y=.030;y<=.0925;y+=.0042)placketYs.push(y);
  wearBdu(waist,clothShell(placketYs.length,6,(j,i)=>{const x=-PH+2*PH*i/6;return bodyPoint(tForX(x,placketYs[j]),placketYs[j],.0009);}),bduPlacket,'BDU polo placket');
  for(const by of [.040,.056,.072]){
    const z0=bodyPoint(0,by-.002)[2],z1=bodyPoint(0,by+.002)[2],btn=wearBdu(waist,cached('bduButton',()=>new THREE.CylinderGeometry(.0036,.0036,.0016,16).rotateX(Math.PI/2)),bduButton,'BDU polo button',0,by,bodyPoint(0,by,.0016)[2]);
    btn.rotation.x=Math.atan((z1-z0)/.004);
  }
  // Collar: a soft stand around the neck (open at the front) plus two flaps lying on the shoulder line.
  const COLLAR=[[.085,.0236],[.0895,.0236],[.0935,.0252]];
  wearBdu(waist,clothShell(COLLAR.length,40,(j,i)=>{
    const t=.5+(TAU-1.0)*i/40,[y,r]=COLLAR[j],w=.0004*Math.sin(7*t+y*200);
    return [(r+w)*Math.sin(t),y,-.002+(r-.003+w)*Math.cos(t)];
  }),bduRed,'BDU polo collar band');
  for(const sign of [-1,1]){
    const A=[sign*.005,.0925],B=[sign*.0285,.0912],Tp=[sign*.0185,.0655],N=8;
    wearBdu(waist,clothShell(N+1,N,(j,i)=>{
      const u=i/N,v=j/N,x=A[0]+(B[0]-A[0])*u*(1-v)+(Tp[0]-A[0])*v,y=A[1]+(B[1]-A[1])*u*(1-v)+(Tp[1]-A[1])*v;
      return [x,y,surfaceZ(x,y,.0016+.0062*(1-v)**1.3)];
    }),bduRed,'BDU polo collar flap');
  }
  // Embroidered BDU mark over the wearer's left chest (robot +x); u follows x so the lettering is not stretched.
  const LOGO={x0:.014,x1:.045,y0:.041,y1:.055};
  const logo=wearBdu(waist,clothShell(3,14,(j,i)=>{const x=LOGO.x0+(LOGO.x1-LOGO.x0)*i/14,y=LOGO.y0+(LOGO.y1-LOGO.y0)*j/2;return bodyPoint(tForX(x,y),y,.0012);},[LOGO.x0,LOGO.x1,LOGO.y0,LOGO.y1]),bduLogoMat,'BDU embroidered logo');logo.castShadow=false;
  // Short sleeve: tapered cloth tube around the upper arm, hem turned up inside. Built in the shoulder-pitch frame so it swings with the arm.
  const SLEEVE=[[.031,.006],[.0295,.0155],[.025,.0232],[.014,.0268],[.0,.0276],[-.014,.0283],[-.0225,.0292],[-.0245,.0286],[-.0225,.0274]];
  function sleeve(parent,name,sign){
    return wearBdu(parent,clothShell(SLEEVE.length,40,(j,i)=>{
      const t=i/40*TAU,[y,r]=SLEEVE[j],w=.0005*Math.sin(4*t+25*y+sign)+.0004*Math.sin(9*t-40*y+.9);
      return [(r+w)*1.03*Math.sin(t),y,-.005+(r+w)*Math.cos(t)];
    }),bduRed,name);
  }

  const neckYaw=joint(waist,'neckYaw',0,.091,-.002),neckPitch=joint(neckYaw,'neckPitch');
  cyl(neckPitch,'Neck spindle',.007,.009,0,0,0,black,'y');
  box(neckPitch,'Neck mounting foot',.028,.004,.024,0,.004,0,edge,.001);
  // Head front silhouette, twin sensor apertures and thin side flanges.
  const head=group(neckPitch,'HeadAssembly',0,.006,0);
  const faceShape=poly([[-.027,.052],[-.031,.046],[-.030,.022],[-.023,.017],[-.016,.014],[-.015,.000],[.015,.000],[.016,.014],[.023,.017],[.030,.022],[.031,.046],[.027,.052]], [[-.0145,.035,.009],[.0145,.035,.009]]);
  plate(head,'Head face aluminium',faceShape,.0015,0,0,.025);
  const rear=poly([[-.023,.063],[-.029,.054],[-.028,.021],[-.015,.010],[.015,.010],[.028,.021],[.029,.054],[.023,.063]]);
  plate(head,'Head rear enclosure',rear,.0015,0,0,-.022);
  for(const sign of [-1,1]){
    const sideShape=poly([[-.024,.050],[-.011,.063],[.015,.063],[.024,.049],[.022,.018],[.008,.011],[-.022,.020]]);
    slot(sideShape,-.006,.050,.013,.004);slot(sideShape,.003,.039,.012,.003);
    const side=plate(head,'Head angled side cheek',sideShape,.0015,sign*.029,0,0);side.rotation.y=Math.PI/2;
    screw(head,sign*.0303,.027,0,.00125,'x');
    const brow=box(head,'Upper head rim',.003,.018,.026,sign*.024,.056,0,silver,.0005);brow.rotation.z=sign*.48;
  }
  const crown=box(head,'Head crown crosspiece',.040,.002,.036,0,.063,0,silver,.0005);
  for(const x of [-.016,.016])screw(head,x,.0644,0,.001,'y');
  wear(head,cached('capBrim',()=>new THREE.CylinderGeometry(.036,.036,.006,24)),shirtFabric,'Bucket cap brim',0,.0585,0);
  wear(head,cached('capDome',()=>new THREE.SphereGeometry(.030,20,12,0,Math.PI*2,0,Math.PI*.62)),shirtFabric,'Bucket cap dome',0,.062,0);
  const face={mouthBars:[]};
  for(const [side,x] of [['Left',.0145],['Right',-.0145]]){
    cyl(head,'Sensor black barrel',.0094,.010,x,.035,.022,black);
    ring(head,'Sensor machined bezel',.009,.0009,x,.035,.028,steel);
    ring(head,'Sensor inner bezel',.0083,.00035,x,.035,.0286,edge);
    const eye=mesh(head,cached('eyeDisc',()=>new THREE.CircleGeometry(.008,48)),led,`EyeLED${side}`,x,.035,.0289);eye.name=`EyeLED${side}`;
    face[side==='Left'?'leftEyeLed':'rightEyeLed']=eye;
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;mesh(head,cached('ledPin',()=>new THREE.SphereGeometry(.00055,8,6)),mouthMat,'Eye LED pin',x+Math.cos(a)*.0065,.035+Math.sin(a)*.0065,.029);}
  }
  face.mouth=group(head,'MouthDisplay',0,.011,.0263);
  for(let i=0;i<7;i++){const bar=box(face.mouth,'Mouth LED bar',.0015,.003,.00035,(i-3)*.0025,0,0,mouthMat,.0003);bar.name=`MouthBar${i}`;face.mouthBars.push(bar);}
  face.mouth.scale.setScalar(.001);

  // Arms are nested at physical axle centres; plates never stretch with motion.
  for(const [side,sign] of [['left',1],['right',-1]]){
    cyl(waist,'Shoulder connecting axle',.0065,.028,sign*.069,.073,0,steel,'x');
    shirtCovered.push(box(waist,'Shoulder mounting spacer',.009,.026,.030,sign*.060,.073,0,black,.001));
    const shoulderRoll=joint(waist,`${side}ShoulderRoll`,sign*.084,.073,0);
    const shoulder=joint(shoulderRoll,`${side}ShoulderPitch`,0,-.018,0);
    restPose[`${side}ShoulderRoll`]=sign*12;shoulderRoll.rotation.z=THREE.MathUtils.degToRad(sign*12);
    const shoulderServo=servo(shoulderRoll,0,-.003,-.012,'Shoulder roll servo');shoulderServo.rotation.z=Math.PI/2;shirtCovered.push(shoulderServo);
    const armPlate=rectangle(.027,.031,.007);hole(armPlate,0,.008,.0036);
    shirtCovered.push(plate(shoulderRoll,'Shoulder cheek plate',armPlate,.0016,0,-.006,.014),horn(shoulderRoll,0,0,.016,.0105));
    shirtCovered.push(box(shoulderRoll,'Upper arm pitch servo housing',.022,.023,.027,0,-.028,-.002,black,.001));
    horn(shoulder,0,0,.016,.0086);
    cyl(shoulderRoll,'Upper arm pitch axle',.0055,.030,0,-.018,0,steel,'x');
    box(shoulder,'Upper arm link',.023,.025,.018,0,-.025,-.002,silver,.0015);
    for(const xx of [-.009,.009])screw(shoulder,xx,-.025,.008,.0011);
    for(let i=0;i<3;i++)cable(shoulder,[[sign*.008,-.004,-.019],[sign*.013,-.022,-.025],[sign*.011,-.045,-.019],[0,-.050,-.014]],.00065);
    const elbow=joint(shoulder,`${side}Elbow`,0,-.040,0);
    const elbowServo=servo(shoulder,0,-.041,-.005,'Elbow fixed servo');elbowServo.rotation.z=Math.PI/2;
    plate(elbow,'Forearm plate',poly([[-.012,.006],[.012,.006],[.013,-.026],[.009,-.034],[-.009,-.034],[-.013,-.026]],[[-.007,-.020,.0014],[.007,-.020,.0014]]),.0016,0,0,.013);
    horn(elbow,0,0,.0145,.0095);
    for(const xx of [-.015,.015])horn(elbow,xx,0,0,.0065,'x');
    cyl(shoulder,'Elbow lateral axle',.0045,.033,0,-.040,0,steel,'x');
    box(elbow,'Forearm side rail',.003,.028,.023,-.011,-.015,0,silver,.0005);
    box(elbow,'Forearm side rail',.003,.028,.023,.011,-.015,0,silver,.0005);
    wearBox(shoulder,`${side}ShirtSleeve`,.050,.016,.030,0,-.004,-.004,shirtFabric);
    sleeve(shoulder,`${side}BDU polo sleeve`,sign);
    const wrist=joint(elbow,`${side}Wrist`,0,-.034,0);
    box(wrist,'Wrist coupling',.019,.012,.017,0,-.002,0,black,.001);
    const hand=group(wrist,`${side}SlottedHand`);hand.scale.x=-sign;
    const palm=poly([[-.011,.003],[.011,.003],[.012,-.014],[.006,-.020],[.004,-.044],[-.005,-.051],[-.011,-.044]],[[0,-.003,.0013],[-.006,-.004,.0011],[.006,-.004,.0011]]);
    plate(hand,'Open palm aluminium',palm,.0018,0,-.002,.012);
    // Three separate bent sheet fingers with open slots between them.
    for(let i=0;i<3;i++){
      const yy=-.049-i*.006;
      const shape=poly([[-.009,yy+.009],[-.004,yy+.005],[.014,yy-.007],[.020,yy-.004],[.022,yy+.001],[.026,yy-.001],[.023,yy-.010],[.015,yy-.012],[-.008,yy+.002]]);
      const finger=plate(hand,'Slotted aluminium finger',shape,.0015,0,0,.012+i*.0003);finger.rotation.y=-sign*.13;
    }
    const thumbShape=poly([[.006,-.020],[.020,-.035],[.019,-.040],[.015,-.041],[.003,-.032],[-.001,-.029]]);
    plate(hand,'Flat thumb',thumbShape,.0018,0,0,.012);
    for(const x of [-.006,.006])screw(hand,x,-.006,.0133,.0011);
  }

  // Leg stacks: hip roll bracket, hip pitch servo, knee, ankle and foot roll.
  for(const [side,sign] of [['left',1],['right',-1]]){
    const yaw=joint(pelvis,`${side}HipYaw`,sign*.033,0,0);
    const roll=joint(yaw,`${side}HipRoll`);
    box(roll,'Hip roll housing',.021,.027,.026,0,-.002,-.004,black,.001);
    const hipBracket=rectangle(.026,.040,.009);hole(hipBracket,0,.010,.004);for(const xx of [-.006,.006])hole(hipBracket,xx,-.010,.002);
    plate(roll,'Hip roll front bracket',hipBracket,.0015,0,-.010,.015);
    horn(roll,0,0,.017,.0094);
    for(const xx of [-.025,.025])box(roll,'Hip pitch yoke cheeks',.0015,.035,.027,xx,-.035,0,silver,.0004);
    const hip=joint(roll,`${side}HipPitch`,0,-.043,0);
    servo(hip,0,0,0,'Hip pitch bus servo','side');
    // Wide U channel with open sides shows the motor cases, like the reference.
    for(const xx of [-.025,.025]){
      const rail=poly([[-.016,.014],[.016,.014],[.016,-.063],[.012,-.077],[-.012,-.077],[-.016,-.063]],[[0,0,.0078],[0,-.067,.0078]]);
      const p=plate(hip,'Thigh U bracket rail',rail,.0015,xx,0,0);p.rotation.y=Math.PI/2;
      horn(hip,xx+Math.sign(xx)*.001,0,0,.0077,'x');
    }
    box(hip,'Thigh bridge plate',.049,.031,.0017,0,-.034,.015,silver,.0007);
    for(const xx of [-.021,.021])for(const yy of [-.022,-.045])screw(hip,xx,yy,.0162,.0011);
    for(let i=0;i<3;i++)cable(hip,[[sign*.018,0,-.014],[sign*.026,-.025,-.020],[sign*.021,-.059,-.017]],.00065);
    const knee=joint(hip,`${side}Knee`,0,-.067,0);
    servo(knee,0,0,0,'Knee pitch bus servo','side');
    for(const xx of [-.025,.025]){
      const s=rectangle(.031,.070,.005);hole(s,0,.024,.0075);hole(s,0,-.029,.0075);slot(s,0,-.003,.006,.014);
      const p=plate(knee,'Shin U bracket rail',s,.0015,xx,-.023,0);p.rotation.y=Math.PI/2;
      horn(knee,xx+Math.sign(xx)*.001,0,0,.0075,'x');
    }
    box(knee,'Shin front cross strap',.049,.015,.0016,0,-.028,.015,silver,.0006);
    wearBox(hip,`${side}Shorts`,.056,.026,.036,0,-.010,.004,shortsFabric,.012);
    const anklePitch=joint(knee,`${side}AnklePitch`,0,-.056,0),ankleRoll=joint(anklePitch,`${side}AnkleRoll`,0,-.039,0);
    servo(anklePitch,0,0,0,'Ankle pitch bus servo');
    for(const xx of [-.025,.025])horn(anklePitch,xx,0,0,.0075,'x');
    // Foot roll motor is mounted beneath ankle pitch, visible between the yokes.
    const footMotor=servo(anklePitch,0,-.029,0,'Foot roll bus servo');footMotor.rotation.z=Math.PI/2;
    const ankleBracket=poly([[-.014,.004],[.014,.004],[.014,-.031],[.009,-.040],[-.009,-.040],[-.014,-.031]],[[0,-.007,.002],[0,-.014,.0015],[-.007,-.016,.0015],[.007,-.016,.0015]]);
    plate(ankleRoll,'Ankle front bracket',ankleBracket,.0018,0,.027,.018);
    horn(ankleRoll,0,0,.020,.009);
    // 78 × 113 mm foot outline, chamfered toes, raised side flanges and black sole.
    const outline=[[-.033,-.050],[.033,-.050],[.039,-.038],[.039,.040],[.030,.060],[.018,.063],[-.018,.063],[-.030,.060],[-.039,.040],[-.039,-.038]];
    const fs=poly(outline);for(const xx of [-.018,.018])for(const zz of [-.019,.020])hole(fs,xx,zz,.0016);
    const foot=plate(ankleRoll,'Aluminium foot plate',fs,.002,sign*.0125,-.016,0);foot.rotation.x=Math.PI/2;
    const sole=plate(ankleRoll,'Thin rubber sole',poly(outline),.0007,sign*.0125,-.01765,0,dark);sole.rotation.x=Math.PI/2;
    for(const xx of [-.036,.036]){
      const flange=poly([[-.035,0],[.038,0],[.031,.014],[-.030,.014]]);
      const p=plate(ankleRoll,'Foot folded side flange',flange,.0015,xx+sign*.0125,-.014,0);p.rotation.y=Math.PI/2;
    }
    for(const xx of [-.018,.018])for(const zz of [-.019,.020])screw(ankleRoll,xx+sign*.0125,-.0145,zz,.0013,'y');
    cable(anklePitch,[[.014,-.006,-.011],[.018,-.029,-.022],[.008,-.046,-.018]],.0011);
    cable(pelvis,[[sign*.043,.015,-.017],[sign*.053,-.014,-.032],[sign*.047,-.052,-.030],[sign*.030,-.063,-.020]],.0013,sign>0?red:dark);
  }
  root.updateMatrixWorld(true);
  return { root, joints, face, costume, bduCostume, shirtCovered, styleMaterials: { shell: paint, frame: silver, trim: edge, fasteners: steel, servo: black, eyes: led, mouth: mouthMat }, dimensions: { height: .383, thigh: .067, shin: .056, ankleHeight: .057, hipHeight: .180, hipRollHeight: .223 }, restPose };
}
