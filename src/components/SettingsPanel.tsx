import {
  Bell,
  Check,
  DownloadCloud,
  Languages,
  Maximize2,
  Monitor,
  Moon,
  Pin,
  RefreshCw,
  Rocket,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { Locale, MessageKey, Translate } from "../i18n";
import type {
  AutoStartStatus,
  ManualUpdateStatus,
  SizePreset,
  ThemePreference,
} from "../types";

const themeOptions: Array<{
  value: ThemePreference;
  labelKey: MessageKey;
  icon: typeof Monitor;
}> = [
  { value: "system", labelKey: "themeSystem", icon: Monitor },
  { value: "light", labelKey: "themeLight", icon: Sun },
  { value: "dark", labelKey: "themeDark", icon: Moon },
];

const sizeLabelKeys: Record<SizePreset, MessageKey> = {
  compact: "sizeCompact",
  standard: "sizeStandard",
  expanded: "sizeExpanded",
};

const localeOptions: Array<{ value: Locale; labelKey: MessageKey }> = [
  { value: "zh-CN", labelKey: "chinese" },
  { value: "en-US", labelKey: "english" },
];

type SettingsPanelProps = {
  t: Translate;
  locale: Locale;
  themePreference: ThemePreference;
  sizePreset: SizePreset;
  alwaysOnTop: boolean;
  autoStartEnabled: boolean;
  autoStartStatus: AutoStartStatus;
  autoStartSupported: boolean;
  autoStartTitle: string;
  windowsNotificationsEnabled: boolean;
  manualUpdateStatus: ManualUpdateStatus;
  updateInstalling: boolean;
  availableUpdateVersion: string | null;
  currentVersion: string;
  onClose: () => void;
  onLocaleChange: (locale: Locale) => void;
  onThemeChange: (theme: ThemePreference) => void;
  onSizeChange: (size: SizePreset) => void;
  onAlwaysOnTopChange: (enabled: boolean) => void;
  onToggleAutoStart: () => void;
  onWindowsNotificationsChange: (enabled: boolean) => void;
  onCheckForUpdates: () => void;
  onInstallUpdate: () => void;
};

export default function SettingsPanel({
  t,
  locale,
  themePreference,
  sizePreset,
  alwaysOnTop,
  autoStartEnabled,
  autoStartStatus,
  autoStartSupported,
  autoStartTitle,
  windowsNotificationsEnabled,
  manualUpdateStatus,
  updateInstalling,
  availableUpdateVersion,
  currentVersion,
  onClose,
  onLocaleChange,
  onThemeChange,
  onSizeChange,
  onAlwaysOnTopChange,
  onToggleAutoStart,
  onWindowsNotificationsChange,
  onCheckForUpdates,
  onInstallUpdate,
}: SettingsPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const autoStartBusy =
    autoStartStatus === "loading" || autoStartStatus === "saving";
  const updateBusy = manualUpdateStatus === "checking" || updateInstalling;

  useEffect(() => {
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const updateStatus = updateInstalling
    ? t("installingUpdate")
    : availableUpdateVersion
    ? t("updateAvailable", { version: availableUpdateVersion })
    : manualUpdateStatus === "checking"
      ? t("checkingForUpdates")
      : manualUpdateStatus === "current"
        ? t("updateUpToDateDescription", { version: currentVersion })
        : manualUpdateStatus === "error"
          ? t("updateCheckFailedDescription")
          : t("currentVersion", { version: currentVersion });

  return (
    <div
      className="settings-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header className="settings-header">
          <div>
            <strong id="settings-title">{t("settingsTitle")}</strong>
            <span>{t("settingsDescription")}</span>
          </div>
          <button
            ref={closeButtonRef}
            className="settings-close"
            aria-label={t("closeSettings")}
            title={t("closeSettings")}
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-group">
            <div className="settings-group-title">
              <span>{t("appearanceSettings")}</span>
            </div>

            <div className="settings-item settings-item-stack">
              <div className="settings-item-copy">
                <span className="settings-item-icon"><Monitor size={15} /></span>
                <div>
                  <strong>{t("themeTitle")}</strong>
                  <span>{t("themeDescription")}</span>
                </div>
              </div>
              <div className="settings-options settings-options-three">
                {themeOptions.map((option) => {
                  const OptionIcon = option.icon;
                  return (
                    <button
                      key={option.value}
                      className={themePreference === option.value ? "active" : ""}
                      onClick={() => onThemeChange(option.value)}
                    >
                      <OptionIcon size={13} />
                      <span>{t(option.labelKey)}</span>
                      {themePreference === option.value && <Check size={11} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="settings-item settings-item-stack">
              <div className="settings-item-copy">
                <span className="settings-item-icon"><Languages size={15} /></span>
                <div>
                  <strong>{t("language")}</strong>
                  <span>{t("languageDescription")}</span>
                </div>
              </div>
              <div className="settings-options settings-options-two">
                {localeOptions.map((option) => (
                  <button
                    key={option.value}
                    className={locale === option.value ? "active" : ""}
                    onClick={() => onLocaleChange(option.value)}
                  >
                    <span>{t(option.labelKey)}</span>
                    {locale === option.value && <Check size={11} />}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="settings-group">
            <div className="settings-group-title">
              <span>{t("windowSettings")}</span>
            </div>

            <div className="settings-item settings-item-stack">
              <div className="settings-item-copy">
                <span className="settings-item-icon"><Maximize2 size={15} /></span>
                <div>
                  <strong>{t("windowSize")}</strong>
                  <span>{t("windowSizeDescription")}</span>
                </div>
              </div>
              <div className="settings-options settings-options-three">
                {(Object.keys(sizeLabelKeys) as SizePreset[]).map((preset) => (
                  <button
                    key={preset}
                    className={sizePreset === preset ? "active" : ""}
                    onClick={() => onSizeChange(preset)}
                  >
                    <span>{t(sizeLabelKeys[preset])}</span>
                    {sizePreset === preset && <Check size={11} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-item">
              <div className="settings-item-copy">
                <span className="settings-item-icon"><Pin size={15} /></span>
                <div>
                  <strong>{t("alwaysOnTopSetting")}</strong>
                  <span>{t("alwaysOnTopDescription")}</span>
                </div>
              </div>
              <button
                className={`settings-switch ${alwaysOnTop ? "enabled" : ""}`}
                type="button"
                role="switch"
                aria-checked={alwaysOnTop}
                aria-label={t("alwaysOnTopSetting")}
                onClick={() => onAlwaysOnTopChange(!alwaysOnTop)}
              >
                <span />
              </button>
            </div>
          </section>

          <section className="settings-group">
            <div className="settings-group-title">
              <span>{t("systemSettings")}</span>
            </div>

            <div className="settings-item">
              <div className="settings-item-copy">
                <span className="settings-item-icon"><Rocket size={15} /></span>
                <div>
                  <strong>{t("autoStart")}</strong>
                  <span>{
                    autoStartStatus === "error"
                      ? t("autoStartError")
                      : t("autoStartDescription")
                  }</span>
                </div>
              </div>
              <button
                className={`settings-switch ${autoStartEnabled ? "enabled" : ""} ${
                  autoStartStatus === "error" ? "error" : ""
                }`}
                type="button"
                role="switch"
                aria-checked={autoStartEnabled}
                aria-busy={autoStartBusy}
                aria-label={autoStartTitle}
                title={autoStartTitle}
                disabled={!autoStartSupported || autoStartBusy}
                onClick={onToggleAutoStart}
              >
                <span />
              </button>
            </div>

            <div className="settings-item">
              <div className="settings-item-copy">
                <span className="settings-item-icon"><Bell size={15} /></span>
                <div>
                  <strong>{t("windowsNotifications")}</strong>
                  <span>{t("windowsNotificationsDescription")}</span>
                </div>
              </div>
              <button
                className={`settings-switch ${
                  windowsNotificationsEnabled ? "enabled" : ""
                }`}
                type="button"
                role="switch"
                aria-checked={windowsNotificationsEnabled}
                aria-label={t("windowsNotifications")}
                title={t("windowsNotificationsDescription")}
                onClick={() =>
                  onWindowsNotificationsChange(!windowsNotificationsEnabled)
                }
              >
                <span />
              </button>
            </div>

            <div className="settings-item">
              <div className="settings-item-copy">
                <span className="settings-item-icon"><DownloadCloud size={15} /></span>
                <div>
                  <strong>{t("updatesSetting")}</strong>
                  <span className={manualUpdateStatus === "error" ? "error-text" : ""}>
                    {updateStatus}
                  </span>
                </div>
              </div>
              <button
                className={`settings-action ${updateBusy ? "checking" : ""} ${
                  availableUpdateVersion ? "primary" : ""
                }`}
                disabled={updateBusy}
                onClick={availableUpdateVersion ? onInstallUpdate : onCheckForUpdates}
              >
                {availableUpdateVersion ? (
                  <DownloadCloud size={13} />
                ) : (
                  <RefreshCw size={13} />
                )}
                <span>
                  {updateInstalling
                    ? t("installingUpdate")
                    : availableUpdateVersion
                    ? t("viewUpdate")
                    : updateBusy
                      ? t("checkingForUpdates")
                      : t("manualCheckUpdate")}
                </span>
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
