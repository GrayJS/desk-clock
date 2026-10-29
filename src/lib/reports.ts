import type { SessionRecord } from "../types";
import { focusSecondsForRecord, isCompletedFocus } from "./sessionRecords";

export type ReportPeriod = "day" | "week" | "month" | "year";
export type ReportDay = {
  focusSeconds: number;
  completed: number;
  skippedFocus: number;
  skippedRest: number;
  hours: number[];
};
export type ReportArchive = {
  version: 1;
  startedOn: string;
  days: Record<string, ReportDay>;
};

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function emptyDay(): ReportDay {
  return { focusSeconds: 0, completed: 0, skippedFocus: 0, skippedRest: 0, hours: Array(24).fill(0) };
}

export function addReportRecord(archive: ReportArchive, record: SessionRecord): ReportArchive {
  const date = new Date(record.completedAt);
  if (!Number.isFinite(date.getTime())) return archive;
  const seconds = focusSecondsForRecord(record);
  if (!Number.isFinite(seconds) || seconds < 0) return archive;
  if (record.mode !== "focus" && record.outcome !== "skipped") return archive;
  const key = localDateKey(date);
  const previous = archive.days[key] ?? emptyDay();
  const hours = [...previous.hours];
  hours[date.getHours()] += seconds;
  return {
    ...archive,
    startedOn: key < archive.startedOn ? key : archive.startedOn,
    days: {
      ...archive.days,
      [key]: {
        focusSeconds: previous.focusSeconds + seconds,
        completed: previous.completed + Number(isCompletedFocus(record)),
        skippedFocus: previous.skippedFocus + Number(record.mode === "focus" && record.outcome === "skipped"),
        skippedRest: previous.skippedRest + Number(record.mode === "rest" && record.outcome === "skipped"),
        hours,
      },
    },
  };
}

export function createReportArchive(records: SessionRecord[], today = new Date()): ReportArchive {
  return records.reduce(addReportRecord, { version: 1, startedOn: localDateKey(today), days: {} } as ReportArchive);
}

export function reconcileReportArchive(archive: ReportArchive, records: SessionRecord[]) {
  const retained = createReportArchive(records);
  let changed = false;
  const days = { ...archive.days };
  for (const [key, known] of Object.entries(retained.days)) {
    const previous = days[key];
    if (!previous) { days[key] = known; changed = true; continue; }
    if (previous.focusSeconds >= known.focusSeconds && previous.completed >= known.completed && previous.skippedFocus >= known.skippedFocus && previous.skippedRest >= known.skippedRest) continue;
    const hours = known.hours.map((seconds, hour) => Math.max(seconds, previous.hours[hour] ?? 0));
    days[key] = { focusSeconds: hours.reduce((sum, seconds) => sum + seconds, 0), completed: Math.max(previous.completed, known.completed), skippedFocus: Math.max(previous.skippedFocus, known.skippedFocus), skippedRest: Math.max(previous.skippedRest, known.skippedRest), hours };
    changed = true;
  }
  return changed ? { ...archive, startedOn: retained.startedOn < archive.startedOn ? retained.startedOn : archive.startedOn, days } : archive;
}

export function periodBounds(period: ReportPeriod, anchor: Date) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const day = anchor.getDate();
  let start = new Date(year, month, day);
  let end = new Date(year, month, day + 1);
  if (period === "week") {
    start.setDate(day - (start.getDay() + 6) % 7);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  } else if (period === "month") {
    start = new Date(year, month, 1);
    end = new Date(year, month + 1, 1);
  } else if (period === "year") {
    start = new Date(year, 0, 1);
    end = new Date(year + 1, 0, 1);
  }
  return { start, end };
}

export function shiftPeriod(period: ReportPeriod, anchor: Date, direction: number) {
  const { start } = periodBounds(period, anchor);
  if (period === "year") return new Date(start.getFullYear() + direction, 0, 1);
  if (period === "month") return new Date(start.getFullYear(), start.getMonth() + direction, 1);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + direction * (period === "week" ? 7 : 1));
}

export function summarizeReport(archive: ReportArchive, period: ReportPeriod, anchor: Date) {
  const { start, end } = periodBounds(period, anchor);
  const startKey = localDateKey(start);
  const endKey = localDateKey(end);
  const total = { focusSeconds: 0, completed: 0, skippedFocus: 0, skippedRest: 0, activeDays: 0 };
  for (const [key, day] of Object.entries(archive.days)) {
    if (key < startKey || key >= endKey) continue;
    total.focusSeconds += day.focusSeconds;
    total.completed += day.completed;
    total.skippedFocus += day.skippedFocus;
    total.skippedRest += day.skippedRest;
    total.activeDays += Number(day.focusSeconds > 0);
  }
  const attempts = total.completed + total.skippedFocus;
  return { ...total, completionRate: attempts ? Math.round(total.completed / attempts * 100) : null };
}

export function reportBuckets(archive: ReportArchive, period: ReportPeriod, anchor: Date) {
  const { start, end } = periodBounds(period, anchor);
  if (period === "day") {
    const day = archive.days[localDateKey(start)];
    return Array.from({ length: 24 }, (_, hour) => ({
      key: String(hour).padStart(2, "0") + ":00",
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate(), hour),
      focusSeconds: day?.hours[hour] ?? 0,
    }));
  }
  const buckets: { key: string; date: Date; focusSeconds: number }[] = [];
  for (let date = start; date < end; date = period === "year"
    ? new Date(date.getFullYear(), date.getMonth() + 1, 1)
    : new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)) {
    buckets.push({
      key: localDateKey(date),
      date,
      focusSeconds: period === "year"
        ? summarizeReport(archive, "month", date).focusSeconds
        : archive.days[localDateKey(date)]?.focusSeconds ?? 0,
    });
  }
  return buckets;
}

export function recordsInPeriod(records: SessionRecord[], period: ReportPeriod, anchor: Date) {
  const { start, end } = periodBounds(period, anchor);
  return records.filter(record => {
    const date = new Date(record.completedAt);
    return date >= start && date < end;
  }).sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
}
