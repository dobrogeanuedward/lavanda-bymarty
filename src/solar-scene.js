import {AU_KM, SOLAR_BODIES, sampleOrbitAsync} from './solar-engine.js';

// Coordinates always remain linear. Views change the camera, never distances.
export const SOLAR_UNITS_PER_AU = 8;
const VIEWS = Object.freeze({calendar:1.25,inner:1.75,all:32,'earth-moon':0.0042,'sun-barycenter':0.025});
const INNER = new Set(['sun','mercury','venus','earth','mars']);
const CALENDAR_COLORS=Object.freeze({spring:'#9dcc93',summer:'#ecc879',autumn:'#df9d7e',winter:'#a6a7e7'});
const CALENDAR_MONTHS=Object.freeze(['january','february','march','april','may','june','july','august','september','october','november','december']);
const LUNAR_PHASES=Object.freeze(['new','waxing-crescent','first-quarter','waxing-gibbous','full','waning-gibbous','last-quarter','waning-crescent']);
const LUNAR_ALCHEMY=Object.freeze(['nigredo','albedo','citrinitas','rubedo']);
const LUNAR_COLORS=Object.freeze({nigredo:{fill:'#393345',outline:'#bba3e0'},albedo:{fill:'#f3eee0',outline:'#f3eee0'},citrinitas:{fill:'#e8c64f',outline:'#ecd567'},rubedo:{fill:'#cf5796',outline:'#e584b9'}});
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
  return (VISIBLE_RADII_AU[view==='calendar'?'inner':view]?.[body.key]??body.radiusKm/AU_KM)*SOLAR_UNITS_PER_AU;
}

// This radial band is an annotation around the actual ephemeris path, never a
// substitute orbit. Its thickness and labels do not represent physical bodies.
export function normalizeSolarCalendar(data){
  if(data===null)return null;
  const invalid=()=>{throw new SolarSceneError('INVALID_CALENDAR','Il calendario richiede dodici settori e posizioni terrestri eclittiche J2000.');};
  if(!data||data.frame!=='J2000 ecliptic'||!Array.isArray(data.sectors)||data.sectors.length!==12)invalid();
  const seen=new Set(),seasons=new Map();
  const sectors=data.sectors.map((sector,index)=>{
    if(!sector||sector.index!==index||sector.key!==CALENDAR_MONTHS[index]||seen.has(sector.key))invalid();
    seen.add(sector.key);
    const label=sector.monthLabel??sector.name??sector.label;
    if(typeof label!=='string'||!label.trim()||label.length>80||!Object.hasOwn(CALENDAR_COLORS,sector.seasonKey)||typeof sector.seasonLabel!=='string'||!sector.seasonLabel.trim()||sector.seasonLabel.length>80)invalid();
    if(!Array.isArray(sector.points)||sector.points.length<2||sector.points.length>512)invalid();
    const points=sector.points.map(point=>{
      toScenePosition(point,1);
      const radius=Math.hypot(...point);
      if(radius<.5||radius>2)invalid();
      return [...point];
    });
    const phaseLabel=typeof sector.phaseLabel==='string'?sector.phaseLabel.slice(0,120):'';
    const normalized={key:sector.key,index,label,phaseLabel,seasonKey:sector.seasonKey,seasonLabel:sector.seasonLabel,points,
      labelPosition:points[Math.floor((points.length-1)/2)].map(value=>value*1.19)};
    const group=seasons.get(sector.seasonKey)??[];group.push(normalized);seasons.set(sector.seasonKey,group);
    return normalized;
  });
  if(seasons.size!==4||[...seasons.values()].some(group=>group.length!==3))invalid();
  if(data.astronomicalEvents!==undefined&&!Array.isArray(data.astronomicalEvents))invalid();
  const events=(data.astronomicalEvents??[]).map(event=>{
    if(!event||typeof event.key!=='string'||!/^[a-z-]{2,40}$/.test(event.key)||typeof event.label!=='string'||!event.label.trim()||event.label.length>120)invalid();
    toScenePosition(event.position,1);
    return {key:`event:${event.key}`,label:event.label,position:[...event.position],labelPosition:event.position.map(value=>value*1.07)};
  });
  if(events.length>4||new Set(events.map(event=>event.key)).size!==events.length)invalid();
  return {frame:data.frame,year:data.year??data.cycleYear,startDate:data.startDate,endDate:data.endDate,sectors,
    astronomicalEvents:events,seasons:[...seasons.entries()].map(([key,group])=>{
      // The December–January–February season wraps through the civil year.
      const middle=group.some(sector=>sector.index===11)&&group.some(sector=>sector.index===0)?group.find(sector=>sector.index===0):group[1];
      return {key,label:group[0].seasonLabel,labelPosition:middle.points[Math.floor((middle.points.length-1)/2)].map(value=>value*1.43)};
    })};
}

