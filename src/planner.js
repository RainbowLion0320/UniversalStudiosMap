export const shanghaiDate=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function distance(a,b) {
 const r=Math.PI/180, dlat=(b[0]-a[0])*r,dlon=(b[1]-a[1])*r;
 const h=Math.sin(dlat/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dlon/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function inPolygon(point,polygon) {
 let inside=false;const [y,x]=point;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [yi,xi]=polygon[i],[yj,xj]=polygon[j];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
export function buildGraph(elements,{avoidSteps=false}={}) {
 const nodes=new Map(),edges=[];
 const boundary=elements.find(x=>x.tags?.tourism==='theme_park')?.geometry?.map(p=>[p.lat,p.lon]);
 for(const way of elements) {
  const t=way.tags??{};
  if(!['footway','pedestrian','path','steps'].includes(t.highway)||!way.geometry||!way.nodes||t.area==='yes')continue;
  if(['no','private'].includes(t.access)||['no','private'].includes(t.foot)||t.service==='emergency_access'||t.footway==='access_aisle'||t.indoor==='yes'||(avoidSteps&&t.highway==='steps'))continue;
  for(let i=1;i<way.nodes.length;i++){
   const a=way.geometry[i-1],b=way.geometry[i];if(!a||!b)continue;
   const pa=[a.lat,a.lon],pb=[b.lat,b.lon];
   if(boundary&&!inPolygon(pa,boundary)&&!inPolygon(pb,boundary))continue;
   const idA=way.nodes[i-1],idB=way.nodes[i],weight=distance(pa,pb);
   if(!nodes.has(idA))nodes.set(idA,{point:pa,neighbors:[]});
   if(!nodes.has(idB))nodes.set(idB,{point:pb,neighbors:[]});
   // Honor explicitly mapped pedestrian direction; a vehicle oneway alone is not a foot restriction.
   if(t['oneway:foot']!=='-1')nodes.get(idA).neighbors.push({id:idB,weight});
   if(t['oneway:foot']!=='yes')nodes.get(idB).neighbors.push({id:idA,weight});
   edges.push([idA,idB]);
  }
 }
 return {nodes,edges};
}
function nearest(graph,point) {
 let best=null;
 for(const [id,node] of graph.nodes){const d=distance(point,node.point);if(!best||d<best.distance)best={id,point:node.point,distance:d};}
 return best;
}
export function shortestPath(graph,start,end) {
 if(!graph.nodes.has(start)||!graph.nodes.has(end))return null;
 const costs=new Map([[start,0]]),parents=new Map(),pending=new Set([start]);
 while(pending.size){
  let current=null,best=Infinity;
  for(const id of pending)if(costs.get(id)<best){best=costs.get(id);current=id;}
  pending.delete(current);
  if(current===end){const ids=[end];while(ids[0]!==start)ids.unshift(parents.get(ids[0]));return {distance:best,points:ids.map(id=>graph.nodes.get(id).point)};}
  for(const {id,weight} of graph.nodes.get(current).neighbors){const next=best+weight;if(next<(costs.get(id)??Infinity)){costs.set(id,next);parents.set(id,current);pending.add(id);}}
 }
 return null;
}
export function createRouter(graph) {
 const cache=new Map();
 return (a,b)=>{
  const key=JSON.stringify([a,b]);if(cache.has(key))return cache.get(key);
  const start=nearest(graph,a),end=nearest(graph,b);
  let result={connected:false,points:[],connectors:[],distance:null,reason:'步道未连通，需核对路线'};
  if(!start||!end)result.reason='缺少步道数据';
  else if(start.distance>100||end.distance>100)result.reason='项目离已知步道较远，需核对入口';
  else {
   const path=shortestPath(graph,start.id,end.id);
   if(path)result={connected:true,points:path.points,connectors:[[a,start.point],[end.point,b]],distance:path.distance+start.distance+end.distance,connectorDistance:start.distance+end.distance,reason:'沿 OSM 步道估算，虚线入口连接待核对'};
  }
  cache.set(key,result);return result;
 };
}
export const clockMinutes=s=>{const [h,m]=s.split(':').map(Number);return h*60+m;};
export const timeLabel=minutes=>`${minutes>=1440?'次日 ':''}${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(Math.round(minutes)%60).padStart(2,'0')}`;
export function liveUsable(date,fetchedAt,now=Date.now()) {
 const age=now-Date.parse(fetchedAt);
 return date===shanghaiDate(new Date(now))&&Number.isFinite(age)&&age>=0&&age<15*60*1000;
}
export function planItinerary(items,settings,router,{fetchedAt,now=Date.now(),schedule=[]}={}) {
 const useLive=settings.useLive&&liveUsable(settings.date,fetchedAt,now);
 const opening=schedule.find(x=>x.date===settings.date&&x.type==='OPERATING');
 const warnings=[];let time=clockMinutes(settings.start),walk=0,queue=0,experience=0,unknownLegs=0;
 if(opening&&time<clockMinutes(opening.openingTime.slice(11,16)))warnings.push(`计划早于当日 ${opening.openingTime.slice(11,16)} 开园时间`);
 const rows=items.map((item,index)=>{
  const custom=settings.overrides?.[item.id]??{};
  const route=index?router(items[index-1].latlng,item.latlng):null;
  const walking=route?(route.connected?Math.ceil(route.distance/(settings.speed*1000/60)):null):0;
  if(walking===null)unknownLegs++;else walk+=walking;
  time+=walking??0;
  const arrival=time;
  const queueLive=item.live?.queue?.STANDBY?.waitTime;
  const isShow=item.entityType==='SHOW';
  const wait=Number.isFinite(custom.wait)?custom.wait:useLive&&Number.isFinite(queueLive)?queueLive:(isShow?0:settings.defaultQueue);
  const duration=Number.isFinite(custom.duration)?custom.duration:item.duration;
  const rowWarnings=[];let slot=null;
  if(useLive&&['CLOSED','DOWN','REFURBISHMENT'].includes(item.live?.status))rowWarnings.push('当前暂停或关闭，请核对');
  time+=wait;queue+=wait;
  if(isShow){
   const slots=(item.live?.showtimes??[]).filter(s=>s.startTime?.startsWith(settings.date)).map(s=>clockMinutes(s.startTime.slice(11,16))).sort((a,b)=>a-b);
   if(custom.showTime)slot=clockMinutes(custom.showTime);
   else if(useLive&&slots.length)slot=slots.find(s=>s>=time+10)??null;
   if(slot!==null){if(slot<time+10)rowWarnings.push('演出提前入场时间不足');time=Math.max(time,slot);}
   else rowWarnings.push(useLive&&slots.length?'已错过已知场次，请调整顺序':'场次待确认，暂按抵达后体验估算');
  }
  const start=time;time+=duration;experience+=duration;
  return {item,route,walking,arrival,start,end:time,wait,duration,slot,warnings:rowWarnings};
 });
 const rest=items.length?settings.rest:0;time+=rest;
 if(unknownLegs)warnings.push(`${unknownLegs} 段步行时间未计入，总时长不完整`);
 if(opening&&time>clockMinutes(opening.closingTime.slice(11,16)))warnings.push(`预计超过当日 ${opening.closingTime.slice(11,16)} 闭园时间`);
 return {rows,finish:time,total:time-clockMinutes(settings.start),walk,queue,experience,rest,unknownLegs,warnings,useLive,opening};
}
export function optimizeOrder(items,router) {
 if(items.length<3)return items;
 const result=[items[0]],remaining=items.slice(1);
 while(remaining.length){
  let best=-1,cost=Infinity;
  remaining.forEach((p,i)=>{const r=router(result.at(-1).latlng,p.latlng);if(r.connected&&r.distance<cost){cost=r.distance;best=i;}});
  if(best===-1)return null;
  result.push(remaining.splice(best,1)[0]);
 }
 const length=order=>order.slice(1).reduce((sum,p,i)=>{const r=router(order[i].latlng,p.latlng);return sum+(r.connected?r.distance:Infinity);},0);
 return length(result)<length(items)?result:items;
}
