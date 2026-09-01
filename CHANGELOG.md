# Changelog

This file records user-visible changes that have not yet reached the latest
stable release.

## 0.6.7 (2026-09-01)

### Added

- Added a persistent setting to enable or disable Windows timer-completion
  notifications. Disabling it also cancels a notification already scheduled
  for the current timer.

### Fixed

- Centered the settings panel horizontally at every window-size preset.

## 0.6.6 (2026-09-01)

### Added

- Added a unified settings panel opened from the title-bar gear button.
- Added controls for theme, interface language, window size, always on top,
  start at login, and update checks to the settings panel.
- Added a title-bar shortcut that quickly cycles through compact, standard,
  and expanded window sizes, with a tooltip showing the current and next preset.
- Added an interactive compact timer with mode switching, countdown,
  start/pause, reset, and progress controls at the 360×210 window preset.
- Added five daily tomato-tree forms based on completed focus sessions:
  Seedling (0–1), Sapling (2–4), Growing (5–9), Flourishing (10–17), and
  Harvest (18+).

### Changed

- Consolidated the previous theme, language, window-size, startup, and update
  controls while keeping always on top and window-size switching available as
  title-bar shortcuts.
- Tree height, crown width, branch count, foliage density, and position now
  transition smoothly as the daily tomato count crosses a stage threshold.
- Improved mature-tree layering and narrow-window layout so fruit does not
  obscure tree status text.
- Changed signed updates to prompt first and start silent installation only
  after the user chooses Update now.

## 0.6.5

- Added optional Windows start-at-login support.
- Published signed Windows installer and updater assets.

[0.6.5]: https://github.com/GrayJS/desk-clock/releases/tag/v0.6.5
