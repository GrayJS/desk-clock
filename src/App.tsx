import {
  Check,
  ChevronDown,
  Clock3,
  History,
  Maximize2,
  Minus,
  Pause,
  Pin,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  Square,
  Sun,
  Moon,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClock } from "./hooks/useClock";
import { usePersistentState } from "./hooks/usePersistentState";
import {
  closeWindow,
  minimizeWindow,
  setAlwaysOnTop,
  setWindowSize,
} from "./lib/window";
import type { SessionRecord, SizePreset, TimerMode } from "./types";

const modeInfo: Record<TimerMode, { label: string; minutes: number }> = {
  focus: { label: "专注", minutes: 25 },
  short: { label: "短休息", minutes: 5 },
  long: { label: "长休息", minutes: 15 },
};

const sizeLabels: Record<SizePreset, string> = {
  compact: "迷你",
  standard: "标准",
  expanded: "展开",
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
  const [remaining, setRemaining] = useState(modeInfo.focus.minutes * 60);
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
  const [theme, setTheme] = usePersistentState<"dark" | "light">(
    "morrow.theme",
    "dark",
  );
  const completingRef = useRef(false);

  const totalSeconds = modeInfo[mode].minutes * 60;
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
        title: task.trim() || "未命名专注",
        note: sessionNote.trim(),
        mode,
        durationMinutes: modeInfo[mode].minutes,
        completedAt: new Date().toISOString(),
      };
      setRecords((current) => [newRecord, ...current].slice(0, 200));
      setSessionNote("");
      setMode("short");
      setRemaining(modeInfo.short.minutes * 60);
    } else {
      setMode("focus");
      setRemaining(modeInfo.focus.minutes * 60);
    }

    window.setTimeout(() => {
      completingRef.current = false;
    }, 300);
  }, [mode, sessionNote, setRecords, task]);

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

  const switchMode = (nextMode: TimerMode) => {
    setRunning(false);
    setMode(nextMode);
    setRemaining(modeInfo[nextMode].minutes * 60);
  };

  const resetTimer = () => {
    setRunning(false);
    setRemaining(totalSeconds);
  };

  const applySize = async (preset: SizePreset) => {
    setSizePreset(preset);
    setSizeMenuOpen(false);
    await setWindowSize(preset);
  };

  const timeText = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const secondsText = pad(now.getSeconds());
  const dateText = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);

  return (
    <main className={`app-shell size-${sizePreset}`} data-theme={theme}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="titlebar" data-tauri-drag-region>
        <div className="brand" data-tauri-drag-region>
          <span className="brand-mark"><Sparkles size={13} /></span>
          <span>Morrow</span>
        </div>
        <div className="window-actions">
          <button
            className="icon-button theme-button"
            aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
            title={theme === "dark" ? "浅色主题" : "深色主题"}
            onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            className={`icon-button pin-button ${alwaysOnTop ? "active" : ""}`}
            aria-label={alwaysOnTop ? "取消置顶" : "窗口置顶"}
            title={alwaysOnTop ? "已置顶" : "置顶"}
            onClick={() => setPinned((value) => !value)}
          >
            <Pin size={14} fill={alwaysOnTop ? "currentColor" : "none"} />
          </button>
          <div className="size-menu-wrap">
            <button
              className="icon-button size-button"
              aria-label="调整窗口大小"
              title="窗口大小"
              onClick={() => setSizeMenuOpen((value) => !value)}
            >
              <Maximize2 size={14} />
              <ChevronDown size={10} />
            </button>
            {sizeMenuOpen && (
              <div className="size-menu">
                {(Object.keys(sizeLabels) as SizePreset[]).map((preset) => (
                  <button key={preset} onClick={() => void applySize(preset)}>
                    <span>{sizeLabels[preset]}</span>
                    {sizePreset === preset && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="icon-button" aria-label="最小化" onClick={() => void minimizeWindow()}>
            <Minus size={14} />
          </button>
          <button className="icon-button close-button" aria-label="关闭" onClick={() => void closeWindow()}>
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
          <span>今日专注</span>
          <strong>{todayMinutes}<small> 分钟</small></strong>
        </div>
      </section>

      <nav className="view-tabs">
        <button className={activeView === "timer" ? "active" : ""} onClick={() => setActiveView("timer")}>
          <TimerReset size={15} /> 番茄钟
        </button>
        <button className={activeView === "history" ? "active" : ""} onClick={() => setActiveView("history")}>
          <History size={15} /> 记录 <span className="count-badge">{records.length}</span>
        </button>
      </nav>

      <div className="content-area">
        {activeView === "timer" ? (
          <section className="timer-view">
            <div className="timer-card">
              <div className="mode-switcher">
                {(Object.keys(modeInfo) as TimerMode[]).map((item) => (
                  <button
                    key={item}
                    className={mode === item ? "active" : ""}
                    onClick={() => switchMode(item)}
                  >
                    {modeInfo[item].label}
                  </button>
                ))}
              </div>

              <div className="timer-core">
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
                  <small>{running ? "正在专注" : modeInfo[mode].label}</small>
                  <strong>{formatTimer(remaining)}</strong>
                </div>
              </div>

              <div className="timer-controls">
                <button className="secondary-control" aria-label="重置计时器" onClick={resetTimer}>
                  <RotateCcw size={17} />
                </button>
                <button className="primary-control" onClick={() => setRunning((value) => !value)}>
                  {running ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                  {running ? "暂停" : "开始专注"}
                </button>
                <button className="secondary-control" aria-label="完成本轮" onClick={finishSession}>
                  <Square size={15} fill="currentColor" />
                </button>
              </div>
            </div>

            <div className="session-fields">
              <label>
                <span>本轮目标</span>
                <textarea
                  value={task}
                  onChange={(event) => setTask(event.target.value)}
                  placeholder="现在最重要的一件事…"
                  maxLength={200}
                  rows={3}
                />
              </label>
              <label>
                <span>随手记</span>
                <textarea
                  value={sessionNote}
                  onChange={(event) => setSessionNote(event.target.value)}
                  placeholder="完成后会写入记录（可选）"
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
                <span>专注足迹</span>
                <strong>今天完成 {todayRecords.length} 轮</strong>
              </div>
              {records.length > 0 && (
                <button className="clear-button" onClick={() => setRecords([])}>
                  <Trash2 size={13} /> 清空
                </button>
              )}
            </div>
            <div className="history-list">
              {records.length === 0 ? (
                <div className="empty-state">
                  <Clock3 size={24} />
                  <strong>还没有专注记录</strong>
                  <span>完成一轮番茄钟后，它会出现在这里。</span>
                </div>
              ) : (
                records.map((record) => (
                  <article className="history-item" key={record.id}>
                    <span className="record-dot" />
                    <div className="record-copy">
                      <strong>{record.title}</strong>
                      {record.note && <p>{record.note}</p>}
                      <span>
                        {new Intl.DateTimeFormat("zh-CN", {
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

      <footer>
        <span><span className={`status-dot ${running ? "working" : ""}`} /> {running ? "保持专注" : "准备就绪"}</span>
        <span><Settings2 size={12} /> 数据仅保存在本机</span>
      </footer>
    </main>
  );
}
