import type { TimerMode } from "../types";

export type CyclePlan = {
  rounds: number;
  focusMinutes: number;
  restMinutes: number;
};

export type CycleRun = {
  plan: CyclePlan;
  round: number;
  completedRounds: number;
  phase: TimerMode;
  finished: boolean;
};

function boundedInteger(value: number, fallback: number, maximum: number) {
  return Number.isFinite(value)
    ? Math.min(maximum, Math.max(1, Math.round(value)))
    : fallback;
}

export function normalizeCyclePlan(plan: CyclePlan): CyclePlan {
  return {
    rounds: boundedInteger(plan.rounds, 4, 99),
    focusMinutes: boundedInteger(plan.focusMinutes, 25, 180),
    restMinutes: boundedInteger(plan.restMinutes, 5, 180),
  };
}

export function startCycle(plan: CyclePlan): CycleRun {
  return {
    plan: normalizeCyclePlan(plan),
    round: 1,
    completedRounds: 0,
    phase: "focus",
    finished: false,
  };
}

export function advanceCycle(run: CycleRun): CycleRun {
  if (run.finished) return run;
  if (run.phase === "rest") {
    return { ...run, round: run.round + 1, phase: "focus" };
  }
  const completedRounds = run.round;
  return completedRounds === run.plan.rounds
    ? { ...run, completedRounds, finished: true }
    : { ...run, completedRounds, phase: "rest" };
}

export function cyclePhaseSeconds(run: CycleRun) {
  return (run.phase === "focus"
    ? run.plan.focusMinutes
    : run.plan.restMinutes) * 60;
}

export function cycleTotalMinutes(plan: CyclePlan) {
  const safePlan = normalizeCyclePlan(plan);
  return safePlan.rounds * safePlan.focusMinutes
    + (safePlan.rounds - 1) * safePlan.restMinutes;
}
