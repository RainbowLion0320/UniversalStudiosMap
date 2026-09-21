import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Share } from '@capacitor/share';
const base='https://api.themeparks.wiki/v1/entity/68e1d8f0-ed42-4351-af25-160421e37ce0';
const cacheKey='universal-live-cache-v1';
export const native=Capacitor.isNativePlatform();
export async function loadPark(){
 let park;
 // The APK always starts from its packaged snapshot. No server or connectivity is required.
 if(!native){try{const r=await fetch('/api/park');if(r.ok)park=await r.json();}catch{}}
 if(!park?.children?.length){const r=await fetch('/data/park.json');if(!r.ok)throw new Error('离线地图未找到');park=await r.json();}
 try{const cached=JSON.parse(localStorage.getItem(cacheKey));if(Array.isArray(cached?.live)&&Array.isArray(cached?.schedule)&&cached.fetchedAt>(park.sources.live?.fetchedAt??'')){park.live=cached.live;park.schedule=cached.schedule;for(const key of ['live','schedule'])park.sources[key]={fetchedAt:cached.fetchedAt};}}catch{}
 return park;
}
let running,lastSuccess=0;
export async function refreshPark(park){
 if(running)return running;
 if(Date.now()-lastSuccess<60000)return park;
 running=(async()=>{
  if(!native){const r=await fetch('/api/refresh',{method:'POST'});if(!r.ok)throw new Error('暂时连不上数据源，离线地图仍可使用');const data=await r.json();if(!data.children?.length)throw new Error('数据未更新');return data;}
  const results=await Promise.all(['live','schedule'].map(async key=>{
   const r=await CapacitorHttp.get({url:`${base}/${key}`,connectTimeout:10000,readTimeout:10000,responseType:'json'});
   const body=typeof r.data==='string'?JSON.parse(r.data):r.data;
   if(r.status!==200||!Array.isArray(body[key==='live'?'liveData':'schedule']))throw new Error('暂时连不上数据源，离线地图仍可使用');
   return body[key==='live'?'liveData':'schedule'];
  }));
  const fetchedAt=new Date().toISOString(),[live,schedule]=results;
  try{localStorage.setItem(cacheKey,JSON.stringify({live,schedule,fetchedAt}));}catch{}
  return {...park,live,schedule,sources:{...park.sources,live:{fetchedAt},schedule:{fetchedAt}}};
 })();
 try{const result=await running;lastSuccess=Date.now();return result;}finally{running=null;}
}
export async function sharePlan(text,date){
 if(native){try{await Share.share({title:`北京环球影城 · ${date}`,text,dialogTitle:'分享我的行程'});}catch{}return;}
 const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`北京环球行程-${date}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function registerBack(handler){if(native)App.addListener('backButton',()=>{if(!handler())App.minimizeApp();});}
