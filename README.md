# Morrow 桌面时钟

简体中文 | [English](README.en.md)

一款面向 Windows 11 的轻量桌面时钟与专注工具。使用 Tauri 2、React、TypeScript 和 Three.js 构建，不依赖 Electron。

当前稳定版本：[`v0.6.8`](https://github.com/GrayJS/desk-clock/releases/latest)

## 效果预览

![Morrow 桌面时钟番茄成果树浅色界面](docs/morrow-tree-preview.jpg)

## 下载与安装

1. 打开 [GitHub Releases](https://github.com/GrayJS/desk-clock/releases/latest)。
2. 下载最新的 `Morrow 桌面时钟_*_x64-setup.exe`。
3. 运行安装包并启动 Morrow。

需要 Windows 10/11 x64 与 Microsoft Edge WebView2。Windows 11 通常已经预装 WebView2。

## 主要功能

- 实时时钟与日期，窗口默认置顶
- 迷你、标准、展开三种窗口尺寸，支持标题栏快速切换、自由缩放和拖动
- 迷你模式保留模式切换、倒计时、开始/暂停、重置和进度显示
- 标准和展开模式提供带图标动效反馈的底部快捷栏，默认单击即可开始或暂停计时，并支持内置或自定义图标
- 深色、浅色与跟随 Windows 系统三种主题模式
- 简体中文与 English 即时切换
- 统一设置面板，集中管理外观、窗口、启动与更新选项
- 专注、短休息、长休息三种计时模式
- 常用时长快捷档位与 1–180 分钟自定义倒计时
- 本轮目标、随手记和专注完成记录
- 最小化或关闭后驻留系统托盘，可从托盘恢复或退出
- 可选开机自启动，并与 Windows 实际启动项状态同步
- 原生后台计时，可选择在完成后发送 Windows 通知
- 无边框透明窗口、响应式布局与 Windows 11 风格动效

## 设置

点击标题栏齿轮按钮打开统一设置面板。面板中的修改会即时生效：

- **外观**：跟随系统、浅色或深色主题，以及简体中文或 English
- **窗口**：迷你、标准或展开尺寸，并可切换窗口置顶
- **快捷栏**：分别配置单击和双击动作，可选开始/暂停、重置、切换模式、置顶、打开设置或无操作；图标可跟随动作，也可使用内置图标或自定义 Emoji / 符号
- **系统**：开机启动、Windows 计时完成通知和签名更新检查

窗口置顶和尺寸切换仍保留在标题栏作为高频快捷操作；尺寸按钮会按迷你、标准、
展开的顺序循环切换。开机启动读取并修改 Windows
实际启动项；在普通浏览器前端预览中该开关不可用。

| 尺寸档位 | 窗口大小 | 适用场景 |
| --- | ---: | --- |
| 迷你 | 360×210 | 常驻桌面并直接操作计时器 |
| 标准 | 420×560 | 日常计时、填写目标与查看记录 |
| 展开 | 720×520 | 并排查看计时内容或完整成果树 |

尺寸选择会保存在本机；下次启动时会恢复上次使用的档位。标题栏尺寸按钮显示当前
档位，并在悬停提示中说明点击后将切换到的档位。

## 每日番茄成果树

- Three.js 渲染低多边形动态成长树
- 当天每完成一轮专注，树上增加一颗番茄
- 树会随番茄数量改变树高、冠幅、分枝和叶片密度，并平滑过渡到下一形态
- 倒计时期间，下一颗番茄会从绿色小果逐渐长大并成熟变红
- 暂停时保留当前成熟度，重置或切换模式后取消本轮生长
- 番茄数量按当天专注记录计算，日期变化后从新的每日成果树开始
- 树体支持呼吸、摆动、鼠标视差和响应式缩放动画

| 当日番茄数 | 树的形态 |
| ---: | --- |
| 0–1 | 幼苗 |
| 2–4 | 幼树 |
| 5–9 | 成长 |
| 10–17 | 繁茂 |
| 18+ | 丰收 |

## 版本更新

- 启动应用后自动检查一次签名更新
- 后台每 1 小时检查一次新版本
- 设置面板提供手动检查更新按钮
- 发现新版本后先显示提示，由用户选择“立即更新”或“稍后提醒”
- 用户确认后在后台静默下载并安装，不会未经确认自动安装
- 自动更新失败时才打开手动下载入口
- 检查结果会反馈“已是最新版本”或网络错误状态
- 当前应用版本显示在底部状态栏

## 数据与隐私

- 专注记录、当前目标、时长、主题、语言、窗口尺寸、置顶、通知和快捷动作偏好均保存在本机 `localStorage`
- 开机启动由 Windows 登录启动项管理，不会上传到远程服务
- 不需要注册账号
- 不上传专注记录或随手记
- 不会上传用户数据；网络可能用于加载界面字体以及检查、下载签名更新

## 本地开发

需要 Node.js 20+、Rust stable、Windows WebView2 和 NSIS 构建环境。

```powershell
npm install
npm run tauri dev
```

仅运行前端预览：

```powershell
npm run dev
```

## 构建安装包

```powershell
npm run tauri build
```

中文 NSIS 安装包会生成在：

```text
src-tauri/target/release/bundle/nsis/
```

推送与 `tauri.conf.json` 版本一致的 `v*` 标签后，GitHub Actions 会构建 Release，
并同时上传签名安装包、`.sig` 与更新清单 `latest.json`。CI 使用仓库中的
`TAURI_SIGNING_PRIVATE_KEY` 和 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` Secrets；
本机备份应始终放在仓库之外。

## 项目结构

```text
src/                         React + TypeScript 界面
src/components/SettingsPanel.tsx 统一设置面板
src/components/FocusTree.tsx Three.js 每日成果树
src/lib/                     窗口、后台通知与更新检测
src-tauri/src/lib.rs         Tauri 托盘、通知和原生窗口逻辑
docs/                        README 效果截图
```

## 技术栈

- Tauri 2
- React 18
- TypeScript
- Three.js
- Vite
- Rust

## 开源协议

本项目采用 [MIT License](LICENSE)。你可以自由使用、修改和分发，但需保留原始版权与许可声明。
