import * as THREE from 'three';
import { GLTFExporter } from './vendor/GLTFExporter.js';
import { createStage } from './stage.mjs';
import { createRobot } from './model.mjs';
import { JOINTS, MOTIONS, applyPose, applyMotion, evaluateMotion, createAnimationClips, bakeCustomClip } from './motion.mjs';
import { SKINS, createSkinController } from './skins.mjs';

const $ = id => document.getElementById(id);
const status = $('status');
try {
  const stage = $('stage');
  const { renderer, scene, camera, controls, setView: showView } = createStage(stage);
  const rig = createRobot(); scene.add(rig.root);
  const skins=createSkinController(rig);
  function setView(name){showView(name);document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));}
  setView('front');

  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smooth=n=>{const t=THREE.MathUtils.clamp(n,0,1);return t*t*(3-2*t);};
  let motion='idle',playing=!reducedMotion,time=0,manual=false,manualPose={},speed=1,exporting=false;
  let armor=0,armorTarget=0,deploy=1;
  function refreshDesignTools(){
    const capabilities=skins.design?.capabilities;
    $('design-tools').hidden=!capabilities;
    $('armor-toggle').hidden=!capabilities?.armor;
    $('expression-field').hidden=!capabilities?.expressions;
    $('mouth-label').textContent=capabilities?.expressions?'Miệng khi nói':'Miệng LED';
    $('armor-toggle').setAttribute('aria-pressed',String(armorTarget===1));
    $('armor-toggle').textContent=armorTarget===1?'Đóng giáp':'Mở giáp';
  }
  function updateDesignContext(){skins.setContext({armor:smooth(armor),deploy:smooth(deploy),expression:$('expression').value});}
  function refreshManualFace(){skins.update(evaluateMotion(motion,time,rig.dimensions),{name:motion,time,blinkEnabled:$('blink').checked,mouthEnabled:$('mouth').checked});}
  function chooseSkin(id,{persist=true}={}){
    if(exporting)return;
    const skin=skins.apply(id);$('skin-name').textContent=skin.label;$('skin-finish').textContent=skin.finish;
    armor=armorTarget=0;deploy=skin.design&&!reducedMotion?0:1;updateDesignContext();refreshDesignTools();
    if(manual)refreshManualFace();
    document.querySelectorAll('[data-skin]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.skin===id)));
    if(persist)try{localStorage.setItem('robot3d.skin',id);}catch{}
    status.textContent=`Ngoại hình: ${skin.label}`;
  }
  $('skin-options').replaceChildren(...SKINS.map(skin=>{
    const button=document.createElement('button');button.type='button';button.className='skin-option';button.dataset.skin=skin.id;button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',skin.label);if(skin.design)button.title='Chọn lại để xem triển khai vỏ';
    const palette=document.createElement('span');palette.className='skin-swatches';palette.setAttribute('aria-hidden','true');
    for(const color of skin.swatches){const swatch=document.createElement('span');swatch.style.setProperty('--swatch',color);palette.append(swatch);}
    const label=document.createElement('span');label.className='skin-option-name';label.textContent=skin.label;
    button.append(palette,label);button.onclick=()=>chooseSkin(skin.id);return button;
  }));
  let preferredSkin=new URLSearchParams(location.search).get('skin');
  if(!preferredSkin)try{preferredSkin=localStorage.getItem('robot3d.skin');}catch{}
  chooseSkin(SKINS.some(s=>s.id===preferredSkin)?preferredSkin:'original',{persist:false});
  $('armor-toggle').onclick=()=>{armorTarget=1-armorTarget;if(reducedMotion)armor=armorTarget;updateDesignContext();refreshDesignTools();if(manual)refreshManualFace();};
  $('expression').onchange=()=>{updateDesignContext();if(manual)refreshManualFace();};
  $('joint-select').replaceChildren(...JOINTS.map(j=>{const o=document.createElement('option');o.value=j.key;o.textContent=j.label;return o;}));
  function syncJoint(){const j=JOINTS.find(j=>j.key===$('joint-select').value);$('joint-angle').min=j.min;$('joint-angle').max=j.max;const value=manual?manualPose[j.key]??j.defaultValue:THREE.MathUtils.radToDeg(rig.joints[j.key].rotation[j.axis]);$('joint-angle').value=Math.round(value);$('joint-value').textContent=`${Math.round(value)}°`;}
  function syncPlay(){ $('play').setAttribute('aria-pressed',String(playing));$('play').textContent=playing?'Tạm dừng':'Phát'; }
  function chooseMotion(name){motion=name;time=0;manual=false;manualPose={};playing=true;if(name==='talk')$('mouth').checked=true;document.querySelectorAll('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion===name)));status.textContent=name==='walk'||name==='run'?'Chuyển động tại chỗ':MOTIONS.find(m=>m.key===name).label;syncPlay();}
  document.querySelectorAll('[data-motion]').forEach(b=>b.onclick=()=>chooseMotion(b.dataset.motion));
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  $('play').onclick=()=>{if(manual){manual=false;time=0;}playing=!playing;syncPlay();};
  $('speed').oninput=()=>{speed=Number($('speed').value);$('speed-value').textContent=`${Number(speed.toFixed(2))}×`;};
  $('joint-select').onchange=syncJoint;
  $('joint-angle').oninput=()=>{
    if(!manual){applyMotion(rig,'idle',0,{blinkEnabled:false,mouthEnabled:$('mouth').checked});manualPose={};}
    manual=true;playing=false;manualPose[$('joint-select').value]=Number($('joint-angle').value);applyPose(rig,manualPose);syncPlay();syncJoint();
    document.querySelectorAll('[data-motion]').forEach(b=>b.setAttribute('aria-pressed','false'));status.textContent='Đang điều chỉnh khớp';
  };
  $('pose-reset').onclick=()=>{manual=true;playing=false;manualPose={};applyMotion(rig,'idle',0,{blinkEnabled:false,mouthEnabled:$('mouth').checked});applyPose(rig,{});syncJoint();syncPlay();status.textContent='Tư thế chuẩn';document.querySelectorAll('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion==='idle')));};
  $('reset').onclick=()=>{motion='idle';manual=false;manualPose={};time=0;playing=false;speed=1;$('speed').value=1;$('speed-value').textContent='1×';$('mouth').checked=false;$('autorotate').checked=false;controls.autoRotate=false;setView('front');applyMotion(rig,'idle',0,{blinkEnabled:$('blink').checked,mouthEnabled:false});syncJoint();syncPlay();status.textContent='Tư thế chuẩn';document.querySelectorAll('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion==='idle')));};
  $('autorotate').onchange=()=>{controls.autoRotate=$('autorotate').checked;};
  const materials=new Set();rig.root.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))materials.add(m);});
  $('wireframe').onchange=()=>{for(const m of materials)m.wireframe=$('wireframe').checked;};
  for(const id of ['blink','mouth'])$(id).onchange=()=>{if(!manual)applyMotion(rig,motion,time,{blinkEnabled:$('blink').checked,mouthEnabled:$('mouth').checked});else if(skins.design)refreshManualFace();else rig.face.mouth.scale.setScalar($('mouth').checked?1:.001);};
  $('reference').onclick=()=>$('reference-dialog').showModal();$('close-reference').onclick=()=>$('reference-dialog').close();
  $('reference-dialog').addEventListener('click',e=>{if(e.target===$('reference-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});

  async function exportRobot(){
    if(exporting)throw new Error('Đang xuất GLB');exporting=true;const flags=[...materials].map(m=>[m,m.wireframe]);
    const saved=[...new Set([rig.root,...Object.values(rig.joints),rig.face.leftEyeLed,rig.face.rightEyeLed,rig.face.mouth,...rig.face.mouthBars,...(rig.animationNodes||[])])].map(n=>({n,p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()}));
    const savedContext=skins.context;
    try {
      for(const m of materials)m.wireframe=false;
      skins.setContext({armor:0,deploy:1});
      const animations=createAnimationClips(rig);
      if(skins.current.id==='mecha'){
        for(const [name,start,end] of [['armor_open',0,1],['armor_close',1,0]])animations.push(bakeCustomClip(rig,name,1.2,t=>{skins.setContext({armor:THREE.MathUtils.lerp(start,end,smooth(t/1.2)),deploy:1});applyMotion(rig,'idle',0,{blinkEnabled:false,mouthEnabled:false});}));
        animations.push(bakeCustomClip(rig,'deploy',1.6,t=>{skins.setContext({armor:0,deploy:smooth(t/1.6)});applyMotion(rig,'idle',0,{blinkEnabled:false,mouthEnabled:false});}));
      }
      if(skins.current.id==='assistant')for(const expression of ['happy','curious','surprised','sleepy'])animations.push(bakeCustomClip(rig,`expression_${expression}`,2,t=>{skins.setContext({expression,deploy:1});applyMotion(rig,'idle',t,{blinkEnabled:true,mouthEnabled:false});}));
      skins.setContext({...savedContext,armor:0,deploy:1});
      applyMotion(rig,'idle',0,{blinkEnabled:false,mouthEnabled:false});rig.root.updateMatrixWorld(true);
      return await new GLTFExporter().parseAsync(rig.root,{binary:true,onlyVisible:true,animations});
    }
    finally{skins.setContext(savedContext);for(const {n,p,q,s} of saved){n.position.copy(p);n.quaternion.copy(q);n.scale.copy(s);}for(const [m,w] of flags)m.wireframe=w;exporting=false;}
  }
  $('download').onclick=async e=>{e.preventDefault();const el=$('download');if(exporting)return;el.setAttribute('aria-disabled','true');el.textContent='Đang xuất…';try{const bytes=await exportRobot();const url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download=skins.current.id==='original'?'robot-animated.glb':`robot-${skins.current.id}.glb`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent=`Đã xuất GLB: ${skins.current.label}`;}catch(e){console.error(e);status.textContent='Không xuất được GLB. Hãy thử lại.';}finally{el.removeAttribute('aria-disabled');el.textContent='Tải GLB';}};
  applyMotion(rig,'idle',0,{blinkEnabled:true,mouthEnabled:false});syncJoint();syncPlay();status.textContent='3D sẵn sàng';
  const clock=new THREE.Clock();let lastUI=0;
  renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.05);if(!exporting){deploy=Math.min(1,deploy+dt/1.25);armor=THREE.MathUtils.clamp(armor+Math.sign(armorTarget-armor)*Math.min(Math.abs(armorTarget-armor),dt/.65),0,1);updateDesignContext();if(playing&&!document.hidden)time+=dt*speed;if(!manual)applyMotion(rig,motion,time,{blinkEnabled:$('blink').checked,mouthEnabled:$('mouth').checked});else if(skins.design)refreshManualFace();}controls.update(dt);renderer.render(scene,camera);lastUI+=dt;if(lastUI>.12&&!manual){syncJoint();lastUI=0;}});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();status.dataset.error='true';status.textContent='Mất kết nối đồ họa. Tải lại trang để tiếp tục.';});
  window.robotViewer={rig,renderer,scene,camera,controls,setView,chooseMotion,chooseSkin,exportRobot,applyPose,applyMotion,get design(){return skins.design;},get state(){return {motion,time,playing,manual,skin:skins.current.id,armor:armorTarget,expression:$('expression').value};},sample(name,t){playing=false;manual=true;time=t;motion=name;$('mouth').checked=name==='talk';updateDesignContext();applyMotion(rig,name,t,{blinkEnabled:true,mouthEnabled:name==='talk'});rig.root.updateMatrixWorld(true);renderer.render(scene,camera);}};
} catch(error){console.error(error);status.dataset.error='true';status.textContent='Không mở được mô hình 3D. Hãy bật WebGL và tải lại.';}
