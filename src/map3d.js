import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { icon,escape as e } from './icons.js';
import { ZONES } from './catalog.js';
const ORIGIN=[39.8554,116.6775];
export function position(latlng,height=0){return new THREE.Vector3((latlng[1]-ORIGIN[1])*111320*Math.cos(ORIGIN[0]*Math.PI/180)/10,height,-(latlng[0]-ORIGIN[0])*111320/10);}
export class ParkMap {
 constructor(container,onSelect){
  this.container=container;this.onSelect=onSelect;this.pins=[];this.labels=[];this.needsRender=true;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e8ecdf');
  this.camera=new THREE.OrthographicCamera(-55,55,55,-55,.1,800);
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
  this.renderer.domElement.setAttribute('aria-label','Low Poly 三维园区地图，拖动旋转，滚轮缩放，右键平移');this.renderer.domElement.setAttribute('role','img');
  container.appendChild(this.renderer.domElement);
  this.overlay=document.createElement('div');this.overlay.className='map-overlay';container.appendChild(this.overlay);
  this.scene.add(new THREE.HemisphereLight(0xfff7e6,0x82937b,2.5));
  const sun=new THREE.DirectionalLight(0xfff4df,3);sun.position.set(-50,90,40);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-75,right:75,top:75,bottom:-75,near:.1,far:260});sun.shadow.normalBias=.18;sun.shadow.bias=-.00015;this.scene.add(sun);
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),new THREE.MeshStandardMaterial({color:0xe8ecdf,roughness:1}));plane.rotation.x=-Math.PI/2;plane.position.y=-3.2;plane.receiveShadow=true;this.scene.add(plane);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=false;this.controls.minPolarAngle=.15;this.controls.maxPolarAngle=Math.PI*.42;this.controls.minZoom=.55;this.controls.maxZoom=4.5;this.controls.maxTargetRadius=85;this.controls.screenSpacePanning=false;
  this.controls.addEventListener('change',()=>{this.needsRender=true;});
  this.routeGroup=new THREE.Group();this.scene.add(this.routeGroup);
  this.fitBounds();this.invalidateSize();
  this.frame=()=>{requestAnimationFrame(this.frame);if(!this.needsRender)return;this.renderer.render(this.scene,this.camera);this.projectLabels();this.needsRender=false;};this.frame();
  this.loading=document.createElement('div');this.loading.className='model-loading';this.loading.textContent='正在搭建微缩园区…';container.appendChild(this.loading);
  new GLTFLoader().load('/models/beijing-park.glb',gltf=>{
   this.model=gltf.scene;gltf.scene.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;}});this.scene.add(gltf.scene);this.loading.remove();this.needsRender=true;
  },undefined,()=>{this.loading.innerHTML='3D 模型暂时无法加载 <button type="button" onclick="location.reload()">重试</button>';});
  for(const [id,z] of Object.entries(ZONES))if(z.label){const el=document.createElement('div');el.className='world-zone';el.innerHTML=`<i style="background:${z.color}"></i>${e(z.name)}`;this.overlay.appendChild(el);this.labels.push({el,point:position(z.label,1.4)});}
  new ResizeObserver(()=>this.invalidateSize()).observe(container);
 }
 fitBounds(){this.controls.target.set(0,0,-2);this.camera.position.set(74,115,125);this.camera.zoom=this.container.clientWidth/this.container.clientHeight>1.4?1.25:1;this.controls.update();this.camera.updateProjectionMatrix();this.needsRender=true;}
 topView(){this.camera.position.set(0,160,1);this.controls.target.set(0,0,-2);this.controls.update();this.needsRender=true;}
 zoom(delta){this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom*delta,.55,4.5);this.camera.updateProjectionMatrix();this.needsRender=true;}
 flyTo(latlng){const p=position(latlng),offset=this.camera.position.clone().sub(this.controls.target);this.controls.target.copy(p);this.camera.position.copy(p).add(offset);this.camera.zoom=Math.max(this.camera.zoom,1.65);this.controls.update();this.camera.updateProjectionMatrix();this.needsRender=true;}
 invalidateSize(){const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;const aspect=width/height,span=aspect<.8?122/aspect:118;this.camera.left=-span*aspect/2;this.camera.right=span*aspect/2;this.camera.top=span/2;this.camera.bottom=-span/2;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height);this.needsRender=true;}
 setPins(items,selected,visible,active){
  for(const p of this.pins)p.el.remove();this.pins=[];
  for(const item of items){if(!visible.has(item.id)&&!selected.includes(item.id))continue;const index=selected.indexOf(item.id),el=document.createElement('button');
   el.type='button';el.className=`world-pin ${index>=0?'planned':''} ${active===item.id?'focused':''}`;el.style.setProperty('--zone',ZONES[item.zone].color);el.title=item.zh;el.setAttribute('aria-label',`地图项目：${item.zh}`);el.innerHTML=`<span>${index>=0?index+1:icon(item.icon)}</span><em>${e(item.zh)}</em>`;el.onclick=()=>this.onSelect(item.id);this.overlay.appendChild(el);this.pins.push({el,point:position(item.latlng,2),planned:index>=0});
  }
  this.needsRender=true;
 }
 setRoute(rows){
  for(const obj of [...this.routeGroup.children]){obj.geometry.dispose();obj.material.dispose();this.routeGroup.remove(obj);}
  for(const row of rows){if(!row.route?.connected)continue;
   // Tube geometry keeps lines readable in WebGL across platforms.
   if(row.route.points.length>1){const points=row.route.points.map(p=>position(p,.36)),curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)if(points[i].distanceTo(points[i-1])>.001)curve.add(new THREE.LineCurve3(points[i-1],points[i]));
    if(curve.curves.length){const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(24,points.length*2),.16,5,false),new THREE.MeshStandardMaterial({color:0x245e4b,roughness:1}));this.routeGroup.add(mesh);}
   }
   for(const segment of row.route.connectors){const points=segment.map(p=>position(p,.44)),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:0x9c6e38,dashSize:.4,gapSize:.3}));line.computeLineDistances();this.routeGroup.add(line);}
  }
  this.needsRender=true;
 }
 projectLabels(){
  const {width,height}=this.container.getBoundingClientRect();
  this.overlay.classList.toggle('compact',width<500&&this.camera.zoom<1.4);
  const center=this.controls.target.clone().project(this.camera),north=this.controls.target.clone().add(new THREE.Vector3(0,0,-10)).project(this.camera);
  const compass=this.container.parentElement.querySelector('.north svg');
  if(compass)compass.style.transform=`rotate(${Math.atan2((north.x-center.x)*width,(north.y-center.y)*height)*180/Math.PI}deg)`;
  for(const entry of [...this.labels,...this.pins]){const p=entry.point.clone().project(this.camera),x=(p.x*.5+.5)*width,y=(-p.y*.5+.5)*height;entry.el.style.transform=`translate(${x}px, ${y}px) translate(-50%, -100%)`;entry.el.style.display=p.z>1||p.z< -1||x<0||x>width||y<0||y>height?'none':'';entry.el.style.zIndex=entry.planned?1000:Math.round((1-p.z)*100);}
 }
}
