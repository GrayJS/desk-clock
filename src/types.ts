export type TimerMode = "focus" | "short" | "long";

export type SessionRecord = {
  id: string;
  title: string;
  note: string;
  mode: TimerMode;
  durationMinutes: number;
  completedAt: string;
};

export type SizePreset = "compact" | "standard" | "expanded";

export type ThemePreference = "system" | "light" | "dark";

export type ManualUpdateStatus = "idle" | "checking" | "current" | "error";

export type AutoStartStatus = "loading" | "ready" | "saving" | "error";

export type QuickAction =
  | "toggleTimer"
  | "resetTimer"
  | "nextMode"
  | "togglePin"
  | "openSettings"
  | "none";

export type QuickIconPreference =
  | "auto"
  | "play"
  | "bolt"
  | "timer"
  | "target"
  | "leaf"
  | "custom";
