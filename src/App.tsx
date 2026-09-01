import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  DownloadCloud,
  History,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Pin,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  Sparkles,
  Sprout,
  Square,
  Timer,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useClock } from "./hooks/useClock";
import { usePersistentState } from "./hooks/usePersistentState";
import SettingsPanel from "./components/SettingsPanel";
import {
  createTranslator,
  getSystemLocale,
  type Locale,
  type MessageKey,
} from "./i18n";
import {
  getAutoStartEnabled,
  setAutoStartEnabled,
  supportsAutoStart,
} from "./lib/autostart";
import {
  cancelTimerNotification,
  openReleasePage,
  scheduleTimerNotification,
  setAppLanguage,
} from "./lib/background";
import {
  checkForUpdate,
  CURRENT_VERSION,
  UPDATE_CHECK_INTERVAL_MS,
  type AvailableUpdate,
} from "./lib/updater";
import {
  listenForTrayGesture,
  prepareTrayIcon,
  resetTrayIcon,
  setCustomTrayIcon,
  showMainWindow,
} from "./lib/tray";
import {
  closeWindow,
  minimizeWindow,
  setAlwaysOnTop,
  setWindowSize,
  startWindowDragging,
} from "./lib/window";
import type {
  AutoStartStatus,
  ManualUpdateStatus,
  SessionRecord,
  SizePreset,
  ThemePreference,
  TimerMode,
  TrayAction,
  TrayIconMode,
  TrayIconStatus,
} from "./types";

const FocusTree = lazy(() => import("./components/FocusTree"));

const modeLabelKeys: Record<TimerMode, MessageKey> = {
  focus: "modeFocus",
  short: "modeShort",
  long: "modeLong",
};

const runningLabelKeys: Record<TimerMode, MessageKey> = {
  focus: "runningFocus",
  short: "runningShort",
  long: "runningLong",
};

const startLabelKeys: Record<TimerMode, MessageKey> = {
  focus: "startFocus",
  short: "startShort",
  long: "startLong",
};

const defaultDurations: Record<TimerMode, number> = {
  focus: 25,
  short: 5,
  long: 15,
};

const sizePresetOrder: SizePreset[] = ["compact", "standard", "expanded"];

const timerModeOrder: TimerMode[] = ["focus", "short", "long"];

const sizeLabelKeys: Record<SizePreset, MessageKey> = {
  compact: "sizeCompact",
  standard: "sizeStandard",
  expanded: "sizeExpanded",
};

const durationPresets: Record<TimerMode, number[]> = {
  focus: [15, 25, 45, 60],
  short: [5, 10, 15],
  long: [15, 20, 30],
};

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function formatTimer(seconds: number) {
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

function sameLocalDay(iso: string, date = new Date()) {
  const target = new Date(iso);
  return (
    target.getFullYear() === date.getFullYear() &&
    target.getMonth() === date.getMonth() &&
    target.getDate() === date.getDate()
  );
}

function playCompletionTone() {
  try {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.7);
    gain.connect(context.destination);
    [523.25, 659.25].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.16);
      oscillator.stop(context.currentTime + 0.55 + index * 0.16);
    });
  } catch {
    // Audio is a progressive enhancement and may be unavailable in WebView.
  }
}

