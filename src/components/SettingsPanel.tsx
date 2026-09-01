import {
  Bell,
  Check,
  DownloadCloud,
  Languages,
  Leaf,
  Maximize2,
  Monitor,
  MousePointerClick,
  Moon,
  Pin,
  Pencil,
  Play,
  RefreshCw,
  Rocket,
  Sun,
  Target,
  Timer,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { Locale, MessageKey, Translate } from "../i18n";
import type {
  AutoStartStatus,
  ManualUpdateStatus,
  QuickAction,
  QuickIconPreference,
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

const quickActionOptions: Array<{
  value: QuickAction;
  labelKey: MessageKey;
}> = [
  { value: "toggleTimer", labelKey: "quickActionToggleTimer" },
  { value: "resetTimer", labelKey: "quickActionResetTimer" },
  { value: "nextMode", labelKey: "quickActionNextMode" },
  { value: "togglePin", labelKey: "quickActionTogglePin" },
  { value: "openSettings", labelKey: "quickActionOpenSettings" },
  { value: "none", labelKey: "quickActionNone" },
];

const quickIconOptions: Array<{
  value: QuickIconPreference;
  labelKey: MessageKey;
  icon: typeof Monitor;
}> = [
  { value: "auto", labelKey: "quickIconAuto", icon: MousePointerClick },
  { value: "play", labelKey: "quickIconPlay", icon: Play },
  { value: "bolt", labelKey: "quickIconBolt", icon: Zap },
  { value: "timer", labelKey: "quickIconTimer", icon: Timer },
  { value: "target", labelKey: "quickIconTarget", icon: Target },
  { value: "leaf", labelKey: "quickIconLeaf", icon: Leaf },
  { value: "custom", labelKey: "quickIconCustom", icon: Pencil },
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
  quickClickAction: QuickAction;
  quickDoubleClickAction: QuickAction;
  quickIconPreference: QuickIconPreference;
  quickCustomIcon: string;
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
  onQuickClickActionChange: (action: QuickAction) => void;
  onQuickDoubleClickActionChange: (action: QuickAction) => void;
  onQuickIconPreferenceChange: (icon: QuickIconPreference) => void;
  onQuickCustomIconChange: (icon: string) => void;
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
  quickClickAction,
  quickDoubleClickAction,
  quickIconPreference,
  quickCustomIcon,
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
  onQuickClickActionChange,
  onQuickDoubleClickActionChange,
  onQuickIconPreferenceChange,
  onQuickCustomIconChange,
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
              <span>{t("quickBarSettings")}</span>
            </div>

            <div className="settings-item settings-item-stack">
              <div className="settings-item-copy">
                <span className="settings-item-icon">
                  <MousePointerClick size={15} />
                </span>
                <div>
                  <strong>{t("quickBarTitle")}</strong>
                  <span>{t("quickBarDescription")}</span>
                </div>
              </div>
              <div className="quick-action-selects">
                <label>
                  <span>{t("quickClickAction")}</span>
                  <select
                    value={quickClickAction}
                    aria-label={t("quickClickAction")}
                    onChange={(event) =>
                      onQuickClickActionChange(event.target.value as QuickAction)
                    }
                  >
                    {quickActionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t("quickDoubleClickAction")}</span>
                  <select
                    value={quickDoubleClickAction}
                    aria-label={t("quickDoubleClickAction")}
                    onChange={(event) =>
                      onQuickDoubleClickActionChange(
                        event.target.value as QuickAction,
                      )
                    }
                  >
                    {quickActionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="quick-icon-editor">
                <span className="quick-icon-editor-title">
                  {t("quickIconTitle")}
                </span>
                <div className="quick-icon-options">
                  {quickIconOptions.map((option) => {
                    const Icon = option.icon;
                    const active = quickIconPreference === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={active ? "active" : ""}
                        aria-label={t(option.labelKey)}
                        aria-pressed={active}
                        title={t(option.labelKey)}
                        onClick={() => onQuickIconPreferenceChange(option.value)}
                      >
                        <Icon size={12} />
                        <span>{t(option.labelKey)}</span>
                      </button>
                    );
                  })}
                </div>
                {quickIconPreference === "custom" && (
                  <label className="quick-custom-icon-input">
                    <span>{t("quickCustomIconLabel")}</span>
                    <input
                      value={quickCustomIcon}
                      maxLength={8}
                      aria-label={t("quickCustomIconLabel")}
                      placeholder={t("quickCustomIconPlaceholder")}
                      onChange={(event) =>
                        onQuickCustomIconChange(event.target.value)
                      }
                    />
                    <b aria-hidden="true">
                      {quickCustomIcon.trim() || "★"}
                    </b>
                  </label>
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
