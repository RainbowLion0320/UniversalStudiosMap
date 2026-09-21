# 数据来源与本地快照

运行 `python3 scripts/fetch_beijing.py` 后，快照写入 `data/local/<UTC 时间>/`。
每次运行独立保存；`manifest.json` 记录来源 URL、抓取时间、统计和错误。
接口数据保留原始坐标及更新时间，不把未声明的坐标系自动当作 WGS84。

- ThemeParks.wiki：[接口](https://api.themeparks.wiki/)、[使用条件](https://www.themeparks.wiki/pricing)。应用显示数据时署名 Powered by ThemeParks.wiki；源码 MIT 许可不代表 API 数据采用 MIT。不要把本地快照作为公开数据包或转售 API 发布。
- Queue-Times：[API 说明](https://queue-times.com/pages/api)。应用显著署名并链接 Powered by Queue-Times.com。
- OpenStreetMap：[版权与 ODbL](https://www.openstreetmap.org/copyright)。保留 © OpenStreetMap contributors，派生数据库按适用的 ODbL 条件处理。

`local/` 已加入 `.gitignore`。开源代码、公共 API、可再分发的数据是不同概念。
当前范围内道路包含园区周边、台阶、可能的排队通道和受限通道，需检查 access、foot、service、barrier、level 和连通性后才能用于路线。
