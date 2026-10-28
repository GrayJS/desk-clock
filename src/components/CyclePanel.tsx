import { Check, Pause, Play, Repeat2, SkipForward, Square, Timer } from "lucide-react";
import { useId } from "react";
import type { Translate } from "../i18n";
import {
  cycleTotalMinutes,
  normalizeCyclePlan,
  type CyclePlan,
  type CycleRun,
} from "../lib/pomodoroCycle";

type CyclePanelProps = {
  t: Translate;
  plan: CyclePlan;
  run: CycleRun | null;
  running: boolean;
  timerText: string;
  startDisabled: boolean;
  onPlanChange: (plan: CyclePlan) => void;
  onStart: () => void;
  onToggle: () => void;
  onStop: () => void;
  onSkip: () => void;
};

export default function CyclePanel({
  t, plan, run, running, timerText, startDisabled,
  onPlanChange, onStart, onToggle, onStop, onSkip,
}: CyclePanelProps) {
  const id = useId();
  const active = Boolean(run && !run.finished);
  const fields = [
    { key: "rounds", label: "cycleRounds", max: 99, unit: "cycleRoundsUnit" },
    { key: "focusMinutes", label: "cycleFocusMinutes", max: 180, unit: "minute" },
    { key: "restMinutes", label: "cycleRestMinutes", max: 180, unit: "minute" },
  ] as const;

  return (
    <section className="cycle-view" aria-label={t("cycleTab")}>
      <div className="cycle-heading">
        <span><Repeat2 size={13} /> {t("cycleEyebrow")}</span>
        <h2>{t("cycleTitle")}</h2>
        <p>{t("cycleDescription")}</p>
      </div>
      <form
        className="cycle-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (!active && !startDisabled) onStart();
        }}
      >
        <fieldset className="cycle-fields" disabled={active}>
          <legend className="sr-only">{t("cyclePlanSettings")}</legend>
          {fields.map(({ key, label, max, unit }) => (
            <label className="cycle-field" key={key} htmlFor={`${id}-${key}`}>
              <span>{t(label)}</span>
              <div>
                <input
                  id={`${id}-${key}`}
                  name={key}
                  type="number"
                  min={1}
                  max={max}
                  step={1}
                  required
                  value={plan[key] || ""}
                  onChange={(event) => onPlanChange({ ...plan, [key]: Number(event.target.value) })}
                  onBlur={() => onPlanChange(normalizeCyclePlan(plan))}
                />
                <small>{t(unit)}</small>
              </div>
              <small>1–{max}</small>
            </label>
          ))}
        </fieldset>
        <div className="cycle-estimate">
          <Timer size={13} /> {t("cycleTotalTime", { minutes: cycleTotalMinutes(plan) })}
        </div>

        {run && (
          <div className={`cycle-progress ${run.finished ? "completed" : ""}`}>
            <div className="cycle-progress-heading" role="status" aria-live="polite">
              <span>{run.finished
                ? t(run.skippedFocusRounds > 0 ? "cycleAllEnded" : "cycleAllDone")
                : t("cycleRoundProgress", { current: run.round, total: run.plan.rounds })}</span>
              <strong>{run.finished
                ? <Check size={15} />
                : t(!running ? "cyclePaused" : run.phase === "focus" ? "runningFocus" : "runningRest")}</strong>
            </div>
            {!run.finished && <b className="cycle-countdown">{timerText}</b>}
            <progress
              max={run.plan.rounds}
              value={run.processedRounds}
              aria-label={t("cycleProcessedRounds", { count: run.processedRounds, total: run.plan.rounds })}
            />
            <small>{run.skippedFocusRounds > 0
              ? t("cycleFocusSummary", { completed: run.completedRounds, skipped: run.skippedFocusRounds })
              : t("cycleCompletedRounds", { count: run.completedRounds, total: run.plan.rounds })}</small>
          </div>
        )}

        <div className="cycle-controls">
          {active ? (
            <>
              <button type="button" className="primary-control" onClick={onToggle}>
                {running ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                {t(running ? "pause" : "resumeCycle")}
              </button>
              <button type="button" className="cycle-skip" onClick={onSkip}>
                <SkipForward size={13} /> {t(run?.phase === "focus" ? "skipFocus" : "skipRest")}
              </button>
              <button type="button" className="cycle-stop" onClick={onStop}>
                <Square size={13} /> {t("stopCycle")}
              </button>
            </>
          ) : (
            <button className="primary-control" type="submit" disabled={startDisabled}>
              <Play size={16} fill="currentColor" /> {t(run?.finished ? "restartCycle" : "startCycle")}
            </button>
          )}
        </div>
        {!active && startDisabled && <p className="cycle-busy-hint">{t("cycleBusyHint")}</p>}
      </form>
      <p className="cycle-help">{t(active ? "cycleActiveHint" : "cyclePlanHint")}</p>
    </section>
  );
}
