import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function compile(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
}
const sessionUri = `data:text/javascript;base64,${Buffer.from(await compile("../src/lib/sessionRecords.ts")).toString("base64")}`;
const reportsSource = (await compile("../src/lib/reports.ts")).replace('"./sessionRecords"', JSON.stringify(sessionUri));
const { createReportArchive, addReportRecord, periodBounds, shiftPeriod, summarizeReport, reportBuckets, recordsInPeriod, localDateKey } =
  await import(`data:text/javascript;base64,${Buffer.from(reportsSource).toString("base64")}`);

const today = new Date(2026, 9, 29);
const record = (overrides = {}) => ({ id: "one", title: "Focus", note: "", mode: "focus", durationMinutes: 25, completedAt: new Date(2026, 9, 29, 10).toISOString(), ...overrides });

test("migration preserves legacy completed focus and distinguishes skipped focus/rest", () => {
  const archive = createReportArchive([
    record(), record({ id: "skip", outcome: "skipped", elapsedSeconds: 73 }),
    record({ mode: "rest", outcome: "skipped", elapsedSeconds: 17 }),
    record({ mode: "rest", outcome: "completed" }), record({ completedAt: "bad date" }),
  ], today);
  const total = summarizeReport(archive, "day", today);
  assert.deepEqual(total, { focusSeconds: 1573, completed: 1, skippedFocus: 1, skippedRest: 1, activeDays: 1, completionRate: 50 });
  assert.equal(reportBuckets(archive, "day", today)[10].focusSeconds, 1573);
});

test("weeks start on Monday and handle a year boundary with an exclusive end", () => {
  const anchor = new Date(2027, 0, 1);
  const { start, end } = periodBounds("week", anchor);
  assert.equal(localDateKey(start), "2026-12-28");
  assert.equal(localDateKey(end), "2027-01-04");
  const records = [record({ completedAt: start.toISOString() }), record({ completedAt: end.toISOString() })];
  assert.equal(recordsInPeriod(records, "week", anchor).length, 1);
});

test("month/year buckets cover leap days, zero days and all twelve months", () => {
  const leap = new Date(2024, 1, 29);
  const archive = createReportArchive([record({ completedAt: leap.toISOString() })], leap);
  const month = reportBuckets(archive, "month", leap);
  assert.equal(month.length, 29);
  assert.equal(month[0].focusSeconds, 0);
  assert.equal(month[28].focusSeconds, 1500);
  assert.equal(reportBuckets(archive, "year", leap).length, 12);
  assert.equal(reportBuckets(archive, "year", leap)[1].focusSeconds, 1500);
});

test("period navigation never rolls a long month into the wrong month", () => {
  assert.equal(localDateKey(shiftPeriod("month", new Date(2026, 0, 31), 1)), "2026-02-01");
  assert.equal(localDateKey(shiftPeriod("month", new Date(2026, 0, 31), -1)), "2025-12-01");
  assert.equal(localDateKey(shiftPeriod("year", today, -1)), "2025-01-01");
});

test("daily summaries survive the 200-detail retention limit without double counting", () => {
  let archive = createReportArchive([], today);
  for (let i = 0; i < 230; i++) archive = addReportRecord(archive, record({ id: String(i) }));
  const total = summarizeReport(archive, "year", today);
  assert.equal(total.completed, 230);
  assert.equal(total.focusSeconds, 230 * 1500);
  assert.equal(total.completionRate, 100);
});

test("empty and zero-second skipped phases do not invent time or an activity day", () => {
  let archive = createReportArchive([], today);
  assert.equal(summarizeReport(archive, "year", today).completionRate, null);
  archive = addReportRecord(archive, record({ outcome: "skipped", elapsedSeconds: 0 }));
  const total = summarizeReport(archive, "day", today);
  assert.equal(total.completionRate, 0);
  assert.equal(total.activeDays, 0);
  assert.equal(total.skippedFocus, 1);
  assert.equal(reportBuckets(archive, "day", today).length, 24);
});

test("calendar days remain complete through daylight-saving transitions", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "America/New_York";
    const spring = new Date(2026, 2, 8);
    const { start, end } = periodBounds("day", spring);
    assert.equal((end - start) / 3600000, 23);
    assert.equal(reportBuckets(createReportArchive([], spring), "week", spring).length, 7);
    assert.equal(reportBuckets(createReportArchive([], spring), "month", spring).length, 31);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
