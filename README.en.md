# Morrow Desk Clock

[简体中文](README.md) | English

A lightweight desktop clock and focus companion for Windows 11, built with Tauri 2, React, TypeScript, and Three.js—without Electron.

Current stable release: [`v0.6.9`](https://github.com/GrayJS/desk-clock/releases/latest)

## Preview

![Morrow Desk Clock focus tomato tree in dark mode](docs/morrow-tree-preview-en.jpg)

## Download and Install

1. Open [GitHub Releases](https://github.com/GrayJS/desk-clock/releases/latest).
2. Download the latest x64 setup executable from the release assets.
3. Run the installer and launch Morrow.

Windows 10/11 x64 and Microsoft Edge WebView2 are required. WebView2 is normally preinstalled on Windows 11.

## Features

- Live clock and date with always-on-top enabled by default
- Compact, standard, and expanded window presets with title-bar quick switching, free resizing, and dragging
- Compact mode keeps mode switching, countdown, start/pause, reset, and progress controls
- The Windows tray icon supports separate click and double-click actions plus custom PNG, JPG, or WebP icons
- Dark, light, and Windows system theme modes
- Instant Simplified Chinese and English switching
- Unified settings panel for appearance, window, startup, and update options
- Focus, short-break, and long-break timer modes
- Quick duration presets and custom 1–180 minute countdowns
- Current goal, quick notes, and completed focus-session history
- System tray background mode with restore and quit actions
- Optional start at login, synchronized with the actual Windows startup entry
- Native background timing with optional Windows notifications when a session ends
- Frameless transparent window, responsive layout, and Windows 11-inspired motion

## Settings

Open the unified settings panel with the gear button in the title bar. Changes
take effect immediately:

- **Appearance**: system, light, or dark theme and Simplified Chinese or English
- **Window**: compact, standard, or expanded size and always-on-top behavior
- **Windows tray**: configure separate tray-icon click and double-click actions for start/pause, reset, next mode, always on top, settings, or no action; upload a custom tray icon when preferred
- **System**: start at login, Windows timer notifications, and signed update checks

Always on top and window-size switching remain available as title-bar shortcuts;
the size button cycles through compact, standard, and expanded presets. Start at
login reads and updates the actual Windows login entry, so it is unavailable in
a regular browser-only frontend preview.

| Preset | Window size | Best for |
| --- | ---: | --- |
| Compact | 360×210 | Keeping the clock visible while controlling the timer |
| Standard | 420×560 | Everyday timing, goals, and focus history |
| Expanded | 720×520 | Side-by-side timer content or the full achievement tree |

The selected preset is stored locally and restored on the next launch. The
title-bar size button reflects the current preset, and its tooltip identifies
the preset that will be selected on the next click.

## Daily Focus Tomato Tree

- A low-poly achievement tree rendered with Three.js
- One tomato is added for every focus session completed that day
- Tree height, crown width, branches, and foliage density evolve with the tomato count using smooth transitions
- During a countdown, the next tomato grows from a small green fruit into a ripe red tomato
- Pausing preserves its current maturity; resetting or switching modes cancels that growth
- Tomato counts follow today's completed focus records and start fresh on a new local date
- The tree includes breathing, swaying, pointer parallax, and responsive scaling animations

| Tomatoes today | Tree form |
| ---: | --- |
| 0–1 | Seedling |
| 2–4 | Sapling |
| 5–9 | Growing |
| 10–17 | Flourishing |
| 18+ | Harvest |

## Updates

- Checks for a signed update once after launch
- Checks for new versions every hour in the background
- Provides a manual update-check button in Settings
- Prompts when a new version is found, with Update now and Remind me later choices
- Downloads and installs silently only after confirmation; it never installs without approval
- Opens the manual download page only if automatic installation fails
- Reports when Morrow is up to date or when the network check fails
- Displays the current application version in the footer

## Data and Privacy

- Focus history, the current goal, durations, theme, language, window size, always-on-top, notification, and tray preferences stay in local `localStorage`
- Start at login is managed by the Windows login entry and is never uploaded to a remote service
- No account is required
- Focus history and quick notes are never uploaded
- User data is never uploaded; network access may be used to load interface fonts and check or download signed updates

## Development

Node.js 20+, Rust stable, Windows WebView2, and an NSIS build environment are required.

```powershell
npm install
npm run tauri dev
```

To run only the frontend preview:

```powershell
npm run dev
```

## Build the Installer

```powershell
npm run tauri build
```

The localized NSIS installer is generated in:

```text
src-tauri/target/release/bundle/nsis/
```

Pushing a `v*` tag that matches the version in `tauri.conf.json` runs the GitHub
Actions release workflow. It uploads the signed installer, `.sig`, and updater
manifest (`latest.json`). CI reads the `TAURI_SIGNING_PRIVATE_KEY` and
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` repository secrets; keep any local backup
outside this repository.

## Project Structure

```text
src/                         React + TypeScript interface
src/components/SettingsPanel.tsx Unified settings panel
src/components/FocusTree.tsx Three.js daily achievement tree
src/lib/                     Window, background notification, and updater helpers
src-tauri/src/lib.rs         Tauri tray, notification, and native window logic
docs/                        README screenshots
```

## Tech Stack

- Tauri 2
- React 18
- TypeScript
- Three.js
- Vite
- Rust

## License

This project is available under the [MIT License](LICENSE). You may use, modify,
and distribute it as long as the original copyright and license notice are kept.