export function normalizeLunarCalendar(data){
  if(data===null)return null;
  const invalid=()=>{throw new SolarSceneError('INVALID_LUNAR_CALENDAR','Il calendario lunare richiede otto intervalli di fase e posizioni geocentriche J2000.');};
  if(!data||data.frame!=='J2000 ecliptic'||data.origin!=='earth'||!Array.isArray(data.sectors)||data.sectors.length!==8)invalid();
  const position=value=>{
    if(!Array.isArray(value)||value.length!==3||!value.every(Number.isFinite)||Math.hypot(...value)<.0015||Math.hypot(...value)>.004)invalid();
    return [...value];
  };
  const sectors=data.sectors.map((sector,index)=>{
    if(!sector||sector.index!==index||sector.key!==LUNAR_PHASES[index]||sector.alchemyKey!==LUNAR_ALCHEMY[Math.floor(index/2)]||sector.angle!==index*45)invalid();
    if(typeof sector.phaseLabel!=='string'||!sector.phaseLabel.trim()||sector.phaseLabel.length>100||typeof sector.alchemyLabel!=='string'||!sector.alchemyLabel.trim()||sector.alchemyLabel.length>80)invalid();
    if(!Number.isFinite(Date.parse(sector.startDate))||!Number.isFinite(Date.parse(sector.endDate))||Date.parse(sector.endDate)<=Date.parse(sector.startDate))invalid();
    if(!Array.isArray(sector.points)||sector.points.length<2||sector.points.length>512)invalid();
    const points=sector.points.map(position),startPosition=position(sector.startPosition??points[0]),endPosition=position(sector.endPosition??points.at(-1));
    const principal=index%2===0;
    return {key:sector.key,index,angle:sector.angle,phaseLabel:sector.phaseLabel,alchemyKey:sector.alchemyKey,alchemyLabel:sector.alchemyLabel,
      label:principal?`${sector.alchemyLabel} · ${sector.phaseLabel}`:sector.phaseLabel,principal,
      startDate:sector.startDate,endDate:sector.endDate,eventDate:sector.eventDate??sector.startDate,
      points,startPosition,endPosition,anchorPosition:startPosition,labelPosition:startPosition.map(value=>value*(principal?1.42:1.30))};
  });
  if(!Number.isFinite(Date.parse(data.startDate))||!Number.isFinite(Date.parse(data.endDate))||Date.parse(data.endDate)<=Date.parse(data.startDate))invalid();
  for(let index=1;index<sectors.length;index++)if(Date.parse(sectors[index].startDate)!==Date.parse(sectors[index-1].endDate))invalid();
  if(Date.parse(sectors[0].startDate)!==Date.parse(data.startDate)||Date.parse(sectors.at(-1).endDate)!==Date.parse(data.endDate))invalid();
  if(!Array.isArray(data.mainEvents)||data.mainEvents.length!==4)invalid();
  const mainEvents=data.mainEvents.map((event,index)=>{
    if(!event||event.key!==LUNAR_PHASES[index*2])invalid();
    return {key:event.key,position:position(event.position),date:event.date??event.eventDate};
  });
  return {frame:data.frame,origin:'earth',startDate:data.startDate,endDate:data.endDate,durationDays:data.durationDays,sectors,mainEvents};
}

