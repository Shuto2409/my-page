import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Check,
  Clock,
  AlertCircle,
  Trash2,
  Bell,
  Home,
  BookOpen,
  NotebookPen,
  ListChecks,
  Pin,
  Pencil,
  Lock,
  TrendingUp,
  List,
  BarChart3,
  Repeat,
  Sun,
  Moon,
  Cloud,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const STORAGE_TASKS = "personal-dashboard:tasks";
const STORAGE_DIARY = "personal-dashboard:diary";
const STORAGE_NOTES = "personal-dashboard:notes";
const STORAGE_ASSIGN = "personal-dashboard:assignments";
const STORAGE_WORKCODE = "personal-dashboard:workcode";
const STORAGE_THEME = "personal-dashboard:theme";

const CATEGORIES = {
  work: { label: "仕事", color: "var(--pd-teal)" },
  personal: { label: "個人", color: "var(--pd-amber)" },
  urgent: { label: "重要", color: "var(--pd-coral)" },
};

const MOODS = {
  good: { label: "good", color: "var(--pd-teal)" },
  neutral: { label: "neutral", color: "var(--pd-amber)" },
  tough: { label: "tough", color: "var(--pd-coral)" },
};

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];
const ROW_HEIGHT = 44;
const HOUR_MARKS = Array.from({ length: 24 }, (_, i) => i);

const NAV_ITEMS_BASE = [
  { key: "home", label: "ホーム", icon: Home, color: "var(--pd-teal)", soft: "var(--pd-teal-soft)" },
  { key: "diary", label: "日記", icon: BookOpen, color: "var(--pd-rose)", soft: "var(--pd-rose-soft)" },
  { key: "notes", label: "メモ", icon: NotebookPen, color: "var(--pd-purple)", soft: "var(--pd-purple-soft)" },
  { key: "assignments", label: "課題", icon: ListChecks, color: "var(--pd-coral)", soft: "var(--pd-coral-soft)" },
];

function pad(n) {
  return String(n).padStart(2, "0");
}
function toDateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function diffDays(a, b) {
  return Math.round((b - a) / 86400000);
}
function formatMonthLabel(d) {
  return `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
}
function formatDateLabel(key) {
  const d = parseDateKey(key);
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日(${w})`;
}
function daysUntil(dateKey) {
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = parseDateKey(dateKey);
  return diffDays(t0, d);
}
function buildMonthMatrix(anchor) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const weeks = [];
  let cursor = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}
function uid() {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const REPEAT_LABELS = { none: "なし", daily: "毎日", weekly: "毎週", monthly: "毎月" };
const REPEAT_CAPS = { daily: 60, weekly: 26, monthly: 12 };
const REPEAT_CAP_LABELS = { daily: "60日", weekly: "26週", monthly: "12ヶ月" };

function addMonths(d, n) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function generateOccurrences(startKey, type, endKey) {
  if (type === "none") return [startKey];
  const start = parseDateKey(startKey);
  const hardEnd = endKey ? parseDateKey(endKey) : null;
  const cap = REPEAT_CAPS[type] || 12;
  const dates = [];
  let cursor = new Date(start);
  for (let i = 0; i < cap; i++) {
    if (hardEnd && cursor > hardEnd) break;
    dates.push(toDateKey(cursor));
    if (type === "daily") cursor = addDays(cursor, 1);
    else if (type === "weekly") cursor = addDays(cursor, 7);
    else if (type === "monthly") cursor = addMonths(cursor, 1);
  }
  return dates;
}

/* ---- persistence hooks ---- */
function usePersistedList(key) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get(key, false);
        if (!cancelled && res && res.value) setItems(JSON.parse(res.value));
      } catch (e) {
        // no existing value yet
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        const res = await window.storage.set(key, JSON.stringify(items), false);
        setError(!res);
      } catch (e) {
        setError(true);
      }
    })();
  }, [items, loaded, key]);

  return [items, setItems, error];
}

function usePersistedValue(key) {
  const [value, setValue] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get(key, false);
        if (!cancelled && res && res.value !== undefined) setValue(JSON.parse(res.value));
      } catch (e) {
        // no existing value yet
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await window.storage.set(key, JSON.stringify(value), false);
      } catch (e) {
        // ignore; non-critical for the code gate
      }
    })();
  }, [value, loaded, key]);

  return [value, setValue];
}

/* ============================= APP ============================= */

