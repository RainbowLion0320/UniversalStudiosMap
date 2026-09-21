# Low Poly 微缩园区

不是地图截图加滤镜：`universal-beijing.blend` 是可编辑的 Blender 场景，`build_park.py` 是确定性生成脚本，`../public/models/beijing-park.glb` 是网页实际加载的三维模型。

## 设计

- 整体：沙岩层叠底座、暖纸色步道、鼠尾草绿地、切面植被、青绿水面；正交相机形成微缩模型观感。
- 哈利·波特：从官网照片提取岩台、多层尖塔、石墙、蓝灰陡屋顶和密集村屋，放大塔楼轮廓以便远景识别。
- 变形金刚：紫色环形轨道、钢支柱、发射站和科幻能量塔。平面范围参考 OSM 地块；轨道高度、弯道及翻转是艺术化设计，不是乘骑轨迹数据。
- 水世界：青绿水池、半环看台、锈色特技架、起重臂和水上飞机，依据官方场景照片作简化。
- 侏罗纪：切面山体、蓝色游客中心穹顶、门户与恐龙轮廓雕塑，依据主题设定发挥。
- 功夫熊猫：层叠中式屋檐、红柱、金色灯笼；为方便地图识别采用外露宝塔意象，真实游乐区主要在室内。
- 小黄人：明黄、珊瑚色街屋、尖顶、旋转棚和小型角色意象，属主题化创作。
- 好莱坞：暖色 Art Deco 立面、装饰竖线与到达区地球仪。
- 310 株树木由固定随机种子布置，避开已收录建筑、水面和主要道路采样点；植被不是现场树木测绘。

## 参考记录

查阅日期：2026-09-21。参考图用于观察，未作为网页纹理或静态内容分发。

| 参考 | 用途 |
| --- | --- |
| [官方：哈利·波特与禁忌之旅](https://www.universalbeijingresort.com/zh_CN/play/haliboteyujinjizhilutm) | 已查看官网城堡照片，提取尖塔、岩基和屋顶比例 |
| [官方：霸天虎过山车](https://www.universalbeijingresort.com/zh_CN/play/batianhuguoshanche) | 已查看紫色轨道、支撑结构照片 |
| [官方：未来水世界](https://www.universalbeijingresort.com/zh_CN/ThemeLands/WaterWorld) | 已查看锈色平台、起重臂与飞机场景照片 |
| [官方园区主题介绍](https://www.universalbeijingresort.com/zh_CN/news/95.html) | 侏罗纪、变形金刚和功夫熊猫的主题设定 |
| [OSM 园区边界](https://www.openstreetmap.org/way/740165118) | 真实园区平面、建筑轮廓、道路与水体 |

## 坐标与可复现构建

局部原点：东经 116.6775，北纬 39.8554；1 模型单位 = 10 米。
Blender：X 向东、Y 向北、Z 向上。glTF 转为 Y 向上，网页的 Z 负向表示北。
经度缩放使用原点纬度余弦的局部近似，适用于本园区范围；所有装饰高度为设计值。

```sh
blender -b --factory-startup --python art/build_park.py
```

已在 Blender 5.2.0 LTS 验证。脚本读取同目录 `source/` 下的 OSM 快照，离线可重建，不依赖商业模型或在线素材服务。
输出编辑场景、预览 PNG 和 GLB。网页 GLB 按材质合并为约 30 个网格批次，文件约 2 MB；`.blend` 中保留单个建筑、树木与分区集合便于后续编辑。

`source/osm.json`：2026-09-21 Overpass 道路与园区边界，查询见 `../data/beijing.overpassql`。
`source/scenery.json`：相同日期的建筑、水面、绿地、景点几何，文件中保留查询和抓取时间。
这些 OSM 数据与派生地理数据适用 [ODbL 1.0](https://www.openstreetmap.org/copyright)，© OpenStreetMap contributors。ThemeParks.wiki 的 API 快照未包含在这里。

模型是攻略视觉辅助，不应从屋顶、树木、装饰轨道或灯笼推断可行走路径。实际规划线单独使用 OSM 步道路网；入口连接需现场核对。