/**
 * Same-origin vendor files, no CDN or inline import map. Build copies:
 * three/build/{three.module.js,three.core.js} and examples/jsm/controls/OrbitControls.js,
 * replacing the latter's `from 'three'` with `from './three.module.js'`.
 * No surface is a photograph or geographic map; colors are procedural diagrams.
 * Only IAU pole directions orient surfaces/rings. No invented daily spin is applied.
 */
export async function createSolarScene({container,engine,onSelect=()=>{},onCalendarSelect=()=>{},onLunarSelect=()=>{},onError=()=>{}}={}){
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
  let calendarData=null,calendarSelection=null,calendarGroup=null;
  const calendarObjects=new Map();
  let lunarData=null,lunarSelection=null,lunarGroup=null,lunarFocusAfterDraw=null;
  const lunarObjects=new Map();
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
  const calendarOverlay=document.createElement('div');calendarOverlay.className='solar-calendar-label-layer';
  Object.assign(calendarOverlay.style,{position:'absolute',inset:'0',pointerEvents:'none'});
  calendarOverlay.setAttribute('aria-label','Calendario stagionale lungo l’orbita terrestre');
  overlay.append(calendarOverlay);
  const lunarOverlay=document.createElement('div');lunarOverlay.className='solar-lunar-label-layer';
  Object.assign(lunarOverlay.style,{position:'absolute',inset:'0',pointerEvents:'none'});
  lunarOverlay.setAttribute('aria-label','Calendario lunare: otto fasi e quattro corrispondenze alchemiche');
  lunarOverlay.hidden=true;overlay.append(lunarOverlay);
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

  function canDraw(){
    // Chromium can retain an offscreen IntersectionObserver entry when the
    // existing stage moves into a native dialog's top layer after a reload.
    // Hidden natal panels still have zero dimensions and remain suspended.
    const visible=onscreen||(container.clientWidth>0&&container.clientHeight>0&&container.closest('dialog[open]'));
    return!disposed&&!failed&&visible&&document.visibilityState!=='hidden';
  }
  function invalidate(){if(canDraw()&&!raf)raf=window.requestAnimationFrame(draw);}
  function fatal(cause){
    if(disposed||failed)return;
    failed=true;if(raf)window.cancelAnimationFrame(raf);raf=0;
    epochController?.abort();
    report(cause instanceof SolarSceneError?cause:new SolarSceneError('RENDER_FAILED','La vista 3D si è interrotta. Le posizioni restano disponibili nella tabella.',cause));
  }

  function removeCalendar(){
    if(calendarGroup){
      scene.remove(calendarGroup);
      calendarGroup.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
      calendarGroup=null;
    }
    calendarOverlay.replaceChildren();calendarObjects.clear();
  }

  function chooseCalendar(key){
    if(setCalendarSelection(key))onCalendarSelect(key);
  }

  function makeCalendarLabel(item,kind='month'){
    const label=document.createElement('button');label.type='button';
    label.className=`solar-calendar-label${kind==='event'?' solar-calendar-event-label':kind==='season'?' solar-calendar-season-label':''}`;
    label.dataset.calendarSector=item.key;label.dataset.season=item.seasonKey??'';
    label.textContent=item.label;label.setAttribute('aria-pressed','false');
    label.setAttribute('aria-label',kind==='month'?`${item.label}, ${item.seasonLabel}${item.phaseLabel?`, ${item.phaseLabel}`:''}. Esplora il calendario.`:`${item.label}, esplora il calendario.`);
    Object.assign(label.style,{position:'absolute',pointerEvents:'auto',whiteSpace:kind==='event'?'normal':'nowrap',maxWidth:'150px',touchAction:'none'});
    const record={...item,kind,label,offset:{x:0,y:0},drag:null,suppressClick:false};
    label.addEventListener('click',event=>{if(record.suppressClick&&event.detail!==0){record.suppressClick=false;return;}record.suppressClick=false;chooseCalendar(item.key);});
    label.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      record.drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:{...record.offset},moved:false};
      label.setPointerCapture(event.pointerId);
    });
    label.addEventListener('pointermove',event=>{
      const drag=record.drag;if(!drag||drag.id!==event.pointerId)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(Math.hypot(dx,dy)>6)drag.moved=true;
      if(drag.moved){record.offset={x:drag.start.x+dx,y:drag.start.y+dy};invalidate();}
    });
    const finish=event=>{if(record.drag?.id===event.pointerId){record.suppressClick=record.drag.moved;record.drag=null;}};
    label.addEventListener('pointerup',finish);label.addEventListener('pointercancel',finish);
    calendarOverlay.append(label);calendarObjects.set(item.key,record);return record;
  }

  function setCalendar(data){
    if(disposed||failed)return false;
    const normalized=normalizeSolarCalendar(data);
    removeCalendar();calendarData=normalized;
    if(!normalized){setCalendarSelection(null);applyVisibility();invalidate();return true;}
    calendarGroup=new THREE.Group();calendarGroup.name='solar-calendar';
    calendarGroup.userData={annotation:true,frame:normalized.frame,origin:'sun',description:'Civil months along the actual Earth ephemeris; meteorological seasons. Decorative radial band, not physical objects.'};
    for(const sector of normalized.sectors){
      const vertices=[],indices=[];
      sector.points.forEach((point,index)=>{
        vertices.push(...toScenePosition(point.map(value=>value*.88)),...toScenePosition(point.map(value=>value*1.12)));
        if(index<sector.points.length-1){const base=index*2;indices.push(base,base+1,base+2,base+1,base+3,base+2);}
      });
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      const color=CALENDAR_COLORS[sector.seasonKey];
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.15,depthWrite:false}));
      mesh.userData.calendarKey=sector.key;calendarGroup.add(mesh);
      const boundary=[new THREE.Vector3(),new THREE.Vector3(...toScenePosition(sector.points[0].map(value=>value*1.12)))];
      const radial=new THREE.Line(new THREE.BufferGeometry().setFromPoints(boundary),new THREE.LineBasicMaterial({color,transparent:true,opacity:.24,depthWrite:false}));calendarGroup.add(radial);
      const orbit=new THREE.Line(new THREE.BufferGeometry().setFromPoints(sector.points.map(point=>new THREE.Vector3(...toScenePosition(point)))),new THREE.LineBasicMaterial({color,transparent:true,opacity:.78,depthWrite:false}));calendarGroup.add(orbit);
      Object.assign(makeCalendarLabel(sector),{mesh});
    }
    for(const event of normalized.astronomicalEvents){
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(...toScenePosition(event.position.map(value=>value*1.09)))]),new THREE.LineDashedMaterial({color:'#f5ecff',transparent:true,opacity:.6,dashSize:.07*SOLAR_UNITS_PER_AU,gapSize:.045*SOLAR_UNITS_PER_AU,depthWrite:false}));
      line.computeLineDistances();calendarGroup.add(line);Object.assign(makeCalendarLabel(event,'event'),{line});
    }
    for(const season of normalized.seasons){
      makeCalendarLabel({...season,key:`season:${season.key}`,seasonKey:season.key},'season');
    }
    scene.add(calendarGroup);
    if(!calendarObjects.has(calendarSelection))calendarSelection=null;
    setCalendarSelection(calendarSelection);applyVisibility();invalidate();return true;
  }

  function setCalendarSelection(key){
    if(key!==null&&!calendarObjects.has(key))return false;
    calendarSelection=key;
    for(const [itemKey,object]of calendarObjects){
      const active=key===itemKey;
      object.label.setAttribute('aria-pressed',String(active));object.label.classList.toggle('is-selected',active);
      if(object.mesh)object.mesh.material.opacity=(active||key===`season:${object.seasonKey}`)?.36:.15;
      if(object.line)object.line.material.opacity=active?1:.6;
    }
    if(key===null)delete container.dataset.solarCalendarSelection;else container.dataset.solarCalendarSelection=key;
    invalidate();return true;
  }

  function removeLunarCalendar(){
    if(lunarGroup){
      scene.remove(lunarGroup);lunarGroup.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});lunarGroup=null;
    }
    lunarOverlay.replaceChildren();lunarObjects.clear();
  }

  function chooseLunar(key){if(setLunarCalendarSelection(key))onLunarSelect(key);}

  function makeLunarLabel(item){
    const label=document.createElement('button');label.type='button';
    label.className=`solar-lunar-label${item.principal?' solar-lunar-main-label':''}`;
    label.dataset.lunarPhase=item.key;label.dataset.alchemy=item.alchemyKey;
    label.textContent=item.label;label.setAttribute('aria-pressed','false');
    label.setAttribute('aria-label',`${item.phaseLabel}, ${item.alchemyLabel}. Esplora il calendario lunare.`);
    Object.assign(label.style,{position:'absolute',pointerEvents:'auto',whiteSpace:'normal',touchAction:'none'});
    const leader=document.createElement('span');leader.className='solar-lunar-leader';leader.setAttribute('aria-hidden','true');leader.hidden=true;
    Object.assign(leader.style,{position:'absolute',height:'1px',background:LUNAR_COLORS[item.alchemyKey].outline,opacity:'.48',transformOrigin:'0 0',pointerEvents:'none'});
    const record={...item,label,leader,offset:{x:0,y:0},drag:null,suppressClick:false};
    label.addEventListener('click',event=>{if(record.suppressClick&&event.detail!==0){record.suppressClick=false;return;}record.suppressClick=false;chooseLunar(item.key);});
    label.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      record.drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:{...record.offset},moved:false};label.setPointerCapture(event.pointerId);
    });
    label.addEventListener('pointermove',event=>{
      const drag=record.drag;if(!drag||drag.id!==event.pointerId)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(Math.hypot(dx,dy)>6)drag.moved=true;
      if(drag.moved){record.offset={x:drag.start.x+dx,y:drag.start.y+dy};invalidate();}
    });
    const finish=event=>{if(record.drag?.id===event.pointerId){record.suppressClick=record.drag.moved;record.drag=null;}};
    label.addEventListener('pointerup',finish);label.addEventListener('pointercancel',finish);
    lunarOverlay.append(leader,label);lunarObjects.set(item.key,record);return record;
  }

  function setLunarCalendar(data){
    if(disposed||failed)return false;
    const normalized=normalizeLunarCalendar(data);
    const focusedPhase=[...lunarObjects.values()].find(object=>object.label===document.activeElement)?.key??lunarFocusAfterDraw;
    removeLunarCalendar();lunarData=normalized;
    lunarFocusAfterDraw=focusedPhase;
    if(!normalized){setLunarCalendarSelection(null);applyVisibility();invalidate();return true;}
    lunarGroup=new THREE.Group();lunarGroup.name='lunar-calendar';
    lunarGroup.userData={annotation:true,origin:'earth',frame:normalized.frame,startDate:normalized.startDate,endDate:normalized.endDate,
      description:'Actual geocentric lunar ephemeris over a lunation; decorative radial band, not a physical orbit or astronomical alchemical process.'};
    for(const sector of normalized.sectors){
      const vertices=[],indices=[],colors=LUNAR_COLORS[sector.alchemyKey];
      sector.points.forEach((point,index)=>{
        vertices.push(...toScenePosition(point.map(value=>value*1.07)),...toScenePosition(point.map(value=>value*1.19)));
        if(index<sector.points.length-1){const base=index*2;indices.push(base,base+1,base+2,base+1,base+3,base+2);}
      });
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:colors.fill,side:THREE.DoubleSide,transparent:true,opacity:.24,depthWrite:false}));
      mesh.userData.lunarKey=sector.key;lunarGroup.add(mesh);
      const radial=new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...toScenePosition(sector.startPosition.map(value=>value*(sector.principal?0:1.07)))),
        new THREE.Vector3(...toScenePosition(sector.startPosition.map(value=>value*1.19)))]),new THREE.LineBasicMaterial({color:colors.outline,transparent:true,opacity:sector.principal?.55:.35,depthWrite:false}));
      lunarGroup.add(radial);
      // Preserve the true open geocentric path. A lunation exceeds one sidereal
      // revolution, so physically overlapping portions must remain overlapping.
      const path=new THREE.Line(new THREE.BufferGeometry().setFromPoints(sector.points.map(point=>new THREE.Vector3(...toScenePosition(point)))),new THREE.LineBasicMaterial({color:colors.outline,transparent:true,opacity:.26,depthWrite:false}));
      const outer=new THREE.Line(new THREE.BufferGeometry().setFromPoints(sector.points.map(point=>new THREE.Vector3(...toScenePosition(point.map(value=>value*1.19))))),new THREE.LineBasicMaterial({color:colors.outline,transparent:true,opacity:.64,depthWrite:false}));
      lunarGroup.add(path,outer);Object.assign(makeLunarLabel(sector),{mesh,radial,outer});
    }
    scene.add(lunarGroup);if(!lunarObjects.has(lunarSelection))lunarSelection=null;
    setLunarCalendarSelection(lunarSelection);applyPositions();applyVisibility();invalidate();return true;
  }

  function setLunarCalendarSelection(key){
    if(key!==null&&!lunarObjects.has(key))return false;
    lunarSelection=key;
    for(const [itemKey,object]of lunarObjects){
      const active=key===itemKey;
      object.label.setAttribute('aria-pressed',String(active));object.label.classList.toggle('is-selected',active);
      object.mesh.material.opacity=active?.46:.24;object.outer.material.opacity=active?1:.64;
      object.radial.material.opacity=active?1:object.principal?.55:.35;
    }
    if(key===null)delete container.dataset.solarLunarSelection;else container.dataset.solarLunarSelection=key;
    invalidate();return true;
  }

  function placeLunarLabels(occupied,selectedOnly=false){
    lunarOverlay.hidden=!lunarGroup?.visible;if(lunarOverlay.hidden)return;
    const earth=bodyObjects.get('earth').group.position;
    const candidates=[...lunarObjects.values()].filter(object=>(object.key===lunarSelection)===selectedOnly).sort((a,b)=>Number(b.principal)-Number(a.principal));
    for(const object of candidates){
      const {label,leader}=object;
      const projected=new THREE.Vector3(...toScenePosition(object.labelPosition)).add(earth).project(camera);
      label.hidden=!labelsEnabled||projected.z<=-1||projected.z>=1||Math.abs(projected.x)>1.12||Math.abs(projected.y)>1.12;
      leader.hidden=true;if(label.hidden)continue;
      const labelWidth=label.offsetWidth||140,labelHeight=label.offsetHeight||44;
      const x=(projected.x+1)*width/2+object.offset.x,y=(1-projected.y)*height/2+object.offset.y;
      const left=Math.max(4,Math.min(width-labelWidth-4,x-labelWidth/2));
      // Compact inline/modal stages share the top with a two-line UTC badge
      // and the bottom with view controls. Keep phase names out of that HUD.
      const topLimit=Math.min(height-labelHeight-4,height<450?76:4);
      const bottomLimit=Math.max(topLimit,height-labelHeight-(height<450?60:4));
      let top=Math.max(topLimit,Math.min(bottomLimit,y-labelHeight/2)),found=false;
      for(let attempt=0;attempt<11;attempt++){
        const next=Math.max(topLimit,Math.min(bottomLimit,top+Math.ceil(attempt/2)*(labelHeight+4)*(attempt%2?-1:1)));
        if(!occupied.some(rect=>left<rect.right+3&&left+labelWidth>rect.left-3&&next<rect.bottom+3&&next+labelHeight>rect.top-3)){top=next;found=true;break;}
      }
      if(!found){label.hidden=true;continue;}
      occupied.push({left,right:left+labelWidth,top,bottom:top+labelHeight});label.style.left=`${left}px`;label.style.top=`${top}px`;
      const anchor=new THREE.Vector3(...toScenePosition(object.anchorPosition)).add(earth).project(camera);
      const anchorX=(anchor.x+1)*width/2,anchorY=(1-anchor.y)*height/2;
      const targetX=Math.max(left,Math.min(left+labelWidth,anchorX)),targetY=Math.max(top,Math.min(top+labelHeight,anchorY));
      const dx=targetX-anchorX,dy=targetY-anchorY,distance=Math.hypot(dx,dy);
      if(distance>16&&anchor.z>-1&&anchor.z<1){
        leader.hidden=false;leader.style.left=`${anchorX}px`;leader.style.top=`${anchorY}px`;leader.style.width=`${distance}px`;leader.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;
      }
    }
  }

  function placeCalendarLabels(occupied,selectedOnly=false){
    const visible=Boolean(calendarGroup?.visible);
    calendarOverlay.hidden=!visible;
    if(!visible)return;
    const priority={season:0,event:1,month:2};
    const candidates=[...calendarObjects.values()].filter(object=>(object.key===calendarSelection)===selectedOnly).sort((a,b)=>priority[a.kind]-priority[b.kind]);
    for(const object of candidates){
      const {label}=object,projected=new THREE.Vector3(...toScenePosition(object.labelPosition)).project(camera);
      label.hidden=!labelsEnabled||projected.z<=-1||projected.z>=1||Math.abs(projected.x)>1.12||Math.abs(projected.y)>1.12;
      if(label.hidden)continue;
      const labelWidth=label.offsetWidth||80,labelHeight=label.offsetHeight||28;
      const x=(projected.x+1)*width/2+(object.offset?.x??0),y=(1-projected.y)*height/2+(object.offset?.y??0);
      const left=Math.max(4,Math.min(width-labelWidth-4,x-labelWidth/2));
      let top=Math.max(4,Math.min(height-labelHeight-4,y-labelHeight/2)),found=false;
      for(let attempt=0;attempt<9;attempt++){
        const next=Math.max(4,Math.min(height-labelHeight-4,top+Math.ceil(attempt/2)*(labelHeight+4)*(attempt%2?-1:1)));
        if(!occupied.some(rect=>left<rect.right+3&&left+labelWidth>rect.left-3&&next<rect.bottom+3&&next+labelHeight>rect.top-3)){top=next;found=true;break;}
      }
      if(!found){label.hidden=true;continue;}
      occupied.push({left,right:left+labelWidth,top,bottom:top+labelHeight});label.style.left=`${left}px`;label.style.top=`${top}px`;
    }
  }

  function placeLabels(){
    const occupied=[];
    placeCalendarLabels(occupied,true);
    placeLunarLabels(occupied,true);
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
    placeCalendarLabels(occupied);
    placeLunarLabels(occupied);
    if(lunarFocusAfterDraw){
      const label=lunarObjects.get(lunarFocusAfterDraw)?.label;lunarFocusAfterDraw=null;
      // Replacing a focused overlay label must not strand keyboard users on
      // body, but a user who moved focus in the meantime keeps their choice.
      if(document.activeElement===document.body)(label&&!label.hidden&&!lunarOverlay.hidden?label:canvas).focus({preventScroll:true});
    }
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
    const innerView=view==='inner'||view==='calendar';
    for(const [key,object]of bodyObjects){
      object.group.visible=view==='sun-barycenter'?key==='sun':view==='earth-moon'?key==='earth'||key==='moon':innerView?INNER.has(key):key!=='moon';
      object.label.setAttribute('aria-pressed',String(selected===key));
      object.label.classList.toggle('is-selected',selected===key);
      object.radius=solarDisplayRadius(object.body,view,sizeMode);object.group.scale.setScalar(object.radius);
      object.label.dataset.radiusMultiplier=String(object.radius/(object.body.radiusKm/AU_KM*SOLAR_UNITS_PER_AU));
    }
    for(const [key,object]of orbitObjects)object.visible=orbitsEnabled&&!(calendarData&&key==='earth')&&(view==='sun-barycenter'?key==='sun':view==='earth-moon'?key==='moon':innerView?INNER.has(key)&&key!=='sun':key!=='moon'&&key!=='sun');
    barycenter.visible=view==='sun-barycenter';
    if(calendarGroup)calendarGroup.visible=innerView||view==='all';
    calendarOverlay.hidden=!calendarGroup?.visible;
    if(lunarGroup)lunarGroup.visible=view==='earth-moon';
    lunarOverlay.hidden=!lunarGroup?.visible;
    container.dataset.solarCalendar=calendarData?'true':'false';
    container.dataset.solarLunarCalendar=lunarData?'true':'false';
    if(lunarData){container.dataset.solarLunarStart=lunarData.startDate;container.dataset.solarLunarEnd=lunarData.endDate;}
    else{delete container.dataset.solarLunarStart;delete container.dataset.solarLunarEnd;}
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
    if(lunarGroup)lunarGroup.position.copy(bodyObjects.get('earth').group.position);
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
      spin:'not simulated',rings:'main C/B/A ring bounds; IAU north pole orientation',
      calendar:{enabled:Boolean(calendarData),visible:Boolean(calendarGroup?.visible),year:calendarData?.year??null,selection:calendarSelection,
        reference:'sun-centered; J2000 ecliptic; actual Earth ephemeris',seasons:'meteorological',
        geometry:'diagrammatic radial band from 88% to 112% of the Earth ephemeris radius; no physical objects',
        events:'astronomical equinoxes and solstices shown as dashed directions'},
      lunarCalendar:{enabled:Boolean(lunarData),visible:Boolean(lunarGroup?.visible),selection:lunarSelection,
        startDate:lunarData?.startDate??null,endDate:lunarData?.endDate??null,durationDays:lunarData?.durationDays??null,
        reference:'Earth-centered J2000 ecliptic; actual geocentric Moon ephemeris translated with Earth',
        geometry:'diagrammatic exterior radial band from 107% to 119% of the Moon ephemeris radius; no physical objects',
        phaseIntervals:'eight exact 45-degree lunar phase intervals over one actual lunation; open path, overlaps preserved',
        alchemy:'editorial symbolic correspondences, not astronomical mechanisms'}};
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
    else if(calendarGroup?.visible){
      const calendarHits=raycaster.intersectObjects([...calendarObjects.values()].filter(object=>object.mesh).map(object=>object.mesh));
      if(calendarHits[0])chooseCalendar(calendarHits[0].object.userData.calendarKey);
    }
    else if(lunarGroup?.visible){
      const lunarHits=raycaster.intersectObjects([...lunarObjects.values()].map(object=>object.mesh));
      if(lunarHits[0])chooseLunar(lunarHits[0].object.userData.lunarKey);
    }
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
    delete container.dataset.solarCalendar;delete container.dataset.solarCalendarSelection;
    delete container.dataset.solarLunarCalendar;delete container.dataset.solarLunarSelection;
    delete container.dataset.solarLunarStart;delete container.dataset.solarLunarEnd;
  }

  resize();applyVisibility();fitView();
  return {update,setView,selectBody,setEpoch,setCalendar,setCalendarSelection,setLunarCalendar,setLunarCalendarSelection,getScaleInfo,resize,dispose,
    clearSelection(){selected=null;applyVisibility();invalidate();},
    setLabels(value){labelsEnabled=Boolean(value);invalidate();},
    setOrbits(value){orbitsEnabled=Boolean(value);applyVisibility();invalidate();},
    setSizeMode(value){if(!['visible','real'].includes(value))throw new SolarSceneError('INVALID_SIZE_MODE','Scegli dimensioni leggibili o fisiche.');sizeMode=value;applyVisibility();invalidate();},
    resetView(){fitView();}};
}
