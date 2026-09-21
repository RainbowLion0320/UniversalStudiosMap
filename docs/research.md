# 北京环球影城：开源地图与路线数据调研

调研日期：2026-09-21。目的地已由用户确认为北京环球影城。

## 结论

具备制作可视化攻略的基础数据。此次检索未找到已验证成熟、许可明确、直接覆盖北京环球「地图 + 真实步行路线 + 排队 + 演出排程」的完整开源成品。推荐组合开源地图组件与公共 API，单独建设园内可通行路网。

第一版建议 Leaflet + OSM + ThemeParks.wiki；Queue-Times 用于备用对照。地图显示、两点间寻路、多项目游玩顺序优化是三个独立问题。

## 值得采用的项目与数据

| 来源 | 提供什么 | 本项目用途 | 许可/条件与判断 |
| --- | --- | --- | --- |
| [ThemeParks/parksapi](https://github.com/ThemeParks/parksapi) | 开源园区数据后端，支持北京环球 | 理解数据结构；优先调用现成 API，避免第一版自行维护采集后端 | 源码 MIT；自建多数园区适配需要另配凭证；API 数据有独立条件 |
| [ThemeParks.wiki API](https://api.themeparks.wiki/) | 项目坐标、状态、排队、演出与营业时间 | 主要业务数据源 | 实测无需密钥读到北京数据；显示数据要署名，不能把其数据当作 MIT 数据包再分发，见[当前条件](https://www.themeparks.wiki/pricing) |
| [OpenStreetMap](https://www.openstreetmap.org/way/740165118) / [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) | 园区边界、道路、部分设施 | 底图和步行图候选数据 | [ODbL](https://www.openstreetmap.org/copyright)，署名；需要检查道路可达性 |
| [Leaflet](https://github.com/Leaflet/Leaflet) | 缩放、标记、线条、GeoJSON、图片覆盖 | 推荐第一版地图组件 | BSD-2-Clause；也支持 [CRS.Simple 图片地图](https://leafletjs.com/examples/crs-simple/crs-simple.html) |
| [ngraph.path](https://github.com/anvaka/ngraph.path) | 图上的 A* 等寻路算法 | 少量园内路口和步道可在浏览器计算路径 | MIT；需要自己提供正确路网，不负责排队或游玩顺序优化 |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | 浏览器矢量地图渲染 | 后续需要自定义矢量底图或复杂样式时选择 | BSD-3-Clause；地图数据和瓦片服务另行配置 |
| [GraphHopper](https://github.com/graphhopper/graphhopper) | 基于 OSM 的路线引擎 | 后续覆盖酒店、地铁站或更大范围步行时考虑 | Apache-2.0；园区小规模原型暂不需要部署完整服务 |
| [Queue-Times API](https://queue-times.com/pages/api) | 排队时间和开放状态 | 备用数据和交叉核验 | 免费实时接口，约每 5 分钟更新；需显著显示并链接 Powered by Queue-Times.com |

## 北京园区实测

通过本机直接请求，非仅依据文档声称支持。

ThemeParks.wiki 园区 ID：`68e1d8f0-ed42-4351-af25-160421e37ce0`。

| 接口 | 本次结果 | 注意事项 |
| --- | --- | --- |
| `/v1/entity/{id}/children` | 44 条：20 个 ATTRACTION、24 个 SHOW；44 条均有 location | 此处是源数据分类，包含见面会等，不代表 44 个机械游乐设施；名称以英文为主 |
| `/v1/entity/{id}/live` | 44 条状态；15 条含 STANDBY；14 条含非空 showtimes | 部分条目无排队数据、演出结束时间可为 null；不能按零处理 |
| `/v1/entity/{id}/schedule` | 7 天日历，2026-09-21 至 2026-09-27 | 不代表已覆盖用户未来出行日期 |
| Queue-Times `/parks/328/queue_times.json` | 20 个 ride 条目 | 其 ID 与 ThemeParks.wiki 不同，需要映射 |
| OSM 初次范围查询 | 1 条主题公园边界 + 224 条步行相关 way | 范围包含周边，不等于 224 条已验证园内道路；初查使用 `out center` |

本地脚本改用 `out body geom` 请求完整道路几何，公共 Overpass 首次返回 504，已记录错误；第二次完整运行成功，取得 224 条道路几何：142 条 footway、77 条 pedestrian、5 条 steps。几何获取已验证，道路连通性和导航尚未验证。

成功快照：`data/local/20260921T134411053619Z/`，6 个来源请求全部成功。统计只描述该次响应，不保证后续数量不变。

抓取脚本保存原始响应与来源时间到 `data/local/`。这些是开发快照，不是持续更新的实时服务。ThemeParks.wiki 的 `lastUpdated` 是条目时间标记，单凭很早的值不能确定采集已经失效，也可能是状态长期未变化；仍需同时展示抓取时间，并检查服务状态。

本次两源对 Camp Jurassic 的开放状态不同，说明需要来源标识、更新时间和冲突处理；最终游玩以[官方 App/园区当日信息](https://www.universalbeijingresort.com/zh_CN)为准。

## 可参考的北京项目

[spmsun/universal-beijing-dining](https://github.com/spmsun/universal-beijing-dining)：个人餐饮导览项目。README 描述有 15 家餐厅、233 道菜品、7 大分区、SVG 地图和离线体验，标注数据更新日期为 2026-07-25。适合参考地图筛选和餐饮清单的交互思路；本次未运行验证其全部功能，也未验证菜单价格。

GitHub 未识别到标准开源许可证，README 仅保留版权声明，不能因为源码公开就当作可自由复制的开源底座。暂只记录链接，不引入其代码、地图或菜单数据。

另外检索到 [njcsdbj/beijing-tour-huanqiu](https://github.com/njcsdbj/beijing-tour-huanqiu)，但没有获取到 README、未确认许可和功能，不作为推荐底座。

## 地图选择与仍需补的数据

1. **真实地理地图（推荐）**：OSM 路网 + 项目坐标。先核对 3–5 个显著地标的坐标，再画点与道路；坐标字段存在不等于源坐标系已确认。[北京适配源码](https://github.com/ThemeParks/parksapi/blob/main/src/parks/universalbeijing/universalbeijing.ts)直接读取 position 中的经纬度，需验证与所用底图是否一致。
2. **园区示意图**：若偏好主题导览风格，可以自行绘制 SVG 或使用获得授权的图，以 Leaflet CRS.Simple 加点、路线。图上距离必须单独标定，不能按插画像素直接算步行米数。官网可看不等于园区插画获开放许可。
3. **路网补齐**：核对普通入口/优速通入口、围栏、楼层、单向通道、园内外边界和临时封路；过滤员工通道与不适用的台阶。不可直接将相邻景点画直线后宣称为可步行路径。
4. **游玩信息**：中文名与分区、体验时长、身高限制、演出时长和提前入场时间、餐饮及厕所、必玩优先级等，需要可靠补录；44 条 API 项目不是完整设施库。
5. **底图联网与缓存**：OSM 数据开放不意味着官方瓦片服务器可任意离线打包。[瓦片政策](https://operations.osmfoundation.org/policies/tiles/)不允许批量预取；需要离线地图时选择允许离线的服务或自行生成。

## 建议实施顺序

第一步：展示地图和中文项目卡，选择必玩、拖动排序，记录游玩完成状态。

第二步：用已核对入口和步道构图，计算相邻项目步行路线。保留人工修正；遇到不连通应明确标记，不能穿建筑补直线。

第三步：加入时间轴。总时间包含步行、排队、体验、演出等候、用餐和休息；演出作为固定时间约束。先做可解释的启发式排序和手动调整，不承诺全局最优。

第四步：结合明确的出行日期、同行者、必玩项目和优速通条件，生成实际攻略。今天的队列不能当作未来某天的预测；历史覆盖未在本次实测，应另行验证后再用于估计。

当前已完成资料与数据验证，尚未完成可视化页面、坐标校准、路网连通性检查或路线优化器。
