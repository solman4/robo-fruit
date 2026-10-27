import * as THREE from 'three';
import { createMechaDesign } from './mecha.mjs';
import { createAssistantDesign } from './assistant.mjs';

// One palette registry drives the selector, live materials and GLB metadata.
// New designs replace the visible exterior while sharing the articulated rig.
export const SKINS = [
  { id: 'original', label: 'Bản gốc', finish: 'Nhôm satin · Mắt xanh', swatches: ['#c4cbd0','#15191e','#23d941'], palette: {} },
  { id: 'mecha', label: 'Mecha', finish: 'Giáp cơ khí · Triển khai từng lớp', swatches: ['#e2e7e8','#263444','#e49343'], palette: {}, design: true },
  { id: 'assistant', label: 'Trợ lý', finish: 'Vỏ bo tròn · Khuôn mặt biểu cảm', swatches: ['#eeeee5','#458a90','#80e9e3'], palette: {}, design: true },
  { id: 'bdu', label: 'Áo BDU', finish: 'Polo đỏ · Logo BDU thêu', swatches: ['#b0062e','#fbf6f0','#c4cbd0'], palette: {} },
  { id: 'ceramic', label: 'Trắng sứ', finish: 'Vỏ sứ bóng · Đèn xanh băng', swatches: ['#eeeee6','#617583','#26d9f0'], palette: {
    shell: { color: 0xeeeee6, metalness: .08, roughness: .19, envMapIntensity: 1.1 },
    frame: { color: 0x7c8c98, metalness: .68, roughness: .35 },
    trim: { color: 0x465b6a, metalness: .76, roughness: .25 },
    fasteners: { color: 0x788c99, metalness: .88, roughness: .24 },
    servo: { color: 0x121f2b, metalness: .10, roughness: .44 },
    eyes: { color: 0x26d9f0 }, mouth: { color: 0x26d9f0 }
  } },
  { id: 'graphite', label: 'Graphite', finish: 'Kim loại tối · Đèn ngọc', swatches: ['#25353f','#82949f','#60e6c8'], palette: {
    shell: { color: 0x25353f, metalness: .78, roughness: .26, envMapIntensity: 1.25 },
    frame: { color: 0x64747f, metalness: .72, roughness: .32 },
    trim: { color: 0xa5b8c3, metalness: .85, roughness: .22 },
    fasteners: { color: 0x8fa0aa, metalness: .90, roughness: .22 },
    servo: { color: 0x0d141b, metalness: .14, roughness: .43 },
    eyes: { color: 0x60e6c8 }, mouth: { color: 0x60e6c8 }
  } },
  { id: 'industrial', label: 'Cam công nghiệp', finish: 'Sơn cam · Khung thép', swatches: ['#d86f22','#53616e','#ffc76b'], palette: {
    shell: { color: 0xd86f22, metalness: .24, roughness: .38, envMapIntensity: .85 },
    frame: { color: 0x53616e, metalness: .65, roughness: .42 },
    trim: { color: 0x333e48, metalness: .72, roughness: .32 },
    fasteners: { color: 0xa5a79d, metalness: .86, roughness: .28 },
    servo: { color: 0x192026, metalness: .08, roughness: .59 },
    eyes: { color: 0xffc76b }, mouth: { color: 0xffc76b }
  } },
  // Only skin that adds a worn costume (cap, collar, short sleeves, shorts) instead of a flat finish.
  { id: 'sporty', label: 'Đồ thể thao', finish: 'Áo thun · Quần đùi · Nón bucket', swatches: ['#3569c4','#eef0ea','#3569c4'], palette: {} }
];

function neutralSensorMap(source) {
  const canvas = document.createElement('canvas'); canvas.width = source.image.width; canvas.height = source.image.height;
  const context = canvas.getContext('2d'); context.drawImage(source.image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for(let i=0;i<pixels.data.length;i+=4){
    const value=Math.min(255,Math.round((pixels.data[i]*.2126+pixels.data[i+1]*.7152+pixels.data[i+2]*.0722)*1.8));
    pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;
  }
  context.putImageData(pixels,0,0);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = source.colorSpace; texture.anisotropy = source.anisotropy; return texture;
}

export function createSkinController(rig) {
  const originals = new Map(Object.entries(rig.styleMaterials).map(([key,material])=>[key,material.clone()]));
  const baseFace=rig.face,baseMeshes=[];
  rig.root.traverse(node=>{if(node.isMesh)baseMeshes.push({node,visible:node.visible});});
  const designs={mecha:createMechaDesign(rig),assistant:createAssistantDesign(rig)};
  let current=SKINS[0], sensorMap, activeDesign;
  let context={armor:0,deploy:1,expression:'happy'};
  function update(state,motionContext){
    activeDesign?.update(state,{...context,...motionContext,motion:motionContext.name??motionContext.motion});
  }
  rig.afterMotion=update;
  function apply(id) {
    const skin=SKINS.find(s=>s.id===id);if(!skin)throw new RangeError(`Unknown robot skin: ${id}`);
    for(const [role,material] of Object.entries(rig.styleMaterials)){
      const wireframe=material.wireframe;
      material.copy(originals.get(role));
      const settings=skin.palette[role];
      if(settings)for(const [key,value] of Object.entries(settings)){if(key==='color')material.color.setHex(value);else material[key]=value;}
      if(role==='eyes'&&skin.id!=='original'&&!skin.design){
        sensorMap ||= neutralSensorMap(originals.get('eyes').map);
        material.map=sensorMap;
      }
      material.wireframe=wireframe;material.needsUpdate=true;
    }
    activeDesign=designs[id];
    for(const {node,visible} of baseMeshes)node.visible=activeDesign?false:visible;
    for(const [key,design] of Object.entries(designs))for(const root of design.roots)root.visible=key===id;
    // Costumes are always reset, otherwise a worn set would leak through when switching to a design skin.
    for(const [wornId,nodes] of [['sporty',rig.costume],['bdu',rig.bduCostume]])nodes.forEach(m=>m.visible=skin.id===wornId);
    // Hardware under the polo is hidden by it, and by the design skins that replace the whole exterior.
    rig.shirtCovered.forEach(n=>n.visible=skin.id!=='bdu'&&!activeDesign);
    rig.face=activeDesign?.face??baseFace;rig.animationNodes=activeDesign?.animatedNodes??[];
    current=skin;rig.root.userData.skin={id:skin.id,label:skin.label};return skin;
  }
  apply('original');
  return {apply,update,setContext(values){context={...context,...values};},get context(){return {...context};},get current(){return current;},get design(){return activeDesign;}};
}
