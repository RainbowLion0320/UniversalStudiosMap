# 许可证与第三方资料

本项目原创代码、文档及原创美术部分采用 [MIT](LICENSE)。第三方代码、地理数据、主题角色与商标不因本仓库的 MIT 许可证而改变其权利归属。

## 地图数据与模型

`art/source/osm.json`、`art/source/scenery.json` 及由其生成的派生地理数据：© OpenStreetMap contributors，适用 [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)。[OSM 版权说明](https://www.openstreetmap.org/copyright)。数据保留在源码仓库，处理和建模方法见 `art/build_park.py`、`src/planner.js`，可机器读取并重建。

`art/universal-beijing.blend`、`public/models/beijing-park.glb`、`art/park-preview.png` 和界面截图包含基于 OSM 数据生成的内容；原创造型部分可按 MIT 使用，地图数据及其署名要求仍适用。转发截图时请保留地图来源说明。

项目中的园区、项目名称及主题角色等相关权利属于各权利人。本项目为独立、非官方攻略工具，与北京环球度假区及相关品牌不存在隶属或背书关系。官方照片仅用于观察参考，不作为纹理或图片分发；参考链接见 `art/README.md`。

## API 服务

Powered by ThemeParks.wiki — https://themeparks.wiki/

根据 [API 使用条件](https://www.themeparks.wiki/pricing)，本应用显示园区信息并保留署名。API 数据不是本项目的 MIT 开源数据；原始响应、排队历史和抓取缓存不在源码或单独 Release 数据包中发布。APK 只内置界面运行必需的项目展示字段；实时值由应用向原始服务请求。不要把应用的本地缓存转成公共数据接口或批量数据产品。条件核对日期：2026-09-22。

Queue-Times 仅用于早期调研；现有应用不展示其数据，也不随安装包分发该快照。

## 运行依赖

- Three.js：MIT，许可证副本见 `public/licenses/three-MIT.txt`。
- Capacitor Core / Android：MIT，见 `public/licenses/capacitor-MIT.txt`、`capacitor-android-MIT.txt`。
- Capacitor App / Share：MIT，见 `public/licenses/capacitor-app-MIT.txt`、`capacitor-share-MIT.txt`。
- AndroidX、Gradle Wrapper 与 Apache Cordova 的相关代码：Apache-2.0，见 `public/licenses/Apache-2.0.txt`；保留各源码已有声明。
- Android 图标、启动页及 Gradle 项目模板来自 Capacitor 默认模板，遵循其 MIT 许可。

开发依赖（Vite 等）保留 npm 包内原始 LICENSE，版本由 `package-lock.json` 固定。完整依赖树可运行 `npm ls --all` 查看。公开源码不包含 Node、JDK、Android SDK 或 Unity 安装程序。
