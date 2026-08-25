import { invoke } from "@tauri-apps/api/core";
import type { Locale } from "../i18n";

function isTauri() {
  return "__TAURI_INTERNALS__" in window;
}

export async function scheduleTimerNotification(
  seconds: number,
  title: string,
  body: string,
) {
  if (!isTauri()) return;

  await invoke("schedule_timer_notification", {
    seconds,
    title,
    body,
  });
}

export async function cancelTimerNotification() {
  if (isTauri()) await invoke("cancel_timer_notification");
}

export async function setAppLanguage(locale: Locale) {
  if (isTauri()) await invoke("set_app_language", { locale });
}

export async function showUpdateNotification(title: string, body: string) {
  if (isTauri()) await invoke("show_update_notification", { title, body });
}

export async function openReleasePage(url: string) {
  if (isTauri()) {
    await invoke("open_release_page", { url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
