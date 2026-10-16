import {AU_KM, SOLAR_BODIES, sampleOrbitAsync} from './solar-engine.js';

// Coordinates always remain linear. Views change the camera, never distances.
export const SOLAR_UNITS_PER_AU = 8;
const VIEWS = Object.freeze({inner:1.75,all:32,'earth-moon':0.0042,'sun-barycenter':0.025});
const INNER = new Set(['sun','mercury','venus','earth','mars']);
const VISIBLE_RADII_AU = Object.freeze({
  inner:{sun:.07,mercury:.019,venus:.026,earth:.026,mars:.022,jupiter:.06,saturn:.055,uranus:.04,neptune:.04,moon:.012},
  all:{sun:.12,mercury:.07,venus:.08,earth:.08,mars:.07,jupiter:.23,saturn:.21,uranus:.17,neptune:.17,moon:.05},
  'earth-moon':{earth:.0001,moon:.00006}
});

export class SolarSceneError extends Error {
  constructor(code,message,cause){super(message,{cause});this.name='SolarSceneError';this.code=code;}
}

export function toScenePosition(position,scale=SOLAR_UNITS_PER_AU){
  if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))throw new SolarSceneError('INVALID_POSITION','La posizione astronomica non è valida.');
  return [position[0]*scale,position[2]*scale,-position[1]*scale];
}

export function solarDisplayRadius(body,view='inner',mode='visible'){
  const physical=body.radiusKm/AU_KM*SOLAR_UNITS_PER_AU;
  if(!Number.isFinite(physical)||physical<=0)throw new SolarSceneError('INVALID_RADIUS','Il raggio del corpo non è valido.');
  if(mode==='real'||view==='sun-barycenter')return physical;
  return (VISIBLE_RADII_AU[view]?.[body.key]??body.radiusKm/AU_KM)*SOLAR_UNITS_PER_AU;
}

/**
 * Same-origin vendor files, no CDN or inline import map. Build copies:
 * three/build/{three.module.js,three.core.js} and examples/jsm/controls/OrbitControls.js,
 * replacing the latter's `from 'three'` with `from './three.module.js'`.
 * No surface is a photograph or geographic map; colors are procedural diagrams.
 * Only IAU pole directions orient surfaces/rings. No invented daily spin is applied.
 */
