import { invoke } from "@tauri-apps/api/core";
import type { TimerMode } from "../types";

function isTauri() {
  return "__TAURI_INTERNALS__" in window;
}

export async function scheduleTimerNotification(
  seconds: number,
  mode: TimerMode,
  task: string,
) {
  if (!isTauri()) return;

  const isFocus = mode === "focus";
  const title = isFocus ? "专注完成" : "休息结束";
  const body = isFocus
    ? task.trim()
      ? `“${task.trim()}”已完成，休息一下吧。`
      : "本轮专注已完成，休息一下吧。"
    : "休息时间结束，可以开始下一轮专注了。";

  await invoke("schedule_timer_notification", {
    seconds,
    title,
    body,
  });
}

export async function cancelTimerNotification() {
  if (isTauri()) await invoke("cancel_timer_notification");
}
