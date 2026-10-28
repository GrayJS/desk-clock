import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/pomodoroCycle.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
}).outputText;
const { startCycle, advanceCycle, normalizeCyclePlan, cyclePhaseSeconds, cycleTotalMinutes } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("a single round finishes after focus without an extra rest", () => {
  const finished = advanceCycle(startCycle({ rounds: 1, focusMinutes: 25, restMinutes: 5 }));
  assert.equal(finished.finished, true);
  assert.equal(finished.completedRounds, 1);
  assert.equal(finished.phase, "focus");
  assert.equal(cycleTotalMinutes(finished.plan), 25);
});

test("three rounds contain three focus periods and exactly two rests", () => {
  let run = startCycle({ rounds: 3, focusMinutes: 30, restMinutes: 8 });
  const phases = [];
  let seconds = 0;
  while (!run.finished) {
    phases.push(`${run.round}:${run.phase}`);
    seconds += cyclePhaseSeconds(run);
    run = advanceCycle(run);
  }
  assert.deepEqual(phases, ["1:focus", "1:rest", "2:focus", "2:rest", "3:focus"]);
  assert.equal(run.completedRounds, 3);
  assert.equal(seconds, 106 * 60);
  assert.equal(cycleTotalMinutes(run.plan), 106);
});

test("changing the editable plan cannot alter an already started run", () => {
  const plan = { rounds: 4, focusMinutes: 20, restMinutes: 5 };
  const run = startCycle(plan);
  plan.rounds = 9;
  plan.focusMinutes = 60;
  assert.deepEqual(run.plan, { rounds: 4, focusMinutes: 20, restMinutes: 5 });
});

test("finished runs cannot advance or accumulate duplicate rounds", () => {
  const finished = advanceCycle(startCycle({ rounds: 1, focusMinutes: 15, restMinutes: 5 }));
  assert.equal(advanceCycle(finished), finished);
});

test("plans bound invalid and fractional values before timing begins", () => {
  assert.deepEqual(normalizeCyclePlan({ rounds: 200, focusMinutes: -2, restMinutes: 181 }),
    { rounds: 99, focusMinutes: 1, restMinutes: 180 });
  assert.deepEqual(normalizeCyclePlan({ rounds: NaN, focusMinutes: Infinity, restMinutes: NaN }),
    { rounds: 4, focusMinutes: 25, restMinutes: 5 });
  assert.deepEqual(normalizeCyclePlan({ rounds: 2.7, focusMinutes: 25.3, restMinutes: 5.8 }),
    { rounds: 3, focusMinutes: 25, restMinutes: 6 });
});

test("skipping focus advances the plan without counting it as completed focus", () => {
  let run = advanceCycle(startCycle({ rounds: 2, focusMinutes: 25, restMinutes: 5 }), "skipped");
  assert.equal(run.phase, "rest");
  assert.equal(run.processedRounds, 1);
  assert.equal(run.completedRounds, 0);
  assert.equal(run.skippedFocusRounds, 1);
  run = advanceCycle(run, "skipped");
  assert.equal(run.phase, "focus");
  assert.equal(run.round, 2);
  assert.equal(run.completedRounds, 0);
  assert.equal(run.skippedFocusRounds, 1);
  run = advanceCycle(run);
  assert.equal(run.finished, true);
  assert.equal(run.processedRounds, 2);
  assert.equal(run.completedRounds, 1);
});

test("skipping the final focus ends the cycle without adding an extra rest", () => {
  const run = advanceCycle(startCycle({ rounds: 1, focusMinutes: 25, restMinutes: 5 }), "skipped");
  assert.equal(run.finished, true);
  assert.equal(run.phase, "focus");
  assert.equal(run.completedRounds, 0);
  assert.equal(run.skippedFocusRounds, 1);
  assert.equal(advanceCycle(run, "skipped"), run);
});
