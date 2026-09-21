# 安卓版 · 环球漫游

地图优先的个人攻略工具。原有 Blender → glTF → Three.js 模型与步道寻路完整保留，由 Capacitor 8 提供 Android 容器、系统返回键与系统分享。

## 使用

- 底部只有「选项目 / 看地图 / 行程」三个入口。地图拖动旋转、双指缩放和平移；定位图标恢复全园，俯视切换垂直视角。
- 点项目打开详情，加入或移除行程。行程自动保存在本机；「调整行程」展开排序、时间编辑与删除。
- 顶栏更多选项提供游玩节奏、分享、刷新和数据说明。
- 竖屏清单占据主要阅读区域；横屏清单停靠左侧，保留地图。支持屏幕旋转、刘海与系统栏安全区域。
- Android 返回键依次收起弹窗、项目详情、清单，再将应用放到后台。
- APK 随包内置模型、44 个项目的展示坐标和 OSM 步道。首次断网也能选项目、计算路线和调整时间。联网后后台尝试刷新排队与演出，失败保留离线内容，不弹出干扰性通知。
- 新安装不把历史排队数据当实时值；只有当天、15 分钟以内的快照在开启对应设置后参与计划。未来日期仍按估算。
- 卸载或清除应用数据会删除本机行程，出发前可通过系统分享备份文字攻略。

## 打包

依赖 Node 22、JDK 21、Android SDK 36 / Build Tools 36.0.0。系统版本最低 Android 8.0，设备 WebView 需要支持 WebGL 2。

```sh
npm ci
npm run data:fetch  # 首次准备数据；已存在本地快照时可跳过
npm run android:release
```

脚本会打包离线数据、同步 Android 工程、编译 release APK、zipalign、签名并验证签名。

输出：`output/release/universal-wander-1.0.0.apk` 及 SHA-256 文件。

构建脚本使用 `JAVA_HOME` 和 `ANDROID_HOME`；本机未配置时查找用户目录的 JDK 和 `~/Library/Android/sdk`。

**更新安装必须保留签名**：默认密钥和密码存储在 `~/.local/share/universal-wander/signing/`，权限分别为目录 700 / 文件 600，不进入 Git。可通过 `WANDER_SIGNING_DIR` 指向自己的备份位置。后续升级需增加 `versionCode` 并使用同一密钥。

## 数据与隐私

- 仅申请网络访问系统权限，无定位、联系人、相机和外部存储读取权限；不含广告或分析 SDK。
- 关闭 Android 自动备份；行程及实时快照缓存只保存在当前应用数据中。
- 联网仅向 ThemeParks.wiki 获取公开排队和演出信息。点击来源链接会交给系统浏览器。
- APK 内只包含展示所需项目字段，不将 API 原始返回作为公开数据集发布。保留 Powered by ThemeParks.wiki 和 OSM attribution。
- OSM 的真实步道与艺术化建筑独立：路线只沿已收录道路；虚线入口仍需现场核对，不是现场导航保证。

## 性能

随包 GLB 约 1.9 MB、约 3.3 万三角形。静置不持续重绘；画面仅在模型载入、视角变化、路线或尺寸变化时渲染。后台暂停绘制，小地图避让非行程标记。

验证详情见 [android-validation.md](android-validation.md)。
