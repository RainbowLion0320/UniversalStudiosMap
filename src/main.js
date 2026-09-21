import { ParkMap } from './map3d.js';
import './style.css';
import {ZONES,enrich,DEFAULT_NAMES} from './catalog.js';
import {icon,escape as e} from './icons.js';
import {buildGraph,createRouter,planItinerary,optimizeOrder,shanghaiDate,timeLabel,liveUsable} from './planner.js';

const $=(s)=>document.querySelector(s);
const KEY='universal-beijing-plan-v1';
let saved;
try {saved=JSON.parse(localStorage.getItem(KEY));}catch{}
const initial={date:shanghaiDate(),start:'10:00',speed:3.5,defaultQueue:30,rest:60,useLive:false,avoidSteps:false,overrides:{}};
const settings={...initial};
// Accept only a bounded known schema from storage. A stale plan must not crash the page.
if(saved?.settings){
 const s=saved.settings;
 if(/^\d{4}-\d{2}-\d{2}$/.test(s.date))settings.date=s.date;
 if(/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start))settings.start=s.start;
 for(const [key,min,max] of [['speed',2,6],['defaultQueue',0,180],['rest',0,240]])if(Number.isFinite(s[key])&&s[key]>=min&&s[key]<=max)settings[key]=s[key];
 settings.useLive=s.useLive===true;settings.avoidSteps=s.avoidSteps===true;
 if(s.overrides&&typeof s.overrides==='object')for(const [id,o] of Object.entries(s.overrides)){
  if(!o||typeof o!=='object')continue;const v={};
  for(const k of ['duration','wait'])if(Number.isFinite(o[k])&&o[k]>=0&&o[k]<=240)v[k]=o[k];
  if(/^([01]\d|2[0-3]):[0-5]\d$/.test(o.showTime))v.showTime=o.showTime;
  settings.overrides[id]=v;
 }
}
let raw,items=[],selected=[],done=new Set(Array.isArray(saved?.done)?saved.done:[]),router,plan,map,active=null;
let zone='all',type='featured',query='',dragged=null,toastTimer;
let mobile='map';
const sourceTime=()=>raw?.sources?.live?.fetchedAt;
const fmtDate=(s)=>s?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s)):'未知';
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify({settings,selected,done:[...done]}));$('#save-status').textContent='已保存在本机';}catch{$('#save-status').textContent='无法保存，请导出行程';}}
function rebuildRouter(){router=createRouter(buildGraph(raw.osm,{avoidSteps:settings.avoidSteps}));}
function filtered(){return items.filter(x=>(zone==='all'||x.zone===zone)&&(type==='all'||type==='featured'&&x.featured||type==='show'&&x.entityType==='SHOW'||type==='ride'&&x.entityType==='ATTRACTION')&&`${x.zh} ${x.name} ${ZONES[x.zone].name}`.toLowerCase().includes(query.toLowerCase()));}
function currentItems(){return selected.map(id=>items.find(p=>p.id===id)).filter(Boolean);}
function refreshPlan(){plan=planItinerary(currentItems(),settings,router,{fetchedAt:sourceTime(),schedule:raw.schedule});renderPlan();renderCards();renderMarkers();renderRoute();persist();}
function add(id){if(selected.includes(id)){selected=selected.filter(x=>x!==id);done.delete(id);}else{selected.push(id);toast('已加入你的一天');}refreshPlan();}
function focusItem(id){active=id;const p=items.find(x=>x.id===id);if(!p)return;map.flyTo(p.latlng,18,{duration:.45});renderDetail(p);renderMarkers();if(innerWidth<1100)setMobile('map');}
function setMobile(view){mobile=view;document.body.dataset.view=view;document.querySelectorAll('[data-view-tab]').forEach(el=>el.classList.toggle('active',el.dataset.viewTab===view));setTimeout(()=>map?.invalidateSize(),30);}
function shell(){
 $('#app').innerHTML=`
 <header class="topbar"><a class="brand" href="/" aria-label="环球漫游首页"><span class="brand-mark">${icon('route')}</span><span>环球漫游<small>UNIVERSAL WANDER</small></span></a><div class="header-note"><span class="dot"></span>北京 · 你的下一场冒险</div><div class="header-actions"><span id="save-status">本地行程</span><button class="button outline" id="export">${icon('download')}导出攻略</button></div></header>
 <section class="page-heading"><div><div class="eyebrow">BEIJING UNIVERSAL RESORT</div><h1>北京环球影城 <span>一天，尽兴去玩。</span></h1></div><div class="heading-aside">${icon('map')}<span>选好心愿项目<br><strong>把喜欢的地方，连成一天</strong></span></div></section>
 <main class="workspace">
 <aside class="explore panel"><div class="panel-heading"><div><span class="eyebrow">EXPLORE THE PARK</span><h2>发现你的必玩</h2></div><span class="count">${items.length}</span></div>
 <label class="search">${icon('search')}<input id="search" type="search" placeholder="搜索项目、演出…" aria-label="搜索项目或演出" autocomplete="off"><kbd>/</kbd></label>
 <div class="tabs" role="group" aria-label="项目类别"><button data-type="featured" class="active">精选</button><button data-type="ride">游乐</button><button data-type="show">演出</button><button data-type="all">全部</button></div>
 <label class="zone-select"><span>探索区域</span><select id="zone" aria-label="选择园区">${Object.entries(ZONES).map(([id,z])=>`<option value="${id}">${z.name}</option>`).join('')}</select></label>
 <div class="list-heading"><span id="results-count"></span><span>点击 + 加入行程</span></div><div id="cards" class="cards"></div>
 <div class="explore-foot">${icon('info')}排队与开放状态为抓取快照，非现场保证。</div>
 </aside>
 <section class="map-panel" aria-label="园区互动地图"><div id="map"></div><div class="map-top"><span class="map-tag"><span class="dot"></span>LOW POLY · 微缩园区</span><div class="map-top-actions"><button id="map-focus" class="map-button wide" aria-label="切换全景地图">全景</button><button id="fit" class="map-button" title="显示整个园区" aria-label="显示整个园区">${icon('locate')}</button></div></div><div class="view-controls"><button id="top-view" title="俯视地图" aria-label="俯视地图">俯视</button><button id="zoom-in" aria-label="放大地图">+</button><button id="zoom-out" aria-label="缩小地图">−</button></div><div class="north"><span>N</span><svg viewBox="0 0 28 35" aria-hidden="true"><path d="m14 3 10 27-10-6-10 6Z" fill="#315b51"/><path d="m14 3 0 21 10 6Z" fill="#8caa9b"/></svg></div>
 <div id="detail" class="detail hidden"></div><div class="map-credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors</div><div class="map-gesture">拖动旋转 · 滚轮缩放 · 右键平移</div><div class="map-bottom"><div class="map-legend"><span><i class="line"></i>步道估算</span><span><i class="line dashed"></i>入口待核对</span></div><button class="subtle" id="about">${icon('info')}地图说明</button></div></section>
 <aside class="itinerary panel"><div class="panel-heading"><div><span class="eyebrow">MAKE IT YOUR DAY</span><h2>我的一天 <span id="plan-count"></span></h2></div><span class="day-symbol">${icon('sun')}</span></div>
 <div class="date-row"><label>游玩日期<input id="date" type="date" value="${settings.date}" aria-label="游玩日期"></label><label>第一站抵达<input id="start" type="time" value="${settings.start}" aria-label="第一站抵达时间"></label></div>
 <div id="summary"></div><div class="plan-actions"><button id="optimize" class="subtle">${icon('sparkles')}减少折返</button><button id="settings" class="subtle">${icon('clock')}时间设置</button></div>
 <div id="timeline" class="timeline"></div><div class="plan-footer"><div id="warnings"></div><p>从第一站开始估算 · 不含入园及离园步行</p><div class="source-line"><span id="source-label"></span><button id="refresh" aria-label="刷新排队与演出数据" title="刷新排队与演出数据">${icon('refresh')}</button></div><a href="https://themeparks.wiki/" target="_blank" rel="noreferrer">Powered by ThemeParks.wiki</a></div></aside>
 </main><nav class="mobile-nav" aria-label="工作区切换"><button data-view-tab="explore">${icon('search')}选项目</button><button class="active" data-view-tab="map">${icon('map')}看地图</button><button data-view-tab="plan">${icon('route')}我的一天 <b id="mobile-count"></b></button></nav>
 <div id="toast" role="status" aria-live="polite"></div><dialog id="dialog"><button class="dialog-close" aria-label="关闭">${icon('x')}</button><div id="dialog-content"></div></dialog>`;
 bind();
}
function renderCards(){
 const list=filtered();$('#results-count').textContent=`${list.length} 个值得期待的体验`;
 $('#cards').innerHTML=list.length?list.map(p=>{
 const checked=selected.includes(p.id),wait=p.live?.queue?.STANDBY?.waitTime;
 return `<article class="attraction ${checked?'selected':''}" style="--zone:${ZONES[p.zone].color}"><button class="attraction-main" data-focus="${p.id}"><span class="attraction-art">${icon(p.icon)}<i></i></span><span class="attraction-text"><small>${e(ZONES[p.zone].name)}</small><strong>${e(p.zh)}</strong><span class="metadata">${icon(p.entityType==='SHOW'?'music':'clock')}${p.entityType==='SHOW'?'演出 / 见面会':`体验约 ${p.duration} 分钟`}${Number.isFinite(wait)?`<em>快照排队 ${wait}′</em>`:''}</span></span></button><button class="add-button ${checked?'checked':''}" data-add="${p.id}" aria-label="${checked?'移除':'加入'}${e(p.zh)}" aria-pressed="${checked}">${icon(checked?'check':'plus')}</button></article>`;
 }).join(''):`<div class="empty"><span>${icon('search')}</span><h3>这里还没有匹配的项目</h3><p>换个关键词，或看看全部区域。</p><button class="button outline" id="reset-filters">重置筛选</button></div>`;
}
function renderPlan(){
 $('#plan-count').textContent=`${selected.length} 站`;$('#mobile-count').textContent=selected.length;
 $('#summary').innerHTML=`<div class="summary-card"><div class="summary-top"><span>${plan.unknownLegs?'已知部分预计用时':'预计游玩用时'}</span><strong>${Math.floor(plan.total/60)}<small>小时</small>${plan.total%60}<small>分钟</small></strong></div><p class="estimate-mode">${plan.useLive?'当天排队快照 · 手动调整优先':'排队按默认估算 · 可逐站调整'}</p><div class="summary-metrics"><span>${icon('footprints')}步行 <b>${plan.walk}′${plan.unknownLegs?'+':''}</b></span><span>${icon('clock')}排队 <b>${plan.queue}′</b></span><span>${icon('sun')}休息 <b>${plan.rest}′</b></span></div></div>`;
 $('#timeline').innerHTML=plan.rows.length?`<div class="timeline-intro"><span class="dot"></span>${e(settings.start)} · 从心愿清单的第一站出发</div>`+plan.rows.map((r,index)=>`<article class="stop ${done.has(r.item.id)?'completed':''}" draggable="true" data-stop="${r.item.id}">
 ${index?`<div class="walk-connector">${icon('footprints')}${r.walking===null?'此段路线待核对':`步行约 ${r.walking} 分钟 · ${Math.round(r.route.distance)} m`}</div>`:''}
 <div class="stop-body"><button class="stop-number" data-done="${r.item.id}" title="${done.has(r.item.id)?'标记未完成':'标记已完成'}" aria-label="${done.has(r.item.id)?'标记未完成':'标记已完成'}${e(r.item.zh)}">${done.has(r.item.id)?icon('check'):index+1}</button><div class="stop-content"><div class="stop-time">${timeLabel(r.start)} <span>— ${timeLabel(r.end)}</span>${r.slot!==null?'<b>场次</b>':''}</div><button class="stop-name" data-focus="${r.item.id}">${e(r.item.zh)}</button><p>${e(ZONES[r.item.zone].name)} · ${r.wait?`排队 ${r.wait}′ · `:''}体验 ${r.duration}′</p>${r.warnings.map(w=>`<div class="row-warning">${e(w)}</div>`).join('')}
 <div class="stop-tools"><button data-move="${r.item.id}" data-direction="-1" aria-label="上移${e(r.item.zh)}" ${index===0?'disabled':''}>${icon('arrow-up')}</button><button data-move="${r.item.id}" data-direction="1" aria-label="下移${e(r.item.zh)}" ${index===plan.rows.length-1?'disabled':''}>${icon('arrow-down')}</button><button class="edit-stop" data-edit="${r.item.id}">调整时间</button><button class="remove-stop" data-add="${r.item.id}" aria-label="从行程移除${e(r.item.zh)}">${icon('x')}</button></div></div><span class="drag-grip" title="拖动调整顺序">${icon('grip')}</span></div></article>`).join('')+`<div class="finish"><span>${icon('flag')}</span><div><strong>${timeLabel(plan.finish)}${plan.unknownLegs?' 之后':''} · 一天的美好收尾</strong><small>含 ${plan.rest} 分钟自由休息，安排在行程末尾</small></div></div>`:`<div class="empty"><span>${icon('route')}</span><h3>把心动，加入这一天</h3><p>从左侧或地图选择项目，<br>你的路线会在这里慢慢展开。</p><button class="button primary" id="starter">试试经典五站</button></div>`;
 $('#warnings').innerHTML=plan.warnings.map(w=>`<p class="warning">${icon('info')}${e(w)}</p>`).join('');
 $('#source-label').textContent=`数据抓取 ${fmtDate(sourceTime())}`;
 $('#optimize').disabled=selected.length<3;
}
function setupMap(){
 map=new ParkMap($('#map'),focusItem);
}
function fitMap(){map.fitBounds();}
function renderMarkers(){
 if(!map)return;
 map.setPins(items,selected,new Set(filtered().map(p=>p.id)),active);
}
function renderRoute(){if(map)map.setRoute(plan.rows);}
function renderDetail(p){
 const live=p.live,wait=live.queue?.STANDBY?.waitTime;const fresh=liveUsable(shanghaiDate(),sourceTime());
 $('#detail').classList.remove('hidden');
 $('#detail').innerHTML=`<button class="detail-close" id="close-detail" aria-label="关闭项目详情">${icon('x')}</button><small style="color:${ZONES[p.zone].color}">${e(ZONES[p.zone].name)}</small><h3>${e(p.zh)}</h3><p class="english-name">${e(p.name)}</p><div class="detail-stats"><span>${icon('clock')}体验约 ${p.duration} 分钟</span><span>${Number.isFinite(wait)?`快照排队 ${wait} 分钟`:'暂无排队数据'}</span></div><p class="detail-note">${fresh?'':'历史快照 · '}${fmtDate(sourceTime())} 抓取${live.lastUpdated?` · 条目更新 ${fmtDate(live.lastUpdated)}`:''}<br>入口位置待核对，体验时长可在行程中调整。</p><button class="button ${selected.includes(p.id)?'outline':'primary'}" data-detail-add="${p.id}">${icon(selected.includes(p.id)?'check':'plus')}${selected.includes(p.id)?'已加入 · 点击移除':'加入我的一天'}</button>`;
}
function openDialog(content){$('#dialog-content').innerHTML=content;$('#dialog').showModal();}
function settingsDialog(){
 openDialog(`<span class="eyebrow">YOUR PACE, YOUR DAY</span><h2>按自己的节奏，安排一天</h2><p class="dialog-lead">修改估算值，路线与时间轴会一起更新。</p><form id="settings-form" class="settings-form"><label>步行速度<select name="speed"><option value="2.5">慢慢逛 · 2.5 km/h</option><option value="3.5">轻松走 · 3.5 km/h</option><option value="4.5">快步走 · 4.5 km/h</option></select></label><label>默认排队时间（分钟）<input name="defaultQueue" type="number" min="0" max="180" value="${settings.defaultQueue}" required></label><label>预留用餐 / 休息（分钟）<input name="rest" type="number" min="0" max="240" value="${settings.rest}" required></label><label class="checkbox"><input name="avoidSteps" type="checkbox" ${settings.avoidSteps?'checked':''}>寻路时避开已标记的台阶</label><label class="checkbox"><input name="useLive" type="checkbox" ${settings.useLive?'checked':''}>当天规划时，使用刚刷新的排队与场次</label><p class="form-note">仅在游玩日期为今天、数据抓取不超过 15 分钟时启用。未来日期或旧快照使用默认估算；手动调整优先。避开台阶不代表已验证无障碍可达。</p><button class="button primary" type="submit">更新我的行程</button></form>`);
 $('#settings-form select').value=String(settings.speed);
 $('#settings-form').onsubmit=event=>{event.preventDefault();const data=new FormData(event.currentTarget);for(const k of ['speed','defaultQueue','rest'])settings[k]=Number(data.get(k));settings.avoidSteps=data.has('avoidSteps');settings.useLive=data.has('useLive');rebuildRouter();$('#dialog').close();refreshPlan();toast('已按你的节奏更新');};
}
function editStop(id){
 const row=plan.rows.find(r=>r.item.id===id);if(!row)return;
 const override=settings.overrides[id]??{};
 openDialog(`<span class="eyebrow">A LITTLE ROOM FOR FLEXIBILITY</span><h2>${e(row.item.zh)}</h2><form class="settings-form" id="stop-form"><label>排队时间（分钟）<input name="wait" type="number" min="0" max="240" value="${row.wait}" required></label><label>体验 / 演出时长（分钟）<input name="duration" type="number" min="1" max="240" value="${row.duration}" required></label>${row.item.entityType==='SHOW'?`<label>固定演出场次（可留空）<input name="showTime" type="time" value="${e(override.showTime??'')}"></label><p class="form-note">手动场次仅适用于当前游玩日期；建议至少提前 10 分钟抵达。</p>`:''}<div class="dialog-actions"><button type="button" id="reset-stop" class="button outline">恢复估算</button><button class="button primary" type="submit">保存调整</button></div></form>`);
 $('#stop-form').onsubmit=event=>{event.preventDefault();const data=new FormData(event.currentTarget);settings.overrides[id]={wait:Number(data.get('wait')),duration:Number(data.get('duration')),...(data.get('showTime')?{showTime:data.get('showTime')}:{})};$('#dialog').close();refreshPlan();};
 $('#reset-stop').onclick=()=>{delete settings.overrides[id];$('#dialog').close();refreshPlan();};
}
function aboutDialog(){openDialog(`<span class="eyebrow">ABOUT THIS MAP</span><h2>出发前，了解这张地图</h2><div class="about-content"><p>地图由 Blender 制作，基于 OpenStreetMap 道路与建筑轮廓。拖动可旋转，滚轮缩放，右键 / 双指平移；也可切换俯视。城堡、过山车、宝塔等地标为参考官网图片创作的 Low Poly 艺术化模型，建筑高度、局部立面和装饰并非测绘复原。${raw.scenery.length?'已加载园区建筑与水面。':''}</p><p><b>绿色实线</b>沿已收录的步道计算。<b>棕色虚线</b>连接项目坐标与附近步道，入口位置尚未逐一核对。步道不连通时不画跨区直线，也不补造步行时间。</p><p>全部路线均为出行规划参考，仍需核对现场围栏、临时封路和入口。完成状态只作打卡记录，不会移除该站用时。</p><p>第一站为行程起点，不含入园、离园步行。休息时间统一预留在末尾，可通过调整项目时间进一步细化。实时排队不能预测未来日期。</p><p>中文展示名与体验时长为本地编辑资料，时长可以修改。演出无可用场次时会标记「待确认」。</p><div class="source-links"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a><a href="https://themeparks.wiki/" target="_blank" rel="noreferrer">Powered by ThemeParks.wiki</a><a href="https://www.universalbeijingresort.com/zh_CN" target="_blank" rel="noreferrer">查看北京环球度假区官方信息 ↗</a></div></div>`);}
function exportPlan(){
 const text=[`# 北京环球影城 · ${settings.date}`,``, `第一站抵达 ${settings.start}；${plan.unknownLegs?'已知部分':'预计'}用时 ${plan.total} 分钟，收尾 ${timeLabel(plan.finish)}${plan.unknownLegs?'之后':''}。`,...plan.warnings.map(w=>`注意：${w}`),'',...plan.rows.flatMap((r,i)=>[`${i+1}. ${timeLabel(r.start)}–${timeLabel(r.end)} ${r.item.zh}${done.has(r.item.id)?'（已完成）':''}`,`   ${i?(r.walking===null?'步行路线待核对':`步行约 ${r.walking} 分钟`)+'；':''}排队 ${r.wait} 分钟；体验 ${r.duration} 分钟。`,...r.warnings.map(w=>`   注意：${w}`)]),'',`预留休息 ${plan.rest} 分钟（在行程末尾）。`,`排队：${plan.useLive?'使用当天新抓取数据，手动值优先':'使用估算，手动值优先'}。`,`不含入园、离园步行。路线含待核对入口；未连通路段不计时间。`,`数据抓取：${fmtDate(sourceTime())}。`,`Powered by ThemeParks.wiki · https://themeparks.wiki/`,`地图 © OpenStreetMap contributors · https://www.openstreetmap.org/copyright`].join('\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`北京环球行程-${settings.date}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('攻略已导出');
}
function bind(){
 $('#search').oninput=event=>{query=event.target.value;renderCards();renderMarkers();};
 $('#zone').onchange=event=>{zone=event.target.value;renderCards();renderMarkers();};
 $('#map-focus').onclick=()=>{const open=$('.workspace').classList.toggle('map-focus');$('#map-focus').textContent=open?'返回规划':'全景';setTimeout(()=>map.fitBounds(),30);};$('#fit').onclick=fitMap;$('#top-view').onclick=()=>map.topView();$('#zoom-in').onclick=()=>map.zoom(1.25);$('#zoom-out').onclick=()=>map.zoom(.8);$('#settings').onclick=settingsDialog;$('#about').onclick=aboutDialog;$('#export').onclick=exportPlan;
 $('.dialog-close').onclick=()=>$('#dialog').close();$('#dialog').onclick=event=>{if(event.target===$('#dialog')){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();}};
 $('#date').onchange=event=>{if(!event.target.value)return;settings.date=event.target.value;for(const o of Object.values(settings.overrides))delete o.showTime;refreshPlan();};
 $('#start').onchange=event=>{if(!event.target.value)return;settings.start=event.target.value;refreshPlan();};
 $('#optimize').onclick=()=>{const ordered=optimizeOrder(currentItems(),router);if(!ordered){toast('有未连通路段，暂不能自动排序，请手动调整');return;}selected=ordered.map(x=>x.id);refreshPlan();toast('已保留第一站，按邻近步道重排；演出冲突请核对');};
 $('#refresh').onclick=async()=>{const button=$('#refresh');button.disabled=true;button.classList.add('spinning');try{const response=await fetch('/api/refresh',{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error);raw=data;items=enrich(raw.children,raw.live);refreshPlan();if(active)renderDetail(items.find(x=>x.id===active));toast('排队与场次已刷新');}catch(error){toast(error.message);}finally{button.disabled=false;button.classList.remove('spinning');}};
 document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.type){type=button.dataset.type;document.querySelectorAll('[data-type]').forEach(b=>b.classList.toggle('active',b===button));renderCards();renderMarkers();}
  if(button.dataset.add)add(button.dataset.add);
  if(button.dataset.detailAdd){add(button.dataset.detailAdd);renderDetail(items.find(p=>p.id===button.dataset.detailAdd));}
  if(button.dataset.focus)focusItem(button.dataset.focus);
  if(button.dataset.done){done.has(button.dataset.done)?done.delete(button.dataset.done):done.add(button.dataset.done);refreshPlan();}
  if(button.dataset.edit)editStop(button.dataset.edit);
  if(button.dataset.move){const index=selected.indexOf(button.dataset.move),target=index+Number(button.dataset.direction);if(target>=0&&target<selected.length){[selected[index],selected[target]]=[selected[target],selected[index]];refreshPlan();}}
  if(button.dataset.viewTab)setMobile(button.dataset.viewTab);
  if(button.id==='close-detail'){$('#detail').classList.add('hidden');active=null;}
  if(button.id==='starter'){selected=DEFAULT_NAMES.map(name=>items.find(x=>x.name===name)?.id).filter(Boolean);refreshPlan();}
  if(button.id==='reset-filters'){zone='all';type='all';query='';$('#zone').value='all';$('#search').value='';document.querySelectorAll('[data-type]').forEach(b=>b.classList.toggle('active',b.dataset.type==='all'));renderCards();renderMarkers();}
 });
 $('#timeline').ondragstart=event=>{const stop=event.target.closest('[data-stop]');if(!stop)return;dragged=stop.dataset.stop;event.dataTransfer.setData('text/plain',dragged);event.dataTransfer.effectAllowed='move';stop.classList.add('dragging');};
 $('#timeline').ondragover=event=>{if(event.target.closest('[data-stop]'))event.preventDefault();};
 $('#timeline').ondrop=event=>{event.preventDefault();const target=event.target.closest('[data-stop]')?.dataset.stop;if(target&&dragged&&target!==dragged&&selected.includes(dragged)){selected.splice(selected.indexOf(dragged),1);selected.splice(selected.indexOf(target),0,dragged);refreshPlan();}dragged=null;};
 $('#timeline').ondragend=()=>{dragged=null;document.querySelectorAll('.dragging').forEach(el=>el.classList.remove('dragging'));};
 document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)&&!$('#dialog').open){event.preventDefault();if(innerWidth<1100)setMobile('explore');$('#search').focus();}});
}
async function start(){
 try{
  const response=await fetch('/api/park');const data=await response.json();if(!response.ok)throw new Error(data.error);
  raw=data;items=enrich(raw.children,raw.live);selected=Array.isArray(saved?.selected)?[...new Set(saved.selected)].filter(id=>items.some(p=>p.id===id)):DEFAULT_NAMES.map(name=>items.find(x=>x.name===name)?.id).filter(Boolean);
  rebuildRouter();shell();setupMap();refreshPlan();setMobile(mobile);
 }catch(error){$('#app').innerHTML=`<div class="load-error"><span>${icon('map')}</span><h1>地图还没准备好</h1><p>${e(error.message)}</p><button class="button primary" onclick="location.reload()">重新加载</button></div>`;}
}
start();
