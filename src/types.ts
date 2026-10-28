export type TimerMode = "focus" | "rest";
export type SessionOutcome = "completed" | "skipped";

export type SessionRecord = {
  id: string;
  title: string;
  note: string;
  mode: TimerMode;
  durationMinutes: number;
  completedAt: string;
  outcome?: SessionOutcome;
  elapsedSeconds?: number;
};

export type SizePreset = "compact" | "standard" | "expanded";

export type ThemePreference = "system" | "light" | "dark";

export type ManualUpdateStatus = "idle" | "checking" | "current" | "error";

export type AutoStartStatus = "loading" | "ready" | "saving" | "error";

export type TrayAction =
  | "showWindow"
  | "toggleTimer"
  | "resetTimer"
  | "nextMode"
  | "togglePin"
  | "openSettings"
  | "none";

export type TrayIconMode = "default" | "custom";

export type TrayIconStatus = "idle" | "applying" | "ready" | "error";
