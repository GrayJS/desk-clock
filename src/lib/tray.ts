import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export type TrayGesture = "click" | "doubleClick";

const TRAY_ICON_SIZE = 32;
const TRAY_ICON_INSET = 2;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function isTauri() {
  return "__TAURI_INTERNALS__" in window;
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("invalid tray icon image"));
    image.src = source;
  });
}

export async function rasterizeTrayIcon(source: string) {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = TRAY_ICON_SIZE;
  canvas.height = TRAY_ICON_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("canvas is unavailable");

  const availableSize = TRAY_ICON_SIZE - TRAY_ICON_INSET * 2;
  const scale = Math.min(
    availableSize / image.naturalWidth,
    availableSize / image.naturalHeight,
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const x = Math.round((TRAY_ICON_SIZE - width) / 2);
  const y = Math.round((TRAY_ICON_SIZE - height) / 2);

  context.clearRect(0, 0, TRAY_ICON_SIZE, TRAY_ICON_SIZE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, x, y, width, height);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    rgba: Array.from(
      context.getImageData(0, 0, TRAY_ICON_SIZE, TRAY_ICON_SIZE).data,
    ),
    width: TRAY_ICON_SIZE,
    height: TRAY_ICON_SIZE,
  };
}

export async function prepareTrayIcon(file: File) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("unsupported tray icon format");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("tray icon is too large");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await rasterizeTrayIcon(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function setCustomTrayIcon(source: string) {
  const icon = await rasterizeTrayIcon(source);
  if (isTauri()) {
    await invoke("set_tray_icon", {
      rgba: icon.rgba,
      width: icon.width,
      height: icon.height,
    });
  }
  return icon;
}

export async function resetTrayIcon() {
  if (isTauri()) await invoke("reset_tray_icon");
}

export async function showMainWindow() {
  if (isTauri()) await invoke("show_main_window_command");
}

export async function listenForTrayGesture(
  handler: (gesture: TrayGesture) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen<TrayGesture>("morrow://tray-gesture", (event) => {
    handler(event.payload);
  });
}
