# 参与开发

欢迎反馈路线、入口或界面问题。请先搜索现有 Issues，再描述复现步骤与设备信息。

```sh
npm ci
npm run data:catalog
npm run dev
npm test
npm run build
```

建议为每个改动开分支，通过 Pull Request 提交。路线算法变更应添加对应的断路、方向或时间边界测试；界面变更附横竖屏截图。不要把未经确认的入口或临时封路当作确定事实。

新素材和数据必须附来源与许可。不要提交 `data/local/`、API 原始快照、签名密钥、密码、个人行程或 `.env`。提交原创代码即同意按本项目 MIT 许可分发；OSM 数据仍按 ODbL 处理。

GitHub CI 会测试算法、构建网页和 Android 调试包。正式安装包在 Releases；CI 调试包不使用正式签名，不能覆盖安装正式版。
