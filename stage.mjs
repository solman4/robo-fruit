import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

// Renderer, studio lighting, floor shadow, camera views and resize handling shared by the viewer pages.
export const VIEWS = { front: [0, .285, 1.0], threequarter: [.55, .40, .85], side: [1.0, .285, 0], back: [0, .285, -1.0] };

export function createStage(stage, { label = 'Robot 3D. Kéo để xoay, cuộn để thu phóng.' } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  stage.appendChild(renderer.domElement); renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', label);
  const scene = new THREE.Scene();
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  const studio=pmrem.fromScene(room,.04);scene.environment=studio.texture;scene.environmentIntensity=.55;room.dispose();pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(31, 1, .005, 20);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, .225, 0); controls.enableDamping = true;
  controls.minDistance = .24; controls.maxDistance = 1.8; controls.autoRotateSpeed = .8;
  controls.maxPolarAngle = Math.PI * .95; controls.enablePan = true;
  scene.add(new THREE.HemisphereLight(0xeef5ff, 0xa0a29b, .85));
  const key = new THREE.DirectionalLight(0xfff6e9, 3.0); key.position.set(-.40,.75,.55); key.castShadow=true;
  key.shadow.mapSize.set(2048,2048); Object.assign(key.shadow.camera,{left:-.45,right:.45,top:.6,bottom:-.45,near:.01,far:2});
  key.shadow.bias=-.00008; key.shadow.normalBias=.0004; scene.add(key);
  const fill=new THREE.DirectionalLight(0xc6deff,.65);fill.position.set(.5,.4,.2);scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffffff,2.4);rim.position.set(.2,.6,-.4);scene.add(rim);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.ShadowMaterial({opacity:.16}));floor.rotation.x=-Math.PI/2;floor.position.y=-.001;floor.receiveShadow=true;scene.add(floor);
  function setView(name){camera.position.set(...VIEWS[name]);controls.target.set(0,.225,0);controls.update();}
  new ResizeObserver(()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(15.5))/Math.min(1,camera.aspect)));camera.updateProjectionMatrix();}).observe(stage);
  return { renderer, scene, camera, controls, setView };
}
