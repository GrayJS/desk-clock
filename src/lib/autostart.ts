import {
  disable,
  enable,
  isEnabled,
} from "@tauri-apps/plugin-autostart";

export function supportsAutoStart() {
  return "__TAURI_INTERNALS__" in window;
}

export async function getAutoStartEnabled() {
  return supportsAutoStart() ? isEnabled() : false;
}

export async function setAutoStartEnabled(enabled: boolean) {
  if (!supportsAutoStart()) return;
  await (enabled ? enable() : disable());
}
