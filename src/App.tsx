import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  DownloadCloud,
  History,
  Languages,
  Monitor,
  Maximize2,
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
  Sun,
  Moon,
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
  closeWindow,
  minimizeWindow,
  setAlwaysOnTop,
  setWindowSize,
  startWindowDragging,
} from "./lib/window";
import type { SessionRecord, SizePreset, TimerMode } from "./types";

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

const durationPresets: Record<TimerMode, number[]> = {
  focus: [15, 25, 45, 60],
  short: [5, 10, 15],
  long: [15, 20, 30],
};

type ThemePreference = "system" | "light" | "dark";
type ManualUpdateStatus = "idle" | "checking" | "current" | "error";
type AutoStartStatus = "loading" | "ready" | "saving" | "error";

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
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const [locale, setLocale] = usePersistentState<Locale>(
    "morrow.locale",
    getSystemLocale(),
  );
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [themePreference, setThemePreference] = usePersistentState<ThemePreference>(
    "morrow.theme",
    "system",
  );
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [durationMenuOpen, setDurationMenuOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(defaultDurations.focus);
  const [availableUpdate, setAvailableUpdate] =
    useState<AvailableUpdate | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [manualUpdateStatus, setManualUpdateStatus] =
    useState<ManualUpdateStatus>("idle");
  const [autoStartEnabled, setAutoStartEnabledState] = useState(false);
  const [autoStartStatus, setAutoStartStatus] =
    useState<AutoStartStatus>("loading");
  const completingRef = useRef(false);
  const lastUpdateCheckRef = useRef(0);
  const updateDismissedUntilRef = useRef(0);
  const timerBusyRef = useRef(false);
  const previousTimerBusyRef = useRef(false);
  const updateInstallRef = useRef(false);
  const manualUpdateTimerRef = useRef<number | null>(null);
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

  useEffect(() => {
    timerBusyRef.current = timerBusy;
  }, [timerBusy]);

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
      try {
        await update.installSilently();
        return true;
      } catch {
        if (openFallback) await openReleasePage(update.releaseUrl);
        return false;
      } finally {
        updateInstallRef.current = false;
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

        if (update.installSilently && !timerBusyRef.current) {
          const started = await installUpdate(update);
          if (started) return "installing" as const;
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
    [installUpdate],
  );

  useEffect(() => {
    const becameIdle = previousTimerBusyRef.current && !timerBusy;
    previousTimerBusyRef.current = timerBusy;
    if (!becameIdle || !availableUpdate?.installSilently) return;

    void installUpdate(availableUpdate).then((started) => {
      if (!started) showManualUpdateStatus("error");
    });
  }, [availableUpdate, installUpdate, timerBusy]);

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

  const toggleTimer = () => {
    if (running) {
      void cancelTimerNotification();
      setRunning(false);
      return;
    }

    const isFocus = mode === "focus";
    const title = t(isFocus ? "notificationFocusTitle" : "notificationRestTitle");
    const body = isFocus
      ? task.trim()
        ? t("notificationFocusTask", { task: task.trim() })
        : t("notificationFocus")
      : t("notificationRest");
    void scheduleTimerNotification(remaining, title, body);
    setRunning(true);
  };

  const completeManually = () => {
    void cancelTimerNotification();
    finishSession();
  };

  const openDurationMenu = () => {
    setCustomMinutes(currentMinutes);
    setDurationMenuOpen((value) => !value);
    setThemeMenuOpen(false);
    setSizeMenuOpen(false);
    setLanguageMenuOpen(false);
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
    setSizeMenuOpen(false);
    await setWindowSize(preset);
  };

  const selectTheme = (preference: ThemePreference) => {
    setThemePreference(preference);
    setThemeMenuOpen(false);
  };

  const selectLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    setLanguageMenuOpen(false);
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
    if (result === "available" || result === "installing") {
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
  const ThemeButtonIcon =
    themePreference === "system" ? Monitor : theme === "dark" ? Moon : Sun;

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
          <div className="language-menu-wrap">
            <button
              className={`icon-button language-button ${languageMenuOpen ? "menu-active" : ""}`}
              aria-label={t("selectLanguage")}
              title={locale === "zh-CN" ? t("chinese") : t("english")}
              onClick={() => {
                setLanguageMenuOpen((value) => !value);
                setThemeMenuOpen(false);
                setSizeMenuOpen(false);
                setDurationMenuOpen(false);
              }}
            >
              <Languages size={14} />
            </button>
            {languageMenuOpen && (
              <div className="language-menu floating-menu">
                <span className="menu-label">{t("language")}</span>
                {localeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => selectLocale(option.value)}
                  >
                    <span>{t(option.labelKey)}</span>
                    {locale === option.value && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="theme-menu-wrap">
            <button
              className={`icon-button theme-button ${themeMenuOpen ? "menu-active" : ""}`}
              aria-label={t("selectTheme")}
              title={
                themePreference === "system"
                  ? t("themeCurrentSystem", {
                      theme: t(theme === "dark" ? "themeDark" : "themeLight"),
                    })
                  : t("themeCurrent", {
                      theme: t(theme === "dark" ? "themeDark" : "themeLight"),
                    })
              }
              onClick={() => {
                setThemeMenuOpen((value) => !value);
                setSizeMenuOpen(false);
                setDurationMenuOpen(false);
                setLanguageMenuOpen(false);
              }}
            >
              <ThemeButtonIcon size={14} />
            </button>
            {themeMenuOpen && (
              <div className="theme-menu floating-menu">
                <span className="menu-label">{t("themeTitle")}</span>
                {themeOptions.map((option) => {
                  const OptionIcon = option.icon;
                  return (
                    <button key={option.value} onClick={() => selectTheme(option.value)}>
                      <span><OptionIcon size={13} /> {t(option.labelKey)}</span>
                      {themePreference === option.value && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            className={`icon-button update-check-button ${
              manualUpdateStatus === "checking" ? "checking" : ""
            } ${availableUpdate ? "has-update" : ""}`}
            aria-label={
              manualUpdateStatus === "checking"
                ? t("checkingForUpdates")
                : t("manualCheckUpdate")
            }
            title={
              manualUpdateStatus === "checking"
                ? t("checkingForUpdates")
                : t("manualCheckUpdate")
            }
            disabled={manualUpdateStatus === "checking"}
            onClick={() => void manuallyCheckForUpdates()}
          >
            <RefreshCw size={14} />
          </button>
          <button
            className={`icon-button pin-button ${alwaysOnTop ? "active" : ""}`}
            aria-label={alwaysOnTop ? t("pinDisable") : t("pinEnable")}
            title={alwaysOnTop ? t("pinned") : t("pin")}
            onClick={() => setPinned((value) => !value)}
          >
            <Pin size={14} fill={alwaysOnTop ? "currentColor" : "none"} />
          </button>
          <div className="size-menu-wrap">
            <button
              className="icon-button size-button"
              aria-label={t("resizeWindow")}
              title={t("windowSize")}
              onClick={() => {
                setSizeMenuOpen((value) => !value);
                setThemeMenuOpen(false);
                setDurationMenuOpen(false);
                setLanguageMenuOpen(false);
              }}
            >
              <Maximize2 size={14} />
              <ChevronDown size={10} />
            </button>
            {sizeMenuOpen && (
              <div className="size-menu">
                {(Object.keys(sizeLabelKeys) as SizePreset[]).map((preset) => (
                  <button key={preset} onClick={() => void applySize(preset)}>
                    <span>{t(sizeLabelKeys[preset])}</span>
                    {sizePreset === preset && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>
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

      {availableUpdate && !updateDismissed && (
        <aside className="update-toast" role="status" aria-live="polite">
          <span className="update-icon"><DownloadCloud size={17} /></span>
          <div className="update-copy">
            <strong>{t("updateAvailable", { version: availableUpdate.version })}</strong>
            <span>{t("updateDescription")}</span>
          </div>
          <button
            className="update-action"
            onClick={() => void installUpdate(availableUpdate, true)}
          >
            {t("viewUpdate")} <ArrowUpRight size={12} />
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
        <button
          className={`auto-start-toggle ${autoStartEnabled ? "enabled" : ""} ${
            autoStartStatus === "error" ? "error" : ""
          }`}
          type="button"
          role="switch"
          aria-checked={autoStartEnabled}
          aria-busy={autoStartStatus === "loading" || autoStartStatus === "saving"}
          aria-label={autoStartTitle}
          title={autoStartTitle}
          disabled={
            !supportsAutoStart() ||
            autoStartStatus === "loading" ||
            autoStartStatus === "saving"
          }
          onClick={() => void toggleAutoStart()}
        >
          <Settings2 size={12} />
          <span>{t("autoStart")}</span>
          <span className="auto-start-switch" aria-hidden="true">
            <span />
          </span>
        </button>
      </footer>
    </main>
  );
}
