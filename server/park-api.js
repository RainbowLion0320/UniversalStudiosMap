import { readdir, readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../data/local/', import.meta.url));
const base = 'https://api.themeparks.wiki/v1/entity/68e1d8f0-ed42-4351-af25-160421e37ce0';
async function readJson(file) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; } }
export async function loadPark() {
  const dirs = (await readdir(root, {withFileTypes:true}).catch(()=>[])).filter(x=>x.isDirectory()).map(x=>x.name).sort().reverse();
  const sources = {}, data = {};
  for (const name of ['children','live','schedule','osm']) {
    for (const dir of dirs) {
      const value = await readJson(path.join(root,dir,`${name}.json`));
      if (!value) continue;
      data[name] = value;
      const manifest = await readJson(path.join(root,dir,'manifest.json'));
      sources[name] = manifest?.sources?.[name] ?? {fetchedAt:null};
      break;
    }
  }
  const refreshed = await readJson(path.join(root,'live-cache.json'));
  for (const name of ['live','schedule']) {
    if (refreshed?.[name] && refreshed.fetchedAt > (sources[name]?.fetchedAt ?? '')) {
      data[name] = refreshed[name]; sources[name] = {fetchedAt:refreshed.fetchedAt,url:base+`/${name}`};
    }
  }
  const scenery = await readJson(path.join(root,'scenery.json')) ?? await readJson(fileURLToPath(new URL('../art/source/scenery.json',import.meta.url)));
  if(!data.osm)data.osm=await readJson(fileURLToPath(new URL('../art/source/osm.json',import.meta.url)));
  return {children:data.children?.children ?? [], live:data.live?.liveData ?? [], schedule:data.schedule?.schedule ?? [], osm:data.osm?.elements ?? [], scenery:scenery?.elements ?? [], sources};
}
let refreshTask, lastRefresh = 0;
async function refresh() {
  if (refreshTask) return refreshTask;
  if (Date.now()-lastRefresh < 60_000) return loadPark();
  refreshTask = (async()=>{
    const result = {};
    for (const name of ['live','schedule']) {
      const response = await fetch(`${base}/${name}`, {signal:AbortSignal.timeout(15_000),headers:{'User-Agent':'UniversalStudiosMap/0.1'}});
      if (!response.ok) throw new Error('数据源暂不可用，请稍后重试');
      const value = await response.json();
      if (!Array.isArray(value[name==='live'?'liveData':'schedule'])) throw new Error('数据源格式异常');
      result[name]=value;
    }
    result.fetchedAt=new Date().toISOString();
    await mkdir(root,{recursive:true});
    await writeFile(path.join(root,'live-cache.tmp'),JSON.stringify(result));
    await rename(path.join(root,'live-cache.tmp'),path.join(root,'live-cache.json'));
    lastRefresh=Date.now();
    return loadPark();
  })();
  try {return await refreshTask;} finally {refreshTask=null;}
}
export function parkApi() {
  const middleware = async(req,res,next)=>{
    const pathname = new URL(req.url,'http://localhost').pathname;
    if (!['/api/park','/api/refresh'].includes(pathname)) return next();
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    if (req.method !== (pathname==='/api/refresh'?'POST':'GET')) {res.statusCode=405;return res.end(JSON.stringify({error:'Method not allowed'}));}
    if (pathname==='/api/refresh' && req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {res.statusCode=403;return res.end(JSON.stringify({error:'Origin not allowed'}));}
    try {
      const data = pathname==='/api/refresh'?await refresh():await loadPark();
      if (!data.children.length) {res.statusCode=503;return res.end(JSON.stringify({error:'还没有本地园区数据。请先运行 npm run data:fetch，然后重试。'}));}
      res.end(JSON.stringify(data));
    } catch {res.statusCode=502;res.end(JSON.stringify({error:'暂时无法刷新，已保留原有数据。请稍后再试。'}));}
  };
  return {name:'local-park-api',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}
