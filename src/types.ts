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
