import { mkdir, writeFile } from 'node:fs/promises';
import { loadPark } from '../server/park-api.js';
const park = await loadPark();
if (!park.children.length) throw new Error('Run npm run data:fetch to obtain the app display data before bundling.');
// Only display fields required by the personal planner; no live values are shipped as current data.
park.children = park.children.map(({id,name,entityType,location})=>({id,name,entityType,location}));
park.live = []; park.schedule = []; park.scenery = [];
park.sources = {osm:park.sources.osm, children:park.sources.children};
await mkdir('public/data',{recursive:true});
await writeFile('public/data/park.json',JSON.stringify(park));
console.log(`Offline map includes ${park.children.length} places and ${park.osm.length} OSM elements.`);
