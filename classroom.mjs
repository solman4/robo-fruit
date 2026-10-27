import * as THREE from 'three';

// Kindergarten classroom around the robot, at robot scale (the 383 mm robot stands for a child, so the room is
// roughly 0.35x a real one). Built from primitives and canvas textures in the Bolt palette; no external assets.
const C = { red: '#E31C3D', sun: '#FFB800', sky: '#1BA3E0', mint: '#00B894', violet: '#7B5CFF', ink: '#1A1F36', coral: '#F08A7C' };
const RAINBOW = [C.red, C.sun, C.mint, C.sky, C.violet];

function texture(w, h, draw, { repeat, srgb = true } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(canvas); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0, ...extra });
function add(parent, geometry, material, [x, y, z], { rot, shadow = false } = {}) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); if (rot) m.rotation.set(...rot);
  m.receiveShadow = shadow; parent.add(m); return m;
}
const box = (w, h, d, r = 0) => r ? roundedBox(w, h, d, r) : new THREE.BoxGeometry(w, h, d);
function roundedBox(w, h, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: r * .35, bevelThickness: r * .35, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, -d / 2); return g;
}

export function createClassroom() {
  const root = new THREE.Group(); root.name = 'Classroom';
  const W = 2.0, BACK = -.6, H = 1.0, FRONT = 1.5;

  // Floor: light oak planks; a round rainbow rug under the robot.
  const planks = texture(512, 512, (g, w, h) => {
    g.fillStyle = '#E9CFA6'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) {
      const y = row * h / 8, shift = (row * 173) % w;
      g.fillStyle = row % 2 ? '#E3C597' : '#EDD5AE'; g.fillRect(0, y, w, h / 8);
      g.strokeStyle = 'rgba(120,80,40,.25)'; g.lineWidth = 2; g.strokeRect(-2, y, w + 4, h / 8);
      for (let x = shift % 256; x < w; x += 256) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h / 8); g.stroke(); }
      for (let k = 0; k < 6; k++) { g.strokeStyle = 'rgba(150,100,50,.08)'; g.beginPath(); g.moveTo(0, y + 8 + k * 9); g.bezierCurveTo(w * .3, y + 4 + k * 9, w * .6, y + 12 + k * 9, w, y + 7 + k * 9); g.stroke(); }
    }
  }, { repeat: [4, 4] });
  add(root, new THREE.PlaneGeometry(W, FRONT - BACK), mat(0xffffff, { map: planks }), [0, -.003, (FRONT + BACK) / 2], { rot: [-Math.PI / 2, 0, 0] });
  const rug = texture(512, 512, (g, w) => {
    const c = w / 2; RAINBOW.concat([C.coral]).forEach((col, i, all) => { g.fillStyle = col; g.beginPath(); g.arc(c, c, c * (1 - i / all.length), 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#FFF8E4'; g.beginPath(); g.arc(c, c, c * .2, 0, Math.PI * 2); g.fill();
  });
  add(root, new THREE.CircleGeometry(.36, 64), mat(0xffffff, { map: rug, roughness: 1 }), [0, -.002, .04], { rot: [-Math.PI / 2, 0, 0] });

  // Walls: soft sky back wall with a sunny wainscot, violet and mint side walls.
  const wall = (top, bottom, w, h) => texture(1024, Math.round(1024 * h / w), (g, cw, ch) => {
    g.fillStyle = top; g.fillRect(0, 0, cw, ch);
    g.fillStyle = 'rgba(255,255,255,.45)';
    for (let y = 20; y < ch * .75; y += 46) for (let x = (y / 46 % 2) * 23 + 12; x < cw; x += 46) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
    const band = ch * .78; g.fillStyle = bottom; g.fillRect(0, band, cw, ch - band);
    g.fillStyle = '#FFFFFF'; g.fillRect(0, band - 8, cw, 10);
  });
  add(root, new THREE.PlaneGeometry(W, H), mat(0xffffff, { map: wall('#DDF2FC', '#FFE9B8', W, H) }), [0, H / 2, BACK]);
  add(root, new THREE.PlaneGeometry(FRONT - BACK, H), mat(0xffffff, { map: wall('#ECE6FF', '#C8F3E4', FRONT - BACK, H) }), [-W / 2, H / 2, (FRONT + BACK) / 2], { rot: [0, Math.PI / 2, 0] });
  add(root, new THREE.PlaneGeometry(FRONT - BACK, H), mat(0xffffff, { map: wall('#E6FAF5', '#FFD9D2', FRONT - BACK, H) }), [W / 2, H / 2, (FRONT + BACK) / 2], { rot: [0, -Math.PI / 2, 0] });

  // Whiteboard, redrawn with whatever the robot is saying or singing.
  const boardCanvas = document.createElement('canvas'); boardCanvas.width = 1024; boardCanvas.height = 400;
  const boardTex = new THREE.CanvasTexture(boardCanvas); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 8;
  let boardState = { title: 'Hello!', sub: 'Xin chào các bạn' };
  function drawBoard() {
    const g = boardCanvas.getContext('2d'), w = boardCanvas.width, h = boardCanvas.height, s = boardState;
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(27,163,224,.12)'; g.lineWidth = 2;
    for (let y = 40; y < h; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (s.words) {
      let size = 92; g.font = `900 ${size}px Nunito, sans-serif`;
      // A leading '-' joins a syllable to the previous one (Twin-kle); each syllable still lights up on its own.
      const parts = s.words.map(word => word.replace(/^-/, '')), joined = s.words.map(word => word.startsWith('-'));
      const gapBefore = i => (i && !joined[i] ? size * .28 : 0);
      const total = () => parts.reduce((sum, part, i) => sum + g.measureText(part).width + gapBefore(i), 0);
      while (total() > w - 80 && size > 40) { size -= 4; g.font = `900 ${size}px Nunito, sans-serif`; }
      let x = (w - total()) / 2; g.textAlign = 'left';
      parts.forEach((part, i) => { x += gapBefore(i); g.fillStyle = i === s.active ? C.red : i < s.active ? C.ink : 'rgba(26,31,54,.35)'; g.fillText(part, x, h * .42); x += g.measureText(part).width; });
      g.textAlign = 'center';
    } else {
      let size = 120; g.font = `900 ${size}px Nunito, sans-serif`;
      while (g.measureText(s.title).width > w - 80 && size > 40) { size -= 4; g.font = `900 ${size}px Nunito, sans-serif`; }
      g.fillStyle = s.color || C.ink; g.fillText(s.title, w / 2, h * .42);
    }
    if (s.sub) { g.font = `700 44px "Be Vietnam Pro", sans-serif`; g.fillStyle = '#5C6478'; g.fillText(s.sub, w / 2, h * .78); }
    boardTex.needsUpdate = true;
  }
  drawBoard();
  const board = new THREE.Group(); board.position.set(0, .49, BACK + .012); root.add(board);
  add(board, box(.76, .3, .016, .01), mat(0xD9DEE8, { roughness: .5 }), [0, 0, 0]);
  add(board, new THREE.PlaneGeometry(.72, .28125), new THREE.MeshStandardMaterial({ map: boardTex, roughness: .35 }), [0, 0, .0135]); // in front of the bevelled frame
  add(board, box(.5, .01, .03), mat(0xC9CFDA), [0, -.155, .014]);
  [[C.red, -.2], [C.sky, -.17], [C.mint, -.14]].forEach(([col, x]) => add(board, new THREE.CylinderGeometry(.005, .005, .045, 10), mat(col), [x, -.145, .022], { rot: [0, 0, Math.PI / 2] }));

  // Alphabet bunting across the back wall.
  const flagLetters = 'ABCDEFGHIJKLM';
  const flagShape = new THREE.Shape(); flagShape.moveTo(-.035, 0); flagShape.lineTo(.035, 0); flagShape.lineTo(0, -.06); flagShape.lineTo(-.035, 0);
  const flagGeo = new THREE.ShapeGeometry(flagShape);
  const uv = flagGeo.attributes.uv, pos = flagGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + .035) / .07, (pos.getY(i) + .06) / .06);
  const n = flagLetters.length, span = W - .2;
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + span * (i + .5) / n, sag = .03 * Math.sin(Math.PI * (i + .5) / n), col = RAINBOW[i % RAINBOW.length];
    const tex = texture(128, 128, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 54px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(flagLetters[i], w / 2, h * .38); });
    add(root, flagGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: .9, side: THREE.DoubleSide }), [x, .72 - sag, BACK + .01], { rot: [0, 0, .06 * Math.sin(i * 1.7)] });
  }
  const string = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, k) => new THREE.Vector3(-W / 2 + .05 + (W - .1) * k / 8, .72 - .03 * Math.sin(Math.PI * k / 8), BACK + .008)));
  add(root, new THREE.TubeGeometry(string, 40, .0015, 6), mat(0x8B6B4A), [0, 0, 0]);

  // Window on the left of the board, with a sky, clouds and sunny curtains.
  const sky = texture(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#7FD0F5'); grad.addColorStop(1, '#D8F2FF'); g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; for (const [x, y, r] of [[70, 80, 26], [100, 70, 32], [130, 84, 24], [180, 160, 20], [205, 150, 26], [228, 162, 18]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#7ED957'; g.beginPath(); g.ellipse(w * .3, h * 1.05, w * .6, h * .22, 0, 0, Math.PI * 2); g.fill();
  });
  const win = new THREE.Group(); win.position.set(-.66, .47, BACK + .01); root.add(win);
  add(win, new THREE.PlaneGeometry(.3, .26), new THREE.MeshBasicMaterial({ map: sky }), [0, 0, .002]);
  for (const [w, h, x, y] of [[.32, .02, 0, .14], [.32, .02, 0, -.14], [.02, .3, -.15, 0], [.02, .3, .15, 0], [.012, .26, 0, 0], [.3, .012, 0, 0]]) add(win, box(w, h, .02), mat(0xffffff), [x, y, .006]);
  add(win, box(.38, .016, .05), mat(0xffffff), [0, -.155, .02]);
  for (const s of [-1, 1]) add(win, box(.06, .32, .01, .004), mat(C.sun), [s * .19, .01, .016]);

  // Bookshelf on the right with colourful books, a globe and a plant.
  const shelf = new THREE.Group(); shelf.position.set(.66, 0, BACK + .09); root.add(shelf);
  const wood = mat(0xF4E3C8);
  add(shelf, box(.34, .012, .15), wood, [0, .44, 0]);
  for (const y of [.006, .15, .295]) add(shelf, box(.32, .012, .15), wood, [0, y, 0]);
  for (const x of [-.165, .165]) add(shelf, box(.012, .45, .15), wood, [x, .222, 0]);
  add(shelf, box(.34, .45, .008), mat(0xFFF3CC), [0, .222, -.072]);
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (const y of [.012, .156, .301]) {
    let x = -.15;
    while (x < .14) {
      const bw = .016 + rnd() * .014, bh = .09 + rnd() * .04, col = [C.red, C.sun, C.sky, C.mint, C.violet, C.coral][Math.floor(rnd() * 6)];
      add(shelf, box(bw, bh, .1), mat(col, { roughness: .7 }), [x + bw / 2, y + .006 + bh / 2, .01], { rot: [0, 0, rnd() < .12 ? .12 : 0] });
      x += bw + .003;
    }
  }
  const globe = new THREE.Group(); globe.position.set(-.07, .5, 0); shelf.add(globe);
  add(globe, new THREE.SphereGeometry(.045, 24, 16), mat(C.sky, { roughness: .5 }), [0, .02, 0]);
  add(globe, new THREE.CylinderGeometry(.006, .03, .03, 16), mat(C.sun), [0, -.03, 0]);
  const plant = new THREE.Group(); plant.position.set(.08, .446, 0); shelf.add(plant);
  add(plant, new THREE.CylinderGeometry(.03, .024, .05, 20), mat(C.coral), [0, .025, 0]);
  for (let i = 0; i < 7; i++) add(plant, new THREE.SphereGeometry(.028, 12, 10), mat(i % 2 ? 0x3BB273 : 0x56C98A), [Math.cos(i * 2.4) * .025, .07 + (i % 3) * .018, Math.sin(i * 2.4) * .02]);

  // Wall clock above the shelf.
  const clockTex = texture(256, 256, (g, w) => {
    const c = w / 2; g.fillStyle = '#fff'; g.beginPath(); g.arc(c, c, c - 4, 0, Math.PI * 2); g.fill();
    g.lineWidth = 14; g.strokeStyle = C.red; g.stroke();
    g.fillStyle = C.ink; g.font = '800 34px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    [['12', 0], ['3', 3], ['6', 6], ['9', 9]].forEach(([t, k]) => { const a = k / 12 * Math.PI * 2 - Math.PI / 2; g.fillText(t, c + Math.cos(a) * 88, c + Math.sin(a) * 88); });
    g.lineCap = 'round'; g.lineWidth = 10; g.beginPath(); g.moveTo(c, c); g.lineTo(c + 40, c - 30); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(c, c); g.lineTo(c - 20, c - 70); g.stroke();
  });
  add(root, new THREE.CircleGeometry(.065, 40), new THREE.MeshStandardMaterial({ map: clockTex, roughness: .6 }), [.66, .6, BACK + .006]);

  // Little round table with two chairs, and ABC blocks on the rug.
  const table = new THREE.Group(); table.position.set(-.62, 0, .12); root.add(table);
  add(table, new THREE.CylinderGeometry(.13, .13, .014, 40), mat(C.sun, { roughness: .6 }), [0, .15, 0]);
  add(table, new THREE.CylinderGeometry(.012, .02, .15, 16), mat(0xffffff), [0, .075, 0]);
  add(table, new THREE.CylinderGeometry(.06, .06, .008, 24), mat(0xffffff), [0, .004, 0]);
  [[C.sky, .19, 0, -Math.PI / 2], [C.red, 0, .19, Math.PI]].forEach(([col, x, z, ry]) => {
    const chair = new THREE.Group(); chair.position.set(x, 0, z); chair.rotation.y = ry; table.add(chair);
    add(chair, box(.08, .012, .08, .006), mat(col, { roughness: .6 }), [0, .09, 0]);
    add(chair, box(.08, .08, .01, .005), mat(col, { roughness: .6 }), [0, .14, -.037]);
    for (const [lx, lz] of [[-.032, -.032], [.032, -.032], [-.032, .032], [.032, .032]]) add(chair, new THREE.CylinderGeometry(.005, .005, .09, 8), mat(0xffffff), [lx, .045, lz]);
  });
  [['A', C.red, -.3, .32, .2], ['B', C.sky, -.24, .36, -.3], ['C', C.mint, -.27, .3, .5]].forEach(([letter, col, x, z, ry], i) => {
    const t = texture(128, 128, (g, w) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, w); g.fillStyle = col; g.fillRect(8, 8, w - 16, w - 16); g.fillStyle = '#fff'; g.font = '900 84px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, w / 2, w / 2 + 4); });
    add(root, new THREE.BoxGeometry(.05, .05, .05), new THREE.MeshStandardMaterial({ map: t, roughness: .7 }), [x, .025 + (i === 2 ? .05 : 0), z], { rot: [0, ry, 0] });
  });

  return {
    root,
    setBoard(state) { boardState = state; drawBoard(); },
    redraw: drawBoard
  };
}
