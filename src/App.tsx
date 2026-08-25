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
  RotateCcw,
  Settings2,
  Sparkles,
  Square,
  Sun,
  Moon,
  Timer,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClock } from "./hooks/useClock";
import { usePersistentState } from "./hooks/usePersistentState";
import {
  createTranslator,
  getSystemLocale,
  type Locale,
  type MessageKey,
} from "./i18n";
import {
  cancelTimerNotification,
  openReleasePage,
  scheduleTimerNotification,
  setAppLanguage,
  showUpdateNotification,
} from "./lib/background";
import {
  checkForUpdate,
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
  const [activeView, setActiveView] = useState<"timer" | "history">("timer");
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
  const completingRef = useRef(false);
  const lastUpdateCheckRef = useRef(0);
  const updateDismissedUntilRef = useRef(0);
  const notifiedUpdateRef = useRef<string | null>(null);
  const t = useMemo(() => createTranslator(locale), [locale]);

  const currentMinutes = durations[mode] ?? defaultDurations[mode];
  const totalSeconds = currentMinutes * 60;
  const theme = themePreference === "system" ? systemTheme : themePreference;
  const progress = Math.min(1, Math.max(0, 1 - remaining / totalSeconds));
  const circumference = 2 * Math.PI * 76;

  const todayRecords = useMemo(
    () => records.filter((record) => sameLocalDay(record.completedAt)),
    [records],
  );
  const todayMinutes = todayRecords.reduce(
    (sum, record) => sum + record.durationMinutes,
    0,
  );

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

  const runUpdateCheck = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const update = await checkForUpdate(signal);
        lastUpdateCheckRef.current = Date.now();
        if (!update) return;

        setAvailableUpdate(update);
        if (Date.now() >= updateDismissedUntilRef.current) {
          setUpdateDismissed(false);
        }
        if (notifiedUpdateRef.current !== update.version) {
          notifiedUpdateRef.current = update.version;
          void showUpdateNotification(
            t("updateNotificationTitle"),
            t("updateNotificationBody", { version: update.version }),
          );
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Update checks are best-effort and must not interrupt offline use.
      }
    },
    [t],
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
            onClick={() => void openReleasePage(availableUpdate.releaseUrl)}
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

      <footer>
        <span><span className={`status-dot ${running ? "working" : ""}`} /> {running ? t("stayFocused") : t("ready")}</span>
        <span><Settings2 size={12} /> {t("trayBackground")}</span>
      </footer>
    </main>
  );
}
