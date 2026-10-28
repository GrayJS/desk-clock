import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/sessionRecords.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
}).outputText;
const { elapsedSessionSeconds, isCompletedFocus, focusSecondsForRecord } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const legacyRecord = {
  id: "legacy", title: "Focus", note: "", mode: "focus",
  durationMinutes: 25, completedAt: "2026-10-29T00:00:00.000Z",
};

test("old records keep their completed-focus count and planned duration", () => {
  assert.equal(isCompletedFocus(legacyRecord), true);
  assert.equal(focusSecondsForRecord(legacyRecord), 25 * 60);
});

test("skipped focus contributes only its actual elapsed time, not a completed round", () => {
  const skipped = { ...legacyRecord, outcome: "skipped", elapsedSeconds: 73 };
  assert.equal(isCompletedFocus(skipped), false);
  assert.equal(focusSecondsForRecord(skipped), 73);
  assert.equal(focusSecondsForRecord({ ...skipped, elapsedSeconds: undefined }), 0);
});

test("skipped rests never inflate focus time or tomato counts", () => {
  const rest = { ...legacyRecord, mode: "rest", outcome: "skipped", elapsedSeconds: 90 };
  assert.equal(isCompletedFocus(rest), false);
  assert.equal(focusSecondsForRecord(rest), 0);
});

test("elapsed time uses the live deadline while running and stored remaining time while paused", () => {
  assert.equal(elapsedSessionSeconds(1500, 1500, 1500000, 73000), 73);
  assert.equal(elapsedSessionSeconds(1500, 1427, null, 9999999), 73);
  assert.equal(elapsedSessionSeconds(1500, 0, 1000, 9999999), 1500);
  assert.equal(elapsedSessionSeconds(1500, 1501, null, 0), 0);
});
