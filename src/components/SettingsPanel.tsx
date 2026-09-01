import {
  Bell,
  Check,
  ChevronDown,
  DownloadCloud,
  ImagePlus,
  Languages,
  Maximize2,
  Monitor,
  MousePointerClick,
  Moon,
  Pin,
  RefreshCw,
  Rocket,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Locale, MessageKey, Translate } from "../i18n";
import type {
  AutoStartStatus,
  ManualUpdateStatus,
  SizePreset,
  ThemePreference,
  TrayAction,
  TrayIconMode,
  TrayIconStatus,
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

const trayActionOptions: Array<{
  value: TrayAction;
  labelKey: MessageKey;
}> = [
  { value: "toggleTimer", labelKey: "quickActionToggleTimer" },
  { value: "resetTimer", labelKey: "quickActionResetTimer" },
  { value: "nextMode", labelKey: "quickActionNextMode" },
  { value: "togglePin", labelKey: "quickActionTogglePin" },
  { value: "openSettings", labelKey: "quickActionOpenSettings" },
  { value: "none", labelKey: "quickActionNone" },
];

type TrayActionSelectProps = {
  id: string;
  label: string;
  value: TrayAction;
  open: boolean;
  t: Translate;
  onToggle: () => void;
  onChange: (value: TrayAction) => void;
};

function TrayActionSelect({
  id,
  label,
  value,
  open,
  t,
  onToggle,
  onChange,
}: TrayActionSelectProps) {
  const selected = trayActionOptions.find((option) => option.value === value)!;
  const listId = `${id}-options`;

  return (
    <div className={`settings-select ${open ? "open" : ""}`}>
      <span id={`${id}-label`} className="settings-select-label">{label}</span>
      <button
        type="button"
        className="settings-select-trigger"
        aria-label={`${label}：${t(selected.labelKey)}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
      >
        <span>{t(selected.labelKey)}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          id={listId}
          className="settings-select-menu"
          role="listbox"
          aria-labelledby={`${id}-label`}
        >
          {trayActionOptions.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onChange(option.value)}
              >
                <span>{t(option.labelKey)}</span>
                {active && <Check size={11} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  trayClickAction: TrayAction;
  trayDoubleClickAction: TrayAction;
  trayIconMode: TrayIconMode;
  trayCustomIcon: string;
  trayIconStatus: TrayIconStatus;
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
  onTrayClickActionChange: (action: TrayAction) => void;
  onTrayDoubleClickActionChange: (action: TrayAction) => void;
  onTrayIconModeChange: (mode: TrayIconMode) => void;
  onTrayIconFileChange: (file: File) => void;
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
  trayClickAction,
  trayDoubleClickAction,
  trayIconMode,
  trayCustomIcon,
  trayIconStatus,
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
  onTrayClickActionChange,
  onTrayDoubleClickActionChange,
  onTrayIconModeChange,
  onTrayIconFileChange,
  onCheckForUpdates,
  onInstallUpdate,
}: SettingsPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [openSelect, setOpenSelect] = useState<"click" | "double" | null>(null);
  const autoStartBusy =
    autoStartStatus === "loading" || autoStartStatus === "saving";
  const updateBusy = manualUpdateStatus === "checking" || updateInstalling;

  useEffect(() => {
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (openSelect) {
        setOpenSelect(null);
      } else {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, openSelect]);

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

        <div
          className="settings-body"
          onMouseDown={(event) => {
            const target = event.target as HTMLElement;
            if (!target.closest(".settings-select")) setOpenSelect(null);
          }}
        >
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
              <span>{t("traySettings")}</span>
            </div>

            <div className="settings-item settings-item-stack">
              <div className="settings-item-copy">
                <span className="settings-item-icon">
                  <MousePointerClick size={15} />
                </span>
                <div>
                  <strong>{t("trayActionTitle")}</strong>
                  <span>{t("trayActionDescription")}</span>
                </div>
              </div>
              <div className="tray-action-selects">
                <TrayActionSelect
                  id="tray-click-action"
                  label={t("trayClickAction")}
                  value={trayClickAction}
                  open={openSelect === "click"}
                  t={t}
                  onToggle={() =>
                    setOpenSelect((current) =>
                      current === "click" ? null : "click",
                    )
                  }
                  onChange={(action) => {
                    onTrayClickActionChange(action);
                    setOpenSelect(null);
                  }}
                />
                <TrayActionSelect
                  id="tray-double-click-action"
                  label={t("trayDoubleClickAction")}
                  value={trayDoubleClickAction}
                  open={openSelect === "double"}
                  t={t}
                  onToggle={() =>
                    setOpenSelect((current) =>
                      current === "double" ? null : "double",
                    )
                  }
                  onChange={(action) => {
                    onTrayDoubleClickActionChange(action);
                    setOpenSelect(null);
                  }}
                />
              </div>
              <div className="tray-icon-editor">
                <span className="tray-icon-editor-title">{t("trayIconTitle")}</span>
                <div className="settings-options settings-options-two tray-icon-modes">
                  <button
                    type="button"
                    className={trayIconMode === "default" ? "active" : ""}
                    aria-pressed={trayIconMode === "default"}
                    onClick={() => onTrayIconModeChange("default")}
                  >
                    <Monitor size={12} />
                    <span>{t("trayIconDefault")}</span>
                  </button>
                  <button
                    type="button"
                    className={trayIconMode === "custom" ? "active" : ""}
                    aria-pressed={trayIconMode === "custom"}
                    onClick={() => onTrayIconModeChange("custom")}
                  >
                    <ImagePlus size={12} />
                    <span>{t("trayIconCustom")}</span>
                  </button>
                </div>
                {trayIconMode === "custom" && (
                  <label className="tray-icon-upload">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      aria-label={t("trayIconChooseFile")}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onTrayIconFileChange(file);
                        event.target.value = "";
                      }}
                    />
                    <span className="tray-icon-preview" aria-hidden="true">
                      {trayCustomIcon ? (
                        <img src={trayCustomIcon} alt="" />
                      ) : (
                        <ImagePlus size={16} />
                      )}
                    </span>
                    <span className="tray-icon-upload-copy">
                      <strong>
                        {t(trayCustomIcon ? "trayIconReplace" : "trayIconChooseFile")}
                      </strong>
                      <small>{t("trayIconFileHint")}</small>
                    </span>
                  </label>
                )}
                {trayIconStatus === "applying" && (
                  <small className="tray-icon-status">{t("trayIconApplying")}</small>
                )}
                {trayIconStatus === "error" && (
                  <small className="tray-icon-status error-text">
                    {t("trayIconError")}
                  </small>
                )}
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
