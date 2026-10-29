# Changelog

This file records user-visible changes that have not yet reached the latest
stable release.

## 0.6.13 (2026-10-29)

### Added

- Replaced the History list with compact daily, weekly, monthly, and yearly
  reports using Ant Design and Ant Design Charts / AntV.
- Added a monthly focus calendar with daily totals and click-through to daily
  reports, plus focus duration, completed rounds, active days, skipped phases,
  completion rate, retained details, and accessible chart data.
- Persist daily summaries independently of the 200-detail limit. Initialize
  existing history on upgrade; clearing history also clears report summaries.

### Changed

- Standard window is now 420×747, keeping its width with a phone-like aspect ratio.
- Adapted reports for narrow and expanded windows and both themes, reducing
  whitespace to keep key metrics visible without scrolling.

## 0.6.12 (2026-10-29)

### Added

- Added Skip focus and Skip rest controls to the cycle panel, normal timer, and
  compact timer. A running cycle continues; a paused cycle stays paused.
- Skipped phases retain their type, planned duration, actual elapsed time,
  timestamp, and note in local history. History distinguishes skipped stages
  from completed focus sessions.

### Changed

- Cycle progress tracks processed rounds separately from completed and skipped
  focus rounds. Skipping the final focus ends the cycle without an extra rest.
- Skipped focus time contributes only its actual elapsed duration to daily focus
  totals; skipped rests and focus skips never add tomatoes or completed rounds.
- Older records without an outcome remain compatible with completed-focus
  statistics. History continues to retain the most recent 200 session records.

## 0.6.11 (2026-10-28)

### Added

- Added a third Cycle tab with configurable round counts and independent focus
  and rest durations, automatic phase transitions, pause/resume, and an end
  action. The final focus round ends the plan without an extra rest.
- Added persistent cycle plans and round progress in normal and compact timers.
  Completed focus phases create records; rest phases do not.

### Changed

- Countdown progress now follows a deadline rather than counting interval
  callbacks, reducing drift after the app is hidden or briefly delayed.

## 0.6.10 (2026-10-28)

### Changed

- Added an accessible confirmation dialog before clearing focus history to
  prevent accidental deletion. The dialog defaults to the safe cancel action,
  supports Escape and backdrop dismissal, and clearly warns that deletion is
  permanent.
- Added native Windows Mica with an Acrylic fallback and refined translucent
  surfaces throughout the interface for an iOS-inspired frosted-glass appearance,
  including dimensional digits, button highlights, and press feedback.
- Added a distinct configurable "show main window" tray action and made it the
  default single-click behavior. Existing installations using the previous
  timer-toggle default are migrated once, while "open settings" remains a
  separate option.
- Completed focus sessions now remain in focus mode and reset to the next focus
  duration instead of automatically switching to a short break.
- Merged short and long breaks into one configurable rest mode. Existing short
  break durations are migrated automatically to the new rest duration.
- Increased the standard window preset height from 560 to 600 pixels for more
  comfortable spacing in the timer, history, and settings views.

## 0.6.9 (2026-09-01)

### Added

- Added configurable single-click and double-click actions to the Windows tray
  icon, with delayed single-click handling to prevent double-click conflicts.
- Added persistent custom Windows tray icons from PNG, JPG, or WebP images.

### Changed

- Replaced the incorrectly scoped in-window bottom quick action with Windows
  tray interactions.
- Replaced native action dropdowns with keyboard-accessible in-app menus for
  consistent behavior inside the settings panel.

## 0.6.8 (2026-09-01)

### Added

- Added a bottom quick-action button that starts or pauses the timer by default.
- Added persistent settings for separate click and double-click actions. Presets
  include start/pause, reset, next mode, always on top, open settings, and no
  action.
- Added persistent quick-bar icon settings with action-aware and built-in presets,
  plus custom emoji or symbol support.

### Changed

- Added action-specific icon feedback animations to the bottom quick-action
  button, with reduced-motion support.
- Improved click and double-click handling with immediate pending feedback,
  pressed states, and cancellation when settings opens.

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
