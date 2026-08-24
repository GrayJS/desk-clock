# Morrow 桌面时钟

一款面向 Windows 11 的轻量桌面时钟。使用 Tauri 2、React 和 TypeScript 构建，不依赖 Electron。

## 功能

- 实时时钟与日期，窗口默认置顶
- 迷你、标准、展开三种窗口尺寸，也支持自由缩放
- 25/5/15 分钟番茄工作法计时器
- 当前目标、随手记与专注完成记录
- 数据仅通过 `localStorage` 保存在本机
- 无边框透明窗口与 Windows 11 风格界面

## 开发

需要 Node.js 20+、Rust stable 和 Windows WebView2。

```powershell
npm install
npm run tauri dev
```

## 构建安装包

```powershell
npm run tauri build
```

安装包会生成在 `src-tauri/target/release/bundle/nsis`。