export async function createSolarScene({container,engine,onSelect=()=>{},onError=()=>{}}={}){
  const notifiedCodes=new Set();
  const report=error=>{const code=error.code||error.name;if(!notifiedCodes.has(code)){notifiedCodes.add(code);onError(error);}};
  if(!container?.ownerDocument||typeof container.appendChild!=='function'){
    const error=new SolarSceneError('INVALID_CONTAINER','Il contenitore della scena non è disponibile.');report(error);throw error;
  }
  const document=container.ownerDocument,window=document.defaultView;
  const canvas=document.createElement('canvas');
  let context,renderer,THREE,OrbitControls;
  try{
    context=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'low-power'});
    if(!context)throw new SolarSceneError('WEBGL_UNAVAILABLE','La vista 3D richiede WebGL 2, non disponibile in questo browser. Le posizioni restano consultabili nella tabella.');
    [THREE,{OrbitControls}]=await Promise.all([import('./vendor/three.module.js'),import('./vendor/OrbitControls.js')]);
    renderer=new THREE.WebGLRenderer({canvas,context,antialias:true,alpha:false,powerPreference:'low-power'});
  }catch(cause){
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    const error=cause instanceof SolarSceneError?cause:new SolarSceneError('RENDERER_UNAVAILABLE','Non riesco a caricare la vista 3D. Le posizioni restano consultabili nella tabella.',cause);
    report(error);throw error;
  }

  let disposed=false,failed=false,state=null,view='inner',sizeMode='visible',selected=null;
  let labelsEnabled=true,orbitsEnabled=true,onscreen=true,raf=0,lastRender=0;
  let width=1,height=1,followKey=null,epochController=null,epochVersion=0,orbitEpoch=null;
  let pendingEpoch=null;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#0b0a15');
  const camera=new THREE.PerspectiveCamera(42,1,.00001,2000);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1;
  // Correct solar direction and day/night boundary; intensity is diagrammatic,
  // independent of distance, rather than a photometric brightness simulation.
  const sunlight=new THREE.PointLight('#fff7e9',3,0,0);
  scene.add(sunlight,new THREE.AmbientLight('#c5c6ff',.035));
  const controls=new OrbitControls(camera,canvas);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse=window.matchMedia('(pointer: coarse)');
  controls.enableDamping=!reduced.matches;controls.dampingFactor=.12;
  controls.autoRotate=false;controls.enablePan=true;
  controls.rotateSpeed=.65;controls.zoomSpeed=.8;
  controls.minPolarAngle=.02;controls.maxPolarAngle=Math.PI-.02;
  controls.listenToKeyEvents(canvas);
  canvas.className='solar-canvas solar-scene-canvas';canvas.tabIndex=0;
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Sistema solare tridimensionale. Trascina per ruotare; usa due dita o la rotella per avvicinarti. I pulsanti dei corpi offrono una selezione alternativa.');
  Object.assign(canvas.style,{display:'block',width:'100%',height:'100%',touchAction:'none'});
  const oldPosition=container.style.position;
  if(window.getComputedStyle(container).position==='static')container.style.position='relative';
  const overlay=document.createElement('div');overlay.className='solar-label-layer solar-scene-labels';
  Object.assign(overlay.style,{position:'absolute',inset:'0',overflow:'hidden',pointerEvents:'none'});
  container.append(canvas,overlay);
  container.dataset.solarOrbitPending='false';
  const bodyObjects=new Map(),orbitObjects=new Map();
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const north=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);

  function proceduralGeometry(body){
    const geometry=new THREE.SphereGeometry(1,40,24);
    const positions=geometry.getAttribute('position'),colors=[];
    const base=new THREE.Color(body.color);
    const banded=['jupiter','saturn','uranus','neptune'].includes(body.key);
    for(let index=0;index<positions.count;index++){
      const x=positions.getX(index),y=positions.getY(index),z=positions.getZ(index);
      const pattern=banded?Math.sin(y*32)+.35*Math.sin(y*91):Math.sin(x*19+z*11)*Math.sin(y*23-z*9);
      const brightness=body.key==='sun'?1+pattern*.05:1+pattern*.12;
      const color=base.clone().multiplyScalar(brightness);
      colors.push(color.r,color.g,color.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    return geometry;
  }

  for(const body of SOLAR_BODIES){
    const group=new THREE.Group();group.name=body.key;
    const material=body.key==='sun'?new THREE.MeshBasicMaterial({vertexColors:true}):new THREE.MeshLambertMaterial({vertexColors:true});
    const sphere=new THREE.Mesh(proceduralGeometry(body),material);
    sphere.userData.bodyKey=body.key;group.add(sphere);scene.add(group);
    let rings=null;
    if(body.key==='saturn'){
      rings=new THREE.Group();rings.visible=false;
      // Main C, B and A ring bounds, km from Saturn's center, NASA factsheet:
      // https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html
      for(const [inner,outer,opacity]of[[74491,92000,.32],[92000,117580,.72],[122170,136775,.55]]){
        const ring=new THREE.Mesh(new THREE.RingGeometry(inner/body.radiusKm,outer/body.radiusKm,96,1),new THREE.MeshLambertMaterial({color:'#d2c3a6',side:THREE.DoubleSide,transparent:true,opacity,depthWrite:false}));
        ring.rotation.x=-Math.PI/2;rings.add(ring);
      }
      group.add(rings);
    }
    const label=document.createElement('button');label.type='button';
    label.className='solar-object-label solar-scene-label';label.dataset.body=body.key;
    label.textContent=body.name;label.setAttribute('aria-label',`${body.name}, seleziona e avvicina`);
    label.setAttribute('aria-pressed','false');
    Object.assign(label.style,{position:'absolute',pointerEvents:'auto',whiteSpace:'nowrap',maxWidth:'140px'});
    const leader=document.createElement('span');leader.className='solar-object-leader solar-scene-label-leader';leader.setAttribute('aria-hidden','true');
    Object.assign(leader.style,{position:'absolute',height:'1px',background:'rgba(220,215,255,.4)',transformOrigin:'0 0',pointerEvents:'none'});
    overlay.append(leader,label);
    label.addEventListener('click',()=>choose(body.key,true));
    bodyObjects.set(body.key,{body,group,sphere,rings,label,leader,radius:0});
  }
  const barycenter=new THREE.Group();
  // Reference marker, rather than a physical object: show it even when the
  // barycenter lies inside the solar photosphere.
  const crossMaterial=new THREE.LineBasicMaterial({color:'#f5ecff',depthTest:false,depthWrite:false,transparent:true,opacity:.9});
  const crossGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.00035*SOLAR_UNITS_PER_AU,0,0),new THREE.Vector3(.00035*SOLAR_UNITS_PER_AU,0,0),new THREE.Vector3(0,-.00035*SOLAR_UNITS_PER_AU,0),new THREE.Vector3(0,.00035*SOLAR_UNITS_PER_AU,0),new THREE.Vector3(0,0,-.00035*SOLAR_UNITS_PER_AU),new THREE.Vector3(0,0,.00035*SOLAR_UNITS_PER_AU)]);
  const cross=new THREE.LineSegments(crossGeometry,crossMaterial);cross.renderOrder=1000;
  barycenter.add(cross);barycenter.visible=false;scene.add(barycenter);
  const baryLabel=document.createElement('span');baryLabel.className='solar-reference-label solar-scene-reference';baryLabel.textContent='Baricentro';
  Object.assign(baryLabel.style,{position:'absolute',pointerEvents:'none'});baryLabel.hidden=true;overlay.append(baryLabel);

  function canDraw(){return!disposed&&!failed&&onscreen&&document.visibilityState!=='hidden';}
  function invalidate(){if(canDraw()&&!raf)raf=window.requestAnimationFrame(draw);}
  function fatal(cause){
    if(disposed||failed)return;
    failed=true;if(raf)window.cancelAnimationFrame(raf);raf=0;
    epochController?.abort();
    report(cause instanceof SolarSceneError?cause:new SolarSceneError('RENDER_FAILED','La vista 3D si è interrotta. Le posizioni restano disponibili nella tabella.',cause));
  }

  function placeLabels(){
    const occupied=[];
    const cameraRight=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
    const candidates=[...bodyObjects.values()].sort((a,b)=>(b.body.key===selected?1:0)-(a.body.key===selected?1:0));
    for(const object of candidates){
      const {group,label,leader}=object;
      const projected=group.position.clone().project(camera);
      const visible=labelsEnabled&&group.visible&&projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1.1&&Math.abs(projected.y)<1.1;
      label.hidden=!visible;leader.hidden=true;
      if(!visible)continue;
      const x=(projected.x+1)*width/2,y=(1-projected.y)*height/2;
      const edge=group.position.clone().addScaledVector(cameraRight,object.radius).project(camera);
      const radiusPixels=Math.abs(edge.x-projected.x)*width/2;
      const labelWidth=label.offsetWidth||60,labelHeight=label.offsetHeight||28;
      const left=Math.max(4,Math.min(width-labelWidth-4,x-labelWidth/2));
      const naturalTop=y-radiusPixels-labelHeight-9;
      let top=Math.max(4,Math.min(height-labelHeight-4,naturalTop)),found=false;
      for(let attempt=0;attempt<12;attempt++){
        const displacement=Math.ceil(attempt/2)*(labelHeight+5)*(attempt%2?-1:1);
        const next=Math.max(4,Math.min(height-labelHeight-4,top+displacement));
        if(!occupied.some(rect=>left<rect.right+3&&left+labelWidth>rect.left-3&&next<rect.bottom+3&&next+labelHeight>rect.top-3)){
          top=next;found=true;break;
        }
      }
      if(!found){label.hidden=true;continue;}
      occupied.push({left,right:left+labelWidth,top,bottom:top+labelHeight});
      label.style.left=`${left}px`;label.style.top=`${top}px`;
      const targetX=left+labelWidth/2,targetY=top<y?top+labelHeight:top;
      const dx=targetX-x,dy=targetY-y,distance=Math.hypot(dx,dy);
      if(distance>radiusPixels+14){
        leader.hidden=false;leader.style.left=`${x}px`;leader.style.top=`${y}px`;
        leader.style.width=`${distance}px`;leader.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;
      }
    }
    baryLabel.hidden=!labelsEnabled||view!=='sun-barycenter';
    if(!baryLabel.hidden){const projected=new THREE.Vector3().project(camera);baryLabel.style.left=`${(projected.x+1)*width/2+7}px`;baryLabel.style.top=`${(1-projected.y)*height/2+7}px`;}
  }

  function draw(timestamp){
    raf=0;if(!canDraw())return;
    const interval=coarse.matches?1000/30:1000/60;
    if(timestamp-lastRender<interval){raf=window.requestAnimationFrame(draw);return;}
    try{
      const moving=controls.update();renderer.render(scene,camera);placeLabels();lastRender=timestamp;
      if(moving&&controls.enableDamping)invalidate();
    }catch(error){fatal(error);}
  }

  function applyVisibility(){
    for(const [key,object]of bodyObjects){
      object.group.visible=view==='sun-barycenter'?key==='sun':view==='earth-moon'?key==='earth'||key==='moon':view==='inner'?INNER.has(key):key!=='moon';
      object.label.setAttribute('aria-pressed',String(selected===key));
      object.label.classList.toggle('is-selected',selected===key);
      object.radius=solarDisplayRadius(object.body,view,sizeMode);object.group.scale.setScalar(object.radius);
      object.label.dataset.radiusMultiplier=String(object.radius/(object.body.radiusKm/AU_KM*SOLAR_UNITS_PER_AU));
    }
    for(const [key,object]of orbitObjects)object.visible=orbitsEnabled&&(view==='sun-barycenter'?key==='sun':view==='earth-moon'?key==='moon':view==='inner'?INNER.has(key)&&key!=='sun':key!=='moon'&&key!=='sun');
    barycenter.visible=view==='sun-barycenter';
    container.dataset.solarView=view;container.dataset.solarSizeMode=sizeMode;
  }

  function applyPositions(){
    if(!state)return;
    for(const body of state.bodies){
      const object=bodyObjects.get(body.key);if(!object)continue;
      const coordinates=view==='sun-barycenter'?(body.barycentricPosition??(body.key==='sun'?state.sunBarycentric:null)):body.position;
      if(!coordinates)throw new SolarSceneError('MISSING_BARYCENTER','La posizione del Sole rispetto al baricentro non è disponibile.');
      object.group.position.set(...toScenePosition(coordinates));
      if(body.rotation?.north){
        north.set(...toScenePosition(body.rotation.north,1)).normalize();
        object.group.quaternion.setFromUnitVectors(up,north);
        if(object.rings)object.rings.visible=true;
      }else{object.group.quaternion.identity();if(object.rings)object.rings.visible=false;}
    }
    if(view!=='sun-barycenter'&&Array.isArray(state.moonGeocentric)){
      const earth=bodyObjects.get('earth'),moon=bodyObjects.get('moon');
      moon.group.position.copy(earth.group.position).add(new THREE.Vector3(...toScenePosition(state.moonGeocentric)));
    }
    const moonOrbit=orbitObjects.get('moon');if(moonOrbit)moonOrbit.position.copy(bodyObjects.get('earth').group.position);
    sunlight.position.copy(view==='sun-barycenter'?bodyObjects.get('sun').group.position:new THREE.Vector3());
  }

  function clipCamera(distance){
    camera.near=Math.max(.0000001,distance/10000);
    controls.minDistance=Math.max(.000001,distance/200);
    controls.maxDistance=Math.max(distance*12,SOLAR_UNITS_PER_AU*VIEWS[view]*5);
    camera.far=Math.max(distance*50,controls.maxDistance*2,view==='all'?SOLAR_UNITS_PER_AU*100:.5);
    camera.updateProjectionMatrix();
  }

  function flushControls(){
    // A residual pan from an AU-wide view must not be applied to lunar scales.
    const damping=controls.enableDamping;controls.enableDamping=false;
    controls.update();controls.enableDamping=damping;
  }

  function fitView(){
    flushControls();
    const target=view==='earth-moon'?bodyObjects.get('earth').group.position:new THREE.Vector3();
    followKey=view==='earth-moon'?'earth':null;
    const extent=VIEWS[view]*SOLAR_UNITS_PER_AU;
    const distance=extent/Math.sin(camera.fov*Math.PI/360)/Math.min(camera.aspect,1)*1.03;
    const direction=new THREE.Vector3(.35,.65,1).normalize();
    controls.target.copy(target);camera.position.copy(target).addScaledVector(direction,distance);
    clipCamera(distance);controls.update();invalidate();
  }

  function update(next){
    if(disposed||failed)return;
    if(!next||next.frame!=='J2000 ecliptic'||!Array.isArray(next.bodies))throw new SolarSceneError('INVALID_STATE','La scena richiede posizioni eclittiche J2000.');
    for(const body of next.bodies)toScenePosition(body.position);
    const previous=followKey?bodyObjects.get(followKey)?.group.position.clone():null;
    state=next;applyPositions();applyVisibility();
    if(previous&&followKey){const delta=bodyObjects.get(followKey).group.position.clone().sub(previous);controls.target.add(delta);camera.position.add(delta);}
    invalidate();
  }

  function setView(value){
    if(!(value in VIEWS))throw new SolarSceneError('INVALID_VIEW','Questa vista non è disponibile.');
    view=value;followKey=null;applyPositions();applyVisibility();fitView();
  }

  function selectBody(key,{focus=false}={}){
    const object=bodyObjects.get(key);if(!object)return false;
    if(![false,true,'pair'].includes(focus)||focus==='pair'&&!['earth','moon'].includes(key))throw new SolarSceneError('INVALID_FOCUS','La vista della coppia riguarda Terra e Luna.');
    selected=key;
    const pair=focus==='pair'||focus===true&&(key==='moon'||view==='earth-moon'&&key==='earth');
    if(pair&&view!=='earth-moon')setView('earth-moon');
    else if(!object.group.visible)setView(key==='moon'?'earth-moon':INNER.has(key)?'inner':'all');
    applyVisibility();
    if(focus&&state){
      // Keep the full geocentric lunar trajectory in view. Selecting the Moon
      // changes the reading/highlight, while the camera continues to follow Earth.
      if(pair||view==='sun-barycenter'){fitView();}
      else{
        flushControls();
        const direction=camera.position.clone().sub(controls.target).normalize();
        const distance=Math.max(object.radius*12,.00001)/Math.min(camera.aspect,1);
        controls.target.copy(object.group.position);camera.position.copy(object.group.position).addScaledVector(direction,distance);
        followKey=key;clipCamera(distance);controls.update();
      }
    }
    invalidate();return true;
  }

  function choose(key,focus){if(selectBody(key,{focus}))onSelect(key);}

  async function setEpoch(date){
    if(disposed||failed)return false;
    const iso=new Date(date).toISOString();
    if(orbitEpoch===iso&&!pendingEpoch)return true;
    epochController?.abort();epochController=new AbortController();
    const signal=epochController.signal,version=++epochVersion;
    pendingEpoch=iso;container.dataset.solarOrbitPending='true';const prepared=[];
    try{
      for(const body of SOLAR_BODIES){
        const trajectory=await sampleOrbitAsync(body.key,iso,{engine,samples:body.key==='moon'?192:256,chunkSize:48,signal});
        if(signal.aborted||version!==epochVersion||disposed)return false;
        if(trajectory.points.length<2)continue;
        const geometry=new THREE.BufferGeometry().setFromPoints(trajectory.points.map(value=>new THREE.Vector3(...toScenePosition(value))));
        const material=new THREE.LineBasicMaterial({color:body.color,transparent:true,opacity:body.key==='moon'?.55:.48});
        // Open, time-sampled ephemeris trajectory: never a forced closed ellipse.
        const line=new THREE.Line(geometry,material);line.name=`trajectory-${body.key}`;
        line.userData={bodyKey:body.key,origin:trajectory.origin,epoch:trajectory.centerDate,closed:false};
        prepared.push([body.key,line]);
      }
      if(signal.aborted||version!==epochVersion||disposed)return false;
      for(const object of orbitObjects.values()){scene.remove(object);object.geometry.dispose();object.material.dispose();}
      orbitObjects.clear();
      for(const[key,line]of prepared){orbitObjects.set(key,line);scene.add(line);}
      prepared.length=0;orbitEpoch=iso;pendingEpoch=null;container.dataset.solarOrbitEpoch=iso;
      applyPositions();applyVisibility();invalidate();return true;
    }catch(error){
      if(error.name==='AbortError'||signal.aborted)return false;
      if(version===epochVersion)pendingEpoch=null;
      report(new SolarSceneError('ORBIT_UNAVAILABLE','Non riesco a ricostruire le traiettorie. Le posizioni dei corpi restano disponibili.',error));
      return false;
    }finally{
      for(const[,line]of prepared){line.geometry.dispose();line.material.dispose();}
      if(version===epochVersion&&!disposed)container.dataset.solarOrbitPending='false';
    }
  }

  function getScaleInfo(){
    const bodies=[...bodyObjects.values()].map(object=>({key:object.body.key,name:object.body.name,radiusKm:object.body.radiusKm,
      physicalRadiusUnits:object.body.radiusKm/AU_KM*SOLAR_UNITS_PER_AU,displayRadiusUnits:object.radius,
      enhancementFactor:object.radius/(object.body.radiusKm/AU_KM*SOLAR_UNITS_PER_AU),visible:object.group.visible}));
    const visibleFactors=bodies.filter(body=>body.visible).map(body=>body.enhancementFactor);
    return {view,sizeMode,distanceScale:'linear',unitsPerAU:SOLAR_UNITS_PER_AU,
      reference:view==='sun-barycenter'?'solar-system-barycenter':view==='earth-moon'?'heliocentric; camera follows Earth':'heliocentric',
      bodies,radiusMultipliers:Object.fromEntries(bodies.map(body=>[body.key,body.enhancementFactor])),
      visibleEnhancementRange:{minimum:Math.min(...visibleFactors),maximum:Math.max(...visibleFactors)},orbitEpoch,
      surfaces:'procedural schematic',lighting:'solar direction; diagrammatic intensity, not photometry',
      spin:'not simulated',rings:'main C/B/A ring bounds; IAU north pole orientation'};
  }

  function resize(){
    if(disposed)return;
    const previousAspect=camera.aspect;
    width=Math.max(1,container.clientWidth);height=Math.max(1,container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,coarse.matches?1.5:2));
    renderer.setSize(width,height,false);camera.aspect=width/height;
    const fitRatio=Math.min(previousAspect,1)/Math.min(camera.aspect,1);
    if(state&&Math.abs(fitRatio-1)>.001){
      flushControls();
      const relative=camera.position.clone().sub(controls.target).multiplyScalar(fitRatio);
      camera.position.copy(controls.target).add(relative);clipCamera(relative.length());
    }
    camera.updateProjectionMatrix();invalidate();
  }
  function onVisibility(){if(canDraw())invalidate();else if(raf){window.cancelAnimationFrame(raf);raf=0;}}
  function onReduced(){controls.enableDamping=!reduced.matches;invalidate();}
  function onContextLost(event){event.preventDefault();fatal(new SolarSceneError('WEBGL_CONTEXT_LOST','Il browser ha sospeso la grafica 3D. Le posizioni restano disponibili nella tabella.'));}
  const pointers=new Set();let down=null;
  function pointerDown(event){pointers.add(event.pointerId);down={x:event.clientX,y:event.clientY,pointerId:event.pointerId,moved:false,multi:pointers.size>1};}
  function pointerMove(event){if(down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)down.moved=true;}
  function pointerCancel(event){pointers.delete(event.pointerId);down=null;}
  function pointerUp(event){
    const action=down;pointers.delete(event.pointerId);down=null;
    if(!action||action.pointerId!==event.pointerId||action.moved||action.multi||event.button>0)return;
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    scene.updateMatrixWorld();camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects([...bodyObjects.values()].filter(object=>object.group.visible).map(object=>object.sphere));
    if(hits[0])choose(hits[0].object.userData.bodyKey,true);
  }
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);
  canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerCancel);
  canvas.addEventListener('webglcontextlost',onContextLost);
  controls.addEventListener('change',invalidate);
  document.addEventListener('visibilitychange',onVisibility);reduced.addEventListener('change',onReduced);
  const resizeObserver=window.ResizeObserver?new window.ResizeObserver(resize):null;
  resizeObserver?.observe(container);if(!resizeObserver)window.addEventListener('resize',resize);
  const intersectionObserver=window.IntersectionObserver?new window.IntersectionObserver(entries=>{onscreen=entries[0]?.isIntersecting??true;onVisibility();}):null;
  intersectionObserver?.observe(container);

  function dispose(){
    if(disposed)return;disposed=true;epochController?.abort();if(raf)window.cancelAnimationFrame(raf);raf=0;
    resizeObserver?.disconnect();intersectionObserver?.disconnect();controls.dispose();
    window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',onVisibility);reduced.removeEventListener('change',onReduced);
    canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerCancel);canvas.removeEventListener('webglcontextlost',onContextLost);
    const geometries=new Set(),materials=new Set();
    scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);});
    for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
    renderer.dispose();renderer.forceContextLoss();canvas.remove();overlay.remove();
    if(container.style.position==='relative'&&oldPosition!=='relative')container.style.position=oldPosition;
    delete container.dataset.solarView;delete container.dataset.solarSizeMode;
    delete container.dataset.solarOrbitEpoch;delete container.dataset.solarOrbitPending;
  }

  resize();applyVisibility();fitView();
  return {update,setView,selectBody,setEpoch,getScaleInfo,resize,dispose,
    clearSelection(){selected=null;applyVisibility();invalidate();},
    setLabels(value){labelsEnabled=Boolean(value);invalidate();},
    setOrbits(value){orbitsEnabled=Boolean(value);applyVisibility();invalidate();},
    setSizeMode(value){if(!['visible','real'].includes(value))throw new SolarSceneError('INVALID_SIZE_MODE','Scegli dimensioni leggibili o fisiche.');sizeMode=value;applyVisibility();invalidate();},
    resetView(){fitView();}};
}
