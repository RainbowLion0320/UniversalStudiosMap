import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGraph,shortestPath,createRouter,planItinerary,liveUsable,optimizeOrder,timeLabel} from '../src/planner.js';
const way=(ids,coords,tags={})=>({nodes:ids,geometry:coords.map(([lat,lon])=>({lat,lon})),tags:{highway:'footway',...tags}});
const a=[39.85,116.67],b=[39.8501,116.67],c=[39.8502,116.67];
test('routes follow shared OSM nodes and never invent connections',()=>{
 const g=buildGraph([way([1,2],[a,b]),way([3,4],[c,[39.8503,116.67]])]);
 assert.equal(shortestPath(g,1,4),null);
 assert.equal(createRouter(g)(a,c).connected,false);
 assert.ok(shortestPath(g,1,2).distance>10);
});
test('private, no-foot and pedestrian area polygons are excluded',()=>{
 const g=buildGraph([way([1,2],[a,b],{access:'private'}),way([2,3],[b,c],{foot:'no'}),way([3,4,3],[c,b,c],{area:'yes'})]);assert.equal(g.nodes.size,0);
});
test('avoid steps removes stairs; pedestrian direction is respected',()=>{
 const stairs=way([1,2],[a,b],{highway:'steps'});assert.equal(buildGraph([stairs],{avoidSteps:true}).nodes.size,0);
 const g=buildGraph([way([1,2],[a,b],{'oneway:foot':'yes'})]);assert.ok(shortestPath(g,1,2));assert.equal(shortestPath(g,2,1),null);
});
test('a far-away POI cannot silently snap across the park',()=>{
 assert.equal(createRouter(buildGraph([way([1,2],[a,b])]))([40,116],b).connected,false);
});
const now=Date.parse('2026-09-21T03:00:00Z'),fetchedAt='2026-09-21T02:58:00Z';
const settings={date:'2026-09-21',start:'10:00',speed:3,defaultQueue:30,rest:60,useLive:true,overrides:{}};
const ride={id:'a',name:'A',latlng:a,duration:10,entityType:'ATTRACTION',live:{queue:{STANDBY:{waitTime:0}}}};
const show={id:'b',name:'B',latlng:b,duration:20,entityType:'SHOW',live:{showtimes:[{startTime:'2026-09-21T11:00:00+08:00'}]}};
const route=()=>({connected:true,distance:100});
test('future dates and stale snapshots never masquerade as live queues',()=>{
 assert.equal(liveUsable('2026-09-22',fetchedAt,now),false);assert.equal(liveUsable('2026-09-21','2026-09-20T02:58:00Z',now),false);
 const p=planItinerary([ride],{...settings,date:'2026-09-22'},route,{fetchedAt,now});assert.equal(p.queue,30);assert.equal(p.useLive,false);
});
test('a real zero wait remains zero, missing waits use explicit defaults',()=>{
 assert.equal(planItinerary([ride],settings,route,{fetchedAt,now}).queue,0);
 assert.equal(planItinerary([{...ride,live:{}}],settings,route,{fetchedAt,now}).queue,30);
});
test('manual timing wins; date-matching show waits to its fixed slot',()=>{
 const p=planItinerary([ride,show],{...settings,overrides:{a:{wait:12,duration:8}}},route,{fetchedAt,now});
 assert.equal(p.rows[0].end,620);assert.equal(p.rows[1].start,660);assert.equal(p.finish,740);
});
test('unknown walking legs stay unknown, not zero or a fake straight line',()=>{
 const p=planItinerary([ride,{...ride,id:'b',latlng:c}],settings,()=>({connected:false,distance:null}),{fetchedAt,now});assert.equal(p.unknownLegs,1);assert.equal(p.rows[1].walking,null);assert.match(p.warnings[0],/未计入/);
});
test('show conflict and closing-time overrun remain visible',()=>{
 const p=planItinerary([show],{...settings,start:'11:10',overrides:{b:{showTime:'11:00'}}},route,{now,fetchedAt,schedule:[{date:settings.date,type:'OPERATING',openingTime:'2026-09-21T10:00:00+08:00',closingTime:'2026-09-21T12:00:00+08:00'}]});
 assert.match(p.rows[0].warnings[0],/不足/);assert.ok(p.warnings.some(w=>w.includes('闭园')));
});
test('optimization preserves first stop and refuses disconnected guesses',()=>{
 const items=[{latlng:[0,0]},{latlng:[0,3]},{latlng:[0,1]}];const r=(a,b)=>({connected:true,distance:Math.abs(a[1]-b[1])});
 assert.deepEqual(optimizeOrder(items,r),[items[0],items[2],items[1]]);assert.equal(optimizeOrder(items,()=>({connected:false})),null);
});
test('empty plans contain no phantom rest; midnight is explicit',()=>{
 const p=planItinerary([],settings,route,{now,fetchedAt});assert.equal(p.total,0);assert.equal(p.rest,0);assert.equal(timeLabel(1450),'次日 00:10');
});