export default function App() {
  const now = useClock();
  const [mode, setMode] = useState<TimerMode>("focus");
  const [durations, setDurations] = usePersistentState<Record<TimerMode, number>>(
    "morrow.durations",
    defaultDurations,
  );
  const [remaining, setRemaining] = useState(defaultDurations.focus * 60);
  const [running, setRunning] = useState(false);
  const [task, setTask] = usePersistentState("morrow.currentTask", "");
  const [sessionNote, setSessionNote] = useState("");
  const [records, setRecords] = usePersistentState<SessionRecord[]>(
    "morrow.sessions",
    [],
  );
  const [activeView, setActiveView] = useState<"timer" | "tree" | "history">(
    "timer",
  );
  const [alwaysOnTop, setPinned] = usePersistentState("morrow.pinned", true);
  const [sizePreset, setSizePreset] =
    usePersistentState<SizePreset>("morrow.size", "standard");
  const [locale, setLocale] = usePersistentState<Locale>(
    "morrow.locale",
    getSystemLocale(),
  );
  const [themePreference, setThemePreference] = usePersistentState<ThemePreference>(
    "morrow.theme",
    "system",
  );
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [durationMenuOpen, setDurationMenuOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(defaultDurations.focus);
  const [availableUpdate, setAvailableUpdate] =
    useState<AvailableUpdate | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [manualUpdateStatus, setManualUpdateStatus] =
    useState<ManualUpdateStatus>("idle");
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [autoStartEnabled, setAutoStartEnabledState] = useState(false);
  const [autoStartStatus, setAutoStartStatus] =
    useState<AutoStartStatus>("loading");
  const [windowsNotificationsEnabled, setWindowsNotificationsEnabled] =
    usePersistentState("morrow.windowsNotifications", true);
  const [trayClickAction, setTrayClickAction] =
    usePersistentState<TrayAction>("morrow.trayClickAction", "toggleTimer");
  const [trayDoubleClickAction, setTrayDoubleClickAction] =
    usePersistentState<TrayAction>(
      "morrow.trayDoubleClickAction",
      "openSettings",
    );
  const [trayIconMode, setTrayIconMode] =
    usePersistentState<TrayIconMode>("morrow.trayIconMode", "default");
  const [trayCustomIcon, setTrayCustomIcon] = usePersistentState(
    "morrow.trayCustomIcon",
    "",
  );
  const [trayIconStatus, setTrayIconStatus] =
    useState<TrayIconStatus>("idle");
  const completingRef = useRef(false);
  const lastUpdateCheckRef = useRef(0);
  const updateDismissedUntilRef = useRef(0);
  const updateInstallRef = useRef(false);
  const manualUpdateTimerRef = useRef<number | null>(null);
  const trayActionHandlerRef = useRef<(action: TrayAction) => void>(() => {});
  const trayActionsRef = useRef({
    click: trayClickAction,
    doubleClick: trayDoubleClickAction,
  });
  trayActionsRef.current = {
    click: trayClickAction,
    doubleClick: trayDoubleClickAction,
  };
  const t = useMemo(() => createTranslator(locale), [locale]);

  const currentMinutes = durations[mode] ?? defaultDurations[mode];
  const totalSeconds = currentMinutes * 60;
  const theme = themePreference === "system" ? systemTheme : themePreference;
  const progress = Math.min(1, Math.max(0, 1 - remaining / totalSeconds));
  const circumference = 2 * Math.PI * 76;

  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const todayRecords = useMemo(
    () => records.filter((record) => sameLocalDay(record.completedAt)),
    [records, todayKey],
  );
  const todayMinutes = todayRecords.reduce(
    (sum, record) => sum + record.durationMinutes,
    0,
  );
  const todayTomatoes = todayRecords.length;
  const tomatoGrowthProgress = mode === "focus" ? progress : 0;
  const remainingFocusMinutes = mode === "focus" ? remaining / 60 : currentMinutes;
  const isTomatoGrowing = mode === "focus" && remaining < totalSeconds;
  const timerBusy = remaining < totalSeconds;

  const finishSession = useCallback(() => {
    if (completingRef.current) return;
    completingRef.current = true;
    setRunning(false);
    playCompletionTone();

    if (mode === "focus") {
      const newRecord: SessionRecord = {
        id: crypto.randomUUID(),
        title: task.trim() || t("unnamedFocus"),
        note: sessionNote.trim(),
        mode,
        durationMinutes: currentMinutes,
        completedAt: new Date().toISOString(),
      };
      setRecords((current) => [newRecord, ...current].slice(0, 200));
      setSessionNote("");
      setMode("short");
      setRemaining((durations.short ?? defaultDurations.short) * 60);
    } else {
      setMode("focus");
      setRemaining((durations.focus ?? defaultDurations.focus) * 60);
    }

    window.setTimeout(() => {
      completingRef.current = false;
    }, 300);
  }, [currentMinutes, durations, mode, sessionNote, setRecords, t, task]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          window.setTimeout(finishSession, 0);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finishSession, running]);

  useEffect(() => {
    void setAlwaysOnTop(alwaysOnTop);
  }, [alwaysOnTop]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = (event: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };
    updateSystemTheme(media);
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t("appTitle");
    void setAppLanguage(locale);
  }, [locale, t]);

  useEffect(() => {
    let active = true;
    void getAutoStartEnabled()
      .then((enabled) => {
        if (!active) return;
        setAutoStartEnabledState(enabled);
        setAutoStartStatus("ready");
      })
      .catch(() => {
        if (active) setAutoStartStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const installUpdate = useCallback(
    async (update: AvailableUpdate, openFallback = false) => {
      if (!update.installSilently) {
        if (openFallback) await openReleasePage(update.releaseUrl);
        return false;
      }
      if (updateInstallRef.current) return false;

      updateInstallRef.current = true;
      setUpdateInstalling(true);
      try {
        await update.installSilently();
        return true;
      } catch {
        if (openFallback) await openReleasePage(update.releaseUrl);
        return false;
      } finally {
        updateInstallRef.current = false;
        setUpdateInstalling(false);
      }
    },
    [],
  );

  const runUpdateCheck = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const update = await checkForUpdate(signal);
        lastUpdateCheckRef.current = Date.now();
        if (!update) {
          setAvailableUpdate(null);
          return "current" as const;
        }

        setAvailableUpdate(update);
        if (Date.now() >= updateDismissedUntilRef.current) {
          setUpdateDismissed(false);
        }
        return "available" as const;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return "aborted" as const;
        }
        // Update checks are best-effort and must not interrupt offline use.
        return "error" as const;
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    const check = () => void runUpdateCheck(controller.signal);
    const startupTimer = window.setTimeout(check, 2500);
    const interval = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS);
    const checkWhenVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastUpdateCheckRef.current >= UPDATE_CHECK_INTERVAL_MS
      ) {
        check();
      }
    };
    document.addEventListener("visibilitychange", checkWhenVisible);
    return () => {
      controller.abort();
      window.clearTimeout(startupTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [runUpdateCheck]);

  useEffect(
    () => () => {
      if (manualUpdateTimerRef.current !== null) {
        window.clearTimeout(manualUpdateTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const syncTrayIcon = async () => {
      setTrayIconStatus("applying");
      try {
        if (trayIconMode === "custom" && trayCustomIcon) {
          await setCustomTrayIcon(trayCustomIcon);
        } else {
          await resetTrayIcon();
        }
        if (!cancelled) setTrayIconStatus("ready");
      } catch {
        if (!cancelled) setTrayIconStatus("error");
      }
    };
    void syncTrayIcon();
    return () => {
      cancelled = true;
    };
  }, [trayCustomIcon, trayIconMode]);

  const switchMode = (nextMode: TimerMode) => {
    void cancelTimerNotification();
    setRunning(false);
    setMode(nextMode);
    const nextMinutes = durations[nextMode] ?? defaultDurations[nextMode];
    setRemaining(nextMinutes * 60);
    setCustomMinutes(nextMinutes);
    setDurationMenuOpen(false);
  };

  const resetTimer = () => {
    void cancelTimerNotification();
    setRunning(false);
    setRemaining(totalSeconds);
  };

  const scheduleCurrentTimerNotification = (seconds: number) => {
    const isFocus = mode === "focus";
    const title = t(isFocus ? "notificationFocusTitle" : "notificationRestTitle");
    const body = isFocus
      ? task.trim()
        ? t("notificationFocusTask", { task: task.trim() })
        : t("notificationFocus")
      : t("notificationRest");
    void scheduleTimerNotification(seconds, title, body);
  };

  const toggleTimer = () => {
    if (running) {
      void cancelTimerNotification();
      setRunning(false);
      return;
    }

    if (windowsNotificationsEnabled) {
      scheduleCurrentTimerNotification(remaining);
    }
    setRunning(true);
  };

  const completeManually = () => {
    void cancelTimerNotification();
    finishSession();
  };

  const openDurationMenu = () => {
    setCustomMinutes(currentMinutes);
    setDurationMenuOpen((value) => !value);
    setSettingsOpen(false);
  };

  const applyDuration = (minutes: number) => {
    const safeMinutes = Math.min(180, Math.max(1, Math.round(minutes || 1)));
    void cancelTimerNotification();
    setRunning(false);
    setDurations((current) => ({ ...current, [mode]: safeMinutes }));
    setRemaining(safeMinutes * 60);
    setCustomMinutes(safeMinutes);
    setDurationMenuOpen(false);
  };

  const applySize = async (preset: SizePreset) => {
    setSizePreset(preset);
    await setWindowSize(preset);
  };

  const nextSizePreset =
    sizePresetOrder[
      (sizePresetOrder.indexOf(sizePreset) + 1) % sizePresetOrder.length
    ];

  const cycleWindowSize = () => void applySize(nextSizePreset);

  const selectTheme = (preference: ThemePreference) => {
    setThemePreference(preference);
  };

  const selectLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
  };

  const dismissUpdate = () => {
    updateDismissedUntilRef.current = Date.now() + UPDATE_CHECK_INTERVAL_MS;
    setUpdateDismissed(true);
  };

  const showManualUpdateStatus = (status: ManualUpdateStatus) => {
    if (manualUpdateTimerRef.current !== null) {
      window.clearTimeout(manualUpdateTimerRef.current);
    }
    setManualUpdateStatus(status);
    if (status === "current" || status === "error") {
      manualUpdateTimerRef.current = window.setTimeout(() => {
        setManualUpdateStatus("idle");
        manualUpdateTimerRef.current = null;
      }, 3600);
    }
  };

  const manuallyCheckForUpdates = async () => {
    if (manualUpdateStatus === "checking") return;
    showManualUpdateStatus("checking");
    updateDismissedUntilRef.current = 0;
    setUpdateDismissed(false);
    const result = await runUpdateCheck();
    if (result === "available") {
      showManualUpdateStatus("idle");
      return;
    }
    if (result === "current") {
      setAvailableUpdate(null);
      showManualUpdateStatus("current");
      return;
    }
    if (result === "error") showManualUpdateStatus("error");
  };

  const toggleAutoStart = async () => {
    if (autoStartStatus === "loading" || autoStartStatus === "saving") return;
    const nextEnabled = !autoStartEnabled;
    setAutoStartStatus("saving");
    try {
      await setAutoStartEnabled(nextEnabled);
      setAutoStartEnabledState(await getAutoStartEnabled());
      setAutoStartStatus("ready");
    } catch {
      setAutoStartStatus("error");
    }
  };

  const changeWindowsNotifications = (enabled: boolean) => {
    setWindowsNotificationsEnabled(enabled);
    if (!enabled) {
      void cancelTimerNotification();
    } else if (running) {
      scheduleCurrentTimerNotification(remaining);
    }
  };

  const runTrayAction = (action: TrayAction) => {
    switch (action) {
      case "toggleTimer":
        toggleTimer();
        break;
      case "resetTimer":
        resetTimer();
        break;
      case "nextMode": {
        const nextMode =
          timerModeOrder[
            (timerModeOrder.indexOf(mode) + 1) % timerModeOrder.length
          ];
        switchMode(nextMode);
        break;
      }
      case "togglePin":
        setPinned((current) => !current);
        break;
      case "openSettings":
        void showMainWindow();
        setDurationMenuOpen(false);
        setSettingsOpen(true);
        break;
      case "none":
        break;
    }
  };

  trayActionHandlerRef.current = runTrayAction;

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenForTrayGesture((gesture) => {
      const action = trayActionsRef.current[gesture];
      trayActionHandlerRef.current(action);
    }).then((dispose) => {
      if (disposed) {
        dispose();
      } else {
        unlisten = dispose;
      }
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const changeTrayIconFile = async (file: File) => {
    setTrayIconStatus("applying");
    try {
      const icon = await prepareTrayIcon(file);
      setTrayCustomIcon(icon.dataUrl);
      setTrayIconMode("custom");
    } catch {
      setTrayIconStatus("error");
    }
  };

  const changeTrayIconMode = (mode: TrayIconMode) => {
    setTrayIconMode(mode);
    if (mode === "default") setTrayIconStatus("applying");
  };

  const autoStartTitle = t(
    autoStartStatus === "loading"
      ? "autoStartLoading"
      : autoStartStatus === "saving"
        ? "autoStartSaving"
        : autoStartStatus === "error"
          ? "autoStartError"
          : autoStartEnabled
            ? "autoStartEnabled"
            : "autoStartDisabled",
  );

  const timeText = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const secondsText = pad(now.getSeconds());
  const dateText = new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);
  const SizeButtonIcon =
    sizePreset === "compact"
      ? Minimize2
      : sizePreset === "expanded"
        ? Maximize2
        : Square;
  const quickResizeTitle = t("quickResizeTitle", {
    current: t(sizeLabelKeys[sizePreset]),
    next: t(sizeLabelKeys[nextSizePreset]),
  });
  return (
    <main
      className={`app-shell size-${sizePreset} ${running ? "is-running" : ""}`}
      data-theme={theme}
      data-theme-preference={themePreference}
      data-locale={locale}
    >
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header
        className="titlebar"
        onMouseDown={(event) => {
          const target = event.target as HTMLElement;
          if (event.button === 0 && !target.closest("button")) {
            void startWindowDragging();
          }
        }}
      >
        <div className="brand">
          <span className="brand-mark"><Sparkles size={13} /></span>
          <span>Morrow</span>
        </div>
        <div className="window-actions">
          <button
            className={`icon-button settings-button ${
              settingsOpen ? "menu-active" : ""
            } ${availableUpdate ? "has-update" : ""}`}
            aria-label={t("settingsTitle")}
            aria-expanded={settingsOpen}
            title={t("settingsTitle")}
            onClick={() => {
              setSettingsOpen((value) => !value);
              setDurationMenuOpen(false);
            }}
          >
            <Settings2 size={14} />
          </button>
          <button
            className="icon-button quick-size-button"
            aria-label={quickResizeTitle}
            title={quickResizeTitle}
            onClick={cycleWindowSize}
          >
            <SizeButtonIcon size={14} />
          </button>
          <button
            className={`icon-button pin-button ${alwaysOnTop ? "active" : ""}`}
            aria-label={alwaysOnTop ? t("pinDisable") : t("pinEnable")}
            title={alwaysOnTop ? t("pinned") : t("pin")}
            onClick={() => setPinned((value) => !value)}
          >
            <Pin size={14} fill={alwaysOnTop ? "currentColor" : "none"} />
          </button>
          <button className="icon-button" aria-label={t("minimizeToTray")} title={t("minimizeToTray")} onClick={() => void minimizeWindow()}>
            <Minus size={14} />
          </button>
          <button className="icon-button close-button" aria-label={t("closeToTray")} title={t("closeToTray")} onClick={() => void closeWindow()}>
            <X size={14} />
          </button>
        </div>
      </header>

      <section className="clock-strip">
        <div>
          <div className="clock-time">
            {timeText}<span>{secondsText}</span>
          </div>
          <div className="clock-date">{dateText}</div>
        </div>
        <div className="today-stat">
          <span>{t("todayFocus")}</span>
          <strong>{todayMinutes}<small> {t("minute")}</small></strong>
        </div>
      </section>

      <section className="compact-timer" aria-label={t("compactTimer")}>
        <div className="compact-timer-main">
          <div className="compact-countdown">
            <span>
              {running ? t(runningLabelKeys[mode]) : t(modeLabelKeys[mode])}
            </span>
            <strong>{formatTimer(remaining)}</strong>
          </div>
          <div className="compact-timer-controls">
            <button
              className="compact-reset"
              aria-label={t("resetTimer")}
              title={t("resetTimer")}
              onClick={resetTimer}
            >
              <RotateCcw size={15} />
            </button>
            <button
              className="compact-toggle"
              aria-label={running ? t("pause") : t(startLabelKeys[mode])}
              title={running ? t("pause") : t(startLabelKeys[mode])}
              onClick={toggleTimer}
            >
              {running ? (
                <Pause size={17} fill="currentColor" />
              ) : (
                <Play size={17} fill="currentColor" />
              )}
            </button>
          </div>
        </div>
        <div className="compact-progress" aria-hidden="true">
          <span style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="compact-mode-switcher">
          {(Object.keys(modeLabelKeys) as TimerMode[]).map((item) => (
            <button
              key={item}
              className={mode === item ? "active" : ""}
              onClick={() => switchMode(item)}
            >
              {t(modeLabelKeys[item])}
            </button>
          ))}
        </div>
      </section>

      <nav className="view-tabs">
        <button className={activeView === "timer" ? "active" : ""} onClick={() => setActiveView("timer")}>
          <TimerReset size={15} /> {t("timerTab")}
        </button>
        <button className={activeView === "tree" ? "active" : ""} onClick={() => setActiveView("tree")}>
          <Sprout size={15} /> {t("treeTab")} <span className="count-badge tomato-badge">{todayTomatoes}</span>
        </button>
        <button className={activeView === "history" ? "active" : ""} onClick={() => setActiveView("history")}>
          <History size={15} /> {t("historyTab")} <span className="count-badge">{records.length}</span>
        </button>
      </nav>

      <div className="content-area">
        {activeView === "timer" ? (
          <section className="timer-view">
            <div className="timer-card">
              <div className="timer-topline">
                <div className="mode-switcher">
                  {(Object.keys(modeLabelKeys) as TimerMode[]).map((item) => (
                    <button
                      key={item}
                      className={mode === item ? "active" : ""}
                      onClick={() => switchMode(item)}
                    >
                      {t(modeLabelKeys[item])}
                    </button>
                  ))}
                </div>
                <div className="duration-menu-wrap">
                  <button
                    className={`duration-trigger ${durationMenuOpen ? "active" : ""}`}
                    aria-label={t("durationSetting")}
                    onClick={openDurationMenu}
                  >
                    <Timer size={12} /> {currentMinutes} {t("minute")} <ChevronDown size={10} />
                  </button>
                  {durationMenuOpen && (
                    <div className="duration-menu floating-menu">
                      <div className="duration-menu-heading">
                        <span>{t("durationHeading", { mode: t(modeLabelKeys[mode]) })}</span>
                        <strong>{currentMinutes}<small> {t("minute")}</small></strong>
                      </div>
                      <div className="duration-presets">
                        {durationPresets[mode].map((minutes) => (
                          <button
                            key={minutes}
                            className={currentMinutes === minutes ? "active" : ""}
                            onClick={() => applyDuration(minutes)}
                          >
                            {minutes}<small>min</small>
                          </button>
                        ))}
                      </div>
                      <div className="custom-duration">
                        <button
                          aria-label={t("decreaseMinute")}
                          onClick={() =>
                            setCustomMinutes((value) =>
                              Math.max(1, (Number.isFinite(value) ? value : 1) - 1),
                            )
                          }
                        >
                          <Minus size={13} />
                        </button>
                        <label>
                          <input
                            type="number"
                            min={1}
                            max={180}
                            value={customMinutes}
                            aria-label={t("customMinutes")}
                            onChange={(event) =>
                              setCustomMinutes(Number(event.target.value))
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") applyDuration(customMinutes);
                            }}
                          />
                          <span>{t("minute")}</span>
                        </label>
                        <button
                          aria-label={t("increaseMinute")}
                          onClick={() =>
                            setCustomMinutes((value) =>
                              Math.min(180, (Number.isFinite(value) ? value : 1) + 1),
                            )
                          }
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <button className="apply-duration" onClick={() => applyDuration(customMinutes)}>
                        {t("applyCustomDuration")}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className={`timer-core ${running ? "running" : ""}`}>
                <svg className="progress-ring" viewBox="0 0 180 180" aria-hidden="true">
                  <circle className="ring-track" cx="90" cy="90" r="76" />
                  <circle
                    className="ring-progress"
                    cx="90"
                    cy="90"
                    r="76"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - progress)}
                  />
                </svg>
                <div className="timer-value">
                  <small>{running ? t(runningLabelKeys[mode]) : t(modeLabelKeys[mode])}</small>
                  <strong>{formatTimer(remaining)}</strong>
                </div>
              </div>

              <div className="timer-controls">
                <button className="secondary-control" aria-label={t("resetTimer")} onClick={resetTimer}>
                  <RotateCcw size={17} />
                </button>
                <button className="primary-control" onClick={toggleTimer}>
                  {running ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                  {running ? t("pause") : t(startLabelKeys[mode])}
                </button>
                <button className="secondary-control" aria-label={t("completeRound")} onClick={completeManually}>
                  <Square size={15} fill="currentColor" />
                </button>
              </div>
            </div>

            <div className="session-fields">
              <label>
                <span>{t("roundGoal")}</span>
                <textarea
                  value={task}
                  onChange={(event) => setTask(event.target.value)}
                  placeholder={t("roundGoalPlaceholder")}
                  maxLength={200}
                  rows={3}
                />
              </label>
              <label>
                <span>{t("quickNote")}</span>
                <textarea
                  value={sessionNote}
                  onChange={(event) => setSessionNote(event.target.value)}
                  placeholder={t("quickNotePlaceholder")}
                  maxLength={400}
                  rows={3}
                />
              </label>
            </div>
          </section>
        ) : activeView === "tree" ? (
          <Suspense
            fallback={(
              <div className="tree-loading" role="status">
                <Sprout size={22} />
                <span>{t("treeLoading")}</span>
              </div>
            )}
          >
            <FocusTree
              tomatoCount={todayTomatoes}
              growthProgress={tomatoGrowthProgress}
              remainingFocusMinutes={remainingFocusMinutes}
              isGrowing={isTomatoGrowing}
              dateText={dateText}
              t={t}
            />
          </Suspense>
        ) : (
          <section className="history-view">
            <div className="history-heading">
              <div>
                <span>{t("focusFootprints")}</span>
                <strong>{t("completedToday", { count: todayRecords.length })}</strong>
              </div>
              {records.length > 0 && (
                <button className="clear-button" onClick={() => setRecords([])}>
                  <Trash2 size={13} /> {t("clear")}
                </button>
              )}
            </div>
            <div className="history-list">
              {records.length === 0 ? (
                <div className="empty-state">
                  <Clock3 size={24} />
                  <strong>{t("noRecords")}</strong>
                  <span>{t("noRecordsHint")}</span>
                </div>
              ) : (
                records.map((record) => (
                  <article className="history-item" key={record.id}>
                    <span className="record-dot" />
                    <div className="record-copy">
                      <strong>{record.title}</strong>
                      {record.note && <p>{record.note}</p>}
                      <span>
                        {new Intl.DateTimeFormat(locale, {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(record.completedAt))}
                      </span>
                    </div>
                    <b>{record.durationMinutes}<small>min</small></b>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
      </div>

      {settingsOpen && (
        <SettingsPanel
          t={t}
          locale={locale}
          themePreference={themePreference}
          sizePreset={sizePreset}
          alwaysOnTop={alwaysOnTop}
          autoStartEnabled={autoStartEnabled}
          autoStartStatus={autoStartStatus}
          autoStartSupported={supportsAutoStart()}
          autoStartTitle={autoStartTitle}
          windowsNotificationsEnabled={windowsNotificationsEnabled}
          trayClickAction={trayClickAction}
          trayDoubleClickAction={trayDoubleClickAction}
          trayIconMode={trayIconMode}
          trayCustomIcon={trayCustomIcon}
          trayIconStatus={trayIconStatus}
          manualUpdateStatus={manualUpdateStatus}
          updateInstalling={updateInstalling}
          availableUpdateVersion={availableUpdate?.version ?? null}
          currentVersion={CURRENT_VERSION}
          onClose={() => setSettingsOpen(false)}
          onLocaleChange={selectLocale}
          onThemeChange={selectTheme}
          onSizeChange={(preset) => void applySize(preset)}
          onAlwaysOnTopChange={setPinned}
          onToggleAutoStart={() => void toggleAutoStart()}
          onWindowsNotificationsChange={changeWindowsNotifications}
          onTrayClickActionChange={setTrayClickAction}
          onTrayDoubleClickActionChange={setTrayDoubleClickAction}
          onTrayIconModeChange={changeTrayIconMode}
          onTrayIconFileChange={(file) => void changeTrayIconFile(file)}
          onCheckForUpdates={() => void manuallyCheckForUpdates()}
          onInstallUpdate={() => {
            if (availableUpdate) void installUpdate(availableUpdate, true);
          }}
        />
      )}

      {availableUpdate && !updateDismissed && (
        <aside
          className="update-toast"
          role="dialog"
          aria-labelledby="update-title"
          aria-describedby="update-description"
        >
          <span className="update-icon"><DownloadCloud size={17} /></span>
          <div className="update-copy">
            <strong id="update-title">
              {t("updateAvailable", { version: availableUpdate.version })}
            </strong>
            <span id="update-description">{t("updateDescription")}</span>
          </div>
          <button
            className={`update-action ${updateInstalling ? "installing" : ""}`}
            disabled={updateInstalling}
            onClick={() => void installUpdate(availableUpdate, true)}
          >
            {updateInstalling ? t("installingUpdate") : t("viewUpdate")}
            {updateInstalling ? <RefreshCw size={12} /> : <ArrowUpRight size={12} />}
          </button>
          <button
            className="update-dismiss"
            aria-label={t("dismissUpdate")}
            title={t("dismissUpdate")}
            onClick={dismissUpdate}
          >
            <X size={13} />
          </button>
        </aside>
      )}

      {(manualUpdateStatus === "current" ||
        manualUpdateStatus === "error") && (
        <aside
          className={`check-toast ${manualUpdateStatus}`}
          role="status"
          aria-live="polite"
        >
          <span className="check-toast-icon">
            {manualUpdateStatus === "current" ? (
              <Check size={15} />
            ) : (
              <X size={15} />
            )}
          </span>
          <div>
            <strong>
              {t(
                manualUpdateStatus === "current"
                  ? "updateUpToDate"
                  : "updateCheckFailed",
              )}
            </strong>
            <span>
              {manualUpdateStatus === "current"
                ? t("updateUpToDateDescription", {
                    version: CURRENT_VERSION,
                  })
                : t("updateCheckFailedDescription")}
            </span>
          </div>
        </aside>
      )}

      <footer>
        <span>
          <span className={`status-dot ${running ? "working" : ""}`} />
          {running ? t("stayFocused") : t("ready")}
          <b className="footer-version">v{CURRENT_VERSION}</b>
        </span>
      </footer>
    </main>
  );
}