export default function PersonalDashboard() {
  const [view, setView] = useState("home");
  const [tasks, setTasks, tasksErr] = usePersistedList(STORAGE_TASKS);
  const [diary, setDiary, diaryErr] = usePersistedList(STORAGE_DIARY);
  const [notes, setNotes, notesErr] = usePersistedList(STORAGE_NOTES);
  const [assignments, setAssignments, assignErr] = usePersistedList(STORAGE_ASSIGN);
  const [workCode, setWorkCode] = usePersistedValue(STORAGE_WORKCODE);
  const [workUnlocked, setWorkUnlocked] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [theme, setTheme] = usePersistedValue(STORAGE_THEME);
  const isDark = theme === "dark";
  const [syncOpen, setSyncOpen] = useState(false);

  useEffect(() => {
    document.body.style.background = isDark ? "#111318" : "#EFECE3";
  }, [isDark]);

  const saveError = tasksErr || diaryErr || notesErr || assignErr;

  function toggleTheme() {
    setTheme(isDark ? "light" : "dark");
  }

  function attemptUnlock(code) {
    const trimmed = (code || "").trim();
    if (!trimmed) return;
    if (!workCode) {
      setWorkCode(trimmed);
      setWorkUnlocked(true);
      setCodeError(false);
      setView("work");
    } else if (trimmed === workCode) {
      setWorkUnlocked(true);
      setCodeError(false);
      setView("work");
    } else {
      setCodeError(true);
    }
  }

  const navItems = workUnlocked
    ? [...NAV_ITEMS_BASE, { key: "work", label: "仕事", icon: TrendingUp, color: "var(--pd-blue)", soft: "var(--pd-blue-soft)" }]
    : NAV_ITEMS_BASE;

  const activeView = view === "work" && !workUnlocked ? "home" : view;

  return (
    <div className={"pd-root" + (isDark ? " pd-dark" : "")}>
      <GlobalStyle />
      <div className="pd-app">
        <nav className="pd-navrail">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;
            return (
              <button
                key={item.key}
                className={"pd-navbtn" + (isActive ? " active" : "")}
                onClick={() => setView(item.key)}
                aria-label={item.label}
                title={item.label}
                style={isActive ? { background: item.soft, color: item.color } : undefined}
              >
                <span
                  className="pd-navicon"
                  style={{ background: isActive ? item.color : item.soft, color: isActive ? "#fff" : item.color }}
                >
                  <Icon size={18} />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
          <button className="pd-theme-toggle" onClick={toggleTheme} aria-label={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"} title={isDark ? "ライトモード" : "ダークモード"}>
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="pd-theme-toggle" onClick={() => setSyncOpen(true)} aria-label="他の端末と同期" title="他の端末と同期">
            <Cloud size={17} />
          </button>
        </nav>
        <div className="pd-content">
          {activeView === "home" && (
            <HomeView
              tasks={tasks}
              setTasks={setTasks}
              assignments={assignments}
              onUnlockWork={attemptUnlock}
              codeError={codeError}
              hasCode={!!workCode}
            />
          )}
          {activeView === "diary" && <DiaryView diary={diary} setDiary={setDiary} />}
          {activeView === "notes" && <NotesView notes={notes} setNotes={setNotes} />}
          {activeView === "assignments" && (
            <AssignmentsView assignments={assignments} setAssignments={setAssignments} />
          )}
          {activeView === "work" && workUnlocked && <WorkAnalyticsView tasks={tasks} />}
        </div>
      </div>
      {saveError && <div className="pd-save-warning-fixed">保存に失敗しました。もう一度お試しください。</div>}
      {syncOpen && <SyncPanel onClose={() => setSyncOpen(false)} />}
    </div>
  );
}

function SyncPanel({ onClose }) {
  const existing = window.storage.getSyncConfig ? window.storage.getSyncConfig() : null;
  const [url, setUrl] = useState(existing?.url || "");
  const [key, setKey] = useState(existing?.key || "");
  const [status, setStatus] = useState(existing ? "connected" : "idle"); // idle | testing | connected | error
  const [message, setMessage] = useState("");
  const [pushCount, setPushCount] = useState(null);

  async function handleConnect() {
    if (!url.trim() || !key.trim()) return;
    setStatus("testing");
    setMessage("");
    const cfg = { url: url.trim(), key: key.trim() };
    try {
      await window.storage.testSyncConfig(cfg);
      window.storage.setSyncConfig(cfg);
      setStatus("connected");
      setMessage("接続できました。");
    } catch (e) {
      setStatus("error");
      setMessage("接続に失敗しました。URLとキー、テーブル作成を確認してください。");
    }
  }

  async function handlePush() {
    const cfg = window.storage.getSyncConfig();
    if (!cfg) return;
    try {
      const n = await window.storage.pushAllLocalToCloud(cfg);
      setPushCount(n);
      setMessage(`この端末のデータ(${n}件)をクラウドに送りました。`);
    } catch (e) {
      setMessage("送信に失敗しました。接続情報を確認してください。");
    }
  }

  function handleDisconnect() {
    window.storage.setSyncConfig(null);
    setStatus("idle");
    setUrl("");
    setKey("");
    setMessage("同期を解除しました。この端末のデータはそのまま残ります。");
  }

  return (
    <div className="pd-overlay" onClick={onClose}>
      <div className="pd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pd-panel-header">
          <div className="pd-panel-title">他の端末と同期</div>
          <button className="pd-icon-btn" onClick={onClose} aria-label="閉じる"><X size={16} /></button>
        </div>

        <p className="pd-sync-desc">
          無料のSupabaseというサービスでデータの保存場所を作ると、同じ場所を指定した端末どうしでデータが共有されます。
          未設定の場合、データはこの端末だけに保存されます。
        </p>

        <div className="pd-field">
          <label htmlFor="sync-url">Project URL</label>
          <input id="sync-url" type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
        </div>
        <div className="pd-field">
          <label htmlFor="sync-key">Anon / Publishable key</label>
          <input id="sync-key" type="text" value={key} onChange={(e) => setKey(e.target.value)} placeholder="ey... または sb_publishable_..." />
        </div>

        {message && (
          <div className={"pd-sync-message" + (status === "error" ? " error" : "")}>{message}</div>
        )}

        <div className="pd-panel-actions">
          <button className="pd-btn-secondary" onClick={onClose}>閉じる</button>
          <button className="pd-btn-primary" onClick={handleConnect} disabled={!url.trim() || !key.trim() || status === "testing"}>
            {status === "testing" ? "接続中..." : "接続してテスト"}
          </button>
        </div>

        {status === "connected" && (
          <div className="pd-sync-connected">
            <button className="pd-btn-secondary pd-small" onClick={handlePush}>この端末のデータをクラウドに送る</button>
            <button className="pd-btn-secondary pd-small" onClick={handleDisconnect}>同期を解除</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================= HOME ============================= */

function HomeView({ tasks, setTasks, assignments, onUnlockWork, codeError, hasCode }) {
  const [calMode, setCalMode] = useState("month");
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [viewMode, setViewMode] = useState("day");
  const [formOpen, setFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState(() => toDateKey(new Date()));
  const [formTime, setFormTime] = useState("");
  const [formCategory, setFormCategory] = useState("work");
  const [formRepeat, setFormRepeat] = useState("none");
  const [formRepeatEnd, setFormRepeatEnd] = useState("");
  const [lockOpen, setLockOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const weekScrollRef = useRef(null);

  useEffect(() => {
    if (calMode === "week" && weekScrollRef.current) {
      weekScrollRef.current.scrollTop = 6 * ROW_HEIGHT;
    }
  }, [calMode]);

  const today = new Date();
  const todayKey = toDateKey(today);

  const addTask = useCallback(() => {
    if (!formTitle.trim()) return;
    if (formRepeat === "none") {
      setTasks((prev) => [
        ...prev,
        { id: uid(), title: formTitle.trim(), date: formDate, time: formTime, category: formCategory, done: false },
      ]);
    } else {
      const seriesId = uid();
      const dates = generateOccurrences(formDate, formRepeat, formRepeatEnd || null);
      const newTasks = dates.map((d) => ({
        id: uid(),
        seriesId,
        repeat: formRepeat,
        title: formTitle.trim(),
        date: d,
        time: formTime,
        category: formCategory,
        done: false,
      }));
      setTasks((prev) => [...prev, ...newTasks]);
    }
    setFormTitle("");
    setFormTime("");
    setFormRepeat("none");
    setFormRepeatEnd("");
    setFormOpen(false);
  }, [formTitle, formDate, formTime, formCategory, formRepeat, formRepeatEnd, setTasks]);

  const toggleDone = useCallback((id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }, [setTasks]);

  const deleteTask = useCallback((id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, [setTasks]);

  const tasksByDate = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    for (const key in map) map[key].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    return map;
  }, [tasks]);

  const assignByDate = useMemo(() => {
    const map = {};
    for (const a of assignments) {
      if (a.status === "submitted") continue;
      if (!map[a.dueDate]) map[a.dueDate] = [];
      map[a.dueDate].push(a);
    }
    return map;
  }, [assignments]);

  const todayTasks = tasksByDate[todayKey] || [];
  const overdueTasks = useMemo(
    () => tasks.filter((t) => !t.done && t.date < todayKey).sort((a, b) => a.date.localeCompare(b.date)),
    [tasks, todayKey]
  );

  const weeks = useMemo(() => buildMonthMatrix(monthAnchor), [monthAnchor]);
  const weekDays = useMemo(() => {
    const mon = mondayOf(weekAnchor);
    return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  }, [weekAnchor]);
  function formatWeekLabel(anchor) {
    const mon = mondayOf(anchor);
    const sun = addDays(mon, 6);
    const sameMonth = mon.getMonth() === sun.getMonth();
    return sameMonth
      ? `${mon.getFullYear()}年 ${mon.getMonth() + 1}月${mon.getDate()}日〜${sun.getDate()}日`
      : `${mon.getMonth() + 1}月${mon.getDate()}日〜${sun.getMonth() + 1}月${sun.getDate()}日`;
  }

  const upcomingGrouped = useMemo(() => {
    const dates = Object.keys(tasksByDate)
      .filter((k) => k >= todayKey && tasksByDate[k].some((t) => !t.done))
      .sort();
    return dates.map((k) => ({ date: k, tasks: tasksByDate[k].filter((t) => !t.done) }));
  }, [tasksByDate, todayKey]);

  const doneTasks = useMemo(() => tasks.filter((t) => t.done).sort((a, b) => b.date.localeCompare(a.date)), [tasks]);
  const selectedDateTasks = tasksByDate[selectedDate] || [];
  const selectedDateAssignments = assignByDate[selectedDate] || [];

  function goToday() {
    setMonthAnchor(new Date());
    setWeekAnchor(new Date());
    setSelectedDate(todayKey);
    setViewMode("day");
  }
  function prevWeek() {
    setWeekAnchor((a) => addDays(a, -7));
  }
  function nextWeek() {
    setWeekAnchor((a) => addDays(a, 7));
  }
  function pickDate(d) {
    setSelectedDate(toDateKey(d));
    setViewMode("day");
  }
  function openQuickAdd(dateKey) {
    setFormDate(dateKey || selectedDate);
    setFormRepeat("none");
    setFormRepeatEnd("");
    setFormOpen(true);
  }
  function submitCode() {
    onUnlockWork(codeInput);
    setCodeInput("");
  }
  const greeting = (() => {
    const h = today.getHours();
    if (h < 5) return "夜更かしですね";
    if (h < 11) return "おはようございます";
    if (h < 17) return "こんにちは";
    return "お疲れさまです";
  })();

  return (
    <div className="pd-home-shell">
      <div className="pd-rail">
        <div>
          <div className="pd-greeting">{greeting}</div>
          <div className="pd-greeting-date">
            {today.getFullYear()}年{today.getMonth() + 1}月{today.getDate()}日
          </div>
        </div>

        <button className="pd-quickadd-btn" onClick={() => openQuickAdd(todayKey)}>
          <Plus size={16} /> 予定・タスクを追加
        </button>

        {overdueTasks.length > 0 && (
          <button className="pd-overdue-banner" onClick={() => setViewMode("upcoming")}>
            <AlertCircle size={15} />
            期限切れが{overdueTasks.length}件あります
          </button>
        )}

        <div>
          <div className="pd-section-label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Bell size={13} /> 今日の予定
          </div>
          <div className="pd-today-list">
            {todayTasks.length === 0 && <div className="pd-empty-note">今日の予定はありません</div>}
            {todayTasks.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggleDone} onDelete={deleteTask} />
            ))}
          </div>
        </div>

        <div className="pd-lock-area">
          {!lockOpen ? (
            <button className="pd-lock-toggle" onClick={() => setLockOpen(true)}>
              <Lock size={12} /> {hasCode ? "コードを入力" : "分析ページを設定"}
            </button>
          ) : (
            <div className="pd-lock-row">
              <input
                type="password"
                value={codeInput}
                placeholder="コード"
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitCode();
                }}
                autoFocus
              />
              <button className="pd-icon-btn" onClick={submitCode} aria-label="開く">
                <Check size={14} />
              </button>
            </div>
          )}
          {lockOpen && !hasCode && <div className="pd-lock-hint">初回はここで入力した文字がそのままコードになります</div>}
          {codeError && <div className="pd-lock-error">コードが違います</div>}
        </div>
      </div>

      <div className="pd-main">
        <div>
          <div className="pd-cal-header">
            <div className="pd-cal-title">
              {calMode === "month" ? formatMonthLabel(monthAnchor) : formatWeekLabel(weekAnchor)}
            </div>
            <div className="pd-cal-nav">
              <div className="pd-tabs" style={{ marginRight: 8 }}>
                <button className={"pd-tab" + (calMode === "month" ? " active" : "")} onClick={() => setCalMode("month")}>月</button>
                <button className={"pd-tab" + (calMode === "week" ? " active" : "")} onClick={() => setCalMode("week")}>週</button>
              </div>
              {calMode === "month" ? (
                <>
                  <button className="pd-today-btn" onClick={goToday}>今日</button>
                  <button className="pd-icon-btn" aria-label="前の月" onClick={() => setMonthAnchor((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1))}>
                    <ChevronLeft size={16} />
                  </button>
                  <button className="pd-icon-btn" aria-label="次の月" onClick={() => setMonthAnchor((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1))}>
                    <ChevronRight size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button className="pd-today-btn" onClick={goToday}>今週</button>
                  <button className="pd-icon-btn" aria-label="前の週" onClick={prevWeek}>
                    <ChevronLeft size={16} />
                  </button>
                  <button className="pd-icon-btn" aria-label="次の週" onClick={nextWeek}>
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          {calMode === "month" && (
            <>
              <div className="pd-weekday-row">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="pd-weekday">{w}</div>
                ))}
              </div>

              <div className="pd-cal-grid">
                {weeks.flat().map((d, i) => {
                  const key = toDateKey(d);
                  const inMonth = d.getMonth() === monthAnchor.getMonth();
                  const dayTasks = tasksByDate[key] || [];
                  const dayAssign = assignByDate[key] || [];
                  const cats = [...new Set(dayTasks.map((t) => t.category))];
                  return (
                    <div
                      key={i}
                      className={"pd-cell" + (inMonth ? "" : " out") + (key === todayKey ? " today" : "") + (key === selectedDate ? " selected" : "")}
                      onClick={() => pickDate(d)}
                    >
                      <div className="pd-cell-num">{d.getDate()}</div>
                      <div className="pd-cell-dots">
                        {cats.slice(0, 3).map((c) => (
                          <span key={c} className="pd-dot" style={{ background: CATEGORIES[c].color }} />
                        ))}
                        {dayAssign.length > 0 && <span className="pd-dot" style={{ background: "var(--pd-purple)" }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {calMode === "week" && (
            <div className="pd-week-tg">
              <div className="pd-week-tg-row pd-week-tg-headerrow">
                <div className="pd-week-tg-cornercell" />
                {weekDays.map((d, i) => {
                  const key = toDateKey(d);
                  return (
                    <div
                      key={i}
                      className={"pd-week-tg-daycell" + (key === todayKey ? " today" : "") + (key === selectedDate ? " selected" : "")}
                      onClick={() => pickDate(d)}
                    >
                      <div className="pd-week-tg-daylabel">{WEEKDAYS[i]}</div>
                      <div className="pd-week-tg-daynum">{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>

              <div className="pd-week-tg-row pd-week-tg-alldayrow">
                <div className="pd-week-tg-cornercell small">終日</div>
                {weekDays.map((d, i) => {
                  const key = toDateKey(d);
                  const allDayTasks = (tasksByDate[key] || []).filter((t) => !t.time);
                  const dayAssign = assignByDate[key] || [];
                  return (
                    <div key={i} className="pd-week-tg-alldaycell" onClick={() => pickDate(d)}>
                      {dayAssign.map((a) => (
                        <div key={a.id} className="pd-week-chip assign">
                          <span className="pd-dot" style={{ background: "var(--pd-purple)" }} />
                          {a.title}
                        </div>
                      ))}
                      {allDayTasks.map((t) => (
                        <div key={t.id} className={"pd-week-chip" + (t.done ? " done" : "")}>
                          <span className="pd-dot" style={{ background: CATEGORIES[t.category].color }} />
                          {t.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              <div className="pd-week-tg-scroll" ref={weekScrollRef}>
                <div className="pd-week-tg-body">
                  <div className="pd-week-tg-hourlabels">
                    {HOUR_MARKS.map((h) => (
                      <div key={h} className="pd-week-tg-hourlabel" style={{ height: ROW_HEIGHT }}>
                        {h}:00
                      </div>
                    ))}
                  </div>
                  {weekDays.map((d, i) => {
                    const key = toDateKey(d);
                    const timedTasks = (tasksByDate[key] || []).filter((t) => t.time);
                    return (
                      <div
                        key={i}
                        className={"pd-week-tg-daycol" + (key === todayKey ? " today" : "")}
                        style={{
                          height: 24 * ROW_HEIGHT,
                          backgroundImage: `repeating-linear-gradient(to bottom, var(--pd-line) 0px, var(--pd-line) 1px, transparent 1px, transparent ${ROW_HEIGHT}px)`,
                        }}
                        onClick={() => pickDate(d)}
                      >
                        {timedTasks.map((t) => {
                          const [hh, mm] = t.time.split(":").map(Number);
                          const top = (hh + mm / 60) * ROW_HEIGHT;
                          const cat = CATEGORIES[t.category] || CATEGORIES.work;
                          return (
                            <div
                              key={t.id}
                              className={"pd-week-tg-event" + (t.done ? " done" : "")}
                              style={{ top, background: cat.color }}
                              title={`${t.time} ${t.title}`}
                            >
                              <span className="pd-week-tg-event-time">{t.time}</span>
                              <span>{t.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pd-list-section">
          <div className="pd-list-header">
            <div className="pd-list-title">
              {viewMode === "day" && formatDateLabel(selectedDate)}
              {viewMode === "upcoming" && "今後の予定"}
              {viewMode === "done" && "完了したタスク"}
            </div>
            <div className="pd-tabs">
              <button className={"pd-tab" + (viewMode === "day" ? " active" : "")} onClick={() => setViewMode("day")}>選択した日</button>
              <button className={"pd-tab" + (viewMode === "upcoming" ? " active" : "")} onClick={() => setViewMode("upcoming")}>今後の予定</button>
              <button className={"pd-tab" + (viewMode === "done" ? " active" : "")} onClick={() => setViewMode("done")}>完了済み</button>
            </div>
          </div>

          {viewMode === "day" && (
            <div>
              {selectedDateAssignments.length > 0 && (
                <>
                  <div className="pd-group-heading" style={{ color: "var(--pd-purple)" }}>課題の締切</div>
                  {selectedDateAssignments.map((a) => (
                    <div key={a.id} className="pd-mini-assign">
                      <span className="pd-dot" style={{ background: "var(--pd-purple)" }} />
                      {a.title}{a.course ? `・${a.course}` : ""}
                    </div>
                  ))}
                </>
              )}
              {selectedDateTasks.length === 0 ? (
                <div className="pd-empty-note">この日の予定はまだありません</div>
              ) : (
                selectedDateTasks.map((t) => <TaskRow key={t.id} task={t} onToggle={toggleDone} onDelete={deleteTask} />)
              )}
            </div>
          )}

          {viewMode === "upcoming" && (
            <div>
              {overdueTasks.length > 0 && (
                <>
                  <div className="pd-group-heading" style={{ color: "var(--pd-coral)" }}>期限切れ</div>
                  {overdueTasks.map((t) => <TaskRow key={t.id} task={t} onToggle={toggleDone} onDelete={deleteTask} showDate />)}
                </>
              )}
              {upcomingGrouped.length === 0 && overdueTasks.length === 0 && <div className="pd-empty-note">今後の予定はありません</div>}
              {upcomingGrouped.map((g) => (
                <div key={g.date}>
                  <div className="pd-group-heading">{formatDateLabel(g.date)}</div>
                  {g.tasks.map((t) => <TaskRow key={t.id} task={t} onToggle={toggleDone} onDelete={deleteTask} />)}
                </div>
              ))}
            </div>
          )}

          {viewMode === "done" && (
            <div>
              {doneTasks.length === 0 ? (
                <div className="pd-empty-note">完了したタスクはまだありません</div>
              ) : (
                doneTasks.map((t) => <TaskRow key={t.id} task={t} onToggle={toggleDone} onDelete={deleteTask} showDate />)
              )}
            </div>
          )}
        </div>
      </div>

      {formOpen && (
        <div className="pd-overlay" onClick={() => setFormOpen(false)}>
          <div className="pd-panel" onClick={(e) => e.stopPropagation()}>
            <div className="pd-panel-header">
              <div className="pd-panel-title">予定・タスクを追加</div>
              <button className="pd-icon-btn" onClick={() => setFormOpen(false)} aria-label="閉じる"><X size={16} /></button>
            </div>
            <div className="pd-field">
              <label htmlFor="pd-title">内容</label>
              <input id="pd-title" type="text" placeholder="例: クライアントに見積もり送付" value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)} autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") addTask(); }} />
            </div>
            <div className="pd-row2">
              <div className="pd-field">
                <label htmlFor="pd-date">日付</label>
                <input id="pd-date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div className="pd-field">
                <label htmlFor="pd-time">時刻(任意)</label>
                <input id="pd-time" type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} />
              </div>
            </div>
            <div className="pd-field">
              <label>カテゴリ</label>
              <div className="pd-cat-row">
                {Object.entries(CATEGORIES).map(([key, val]) => (
                  <button key={key} className={"pd-cat-btn" + (formCategory === key ? " active" : "")}
                    style={formCategory === key ? { background: val.color, color: "#fff" } : undefined} onClick={() => setFormCategory(key)}>
                    {val.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="pd-field">
              <label>繰り返し</label>
              <div className="pd-cat-row">
                {Object.entries(REPEAT_LABELS).map(([key, label]) => (
                  <button key={key} className={"pd-cat-btn" + (formRepeat === key ? " active" : "")}
                    style={formRepeat === key ? { background: "var(--pd-teal)", color: "#fff" } : undefined} onClick={() => setFormRepeat(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {formRepeat !== "none" && (
              <div className="pd-field">
                <label htmlFor="pd-repeat-end">
                  終了日(任意・未入力なら{REPEAT_CAP_LABELS[formRepeat]}分作成)
                </label>
                <input
                  id="pd-repeat-end"
                  type="date"
                  value={formRepeatEnd}
                  min={formDate}
                  onChange={(e) => setFormRepeatEnd(e.target.value)}
                />
              </div>
            )}
            <div className="pd-panel-actions">
              <button className="pd-btn-secondary" onClick={() => setFormOpen(false)}>キャンセル</button>
              <button className="pd-btn-primary" onClick={addTask} disabled={!formTitle.trim()}>追加する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete, showDate }) {
  const cat = CATEGORIES[task.category] || CATEGORIES.work;
  return (
    <div className={"pd-task-row" + (task.done ? " done" : "")}>
      <button className={"pd-checkbox" + (task.done ? " checked" : "")} onClick={() => onToggle(task.id)} aria-label={task.done ? "未完了に戻す" : "完了にする"}>
        {task.done && <Check size={11} color="white" strokeWidth={3} />}
      </button>
      <div className="pd-task-body">
        <div className="pd-task-title">{task.title}</div>
        <div className="pd-task-meta">
          <span className="pd-dot" style={{ background: cat.color }} />
          <span>{cat.label}</span>
          {task.time && (<><span>·</span><Clock size={11} /><span>{task.time}</span></>)}
          {task.seriesId && (<><span>·</span><Repeat size={11} /><span>{REPEAT_LABELS[task.repeat] || "繰り返し"}</span></>)}
          {showDate && (<><span>·</span><span>{formatDateLabel(task.date)}</span></>)}
        </div>
      </div>
      <button className="pd-del-btn" onClick={() => onDelete(task.id)} aria-label="削除"><Trash2 size={14} /></button>
    </div>
  );
}

/* ============================= DIARY ============================= */

function DiaryView({ diary, setDiary }) {
  const sorted = useMemo(() => [...diary].sort((a, b) => b.date.localeCompare(a.date)), [diary]);
  const [selectedId, setSelectedId] = useState(sorted[0]?.id || null);
  const [formOpen, setFormOpen] = useState(false);
  const [fDate, setFDate] = useState(() => toDateKey(new Date()));
  const [fTitle, setFTitle] = useState("");
  const [fContent, setFContent] = useState("");
  const [fMood, setFMood] = useState("neutral");
  const [editingId, setEditingId] = useState(null);

  const selected = diary.find((d) => d.id === selectedId) || null;

  function openNew() {
    setEditingId(null);
    setFDate(toDateKey(new Date()));
    setFTitle("");
    setFContent("");
    setFMood("neutral");
    setFormOpen(true);
  }
  function openEdit(entry) {
    setEditingId(entry.id);
    setFDate(entry.date);
    setFTitle(entry.title);
    setFContent(entry.content);
    setFMood(entry.mood || "neutral");
    setFormOpen(true);
  }
  function save() {
    if (!fContent.trim()) return;
    if (editingId) {
      setDiary((prev) => prev.map((d) => (d.id === editingId ? { ...d, date: fDate, title: fTitle.trim(), content: fContent.trim(), mood: fMood } : d)));
      setSelectedId(editingId);
    } else {
      const newEntry = { id: uid(), date: fDate, title: fTitle.trim(), content: fContent.trim(), mood: fMood };
      setDiary((prev) => [...prev, newEntry]);
      setSelectedId(newEntry.id);
    }
    setFormOpen(false);
  }
  function remove(id) {
    setDiary((prev) => prev.filter((d) => d.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <div className="pd-view">
      <div className="pd-view-header">
        <div className="pd-view-title">日記</div>
        <button className="pd-quickadd-btn pd-inline" onClick={openNew}><Plus size={16} /> 新しい日記</button>
      </div>

      <div className="pd-diary-shell">
        <div className="pd-diary-list">
          {sorted.length === 0 && <div className="pd-empty-note">まだ日記がありません</div>}
          {sorted.map((entry) => (
            <button
              key={entry.id}
              className={"pd-diary-item" + (entry.id === selectedId ? " active" : "")}
              onClick={() => setSelectedId(entry.id)}
            >
              <span className="pd-dot" style={{ background: MOODS[entry.mood || "neutral"].color }} />
              <div className="pd-diary-item-body">
                <div className="pd-diary-item-date">{formatDateLabel(entry.date)}</div>
                <div className="pd-diary-item-title">{entry.title || entry.content.slice(0, 20)}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="pd-diary-detail">
          {!selected ? (
            <div className="pd-empty-note">左の一覧から日記を選ぶか、新しく書いてみましょう</div>
          ) : (
            <>
              <div className="pd-diary-detail-header">
                <div>
                  <div className="pd-diary-detail-date">{formatDateLabel(selected.date)}</div>
                  {selected.title && <div className="pd-diary-detail-title">{selected.title}</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="pd-icon-btn" onClick={() => openEdit(selected)} aria-label="編集"><Pencil size={15} /></button>
                  <button className="pd-icon-btn" onClick={() => remove(selected.id)} aria-label="削除"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="pd-diary-detail-content">{selected.content}</div>
            </>
          )}
        </div>
      </div>

      {formOpen && (
        <div className="pd-overlay" onClick={() => setFormOpen(false)}>
          <div className="pd-panel" onClick={(e) => e.stopPropagation()}>
            <div className="pd-panel-header">
              <div className="pd-panel-title">{editingId ? "日記を編集" : "日記を書く"}</div>
              <button className="pd-icon-btn" onClick={() => setFormOpen(false)} aria-label="閉じる"><X size={16} /></button>
            </div>
            <div className="pd-row2">
              <div className="pd-field">
                <label htmlFor="dy-date">日付</label>
                <input id="dy-date" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
              </div>
              <div className="pd-field">
                <label>気分</label>
                <div className="pd-cat-row">
                  {Object.entries(MOODS).map(([key, val]) => (
                    <button key={key} className={"pd-cat-btn" + (fMood === key ? " active" : "")}
                      style={fMood === key ? { background: val.color, color: "#fff" } : undefined} onClick={() => setFMood(key)}>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="pd-field">
              <label htmlFor="dy-title">タイトル(任意)</label>
              <input id="dy-title" type="text" value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="例: 週の振り返り" />
            </div>
            <div className="pd-field">
              <label htmlFor="dy-content">内容</label>
              <textarea id="dy-content" rows={7} value={fContent} onChange={(e) => setFContent(e.target.value)} placeholder="今日あったことを書いてみましょう" />
            </div>
            <div className="pd-panel-actions">
              <button className="pd-btn-secondary" onClick={() => setFormOpen(false)}>キャンセル</button>
              <button className="pd-btn-primary" onClick={save} disabled={!fContent.trim()}>保存する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================= NOTES ============================= */

function NotesView({ notes, setNotes }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [fTitle, setFTitle] = useState("");
  const [fContent, setFContent] = useState("");

  const sorted = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [notes]);

  function openNew() {
    setEditingId(null);
    setFTitle("");
    setFContent("");
    setFormOpen(true);
  }
  function openEdit(n) {
    setEditingId(n.id);
    setFTitle(n.title);
    setFContent(n.content);
    setFormOpen(true);
  }
  function save() {
    if (!fTitle.trim() && !fContent.trim()) return;
    if (editingId) {
      setNotes((prev) => prev.map((n) => (n.id === editingId ? { ...n, title: fTitle.trim(), content: fContent.trim(), updatedAt: Date.now() } : n)));
    } else {
      setNotes((prev) => [...prev, { id: uid(), title: fTitle.trim(), content: fContent.trim(), pinned: false, updatedAt: Date.now() }]);
    }
    setFormOpen(false);
  }
  function togglePin(id) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  }
  function remove(id) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="pd-view">
      <div className="pd-view-header">
        <div className="pd-view-title">メモ</div>
        <button className="pd-quickadd-btn pd-inline" onClick={openNew}><Plus size={16} /> 新しいメモ</button>
      </div>

      {sorted.length === 0 ? (
        <div className="pd-empty-note">まだメモがありません</div>
      ) : (
        <div className="pd-notes-grid">
          {sorted.map((n) => (
            <div key={n.id} className={"pd-note-card" + (n.pinned ? " pinned" : "")}>
              <div className="pd-note-card-header">
                <div className="pd-note-title">{n.title || "無題のメモ"}</div>
                <button className={"pd-pin-btn" + (n.pinned ? " active" : "")} onClick={() => togglePin(n.id)} aria-label="ピン留め">
                  <Pin size={14} />
                </button>
              </div>
              <div className="pd-note-content">{n.content}</div>
              <div className="pd-note-actions">
                <button className="pd-icon-btn" onClick={() => openEdit(n)} aria-label="編集"><Pencil size={14} /></button>
                <button className="pd-icon-btn" onClick={() => remove(n.id)} aria-label="削除"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="pd-overlay" onClick={() => setFormOpen(false)}>
          <div className="pd-panel" onClick={(e) => e.stopPropagation()}>
            <div className="pd-panel-header">
              <div className="pd-panel-title">{editingId ? "メモを編集" : "新しいメモ"}</div>
              <button className="pd-icon-btn" onClick={() => setFormOpen(false)} aria-label="閉じる"><X size={16} /></button>
            </div>
            <div className="pd-field">
              <label htmlFor="nt-title">タイトル</label>
              <input id="nt-title" type="text" value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="例: 買い物リスト" autoFocus />
            </div>
            <div className="pd-field">
              <label htmlFor="nt-content">内容</label>
              <textarea id="nt-content" rows={7} value={fContent} onChange={(e) => setFContent(e.target.value)} placeholder="メモの内容" />
            </div>
            <div className="pd-panel-actions">
              <button className="pd-btn-secondary" onClick={() => setFormOpen(false)}>キャンセル</button>
              <button className="pd-btn-primary" onClick={save} disabled={!fTitle.trim() && !fContent.trim()}>保存する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================= ASSIGNMENTS ============================= */

function urgencyColor(days) {
  if (days <= 2) return "var(--pd-coral)";
  if (days <= 7) return "var(--pd-amber)";
  return "var(--pd-teal)";
}
function urgencyLabel(days) {
  if (days < 0) return `期限切れ・${Math.abs(days)}日超過`;
  if (days === 0) return "今日が締切";
  return `あと${days}日`;
}
function urgencyWidth(days) {
  const clamped = Math.max(0, Math.min(30, days));
  return Math.max(6, 100 - (clamped / 30) * 100);
}

function AssignmentsView({ assignments, setAssignments }) {
  const [mode, setMode] = useState("list"); // "list" | "gantt"
  const [formOpen, setFormOpen] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fCourse, setFCourse] = useState("");
  const [fStart, setFStart] = useState(() => toDateKey(new Date()));
  const [fDue, setFDue] = useState(() => toDateKey(new Date()));

  const pending = useMemo(
    () => assignments.filter((a) => a.status !== "submitted").sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [assignments]
  );
  const submitted = useMemo(
    () => assignments.filter((a) => a.status === "submitted").sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
    [assignments]
  );
  const ganttItems = useMemo(() => [...assignments].sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [assignments]);

  function add() {
    if (!fTitle.trim() || !fDue) return;
    const start = fStart && fStart <= fDue ? fStart : fDue;
    setAssignments((prev) => [...prev, { id: uid(), title: fTitle.trim(), course: fCourse.trim(), startDate: start, dueDate: fDue, status: "pending" }]);
    setFTitle("");
    setFCourse("");
    setFormOpen(false);
  }
  function toggleStatus(id) {
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, status: a.status === "submitted" ? "pending" : "submitted" } : a)));
  }
  function remove(id) {
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="pd-view">
      <div className="pd-view-header">
        <div className="pd-view-title">課題</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="pd-tabs">
            <button className={"pd-tab" + (mode === "list" ? " active" : "")} onClick={() => setMode("list")}>
              <List size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />リスト
            </button>
            <button className={"pd-tab" + (mode === "gantt" ? " active" : "")} onClick={() => setMode("gantt")}>
              <BarChart3 size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />ガントチャート
            </button>
          </div>
          <button className="pd-quickadd-btn pd-inline" onClick={() => setFormOpen(true)}><Plus size={16} /> 課題を追加</button>
        </div>
      </div>

      {mode === "list" && (
        <>
          <div className="pd-section-label" style={{ marginBottom: 10 }}>未提出({pending.length})</div>
          {pending.length === 0 ? (
            <div className="pd-empty-note">未提出の課題はありません</div>
          ) : (
            <div className="pd-assign-list">
              {pending.map((a) => {
                const d = daysUntil(a.dueDate);
                const color = urgencyColor(d);
                return (
                  <div key={a.id} className="pd-assign-card">
                    <div className="pd-assign-top">
                      <div>
                        <div className="pd-assign-title">{a.title}</div>
                        {a.course && <div className="pd-assign-course">{a.course}</div>}
                      </div>
                      <div className="pd-assign-actions">
                        <button className="pd-btn-secondary pd-small" onClick={() => toggleStatus(a.id)}>提出済みにする</button>
                        <button className="pd-icon-btn" onClick={() => remove(a.id)} aria-label="削除"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="pd-assign-meta">
                      <span style={{ color }}>{urgencyLabel(d)}</span>
                      <span className="pd-assign-date">{formatDateLabel(a.dueDate)}締切</span>
                    </div>
                    <div className="pd-assign-bar-track">
                      <div className="pd-assign-bar-fill" style={{ width: `${urgencyWidth(d)}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {submitted.length > 0 && (
            <>
              <div className="pd-section-label" style={{ margin: "22px 0 10px" }}>提出済み({submitted.length})</div>
              <div className="pd-assign-list">
                {submitted.map((a) => (
                  <div key={a.id} className="pd-assign-card submitted">
                    <div className="pd-assign-top">
                      <div>
                        <div className="pd-assign-title">{a.title}</div>
                        {a.course && <div className="pd-assign-course">{a.course}</div>}
                      </div>
                      <div className="pd-assign-actions">
                        <button className="pd-btn-secondary pd-small" onClick={() => toggleStatus(a.id)}>未提出に戻す</button>
                        <button className="pd-icon-btn" onClick={() => remove(a.id)} aria-label="削除"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="pd-assign-meta">
                      <Check size={13} color="var(--pd-ink-muted)" />
                      <span className="pd-assign-date">{formatDateLabel(a.dueDate)}締切</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {mode === "gantt" && <GanttChart items={ganttItems} />}

      {formOpen && (
        <div className="pd-overlay" onClick={() => setFormOpen(false)}>
          <div className="pd-panel" onClick={(e) => e.stopPropagation()}>
            <div className="pd-panel-header">
              <div className="pd-panel-title">課題を追加</div>
              <button className="pd-icon-btn" onClick={() => setFormOpen(false)} aria-label="閉じる"><X size={16} /></button>
            </div>
            <div className="pd-field">
              <label htmlFor="as-title">課題名</label>
              <input id="as-title" type="text" value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="例: レポート提出" autoFocus />
            </div>
            <div className="pd-field">
              <label htmlFor="as-course">科目・カテゴリ(任意)</label>
              <input id="as-course" type="text" value={fCourse} onChange={(e) => setFCourse(e.target.value)} placeholder="例: 経済学" />
            </div>
            <div className="pd-row2">
              <div className="pd-field">
                <label htmlFor="as-start">着手日(任意)</label>
                <input id="as-start" type="date" value={fStart} onChange={(e) => setFStart(e.target.value)} />
              </div>
              <div className="pd-field">
                <label htmlFor="as-due">締切日</label>
                <input id="as-due" type="date" value={fDue} onChange={(e) => setFDue(e.target.value)} />
              </div>
            </div>
            <div className="pd-panel-actions">
              <button className="pd-btn-secondary" onClick={() => setFormOpen(false)}>キャンセル</button>
              <button className="pd-btn-primary" onClick={add} disabled={!fTitle.trim() || !fDue}>追加する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GanttChart({ items }) {
  if (items.length === 0) {
    return <div className="pd-empty-note">まだ課題がありません。追加すると期間バーで表示されます。</div>;
  }
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const starts = items.map((a) => parseDateKey(a.startDate || a.dueDate));
  const ends = items.map((a) => parseDateKey(a.dueDate));
  let minDate = new Date(Math.min(todayMid.getTime(), ...starts.map((d) => d.getTime())));
  let maxDate = new Date(Math.max(todayMid.getTime(), ...ends.map((d) => d.getTime())));
  minDate = addDays(minDate, -1);
  maxDate = addDays(maxDate, 2);
  const totalDays = diffDays(minDate, maxDate) + 1;
  const colWidth = 32;
  const dayList = Array.from({ length: totalDays }, (_, i) => addDays(minDate, i));
  const todayIdx = diffDays(minDate, todayMid);

  return (
    <div className="pd-gantt-outer">
      <div className="pd-gantt-labels">
        <div className="pd-gantt-labels-header" />
        {items.map((a) => (
          <div key={a.id} className="pd-gantt-label-row">
            <div className="pd-gantt-label-title">{a.title}</div>
            {a.course && <div className="pd-gantt-label-course">{a.course}</div>}
          </div>
        ))}
      </div>
      <div className="pd-gantt-scrollarea">
        <div style={{ width: totalDays * colWidth }}>
          <div className="pd-gantt-header">
            {dayList.map((d, i) => (
              <div key={i} className="pd-gantt-daycell" style={{ width: colWidth }}>
                {(i === 0 || d.getDate() === 1) && <div className="pd-gantt-month">{d.getMonth() + 1}月</div>}
                <div className="pd-gantt-daynum">{d.getDate()}</div>
              </div>
            ))}
          </div>
          <div className="pd-gantt-body">
            <div className="pd-gantt-todayline" style={{ left: todayIdx * colWidth + colWidth / 2 }} />
            {items.map((a) => {
              const s = parseDateKey(a.startDate || a.dueDate);
              const e = parseDateKey(a.dueDate);
              const startIdx = diffDays(minDate, s);
              const endIdx = diffDays(minDate, e);
              const left = startIdx * colWidth + 2;
              const width = Math.max(colWidth - 4, (endIdx - startIdx + 1) * colWidth - 4);
              const color = a.status === "submitted" ? "#BEBAAE" : urgencyColor(daysUntil(a.dueDate));
              return (
                <div key={a.id} className="pd-gantt-row">
                  <div className="pd-gantt-bar" style={{ left, width, background: color }} title={`${a.title}(${formatDateLabel(a.dueDate)}締切)`}>
                    <span>{a.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================= WORK ANALYTICS ============================= */

function mondayOf(d) {
  const day = (d.getDay() + 6) % 7;
  const r = new Date(d);
  r.setDate(d.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}
function getWeekRanges(n) {
  const ranges = [];
  const thisMonday = mondayOf(new Date());
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(thisMonday, -7 * i);
    const end = addDays(start, 6);
    ranges.push({ start: toDateKey(start), end: toDateKey(end), label: `${start.getMonth() + 1}/${start.getDate()}` });
  }
  return ranges;
}
function getMonthRanges(n) {
  const ranges = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = toDateKey(d);
    const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    ranges.push({ start, end: toDateKey(endDate), label: `${d.getMonth() + 1}月` });
  }
  return ranges;
}
function computeTrend(tasks, ranges) {
  return ranges.map((r) => {
    const inRange = tasks.filter((t) => t.date >= r.start && t.date <= r.end);
    return { label: r.label, 予定: inRange.length, 完了: inRange.filter((t) => t.done).length };
  });
}
function computeCategoryBreakdown(tasks) {
  return Object.entries(CATEGORIES).map(([key, val]) => {
    const items = tasks.filter((t) => t.category === key);
    return { key, label: val.label, 完了: items.filter((t) => t.done).length, 未完了: items.filter((t) => !t.done).length };
  });
}

function WorkAnalyticsView({ tasks }) {
  const [granularity, setGranularity] = useState("week");

  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const rate = total ? Math.round((done / total) * 100) : 0;

  const ranges = granularity === "week" ? getWeekRanges(8) : getMonthRanges(6);
  const trendData = useMemo(() => computeTrend(tasks, ranges), [tasks, granularity]);
  const categoryData = useMemo(() => computeCategoryBreakdown(tasks), [tasks]);

  return (
    <div className="pd-view">
      <div className="pd-view-header">
        <div className="pd-view-title">仕事の分析</div>
      </div>

      <div className="pd-stat-row">
        <div className="pd-stat-card">
          <div className="pd-stat-label">完了率</div>
          <div className="pd-stat-value">{rate}%</div>
          <div className="pd-stat-sub">{done} / {total}件 完了</div>
          <div className="pd-assign-bar-track" style={{ marginTop: 10 }}>
            <div className="pd-assign-bar-fill" style={{ width: `${rate}%`, background: "var(--pd-teal)" }} />
          </div>
        </div>
        <div className="pd-stat-card">
          <div className="pd-stat-label">総タスク数</div>
          <div className="pd-stat-value">{total}</div>
          <div className="pd-stat-sub">未完了 {total - done}件</div>
        </div>
      </div>

      <div className="pd-chart-card">
        <div className="pd-chart-card-header">
          <div className="pd-chart-title">カテゴリ別の作業量</div>
        </div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E1D8" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={{ stroke: "#E4E1D8" }} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 12.5, fill: "#20242B" }} axisLine={{ stroke: "#E4E1D8" }} tickLine={false} width={50} />
              <Tooltip contentStyle={{ fontSize: 12.5, borderRadius: 8, border: "1px solid #E4E1D8" }} />
              <Legend wrapperStyle={{ fontSize: 12.5 }} />
              <Bar dataKey="完了" stackId="a" fill="#2B6F6B" radius={[0, 0, 0, 0]} />
              <Bar dataKey="未完了" stackId="a" fill="#D8D4C8" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="pd-chart-card">
        <div className="pd-chart-card-header">
          <div className="pd-chart-title">傾向</div>
          <div className="pd-tabs">
            <button className={"pd-tab" + (granularity === "week" ? " active" : "")} onClick={() => setGranularity("week")}>週次</button>
            <button className={"pd-tab" + (granularity === "month" ? " active" : "")} onClick={() => setGranularity("month")}>月次</button>
          </div>
        </div>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={trendData} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E1D8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={{ stroke: "#E4E1D8" }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={{ stroke: "#E4E1D8" }} tickLine={false} width={28} />
              <Tooltip contentStyle={{ fontSize: 12.5, borderRadius: 8, border: "1px solid #E4E1D8" }} />
              <Legend wrapperStyle={{ fontSize: 12.5 }} />
              <Bar dataKey="予定" fill="#F0EEE6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="完了" fill="#2B6F6B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ============================= STYLE ============================= */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

      .pd-root {
        --pd-bg: #F7F5F0;
        --pd-surface: #FFFFFF;
        --pd-ink: #21252C;
        --pd-ink-muted: #797E86;
        --pd-line: #ECE9E0;
        --pd-teal: #2B6F6B;
        --pd-teal-soft: #E4EEEC;
        --pd-amber: #C98A2C;
        --pd-amber-soft: #F6EBD9;
        --pd-coral: #C4573F;
        --pd-coral-soft: #F7E4DE;
        --pd-purple: #6E5AA8;
        --pd-purple-soft: #EDE9F5;
        --pd-rose: #B8577A;
        --pd-rose-soft: #F6E5EC;
        --pd-blue: #3E76B0;
        --pd-blue-soft: #E3EDF6;
        --pd-hover: #EFEBE0;
        --pd-primary-bg: #21252C;
        --pd-primary-text: #FFFFFF;
        --pd-primary-hover: #34394A;
        --pd-gradient: linear-gradient(135deg, #15A594 0%, #6C4AD6 100%);
        --pd-gradient-btn: linear-gradient(135deg, #159C8D 0%, #5D3FC4 100%);
        --pd-gradient-btn-hover: linear-gradient(135deg, #128577 0%, #4C33AD 100%);

        font-family: 'Inter', system-ui, sans-serif;
        color: var(--pd-ink);
        background: var(--pd-bg);
        width: 100%;
        box-sizing: border-box;
        border-radius: 16px;
        overflow: hidden;
        position: relative;
        transition: background 0.2s ease, color 0.2s ease;
      }
      .pd-root.pd-dark {
        --pd-bg: #16181D;
        --pd-surface: #1F2126;
        --pd-ink: #ECEDEF;
        --pd-ink-muted: #999DA6;
        --pd-line: #303339;
        --pd-teal: #52B0A8;
        --pd-teal-soft: #1E3936;
        --pd-amber: #E0A24C;
        --pd-amber-soft: #3B2E18;
        --pd-coral: #E07A62;
        --pd-coral-soft: #3D241D;
        --pd-purple: #9C8AD1;
        --pd-purple-soft: #2A2440;
        --pd-rose: #D486A2;
        --pd-rose-soft: #3A2430;
        --pd-blue: #6FA6DB;
        --pd-blue-soft: #1E2D3E;
        --pd-hover: #2A2D34;
        --pd-primary-bg: #ECEDEF;
        --pd-primary-text: #16181D;
        --pd-primary-hover: #D5D7DB;
        --pd-gradient: linear-gradient(135deg, #52B0A8 0%, #9C8AD1 100%);
        --pd-gradient-btn: linear-gradient(135deg, #1E7A72 0%, #4B3A8C 100%);
        --pd-gradient-btn-hover: linear-gradient(135deg, #256F68 0%, #59448F 100%);
      }
      .pd-root * { box-sizing: border-box; }
      .pd-root ::-webkit-scrollbar { width: 8px; height: 8px; }
      .pd-root ::-webkit-scrollbar-track { background: transparent; }
      .pd-root ::-webkit-scrollbar-thumb { background: #DAD6C9; border-radius: 8px; }
      .pd-root ::-webkit-scrollbar-thumb:hover { background: #C9C4B3; }
      .pd-root button { transition: transform 0.1s ease, background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease; }
      .pd-root button:active { transform: scale(0.97); }

      .pd-app { display: flex; min-height: 640px; }
      @media (max-width: 780px) { .pd-app { flex-direction: column; } }

      .pd-navrail {
        width: 84px; flex-shrink: 0; background: var(--pd-surface); border-right: 1px solid var(--pd-line);
        display: flex; flex-direction: column; align-items: stretch; padding: 20px 8px; gap: 4px;
      }
      @media (max-width: 780px) {
        .pd-navrail { width: 100%; flex-direction: row; border-right: none; border-bottom: 1px solid var(--pd-line); padding: 8px; }
      }
      .pd-navbtn {
        display: flex; flex-direction: column; align-items: center; gap: 6px; background: none; border: none;
        color: var(--pd-ink-muted); padding: 8px 4px 10px; border-radius: 12px; cursor: pointer; font-size: 11px;
        font-family: 'Inter', sans-serif; transition: background 0.15s ease, color 0.15s ease; flex: 1;
      }
      .pd-navicon { width: 36px; height: 36px; border-radius: 11px; display: flex; align-items: center; justify-content: center; transition: background 0.15s ease, color 0.15s ease; }
      .pd-navbtn:hover:not(.active) { background: var(--pd-bg); }
      .pd-navbtn.active { font-weight: 600; }
      .pd-navbtn:focus-visible { outline: 2px solid var(--pd-teal); outline-offset: 1px; }

      .pd-theme-toggle {
        display: flex; align-items: center; justify-content: center; background: none; border: none;
        color: var(--pd-ink-muted); cursor: pointer; border-radius: 10px; width: 36px; height: 36px;
        margin: 8px auto 0; flex-shrink: 0;
      }
      .pd-theme-toggle:hover { background: var(--pd-bg); color: var(--pd-ink); }
      .pd-theme-toggle:focus-visible { outline: 2px solid var(--pd-teal); outline-offset: 1px; }
      @media (max-width: 780px) { .pd-theme-toggle { margin: 0 0 0 auto; } }

      .pd-content { flex: 1; min-width: 0; overflow: auto; background: var(--pd-bg); }

      .pd-home-shell { display: grid; grid-template-columns: 280px 1fr; min-height: 640px; }
      @media (max-width: 780px) { .pd-home-shell { grid-template-columns: 1fr; } }

      .pd-rail { background: var(--pd-surface); border-right: 1px solid var(--pd-line); padding: 26px 22px; display: flex; flex-direction: column; gap: 22px; }
      @media (max-width: 780px) { .pd-rail { border-right: none; border-bottom: 1px solid var(--pd-line); } }
      .pd-greeting {
        font-family: 'Libre Franklin', sans-serif; font-weight: 700; font-size: 21px; letter-spacing: -0.015em; line-height: 1.25;
        background: var(--pd-gradient); -webkit-background-clip: text; background-clip: text; color: transparent;
      }
      .pd-greeting-date { color: var(--pd-ink-muted); font-size: 13px; margin-top: 4px; }

      .pd-quickadd-btn {
        display: flex; align-items: center; gap: 8px; justify-content: center; background: var(--pd-gradient-btn); color: #fff;
        border: none; border-radius: 10px; padding: 11px 14px; font-size: 14px; font-weight: 500; font-family: 'Inter', sans-serif;
        cursor: pointer;
      }
      .pd-quickadd-btn:hover { background: var(--pd-gradient-btn-hover); }
      .pd-quickadd-btn:focus-visible { outline: 2px solid var(--pd-teal); outline-offset: 2px; }
      .pd-quickadd-btn.pd-inline { width: fit-content; }

      .pd-section-label { font-size: 13px; font-weight: 600; color: var(--pd-ink-muted); }
      .pd-today-list { display: flex; flex-direction: column; gap: 6px; }
      .pd-empty-note { color: var(--pd-ink-muted); font-size: 13px; padding: 6px 0; }

      .pd-task-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px 10px; border-radius: 9px; transition: background 0.15s ease; }
      .pd-task-row:hover { background: var(--pd-bg); }
      .pd-task-row.done .pd-task-title { text-decoration: line-through; color: var(--pd-ink-muted); }

      .pd-checkbox {
        width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--pd-line); background: var(--pd-surface);
        display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; margin-top: 1px;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      .pd-checkbox.checked { background: var(--pd-teal); border-color: var(--pd-teal); }
      .pd-checkbox:focus-visible { outline: 2px solid var(--pd-teal); outline-offset: 2px; }

      .pd-task-body { flex: 1; min-width: 0; }
      .pd-task-title { font-size: 14px; line-height: 1.4; }
      .pd-task-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; font-size: 12px; color: var(--pd-ink-muted); flex-wrap: wrap; }
      .pd-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
      .pd-del-btn { background: none; border: none; cursor: pointer; color: var(--pd-ink-muted); padding: 4px; border-radius: 7px; opacity: 0; transition: opacity 0.12s ease, color 0.12s ease; flex-shrink: 0; }
      .pd-task-row:hover .pd-del-btn { opacity: 1; }
      .pd-del-btn:hover { color: var(--pd-coral); background: var(--pd-coral-soft); }
      .pd-del-btn:focus-visible { outline: 2px solid var(--pd-teal); opacity: 1; }

      .pd-overdue-banner { display: flex; align-items: center; gap: 8px; background: var(--pd-coral-soft); color: var(--pd-coral); padding: 9px 11px; border-radius: 9px; font-size: 12.5px; font-weight: 500; cursor: pointer; border: none; width: 100%; text-align: left; }
      .pd-overdue-banner:hover { background: #F2D9D0; }

      .pd-lock-area { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--pd-line); }
      .pd-lock-toggle { display: flex; align-items: center; gap: 6px; background: none; border: none; color: var(--pd-ink-muted); font-size: 11.5px; cursor: pointer; padding: 4px 2px; font-family: 'Inter', sans-serif; }
      .pd-lock-toggle:hover { color: var(--pd-ink); }
      .pd-lock-row { display: flex; gap: 6px; }
      .pd-lock-row input { flex: 1; border: none; border-radius: 8px; padding: 8px 10px; font-size: 13px; background: var(--pd-bg); color: var(--pd-ink); font-family: 'Inter', sans-serif; }
      .pd-lock-row input:focus-visible, .pd-lock-row input:focus { outline: 2px solid var(--pd-teal); outline-offset: 1px; }
      .pd-lock-hint { font-size: 10.5px; color: var(--pd-ink-muted); margin-top: 6px; line-height: 1.4; }
      .pd-lock-error { font-size: 11.5px; color: var(--pd-coral); margin-top: 6px; }

      .pd-main { padding: 26px 30px; display: flex; flex-direction: column; gap: 24px; overflow: auto; }
      .pd-cal-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
      .pd-cal-title { font-family: 'Libre Franklin', sans-serif; font-weight: 600; font-size: 19px; letter-spacing: -0.01em; }
      .pd-cal-nav { display: flex; align-items: center; gap: 4px; }
      .pd-icon-btn { background: none; border: none; border-radius: 8px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--pd-ink); }
      .pd-icon-btn:hover { background: var(--pd-bg); }
      .pd-icon-btn:focus-visible { outline: 2px solid var(--pd-teal); outline-offset: 1px; }
      .pd-today-btn { font-size: 12.5px; font-family: 'Inter', sans-serif; font-weight: 500; border: none; background: var(--pd-bg); border-radius: 8px; padding: 7px 13px; cursor: pointer; color: var(--pd-ink); margin-right: 6px; }
      .pd-today-btn:hover { background: var(--pd-hover); }

      .pd-weekday-row { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 4px; }
      .pd-weekday { text-align: center; font-size: 11.5px; color: var(--pd-ink-muted); font-weight: 500; padding-bottom: 6px; }

      .pd-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
      .pd-cell { aspect-ratio: 1 / 0.82; border: none; border-radius: 9px; background: var(--pd-surface); padding: 6px 6px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; transition: background 0.15s ease, box-shadow 0.15s ease; min-height: 56px; }
      .pd-cell:hover { background: var(--pd-teal-soft); }
      .pd-cell.out { opacity: 0.4; }
      .pd-cell.today { background: linear-gradient(135deg, var(--pd-teal-soft), var(--pd-purple-soft)); }
      .pd-cell.selected { box-shadow: inset 0 0 0 1.5px var(--pd-ink); }
      .pd-cell-num { font-size: 12.5px; font-weight: 500; }
      .pd-cell-dots { display: flex; gap: 3px; flex-wrap: wrap; }

      .pd-week-tg { border: 1px solid var(--pd-line); border-radius: 12px; overflow: hidden; background: var(--pd-surface); }
      .pd-week-tg-row { display: grid; grid-template-columns: 46px repeat(7, 1fr); }
      .pd-week-tg-headerrow { border-bottom: 1px solid var(--pd-line); }
      .pd-week-tg-cornercell { border-right: 1px solid var(--pd-line); }
      .pd-week-tg-cornercell.small { font-size: 9.5px; color: var(--pd-ink-muted); display: flex; align-items: center; justify-content: center; text-align: center; }
      .pd-week-tg-daycell { text-align: center; padding: 8px 2px; cursor: pointer; border-right: 1px solid var(--pd-line); transition: background 0.15s ease; }
      .pd-week-tg-daycell:hover { background: var(--pd-bg); }
      .pd-week-tg-daycell:last-child { border-right: none; }
      .pd-week-tg-daycell.today { background: linear-gradient(135deg, var(--pd-teal-soft), var(--pd-purple-soft)); }
      .pd-week-tg-daycell.selected { box-shadow: inset 0 0 0 1.5px var(--pd-ink); }
      .pd-week-tg-daylabel { font-size: 10.5px; color: var(--pd-ink-muted); }
      .pd-week-tg-daynum { font-size: 15px; font-weight: 600; margin-top: 2px; }

      .pd-week-tg-alldayrow { border-bottom: 1px solid var(--pd-line); min-height: 30px; }
      .pd-week-tg-alldaycell { border-right: 1px solid var(--pd-line); padding: 4px; display: flex; flex-direction: column; gap: 3px; cursor: pointer; }
      .pd-week-tg-alldaycell:last-child { border-right: none; }

      .pd-week-tg-scroll { max-height: 460px; overflow-y: auto; }
      .pd-week-tg-body { display: grid; grid-template-columns: 46px repeat(7, 1fr); }
      .pd-week-tg-hourlabels { border-right: 1px solid var(--pd-line); }
      .pd-week-tg-hourlabel { font-size: 9.5px; color: var(--pd-ink-muted); text-align: right; padding-right: 6px; box-sizing: border-box; border-top: 1px solid var(--pd-line); }
      .pd-week-tg-hourlabel:first-child { border-top: none; }

      .pd-week-tg-daycol { position: relative; border-right: 1px solid var(--pd-line); cursor: pointer; }
      .pd-week-tg-daycol:last-child { border-right: none; }
      .pd-week-tg-daycol.today { background: var(--pd-teal-soft); }
      .pd-week-tg-event { position: absolute; left: 2px; right: 2px; font-size: 10.5px; color: white; border-radius: 5px; padding: 1px 5px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; height: 20px; display: flex; align-items: center; gap: 5px; z-index: 2; }
      .pd-week-tg-event.done { opacity: 0.5; text-decoration: line-through; }
      .pd-week-tg-event-time { font-weight: 600; flex-shrink: 0; }

      .pd-week-chip { display: flex; align-items: center; gap: 4px; font-size: 10.5px; padding: 3px 5px; border-radius: 6px; background: var(--pd-bg); overflow: hidden; }
      .pd-week-chip.done { opacity: 0.5; text-decoration: line-through; }
      .pd-week-chip.assign { background: var(--pd-purple-soft); color: var(--pd-purple); font-weight: 500; }

      .pd-list-section { border-top: 1px solid var(--pd-line); padding-top: 20px; }
      .pd-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
      .pd-list-title { font-family: 'Libre Franklin', sans-serif; font-weight: 600; font-size: 16px; }
      .pd-tabs { display: flex; gap: 4px; background: var(--pd-bg); padding: 3px; border-radius: 10px; }
      .pd-tab { display: flex; align-items: center; font-size: 12.5px; font-family: 'Inter', sans-serif; padding: 6px 12px; border-radius: 7px; border: none; background: transparent; cursor: pointer; color: var(--pd-ink-muted); }
      .pd-tab.active { background: var(--pd-gradient); color: white; }
      .pd-group-heading { font-size: 12.5px; font-weight: 600; color: var(--pd-ink-muted); margin: 14px 0 6px; }
      .pd-group-heading:first-child { margin-top: 0; }
      .pd-mini-assign { display: flex; align-items: center; gap: 8px; font-size: 13.5px; padding: 6px 10px; }

      .pd-view { padding: 26px 30px; }
      .pd-view-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; flex-wrap: wrap; gap: 10px; }
      .pd-view-title { font-family: 'Libre Franklin', sans-serif; font-weight: 700; font-size: 21px; letter-spacing: -0.01em; }

      .pd-diary-shell { display: grid; grid-template-columns: 260px 1fr; gap: 24px; min-height: 460px; }
      @media (max-width: 700px) { .pd-diary-shell { grid-template-columns: 1fr; } }
      .pd-diary-list { display: flex; flex-direction: column; gap: 4px; border-right: 1px solid var(--pd-line); padding-right: 18px; }
      @media (max-width: 700px) { .pd-diary-list { border-right: none; padding-right: 0; } }
      .pd-diary-item { display: flex; align-items: flex-start; gap: 9px; background: none; border: none; text-align: left; padding: 9px 10px; border-radius: 9px; cursor: pointer; }
      .pd-diary-item:hover { background: var(--pd-bg); }
      .pd-diary-item.active { background: var(--pd-teal-soft); }
      .pd-diary-item .pd-dot { margin-top: 6px; }
      .pd-diary-item-date { font-size: 11.5px; color: var(--pd-ink-muted); }
      .pd-diary-item-title { font-size: 13.5px; margin-top: 1px; }
      .pd-diary-detail { padding: 4px 8px; }
      .pd-diary-detail-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
      .pd-diary-detail-date { font-size: 12.5px; color: var(--pd-ink-muted); }
      .pd-diary-detail-title { font-family: 'Libre Franklin', sans-serif; font-weight: 600; font-size: 18px; margin-top: 2px; }
      .pd-diary-detail-content { font-size: 14.5px; line-height: 1.8; white-space: pre-wrap; }

      .pd-notes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
      .pd-note-card { background: var(--pd-surface); border: none; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px; min-height: 130px; }
      .pd-note-card.pinned { box-shadow: inset 3px 0 0 0 var(--pd-amber); }
      .pd-note-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
      .pd-note-title { font-weight: 600; font-size: 14.5px; }
      .pd-pin-btn { background: none; border: none; color: var(--pd-ink-muted); cursor: pointer; padding: 2px; border-radius: 6px; }
      .pd-pin-btn.active { color: var(--pd-amber); }
      .pd-note-content { font-size: 13px; line-height: 1.6; color: var(--pd-ink-muted); flex: 1; white-space: pre-wrap; overflow: hidden; }
      .pd-note-actions { display: flex; gap: 4px; justify-content: flex-end; }

      .pd-assign-list { display: flex; flex-direction: column; gap: 10px; }
      .pd-assign-card { background: var(--pd-surface); border: none; border-radius: 12px; padding: 16px 18px; }
      .pd-assign-card.submitted { opacity: 0.6; }
      .pd-assign-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .pd-assign-title { font-weight: 600; font-size: 14.5px; }
      .pd-assign-course { font-size: 12.5px; color: var(--pd-ink-muted); margin-top: 2px; }
      .pd-assign-actions { display: flex; align-items: center; gap: 6px; }
      .pd-assign-meta { display: flex; align-items: center; gap: 8px; font-size: 12.5px; margin-top: 10px; font-weight: 500; }
      .pd-assign-date { color: var(--pd-ink-muted); font-weight: 400; }
      .pd-assign-bar-track { height: 5px; background: var(--pd-bg); border-radius: 4px; margin-top: 8px; overflow: hidden; }
      .pd-assign-bar-fill { height: 100%; border-radius: 4px; }

      /* gantt */
      .pd-gantt-outer { display: flex; border: 1px solid var(--pd-line); border-radius: 12px; overflow: hidden; background: var(--pd-surface); }
      .pd-gantt-labels { width: 180px; flex-shrink: 0; border-right: 1px solid var(--pd-line); }
      .pd-gantt-labels-header { height: 40px; border-bottom: 1px solid var(--pd-line); }
      .pd-gantt-label-row { height: 34px; display: flex; flex-direction: column; justify-content: center; padding: 0 10px; border-bottom: 1px solid var(--pd-line); }
      .pd-gantt-label-title { font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pd-gantt-label-course { font-size: 10.5px; color: var(--pd-ink-muted); }
      .pd-gantt-scrollarea { overflow-x: auto; flex: 1; }
      .pd-gantt-header { display: flex; height: 40px; border-bottom: 1px solid var(--pd-line); }
      .pd-gantt-daycell { flex-shrink: 0; text-align: center; font-size: 10px; color: var(--pd-ink-muted); padding-top: 4px; border-right: 1px solid var(--pd-line); position: relative; }
      .pd-gantt-month { font-size: 9px; font-weight: 600; position: absolute; top: 2px; left: 2px; color: var(--pd-ink); }
      .pd-gantt-daynum { margin-top: 12px; }
      .pd-gantt-body { position: relative; }
      .pd-gantt-row { height: 34px; border-bottom: 1px solid var(--pd-line); position: relative; }
      .pd-gantt-bar { position: absolute; top: 5px; height: 24px; border-radius: 6px; display: flex; align-items: center; padding: 0 8px; overflow: hidden; white-space: nowrap; font-size: 11px; color: white; font-weight: 500; }
      .pd-gantt-todayline { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--pd-ink); opacity: 0.4; z-index: 2; }

      /* work analytics */
      .pd-stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 22px; }
      .pd-stat-card { background: var(--pd-surface); border: none; border-radius: 12px; padding: 18px; }
      .pd-stat-label { font-size: 12.5px; color: var(--pd-ink-muted); }
      .pd-stat-value {
        font-family: 'Libre Franklin', sans-serif; font-weight: 700; font-size: 30px; margin-top: 4px; letter-spacing: -0.01em;
        background: var(--pd-gradient); -webkit-background-clip: text; background-clip: text; color: transparent;
      }
      .pd-stat-sub { font-size: 12px; color: var(--pd-ink-muted); margin-top: 2px; }
      .pd-chart-card { background: var(--pd-surface); border: none; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
      .pd-chart-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
      .pd-chart-title { font-family: 'Libre Franklin', sans-serif; font-weight: 600; font-size: 14.5px; }

      .pd-overlay { position: absolute; inset: 0; background: rgba(33,37,44,0.32); display: flex; align-items: center; justify-content: center; z-index: 10; padding: 20px; }
      .pd-panel { background: var(--pd-surface); border-radius: 16px; padding: 24px; width: 100%; max-width: 380px; border: none; box-shadow: 0 12px 32px rgba(33,37,44,0.16); max-height: 88vh; overflow: auto; position: relative; }
      .pd-panel::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 5px; border-radius: 16px 16px 0 0; background: var(--pd-gradient); }
      .pd-panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
      .pd-panel-title { font-family: 'Libre Franklin', sans-serif; font-weight: 600; font-size: 16px; }
      .pd-field { margin-bottom: 14px; }
      .pd-field label { display: block; font-size: 12.5px; color: var(--pd-ink-muted); margin-bottom: 5px; }
      .pd-field input[type="text"], .pd-field input[type="date"], .pd-field input[type="time"], .pd-field textarea {
        width: 100%; border: none; border-radius: 9px; padding: 10px 11px; font-size: 14px;
        font-family: 'Inter', sans-serif; background: var(--pd-bg); color: var(--pd-ink); resize: vertical;
      }
      .pd-field input:focus-visible, .pd-field input:focus, .pd-field textarea:focus-visible, .pd-field textarea:focus { outline: 2px solid var(--pd-teal); outline-offset: 1px; }
      .pd-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .pd-cat-row { display: flex; gap: 6px; }
      .pd-cat-btn { flex: 1; font-size: 12.5px; padding: 8px 6px; border-radius: 8px; border: none; background: var(--pd-bg); cursor: pointer; color: var(--pd-ink-muted); font-family: 'Inter', sans-serif; transition: background 0.15s ease, color 0.15s ease; }
      .pd-cat-btn.active { font-weight: 600; }
      .pd-panel-actions { display: flex; gap: 8px; margin-top: 20px; }
      .pd-btn-primary { flex: 1; background: var(--pd-gradient-btn); color: #fff; border: none; border-radius: 9px; padding: 11px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: 'Inter', sans-serif; }
      .pd-btn-primary:hover { background: var(--pd-gradient-btn-hover); }
      .pd-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
      .pd-btn-secondary { background: var(--pd-bg); color: var(--pd-ink); border: none; border-radius: 9px; padding: 11px 14px; font-size: 14px; cursor: pointer; font-family: 'Inter', sans-serif; }
      .pd-btn-secondary:hover { background: var(--pd-hover); }
      .pd-btn-secondary.pd-small { padding: 7px 11px; font-size: 12.5px; }

      .pd-save-warning-fixed { position: absolute; bottom: 10px; right: 14px; font-size: 11.5px; color: var(--pd-coral); background: var(--pd-coral-soft); padding: 5px 10px; border-radius: 7px; }

      .pd-sync-desc { font-size: 12.5px; color: var(--pd-ink-muted); line-height: 1.6; margin: 0 0 16px; }
      .pd-sync-message { font-size: 12.5px; color: var(--pd-teal); background: var(--pd-teal-soft); padding: 8px 10px; border-radius: 8px; margin-top: 4px; margin-bottom: 4px; }
      .pd-sync-message.error { color: var(--pd-coral); background: var(--pd-coral-soft); }
      .pd-sync-connected { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--pd-line); }
    `}</style>
  );
}
