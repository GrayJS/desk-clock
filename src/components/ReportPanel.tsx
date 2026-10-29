import { Column, type ColumnConfig } from "@ant-design/plots";
import { Button, Calendar, ConfigProvider, DatePicker, Empty, Progress, Segmented, Tooltip, theme as antTheme } from "antd";
import zhCN from "antd/locale/zh_CN";
import enUS from "antd/locale/en_US";
import dayjs from "dayjs";
import updateLocale from "dayjs/plugin/updateLocale";
import "dayjs/locale/zh-cn";
import { ArrowDownRight, ArrowUpRight, BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Info, ListChecks, SkipForward, Trash2 } from "lucide-react";
import { Component, memo, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Locale, MessageKey, Translate } from "../i18n";
import { dateFromKey, localDateKey, periodBounds, recordsInPeriod, reportBuckets, shiftPeriod, summarizeReport, type ReportArchive, type ReportPeriod } from "../lib/reports";
import type { SessionRecord } from "../types";
import "./ReportPanel.css";

dayjs.extend(updateLocale);
dayjs.updateLocale("en", { weekStart: 1 });

type Props = {
  archive: ReportArchive;
  records: SessionRecord[];
  locale: Locale;
  theme: "dark" | "light";
  t: Translate;
  today: string;
  onClear: () => void;
  preview?: boolean;
};

class ChartBoundary extends Component<{ children: ReactNode; fallback: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="report-chart-fallback" role="status">{this.props.fallback}</p> : this.props.children; }
}

const compareKeys: Record<ReportPeriod, MessageKey> = {
  day: "reportCompareDay", week: "reportCompareWeek", month: "reportCompareMonth", year: "reportCompareYear",
};

function durationLabel(seconds: number, locale: Locale) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return locale === "zh-CN"
    ? hours ? `${hours}小时${minutes % 60}分钟` : `${minutes}分钟`
    : hours ? `${hours}h ${minutes % 60}min` : `${minutes}min`;
}

