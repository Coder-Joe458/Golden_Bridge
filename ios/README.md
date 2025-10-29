# GoldenBridgeMobile (iOS)

直连现有 Next.js 单体后端的 SwiftUI 客户端骨架。项目基于 [XcodeGen](https://github.com/yonaskolb/XcodeGen)，通过 `project.yml` 生成 Xcode 工程，方便在 monorepo 中管理配置。

## 目录结构

- `project.yml` – XcodeGen 配置文件
- `Config/` – 不同构建配置（Debug/Release）的环境变量与编译选项
- `Sources/` – SwiftUI 应用源码
  - `Configuration/` – 读取环境变量、定义常量
  - `Networking/` – API 客户端、数据模型
  - `Services/` – 针对业务场景的封装（认证、聊天、推荐）
  - `Views/` – SwiftUI 界面与导航壳
- `Resources/` – `Info.plist`、资源文件（AppIcon 等）
- `Tests/` – 单元测试占位

## 快速开始

1. **安装依赖**
   ```bash
   brew install xcodegen # 若尚未安装
   ```
2. **生成 Xcode 工程**
   ```bash
   cd ios
   xcodegen generate
   open GoldenBridgeMobile.xcodeproj
   ```
3. **配置签名**
   - 在 Xcode 中选择团队、Bundle ID（默认 `com.goldenbridge.mobile`，可在 `project.yml` 修改）。
   - `Config/Debug.xcconfig`、`Config/Release.xcconfig` 中设置 `API_BASE_URL`、`AUTH_BASE_URL` 等变量。

4. **运行**
   - Debug 模式下默认指向 `http://localhost:3000`，确保 Next.js 服务运行且通过局域网/隧道可访问。
   - 生产构建前，将 `API_BASE_URL` 更新为 `https://www.aibridgeloan.com` 等线上域名。

## 与 Web 共用的接口
- `/api/auth/csrf`、`/api/auth/callback/credentials` – 凭证登录（复用 NextAuth）
- `/api/chat/session`、`/api/chat` – 会话上下文
- `/api/recommendations` – 推荐经纪人
- `/api/broker/*` – 经纪人对话与资料

`APIClient` 会自动附带 Cookie 并在需要时注入 CSRF Token，保证与 Web 逻辑保持一致。

## Fastlane / CI
后续可在 `ios/fastlane/` 中添加自动化脚本，并在 GitHub Actions 中触发 `fastlane test` / `fastlane pilot upload`，与 Web 部署保持同一触发点。
