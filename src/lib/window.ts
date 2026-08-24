import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SizePreset } from "../types";

const sizes: Record<SizePreset, [number, number]> = {
  compact: [360, 210],
  standard: [420, 560],
  expanded: [720, 520],
};

function isTauri() {
  return "__TAURI_INTERNALS__" in window;
}

export async function setAlwaysOnTop(enabled: boolean) {
  if (isTauri()) await getCurrentWindow().setAlwaysOnTop(enabled);
}

export async function setWindowSize(preset: SizePreset) {
  if (!isTauri()) return;
  const [width, height] = sizes[preset];
  const appWindow = getCurrentWindow();
  await appWindow.setSize(new LogicalSize(width, height));
  await appWindow.center();
}

export async function minimizeWindow() {
  if (isTauri()) await getCurrentWindow().minimize();
}

export async function closeWindow() {
  if (isTauri()) await getCurrentWindow().close();
}