function ReportPanel({ archive, records, locale, theme, t, today, onClear, preview }: Props) {
  const [period, setPeriod] = useState<ReportPeriod>(() => {
    const requested = preview ? new URLSearchParams(location.search).get("period") : null;
    return requested === "day" || requested === "week" || requested === "month" || requested === "year" ? requested : "week";
  });
  const [anchorKey, setAnchorKey] = useState(today);
  const [dense, setDense] = useState(() => window.matchMedia("(min-width: 600px) and (max-height: 600px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 600px) and (max-height: 600px)");
    const update = () => setDense(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const chartHeight = dense ? 112 : 140;
  const anchor = useMemo(() => dateFromKey(anchorKey), [anchorKey]);
  const currentDate = useMemo(() => dateFromKey(today), [today]);
  const total = useMemo(() => summarizeReport(archive, period, anchor), [archive, period, anchor]);
  const previous = useMemo(() => summarizeReport(archive, period, shiftPeriod(period, anchor, -1)), [archive, period, anchor]);
  const filtered = useMemo(() => recordsInPeriod(records, period, anchor), [records, period, anchor]);
  const data = useMemo(() => reportBuckets(archive, period, anchor).map(bucket => ({
    ...bucket,
    minutes: Math.round(bucket.focusSeconds / 60 * 100) / 100,
    label: period === "day" ? bucket.key.slice(0, 2)
      : new Intl.DateTimeFormat(locale, period === "year" ? { month: "short" }
        : period === "week" ? { weekday: "short" } : { day: "numeric" }).format(bucket.date),
    fullLabel: period === "day" ? bucket.key : new Intl.DateTimeFormat(locale,
      period === "year" ? { year: "numeric", month: "long" } : { month: "long", day: "numeric", weekday: "short" }).format(bucket.date),
  })), [archive, period, anchor, locale]);
  const peak = data.reduce((best, point) => point.focusSeconds > best.focusSeconds ? point : best, data[0]);
  const dark = theme === "dark";
  const accent = dark ? "#d7fb76" : "#537b28";
  const muted = dark ? "#9ea89c" : "#70796b";
  const hours = Math.floor(total.focusSeconds / 3600);
  const minutes = Math.floor(total.focusSeconds / 60) % 60;
  const change = previous.focusSeconds > 0 ? Math.round((total.focusSeconds - previous.focusSeconds) / previous.focusSeconds * 100) : null;
  const nextIsFuture = periodBounds(period, shiftPeriod(period, anchor, 1)).start > periodBounds(period, currentDate).start;
  const periodLabel = (date: Date) => {
    const { start, end } = periodBounds(period, date);
    if (period === "week") {
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
      return `${new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(start)} – ${new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(last)}`;
    }
    return new Intl.DateTimeFormat(locale, period === "year" ? { year: "numeric" }
      : period === "month" ? { year: "numeric", month: "long" } : { year: "numeric", month: "short", day: "numeric" }).format(start);
  };

  const chartConfig = useMemo<ColumnConfig>(() => ({
    data,
    xField: "label",
    yField: "minutes",
    height: chartHeight,
    autoFit: true,
    animate: false,
    theme: dark ? "classicDark" : "classic",
    paddingTop: 8,
    paddingRight: 8,
    paddingLeft: 32,
    paddingBottom: 20,
    style: { fill: accent, radiusTopLeft: 4, radiusTopRight: 4, maxWidth: 24 },
    scale: { y: { domainMin: 0, nice: true }, x: { padding: period === "month" ? 0.2 : 0.45 } },
    axis: {
      x: { title: false, tick: false, line: false, labelFill: muted, labelFontSize: 10, labelAutoHide: true, labelAutoRotate: false },
      y: { title: false, tick: false, line: false, tickCount: 3, labelFill: muted, labelFontSize: 10, gridStroke: dark ? "#343d31" : "#e4e9df", gridLineDash: [3, 4] },
    },
    tooltip: { title: "fullLabel", items: [{ channel: "y", name: t("reportFocusTime"), valueFormatter: (value: number) => durationLabel(Math.round(value * 60), locale) }] },
  }), [data, dark, accent, muted, period, t, locale, chartHeight]);

  return (
    <ConfigProvider locale={locale === "zh-CN" ? zhCN : enUS} theme={{
      algorithm: dark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
      token: { colorPrimary: accent, colorText: dark ? "#edf2e7" : "#263322", colorTextSecondary: muted,
        colorBgContainer: dark ? "#242b23" : "#f8faf5", colorBgElevated: dark ? "#293127" : "#ffffff",
        colorBorder: dark ? "#3b4635" : "#dce4d5", borderRadius: 10, fontFamily: "inherit", fontSize: 12, controlHeight: 34 },
    }}>
      <section className="report-view" aria-label={t("reportEyebrow")}>
        <div className="report-heading">
          <div><span className="report-eyebrow"><BarChart3 size={12} /> {t("reportEyebrow")}</span><h2>{t("reportTitle")}</h2></div>
          {preview && <span className="report-preview-label">{t("reportDemo")}</span>}
          {(records.length > 0 || Object.keys(archive.days).length > 0) && <Tooltip title={t("clearHistoryTitle")}>
            <Button type="text" className="report-clear" icon={<Trash2 size={14} />} aria-label={t("clearHistoryTitle")} onClick={onClear} />
          </Tooltip>}
        </div>
        <div className="report-toolbar">
          <Segmented block aria-label={t("reportPeriodLabel")} value={period} onChange={value => setPeriod(value as ReportPeriod)} options={[
            { value: "day", label: t("reportDay") }, { value: "week", label: t("reportWeek") },
            { value: "month", label: t("reportMonth") }, { value: "year", label: t("reportYear") },
          ]} />
          <div className="report-date-navigation">
            <Button type="text" icon={<ChevronLeft size={16} />} aria-label={t("reportPrevious")} onClick={() => setAnchorKey(localDateKey(shiftPeriod(period, anchor, -1)))} />
            <DatePicker aria-label={t("reportDateLabel")} allowClear={false} inputReadOnly value={dayjs(anchor)}
              picker={period === "day" ? "date" : period} format={value => periodLabel(value.toDate())}
              disabledDate={date => periodBounds(period, date.toDate()).start > periodBounds(period, currentDate).start}
              onChange={date => { if (date) setAnchorKey(localDateKey(date.toDate())); }} suffixIcon={null} />
            <Button type="text" icon={<ChevronRight size={16} />} aria-label={t("reportNext")} disabled={nextIsFuture} onClick={() => setAnchorKey(localDateKey(shiftPeriod(period, anchor, 1)))} />
            <Button type="text" className="report-current" onClick={() => setAnchorKey(today)}>{t("reportCurrent")}</Button>
          </div>
        </div>

        <div className="report-overview" data-period={period}>
          <section className="report-summary-card" aria-label={t("reportFocusTime")}>
            <div className="report-card-eyebrow"><Clock3 size={13} /> {t("reportFocusTime")}</div>
            <div className="report-hero-value" data-long={hours >= 100} aria-label={durationLabel(total.focusSeconds, locale)}>
              {hours > 0 && <><strong>{hours}</strong><small>{t("reportHours")}</small></>}
              <strong>{hours > 0 ? minutes.toString().padStart(2, "0") : minutes}</strong><small>{t("reportMinutes")}</small>
            </div>
            <div className={`report-change ${change === null ? "neutral" : change < 0 ? "down" : "up"}`}>
              {change === null ? <span>{t("reportNoComparison")}</span> : <>
                {change < 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}<b>{Math.abs(change)}%</b><span>{t(compareKeys[period])}</span>
              </>}
            </div>
            <div className="report-metrics">
              <div><strong>{total.completed}<small>{t("reportRoundsUnit")}</small></strong><span>{t("reportCompleted")}</span></div>
              <div><strong>{total.activeDays}<small>{t("reportDaysUnit")}</small></strong><span>{t("reportActiveDays")}</span></div>
              <div><strong>{total.skippedFocus + total.skippedRest}<small>{t("reportTimesUnit")}</small></strong><span>{t("reportSkipped")}</span></div>
            </div>
          </section>

          <section className="report-chart-card" aria-label={t(period === "month" ? "reportCalendar" : "reportTrend")}>
            <div className="report-section-heading"><h3>{t(period === "month" ? "reportCalendar" : "reportTrend")}</h3><span>{t(period === "day" ? "reportByHour" : period === "year" ? "reportByMonth" : "reportByDay")}</span></div>
            {period === "month" ? <>
              <div className="report-calendar" aria-label={t("reportCalendar")}>
                <Calendar fullscreen={false} headerRender={() => null} mode="month" value={dayjs(anchor)}
                  disabledDate={date => date.month() !== anchor.getMonth() || date.year() !== anchor.getFullYear() || date.toDate() > currentDate}
                  onSelect={(date, info) => { if (info.source === "date") { setAnchorKey(localDateKey(date.toDate())); setPeriod("day"); } }}
                  fullCellRender={date => {
                    if (date.month() !== anchor.getMonth() || date.year() !== anchor.getFullYear()) return <span className="report-calendar-blank" />;
                    const key = localDateKey(date.toDate());
                    const seconds = archive.days[key]?.focusSeconds ?? 0;
                    const level = seconds ? Math.max(1, Math.ceil(seconds / Math.max(1, peak.focusSeconds) * 4)) : 0;
                    const future = key > today;
                    return <button type="button" className="report-calendar-day" data-level={level} data-today={key === today} disabled={future}
                      aria-label={`${date.format("YYYY-MM-DD")} · ${durationLabel(seconds, locale)}`}
                      onClick={event => { event.stopPropagation(); setAnchorKey(key); setPeriod("day"); }}>
                      <span>{date.date()}</span><small>{future ? "·" : Math.floor(seconds / 60) || "—"}</small>
                    </button>;
                  }} />
              </div>
              <div className="report-calendar-key"><span>{t("reportCalendarHint")}</span><span>{t("reportLess")}{[0, 1, 2, 3, 4].map(level => <i key={level} data-level={level} />)}{t("reportMore")}</span></div>
            </> : total.focusSeconds > 0 ? <>
              <div className="report-chart-unit">{t("reportMinutes")}</div>
              <div className="report-chart" style={{ height: chartHeight }} role="img" aria-label={`${periodLabel(anchor)} · ${t("reportFocusTime")} ${durationLabel(total.focusSeconds, locale)}`}>
                <ChartBoundary key={`${period}-${anchorKey}-${theme}`} fallback={t("reportChartUnavailable")}><Column {...chartConfig} /></ChartBoundary>
              </div>
              <div className="report-peak"><i /><span>{t("reportPeak")}</span><strong>{peak.fullLabel}</strong><b>{durationLabel(peak.focusSeconds, locale)}</b></div>
            </> : <div className="report-empty-chart"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<><strong>{t("reportNoFocus")}</strong><span>{t("reportNoFocusHint")}</span></>} /></div>}
          </section>
        <section className="report-outcomes" aria-label={t("reportCompletionRate")}>
          <div className="report-section-heading"><h3><ListChecks size={14} /> {t("reportCompletionRate")}</h3><strong>{total.completionRate === null ? "—" : `${total.completionRate}%`}</strong></div>
          <Progress percent={total.completionRate ?? 0} showInfo={false} strokeColor={accent} railColor={total.completionRate === null ? undefined : dark ? "#624d2f" : "#e8d7b7"} size="small" />
          <div className="report-outcome-labels">
            <span><Check size={12} />{t("reportCompletedShort")}<b>{total.completed}</b></span>
            <span><SkipForward size={12} />{t("reportSkippedFocus")}<b>{total.skippedFocus}</b></span>
            <span><SkipForward size={12} />{t("reportSkippedRest")}<b>{total.skippedRest}</b></span>
          </div>
          {total.completionRate === null && <p>{t("reportNoAttempts")}</p>}
        </section>
        </div>

        <details className="report-details" key={`details-${period}-${anchorKey}`}>
          <summary><span><ListChecks size={14} />{t("reportDetails")}</span><span>{t("reportRecordCount", { count: filtered.length })}<ChevronDown size={14} /></span></summary>
          {filtered.length === 0 ? <p className="report-no-details">{Object.keys(archive.days).length > 0 && (total.completed + total.skippedFocus + total.skippedRest > 0) ? t("reportArchivedDetails") : t("reportNoDetails")}</p>
            : <div className="report-record-list">{filtered.map(record => <article className="history-item" key={record.id}>
              <span className={`record-dot ${record.outcome === "skipped" ? "skipped" : ""}`} />
              <div className="record-copy">
                <div className="record-title-row"><strong>{record.title}</strong>{record.outcome === "skipped" && <span className="record-skip-badge">{t(record.mode === "focus" ? "skippedFocus" : "skippedRest")}</span>}</div>
                {record.note && <p>{record.note}</p>}
                {record.outcome === "skipped" && <p className="record-duration-detail">{t("plannedDuration", { minutes: record.durationMinutes })}</p>}
                <span>{new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(record.completedAt))}</span>
              </div>
              <b>{record.outcome === "skipped" ? `${String(Math.floor((record.elapsedSeconds ?? 0) / 60)).padStart(2, "0")}:${String((record.elapsedSeconds ?? 0) % 60).padStart(2, "0")}` : record.durationMinutes}<small>{record.outcome === "skipped" ? t("elapsedTime") : "min"}</small></b>
            </article>)}</div>}
        </details>

        <details className="report-data-table" key={`table-${period}-${anchorKey}`}>
          <summary>{t("reportDataTable")}<ChevronDown size={12} /></summary>
          <table><thead><tr><th>{t("reportBucket")}</th><th>{t("reportFocusTime")} ({t("reportMinutes")})</th></tr></thead>
            <tbody>{data.map(row => <tr key={row.key}><th scope="row">{row.fullLabel}</th><td>{new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(row.minutes)}</td></tr>)}</tbody></table>
        </details>
        <div className="report-source"><Tooltip title={t("reportSourceHint")}><button type="button" aria-label={t("reportStatisticsHelp")}><Info size={12} /></button></Tooltip><p>{t("reportSource", { date: archive.startedOn.replace(/-/g, "/") })}</p></div>
      </section>
    </ConfigProvider>
  );
}

export default memo(ReportPanel);
