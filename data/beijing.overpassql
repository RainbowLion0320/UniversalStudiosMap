// 北京环球附近的研究范围，含周边道路；不是园内可导航道路白名单。
// OSM data © OpenStreetMap contributors, ODbL 1.0.
[out:json][timeout:25];
(
  way(740165118);
  way["highway"~"^(footway|pedestrian|path|steps)$"](39.846,116.661,39.860,116.685);
);
out body geom;
