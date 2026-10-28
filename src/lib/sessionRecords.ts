import type { SessionRecord } from "../types";

export function elapsedSessionSeconds(
  totalSeconds: number,
  remainingSeconds: number,
  deadline: number | null,
  now: number,
) {
  const remaining = deadline === null
    ? remainingSeconds
    : Math.ceil((deadline - now) / 1000);
  return Math.min(totalSeconds, Math.max(0, Math.floor(totalSeconds - remaining)));
}

export function isCompletedFocus(record: SessionRecord) {
  // Records created before outcomes were introduced are completed focus sessions.
  return record.mode === "focus" && record.outcome !== "skipped";
}

export function focusSecondsForRecord(record: SessionRecord) {
  if (record.mode !== "focus") return 0;
  return record.outcome === "skipped"
    ? Math.max(0, record.elapsedSeconds ?? 0)
    : record.durationMinutes * 60;
}
