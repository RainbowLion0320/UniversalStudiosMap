# 维护与发版

## 日常检查

推送到 main 或提交 Pull Request 会触发 `.github/workflows/ci.yml`：Node 测试 → 获取展示清单 → 网页构建 → Android 调试 APK。CI 调试包仅用于测试，保留 14 天；正式安装包从 Releases 下载。外部 API 暂不可用时，清单获取步骤会报错，可在服务恢复后重跑。

Dependabot 每月检查 npm 和 Actions 依赖。Issue 模板、PR 模板、安全私密报告入口均已配置。

## 发布正式版本

1. 更新 `package.json` 及 lockfile 的版本、`android/app/build.gradle` 的 `versionName` 和递增 `versionCode`；首次发布为 1 / 1.0.0。
2. 更新 `CHANGELOG.md`，创建 `docs/releases/v<版本>.md`。
3. `npm ci`，如无本地清单先 `npm run data:catalog`；运行 `npm test`。
4. `npm run android:release`，复用正式签名密钥；在设备或模拟器检查横竖屏、离线与安装升级。
5. 提交改动并推送，确认 GitHub CI 通过。
6. 运行 `npm run release:publish`，脚本会检查工作区、校验 APK、推送版本 tag，再创建公开 Release，上传 APK、SHA-256 和第三方说明。GitHub 自动提供源代码归档。
7. 从 Release 下载 APK 和校验文件，重新验证摘要和签名。已经公开的版本不要替换二进制，后续修复递增版本发布。

需要已登录的 GitHub CLI（`gh auth login`）。脚本不会上传签名密钥，也不会配置 GitHub 签名 secrets。

## 签名备份

`~/.local/share/universal-wander/signing/` 中保存正式密钥与密码，目录 700、文件 600。备份到自己的安全存储中，不要放入仓库、Issue、Release 或 CI artifact。丢失签名将无法为已安装用户提供同包名覆盖升级。

独立 fork 默认生成自己的签名；这不能覆盖本仓库正式版。分发 fork 前建议修改 applicationId 和产品名称。
