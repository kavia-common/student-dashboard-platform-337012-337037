import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { getDefaultDashboardData } from "./data/mockData";
import { loadFromStorage, saveToStorage } from "./utils/storage";
import { applyTheme, loadInitialTheme, toggleTheme } from "./utils/theme";
import {
  assignmentStatusPill,
  calcGradePercent,
  formatDateTime,
  formatShortDate,
  includesQuery,
} from "./utils/dashboard";
import { downloadCsv } from "./utils/csv";
import {
  buildNumericTrendSeries,
  buildWeeklySeriesFromDates,
  calcGpaFromGradePercents,
  calcTrendDelta,
} from "./utils/analytics";
import Sparkline from "./components/Sparkline";

const STORAGE_KEY = "dashboard_state_v1";

const SECTIONS = [
  { key: "profile", label: "Profile", desc: "Overview and details", icon: "👤" },
  { key: "classes", label: "Classes", desc: "Schedule & instructors", icon: "📚" },
  { key: "assignments", label: "Assignments", desc: "Due dates & status", icon: "✅" },
  { key: "grades", label: "Grades", desc: "Scores & progress", icon: "📈" },
  { key: "analytics", label: "Analytics", desc: "Trends & insights", icon: "🧠" },
  { key: "calendar", label: "Calendar", desc: "Month view & events", icon: "🗓️" },
  {
    key: "notifications",
    label: "Notifications",
    desc: "Updates, reminders & preferences",
    icon: "🔔",
  },
];

// Notification categories used by the dashboard.
// (Mock notifications use "kind"; we normalize it into these category keys.)
const NOTIFICATION_CATEGORIES = [
  { key: "assignments", label: "Assignments", desc: "Due dates and reminders" },
  { key: "grades", label: "Grades", desc: "New grades and feedback" },
  { key: "classes", label: "Classes", desc: "Schedule and room changes" },
  { key: "calendar", label: "Calendar", desc: "Events and study blocks" },
  { key: "system", label: "System", desc: "Product updates and account messages" },
];

const DEFAULT_NOTIFICATION_PREFERENCES = {
  // Per-category "enabled" toggles
  categories: {
    assignments: true,
    grades: true,
    classes: true,
    calendar: true,
    system: true,
  },

  // Channels (UI only; no real push/email integration in this mock dashboard)
  channels: {
    inApp: true,
    email: false,
    sms: false,
  },

  // Optional "quiet hours" (UI-only behavior: used to show status and example gating)
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "07:00",
  },
};

function normalizeNotificationCategory(kind) {
  const k = String(kind ?? "").trim().toLowerCase();
  if (k.includes("assign")) return "assignments";
  if (k.includes("grade")) return "grades";
  if (k.includes("class")) return "classes";
  if (k.includes("calendar")) return "calendar";
  return "system";
}

// PUBLIC_INTERFACE
function App() {
  /** Student dashboard app (mock data + optional localStorage persistence). */

  const [activeSection, setActiveSection] = useState("profile");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Theme is always persisted independently (even when "Persist" is off),
  // matching typical user expectations. This uses the same defensive storage helper.
  const [theme, setTheme] = useState(() => loadInitialTheme());

  const [persistEnabled, setPersistEnabled] = useState(
    loadFromStorage("persist_enabled", true)
  );

  const [data, setData] = useState(() => {
    const fallback = getDefaultDashboardData();
    const withPrefs = {
      ...fallback,
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    };

    if (!loadFromStorage("persist_enabled", true)) return withPrefs;

    // Back-compat: older persisted states won't include preferences
    const loaded = loadFromStorage(STORAGE_KEY, withPrefs);
    return {
      ...withPrefs,
      ...loaded,
      notificationPreferences: {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(loaded?.notificationPreferences ?? {}),
        categories: {
          ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
          ...(loaded?.notificationPreferences?.categories ?? {}),
        },
        channels: {
          ...DEFAULT_NOTIFICATION_PREFERENCES.channels,
          ...(loaded?.notificationPreferences?.channels ?? {}),
        },
        quietHours: {
          ...DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
          ...(loaded?.notificationPreferences?.quietHours ?? {}),
        },
      },
    };
  });

  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState("all");
  const [notificationFilter, setNotificationFilter] = useState("all"); // all|unread|read
  const [notificationCategoryFilter, setNotificationCategoryFilter] =
    useState("all"); // all|assignments|grades|classes|calendar|system

  // Apply theme to the document and persist it.
  useEffect(() => {
    applyTheme(theme, { persist: true });
  }, [theme]);

  // Persist preference and data if enabled.
  useEffect(() => {
    saveToStorage("persist_enabled", persistEnabled);
  }, [persistEnabled]);

  useEffect(() => {
    if (!persistEnabled) return;
    saveToStorage(STORAGE_KEY, data);
  }, [persistEnabled, data]);

  const classesById = useMemo(() => {
    const map = new Map();
    for (const c of data.classes) map.set(c.id, c);
    return map;
  }, [data.classes]);

  const unreadCount = useMemo(
    () => data.notifications.filter((n) => !n.read).length,
    [data.notifications]
  );

  const activeSectionMeta = useMemo(
    () => SECTIONS.find((s) => s.key === activeSection) ?? SECTIONS[0],
    [activeSection]
  );

  const filteredAssignments = useMemo(() => {
    return data.assignments
      .filter((a) => (classFilter === "all" ? true : a.classId === classFilter))
      .filter((a) =>
        assignmentStatusFilter === "all"
          ? true
          : String(a.status).toLowerCase() === assignmentStatusFilter
      )
      .filter((a) => {
        const cls = classesById.get(a.classId);
        return (
          includesQuery(a.title, query) ||
          includesQuery(cls?.name, query) ||
          includesQuery(cls?.code, query)
        );
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [
    data.assignments,
    classFilter,
    assignmentStatusFilter,
    query,
    classesById,
  ]);

  const filteredClasses = useMemo(() => {
    return data.classes.filter((c) => {
      return (
        includesQuery(c.name, query) ||
        includesQuery(c.code, query) ||
        includesQuery(c.instructor, query)
      );
    });
  }, [data.classes, query]);

  const filteredGrades = useMemo(() => {
    return data.grades
      .filter((g) => (classFilter === "all" ? true : g.classId === classFilter))
      .filter((g) => {
        const cls = classesById.get(g.classId);
        return (
          includesQuery(g.item, query) ||
          includesQuery(cls?.name, query) ||
          includesQuery(cls?.code, query)
        );
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [data.grades, classFilter, query, classesById]);

  const filteredEvents = useMemo(() => {
    return data.calendarEvents
      .filter((e) => (classFilter === "all" ? true : e.classId === classFilter))
      .filter((e) => {
        const cls = e.classId ? classesById.get(e.classId) : null;
        return (
          includesQuery(e.title, query) ||
          includesQuery(e.type, query) ||
          includesQuery(cls?.name, query) ||
          includesQuery(cls?.code, query)
        );
      })
      .sort((a, b) => new Date(a.at) - new Date(b.at));
  }, [data.calendarEvents, classFilter, query, classesById]);

  const preferences = data.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES;

  const filteredNotifications = useMemo(() => {
    return data.notifications
      .map((n) => ({
        ...n,
        _category: normalizeNotificationCategory(n.kind),
      }))
      // Apply preferences first (category enabled)
      .filter((n) => Boolean(preferences?.categories?.[n._category] ?? true))
      // Apply view filter
      .filter((n) =>
        notificationFilter === "all"
          ? true
          : notificationFilter === "unread"
          ? !n.read
          : n.read
      )
      // Apply category filter dropdown
      .filter((n) =>
        notificationCategoryFilter === "all"
          ? true
          : n._category === notificationCategoryFilter
      )
      // Global search
      .filter((n) => includesQuery(n.title, query) || includesQuery(n.body, query))
      .sort((a, b) => new Date(b.time) - new Date(a.time));
  }, [
    data.notifications,
    notificationFilter,
    notificationCategoryFilter,
    query,
    preferences,
  ]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const c of NOTIFICATION_CATEGORIES) counts[c.key] = { total: 0, unread: 0 };

    for (const n of data.notifications) {
      const cat = normalizeNotificationCategory(n.kind);
      if (!counts[cat]) counts[cat] = { total: 0, unread: 0 };
      counts[cat].total += 1;
      if (!n.read) counts[cat].unread += 1;
    }
    return counts;
  }, [data.notifications]);

  // PUBLIC_INTERFACE
  const markNotificationRead = (id, read) => {
    /** Marks a notification as read/unread. */
    setData((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, read } : n
      ),
    }));
  };

  // PUBLIC_INTERFACE
  const toggleAssignmentStatus = (id) => {
    /** Simple status toggle for demo purposes. */
    setData((prev) => {
      const next = prev.assignments.map((a) => {
        if (a.id !== id) return a;
        const order = ["Not Started", "In Progress", "Submitted"];
        const idx = Math.max(0, order.indexOf(a.status));
        return { ...a, status: order[(idx + 1) % order.length] };
      });
      return { ...prev, assignments: next };
    });
  };

  // PUBLIC_INTERFACE
  const createAssignment = (draft) => {
    /** Creates an assignment and adds it to dashboard state (persists via existing state persistence). */
    const safeId =
      (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
      `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const nextAssignment = {
      id: safeId,
      classId: draft.classId,
      title: draft.title,
      dueDate: draft.dueDate,
      status: draft.status,
      points: draft.points,
    };

    setData((prev) => ({
      ...prev,
      assignments: [nextAssignment, ...prev.assignments],
    }));
  };

  // PUBLIC_INTERFACE
  const updateAssignment = (id, patch) => {
    /** Updates an existing assignment by id. */
    setData((prev) => ({
      ...prev,
      assignments: prev.assignments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  // PUBLIC_INTERFACE
  const deleteAssignment = (id) => {
    /** Deletes an assignment by id. */
    setData((prev) => ({
      ...prev,
      assignments: prev.assignments.filter((a) => a.id !== id),
    }));
  };

  // PUBLIC_INTERFACE
  const addCalendarEvent = (event) => {
    /** Adds a calendar event to the dashboard state (and persists if enabled). */
    setData((prev) => ({
      ...prev,
      calendarEvents: [event, ...prev.calendarEvents],
    }));
  };

  // PUBLIC_INTERFACE
  const resetToMockData = () => {
    /** Resets dashboard state to default mock data (and clears persisted state). */
    const fresh = getDefaultDashboardData();
    const withPrefs = {
      ...fresh,
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    };
    setData(withPrefs);
    saveToStorage(STORAGE_KEY, withPrefs);
  };

  // PUBLIC_INTERFACE
  const updateNotificationPreferences = (patch) => {
    /** Update notification preferences (categories/channels/quietHours). */
    setData((prev) => {
      const current = prev.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
      const next = {
        ...current,
        ...patch,
        categories: {
          ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
          ...(current?.categories ?? {}),
          ...(patch?.categories ?? {}),
        },
        channels: {
          ...DEFAULT_NOTIFICATION_PREFERENCES.channels,
          ...(current?.channels ?? {}),
          ...(patch?.channels ?? {}),
        },
        quietHours: {
          ...DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
          ...(current?.quietHours ?? {}),
          ...(patch?.quietHours ?? {}),
        },
      };
      return { ...prev, notificationPreferences: next };
    });
  };

  const closeSidebarOnNav = () => setSidebarOpen(false);

  const kpis = useMemo(() => {
    const dueSoon = data.assignments.filter((a) => {
      const days = (new Date(a.dueDate) - new Date()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 7 && a.status !== "Submitted";
    }).length;

    const submitted = data.assignments.filter((a) => a.status === "Submitted").length;

    const avg = (() => {
      if (data.grades.length === 0) return 0;
      const percents = data.grades.map((g) => calcGradePercent(g.score, g.outOf));
      return Math.round(percents.reduce((a, b) => a + b, 0) / percents.length);
    })();

    const upcomingEvents = data.calendarEvents.filter(
      (e) => new Date(e.at) >= new Date()
    ).length;

    return { dueSoon, submitted, avg, upcomingEvents };
  }, [data.assignments, data.grades, data.calendarEvents]);

  const classOptions = useMemo(
    () =>
      [{ id: "all", label: "All classes" }].concat(
        data.classes.map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` }))
      ),
    [data.classes]
  );

  // --- Analytics (mock-derived) ---
  const analytics = useMemo(() => {
    const gradePercents = data.grades
      .map((g) => calcGradePercent(g.score, g.outOf))
      .filter((p) => Number.isFinite(p));

    // Use provided profile.gpa as "current", but compute an estimate from grades for insight.
    const gpaEstimate = calcGpaFromGradePercents(gradePercents);

    // A mock "GPA history" series: blend historical grade snapshots into a gently varying line.
    // Oldest -> newest, 8 points.
    const gpaHistoryValues = (() => {
      const base = Number(data.profile?.gpa ?? 0) || 0;
      const est = gpaEstimate || base || 0;

      // Deterministic pseudo-variation using grade percents (no randomness).
      const seed = gradePercents.reduce((a, b) => a + b, 0) || 1;
      const wobble = (i) => (((seed * (i + 3)) % 11) - 5) / 100; // [-0.05..0.05]
      const blend = (t) => base * (1 - t) + est * t;

      return Array.from({ length: 8 }).map((_, i) => {
        const t = i / 7;
        const v = blend(t) + wobble(i);
        return Math.max(0, Math.min(4, Number(v.toFixed(2))));
      });
    })();

    const gpaSeries = buildNumericTrendSeries(
      gpaHistoryValues,
      ["8w", "7w", "6w", "5w", "4w", "3w", "2w", "Now"]
    );
    const gpaDelta = calcTrendDelta(gpaSeries);

    const assignmentsCompletedWeekly = buildWeeklySeriesFromDates(
      data.assignments.filter((a) => a.status === "Submitted"),
      (a) => a.dueDate,
      { weeks: 8 }
    );
    const assignmentsDelta = calcTrendDelta(assignmentsCompletedWeekly);

    const gradesPostedWeekly = buildWeeklySeriesFromDates(
      data.grades,
      (g) => g.date,
      { weeks: 8 }
    );
    const gradesDelta = calcTrendDelta(gradesPostedWeekly);

    const notificationsWeekly = buildWeeklySeriesFromDates(
      data.notifications,
      (n) => n.time,
      { weeks: 8 }
    );
    const notifDelta = calcTrendDelta(notificationsWeekly);

    const currentGpa = Number(data.profile?.gpa ?? 0) || 0;

    return {
      currentGpa,
      gpaEstimate,
      gpaSeries,
      gpaDelta,
      assignmentsCompletedWeekly,
      assignmentsDelta,
      gradesPostedWeekly,
      gradesDelta,
      notificationsWeekly,
      notifDelta,
      gradePercents,
    };
  }, [data.profile, data.assignments, data.grades, data.notifications]);

  return (
    <div className="appShell">
      <aside
        className={`sidebar ${sidebarOpen ? "sidebarOpen" : ""}`}
        aria-label="Sidebar navigation"
      >
        <div className="sidebarCard">
          <div className="brand" aria-label="App brand">
            <div className="brandMark" aria-hidden="true" />
            <div className="brandTitle">
              <strong>Student Dashboard</strong>
              <span>Quick overview & planning</span>
            </div>
          </div>

          <nav className="sidebarNav" aria-label="Sections">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                className={`navItem ${activeSection === s.key ? "navItemActive" : ""}`}
                onClick={() => {
                  setActiveSection(s.key);
                  closeSidebarOnNav();
                }}
                aria-current={activeSection === s.key ? "page" : undefined}
              >
                <span className="navIcon" aria-hidden="true">
                  {s.icon}
                </span>
                <span className="navText">
                  <strong>
                    {s.label}{" "}
                    {s.key === "notifications" && unreadCount > 0 ? (
                      <span className="pill pillRed" style={{ marginLeft: 8 }}>
                        {unreadCount} unread
                      </span>
                    ) : null}
                  </strong>
                  <span>{s.desc}</span>
                </span>
              </button>
            ))}
          </nav>

          <div className="sidebarFooter">
            <span className="chip" title="Persistence stores changes in localStorage">
              <span aria-hidden="true">💾</span>
              Persist:{" "}
              <strong style={{ color: "var(--text)" }}>
                {persistEnabled ? "On" : "Off"}
              </strong>
            </span>
            <button
              className="smallBtn"
              onClick={() => setPersistEnabled((p) => !p)}
              aria-label="Toggle local persistence"
            >
              Toggle
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="header" aria-label="Header">
          <div className="headerLeft">
            <button
              className="mobileMenuBtn"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              ☰
            </button>
            <div className="pageTitle">
              <strong>{activeSectionMeta.label}</strong>
              <span>{activeSectionMeta.desc}</span>
            </div>
          </div>

          <div className="headerRight">
            <div className="searchWrap" role="search">
              <span className="searchIcon" aria-hidden="true">
                ⌕
              </span>
              <input
                className="searchInput"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search classes, assignments, grades, notifications…"
                aria-label="Search dashboard"
              />
            </div>

            <button
              className="badgeBtn"
              onClick={() => setActiveSection("notifications")}
              aria-label="Open notifications"
              title="Notifications"
            >
              🔔
              {unreadCount > 0 ? <span className="badgeDot" aria-hidden="true" /> : null}
            </button>

            <button
              className="badgeBtn"
              onClick={() => setTheme((t) => toggleTheme(t))}
              aria-label="Toggle dark mode"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>

            <button className="badgeBtn" onClick={resetToMockData} aria-label="Reset mock data">
              ↺
            </button>
          </div>
        </header>

        <div className="content">
          <section className="grid" aria-label="Dashboard content">
            <div className="card">
              <div className="cardBody">
                <div className="kpiRow" aria-label="Key metrics">
                  <div className="kpi">
                    <div className="kpiLabel">Assignments due soon</div>
                    <div className="kpiValue">{kpis.dueSoon}</div>
                    <div className="muted">Next 7 days (not submitted)</div>
                  </div>
                  <div className="kpi">
                    <div className="kpiLabel">Submitted</div>
                    <div className="kpiValue">{kpis.submitted}</div>
                    <div className="muted">Total completed assignments</div>
                  </div>
                  <div className="kpi">
                    <div className="kpiLabel">Grade average</div>
                    <div className="kpiValue">{kpis.avg}%</div>
                    <div className="muted">Across recent graded items</div>
                  </div>
                  <div className="kpi">
                    <div className="kpiLabel">Upcoming events</div>
                    <div className="kpiValue">{kpis.upcomingEvents}</div>
                    <div className="muted">Calendar entries ahead</div>
                  </div>
                </div>
              </div>
            </div>

            {activeSection !== "profile" ? (
              <div className="card">
                <div className="cardBody">
                  <div className="inputRow" aria-label="Filters">
                    <label className="muted" htmlFor="classFilter">
                      Filter by class
                    </label>
                    <select
                      id="classFilter"
                      className="select"
                      value={classFilter}
                      onChange={(e) => setClassFilter(e.target.value)}
                      aria-label="Class filter"
                    >
                      {classOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>

                    {activeSection === "assignments" ? (
                      <>
                        <label className="muted" htmlFor="statusFilter">
                          Status
                        </label>
                        <select
                          id="statusFilter"
                          className="select"
                          value={assignmentStatusFilter}
                          onChange={(e) => setAssignmentStatusFilter(e.target.value)}
                          aria-label="Assignment status filter"
                        >
                          <option value="all">All</option>
                          <option value="not started">Not Started</option>
                          <option value="in progress">In Progress</option>
                          <option value="submitted">Submitted</option>
                        </select>
                      </>
                    ) : null}

                    {activeSection === "notifications" ? (
                      <>
                        <label className="muted" htmlFor="notifFilter">
                          View
                        </label>
                        <select
                          id="notifFilter"
                          className="select"
                          value={notificationFilter}
                          onChange={(e) => setNotificationFilter(e.target.value)}
                          aria-label="Notification filter"
                        >
                          <option value="all">All</option>
                          <option value="unread">Unread</option>
                          <option value="read">Read</option>
                        </select>

                        <label className="muted" htmlFor="notifCategoryFilter">
                          Category
                        </label>
                        <select
                          id="notifCategoryFilter"
                          className="select"
                          value={notificationCategoryFilter}
                          onChange={(e) => setNotificationCategoryFilter(e.target.value)}
                          aria-label="Notification category filter"
                        >
                          <option value="all">All categories</option>
                          {NOTIFICATION_CATEGORIES.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : null}

                    <span className="muted" style={{ marginLeft: "auto" }}>
                      Tip: changes persist when “Persist” is On.
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {activeSection === "profile" ? <ProfilePanel profile={data.profile} /> : null}

            {activeSection === "classes" ? <ClassesPanel classes={filteredClasses} /> : null}

            {activeSection === "assignments" ? (
              <AssignmentsPanel
                assignments={filteredAssignments}
                classes={data.classes}
                classesById={classesById}
                onToggleStatus={toggleAssignmentStatus}
                onCreate={createAssignment}
                onUpdate={updateAssignment}
                onDelete={deleteAssignment}
              />
            ) : null}

            {activeSection === "grades" ? (
              <GradesPanel grades={filteredGrades} classesById={classesById} />
            ) : null}

            {activeSection === "analytics" ? (
              <AnalyticsPanel
                profile={data.profile}
                analytics={analytics}
                grades={filteredGrades}
                classesById={classesById}
              />
            ) : null}

            {activeSection === "calendar" ? (
              <CalendarPanel
                events={filteredEvents}
                classes={data.classes}
                classesById={classesById}
                onCreateEvent={addCalendarEvent}
              />
            ) : null}

            {activeSection === "notifications" ? (
              <NotificationsPanel
                notifications={filteredNotifications}
                preferences={preferences}
                categories={NOTIFICATION_CATEGORIES}
                categoryCounts={categoryCounts}
                onMarkRead={markNotificationRead}
                onUpdatePreferences={updateNotificationPreferences}
              />
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}

function ProfilePanel({ profile }) {
  return (
    <div className="grid2">
      <div className="card">
        <div className="cardHeader">
          <div>
            <h2>Student</h2>
            <p>Profile snapshot</p>
          </div>
          <span className="pill pillBlue">Active</span>
        </div>
        <div className="cardBody">
          <div className="list">
            <div className="listItem">
              <div>
                <strong>{profile.name}</strong>
                <p>
                  {profile.program} · {profile.year}
                </p>
              </div>
              <span className="pill">ID: {profile.id}</span>
            </div>
            <div className="listItem">
              <div>
                <strong>Email</strong>
                <p>{profile.email}</p>
              </div>
              <span className="pill">Primary</span>
            </div>
            <div className="listItem">
              <div>
                <strong>Advisor</strong>
                <p>{profile.advisor}</p>
              </div>
              <span className="pill">Office Hours</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div>
            <h2>Academic summary</h2>
            <p>At-a-glance metrics</p>
          </div>
          <span className="pill pillGreen">GPA {profile.gpa.toFixed(2)}</span>
        </div>
        <div className="cardBody">
          <div className="emptyState">
            This dashboard uses mock data. Use the sidebar to navigate, search globally from
            the header, and filter per section.
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsPanel({ profile, analytics, grades, classesById }) {
  const gpaPillClass =
    analytics.gpaDelta.direction === "up"
      ? "pillGreen"
      : analytics.gpaDelta.direction === "down"
      ? "pillAmber"
      : "pillBlue";

  const deltaText = (d, suffix = "") =>
    `${d > 0 ? "+" : ""}${Number(d).toFixed(2)}${suffix}`;

  const countDeltaText = (d) => `${d > 0 ? "+" : ""}${d}`;

  const gradeAverage = useMemo(() => {
    if (!analytics.gradePercents.length) return 0;
    const sum = analytics.gradePercents.reduce((a, b) => a + b, 0);
    return Math.round(sum / analytics.gradePercents.length);
  }, [analytics.gradePercents]);

  return (
    <div className="grid">
      <div className="grid2">
        <div className="card">
          <div className="cardHeader">
            <div>
              <h2>GPA</h2>
              <p>Current + 8-week trend (mock-derived)</p>
            </div>
            <span className={`pill ${gpaPillClass}`}>
              {analytics.gpaDelta.direction === "flat"
                ? "Stable"
                : analytics.gpaDelta.direction === "up"
                ? "Trending up"
                : "Trending down"}
            </span>
          </div>
          <div className="cardBody">
            <div className="analyticsTop">
              <div className="analyticsStat">
                <div className="kpiLabel">Current</div>
                <div className="analyticsValue">{analytics.currentGpa.toFixed(2)}</div>
                <div className="muted">From profile</div>
              </div>
              <div className="analyticsStat">
                <div className="kpiLabel">Estimate</div>
                <div className="analyticsValue">{analytics.gpaEstimate.toFixed(2)}</div>
                <div className="muted">From recent grades</div>
              </div>
              <div className="analyticsStat">
                <div className="kpiLabel">Δ week</div>
                <div className="analyticsValue">{deltaText(analytics.gpaDelta.delta, "")}</div>
                <div className="muted">Last point vs prior</div>
              </div>
            </div>

            <div className="sparkWrap">
              <Sparkline
                series={analytics.gpaSeries}
                ariaLabel="GPA 8-week trend chart"
                stroke="var(--primary)"
                fill="rgba(59,130,246,0.10)"
              />
              <div className="sparkAxis" aria-hidden="true">
                <span>8 weeks ago</span>
                <span>Now</span>
              </div>
            </div>

            <div className="analyticsNote">
              <span className="pill">Goal</span>
              <span className="muted">
                Keep above <strong>{Math.max(3.5, Number(profile.gpa ?? 0)).toFixed(2)}</strong>{" "}
                while maintaining workload balance.
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="cardHeader">
            <div>
              <h2>Performance snapshot</h2>
              <p>Grades, completion, and updates</p>
            </div>
            <span className="pill pillBlue">Last 8 weeks</span>
          </div>
          <div className="cardBody">
            <div className="kpiRow kpiRowCompact" aria-label="Analytics KPIs">
              <div className="kpi">
                <div className="kpiLabel">Avg score</div>
                <div className="kpiValue">{gradeAverage}%</div>
                <div className="muted">Based on shown grades</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel">Assignments completed</div>
                <div className="kpiValue">
                  {analytics.assignmentsCompletedWeekly.reduce((a, b) => a + b.value, 0)}
                </div>
                <div className="muted">Δ {countDeltaText(analytics.assignmentsDelta.delta)} this week</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel">Grades posted</div>
                <div className="kpiValue">
                  {analytics.gradesPostedWeekly.reduce((a, b) => a + b.value, 0)}
                </div>
                <div className="muted">Δ {countDeltaText(analytics.gradesDelta.delta)} this week</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel">Notifications</div>
                <div className="kpiValue">
                  {analytics.notificationsWeekly.reduce((a, b) => a + b.value, 0)}
                </div>
                <div className="muted">Δ {countDeltaText(analytics.notifDelta.delta)} this week</div>
              </div>
            </div>

            <div className="grid3" style={{ marginTop: 14 }}>
              <TrendCard
                title="Completion"
                subtitle="Assignments submitted / week"
                series={analytics.assignmentsCompletedWeekly}
                stroke="var(--success)"
                fill="rgba(16,185,129,0.10)"
              />
              <TrendCard
                title="Grades"
                subtitle="Graded items posted / week"
                series={analytics.gradesPostedWeekly}
                stroke="var(--primary-2)"
                fill="rgba(6,182,212,0.10)"
              />
              <TrendCard
                title="Activity"
                subtitle="Notifications / week"
                series={analytics.notificationsWeekly}
                stroke="var(--warning)"
                fill="rgba(245,158,11,0.10)"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div>
            <h2>Recent grades (context)</h2>
            <p>Matches the active class filter</p>
          </div>
          <span className="pill">{grades.length} items</span>
        </div>
        <div className="cardBody">
          {grades.length === 0 ? (
            <div className="emptyState">No grades available for the current filter.</div>
          ) : (
            <table className="table" aria-label="Recent grades table (analytics)">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Class</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Percent</th>
                </tr>
              </thead>
              <tbody>
                {grades.slice(0, 6).map((g) => {
                  const cls = classesById.get(g.classId);
                  const pct = calcGradePercent(g.score, g.outOf);
                  return (
                    <tr key={g.id}>
                      <td>
                        <strong>{g.item}</strong>
                      </td>
                      <td>
                        <span className="pill">{cls?.code ?? "—"}</span>
                      </td>
                      <td>{formatShortDate(g.date)}</td>
                      <td>
                        {g.score} / {g.outOf}
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            pct >= 90
                              ? "pillGreen"
                              : pct >= 75
                              ? "pillBlue"
                              : pct >= 60
                              ? "pillAmber"
                              : "pillRed"
                          }`}
                        >
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="muted" style={{ marginTop: 10 }}>
            Note: Trends are derived from mock data timestamps. With persistence enabled, toggling
            assignment status can affect completion counts over time.
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendCard({ title, subtitle, series, stroke, fill }) {
  const { delta, direction } = calcTrendDelta(series);
  const pillClass =
    direction === "up" ? "pillGreen" : direction === "down" ? "pillAmber" : "pillBlue";

  return (
    <div className="card" style={{ background: "rgba(255,255,255,0.70)" }}>
      <div className="cardHeader">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className={`pill ${pillClass}`}>
          {direction === "flat" ? "0" : delta > 0 ? `+${delta}` : `${delta}`} vs last week
        </span>
      </div>
      <div className="cardBody">
        <div className="sparkWrap">
          <Sparkline series={series} ariaLabel={`${title} trend chart`} stroke={stroke} fill={fill} />
          <div className="sparkAxis" aria-hidden="true">
            <span>Oldest</span>
            <span>Newest</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClassesPanel({ classes }) {
  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <h2>Classes</h2>
          <p>Courses for the current term</p>
        </div>
        <span className="pill">{classes.length} total</span>
      </div>
      <div className="cardBody">
        {classes.length === 0 ? (
          <div className="emptyState">No classes match your search.</div>
        ) : (
          <table className="table" aria-label="Classes table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Instructor</th>
                <th>Schedule</th>
                <th>Location</th>
                <th>Term</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.code}</strong>
                    <div className="muted">{c.name}</div>
                  </td>
                  <td>{c.instructor}</td>
                  <td>{c.schedule}</td>
                  <td>{c.location}</td>
                  <td>{c.term}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AssignmentsPanel({
  assignments,
  classes,
  classesById,
  onToggleStatus,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null); // assignment or null

  const openCreate = () => {
    setEditing(null);
    setEditOpen(true);
  };

  const openEdit = (assignment) => {
    setEditing(assignment);
    setEditOpen(true);
  };

  const close = () => {
    setEditOpen(false);
    setEditing(null);
  };

  // PUBLIC_INTERFACE
  const handleSubmit = (draft) => {
    /** Create or update assignment based on whether an existing assignment is being edited. */
    if (editing) {
      onUpdate(editing.id, draft);
    } else {
      onCreate(draft);
    }
    close();
  };

  // PUBLIC_INTERFACE
  const handleDelete = (id) => {
    /** Deletes an assignment and closes modal if needed. */
    onDelete(id);
    close();
  };

  // PUBLIC_INTERFACE
  const handleExportCsv = () => {
    /** Export the currently shown (already filtered) assignments to CSV. */
    const headers = [
      "Assignment",
      "Class Code",
      "Class Name",
      "Due (ISO)",
      "Due (Formatted)",
      "Status",
      "Points",
    ];

    const rows = assignments.map((a) => {
      const cls = classesById.get(a.classId);
      return [
        a.title,
        cls?.code ?? "",
        cls?.name ?? "",
        a.dueDate,
        formatDateTime(a.dueDate),
        a.status,
        a.points,
      ];
    });

    // Include a short timestamp to make repeat downloads easy to distinguish.
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadCsv({
      filename: `assignments-${stamp}.csv`,
      headers,
      rows,
    });
  };

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <h2>Assignments</h2>
          <p>Track deadlines and progress</p>
        </div>
        <div className="rowActions">
          <span className="pill">{assignments.length} shown</span>
          <button
            className="btn"
            onClick={handleExportCsv}
            aria-label="Export assignments as CSV"
            title="Export the currently shown assignments"
          >
            Export CSV
          </button>
          <button className="btn btnPrimary" onClick={openCreate} aria-label="Create assignment">
            + New assignment
          </button>
        </div>
      </div>
      <div className="cardBody">
        {assignments.length === 0 ? (
          <div className="emptyState">No assignments match your filters. Create one to get started.</div>
        ) : (
          <table className="table" aria-label="Assignments table">
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Class</th>
                <th>Due</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const cls = classesById.get(a.classId);
                const pillClass = assignmentStatusPill(a.status);
                return (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.title}</strong>
                      <div className="muted">{a.points} points</div>
                    </td>
                    <td>
                      <span className="pill">{cls?.code ?? "—"}</span>
                    </td>
                    <td>{formatDateTime(a.dueDate)}</td>
                    <td>
                      <span className={`pill ${pillClass}`}>{a.status}</span>
                    </td>
                    <td>
                      <div className="rowActions">
                        <button className="btn" onClick={() => openEdit(a)} aria-label={`Edit assignment ${a.title}`}>
                          Edit
                        </button>
                        <button className="btn btnPrimary" onClick={() => onToggleStatus(a.id)} aria-label={`Toggle status for ${a.title}`}>
                          Toggle status
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="muted" style={{ marginTop: 10 }}>
          Note: Creating/editing assignments updates dashboard state. If “Persist” is On, changes are saved to localStorage and will remain after refresh.
        </div>
      </div>

      {editOpen ? (
        <AssignmentEditorModal
          assignment={editing}
          classes={classes}
          onCancel={close}
          onSubmit={handleSubmit}
          onDelete={editing ? () => handleDelete(editing.id) : null}
        />
      ) : null}
    </div>
  );
}

function AssignmentEditorModal({ assignment, classes, onCancel, onSubmit, onDelete }) {
  const isEdit = Boolean(assignment);

  const initial = useMemo(() => {
    const fallbackDue = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      d.setHours(23, 59, 0, 0);
      return d.toISOString();
    })();

    return {
      title: String(assignment?.title ?? ""),
      classId: String(assignment?.classId ?? (classes[0]?.id ?? "")),
      dueDate: String(assignment?.dueDate ?? fallbackDue),
      status: String(assignment?.status ?? "Not Started"),
      points: Number(assignment?.points ?? 10),
    };
  }, [assignment, classes]);

  const [title, setTitle] = useState(initial.title);
  const [classId, setClassId] = useState(initial.classId);
  const [date, setDate] = useState(() => toDateInputValue(initial.dueDate));
  const [time, setTime] = useState(() => toTimeInputValue(initial.dueDate, "23:59"));
  const [status, setStatus] = useState(initial.status);
  const [points, setPoints] = useState(String(initial.points));
  const [error, setError] = useState("");

  useEffect(() => {
    if (error) setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, classId, date, time, status, points]);

  const buildDueIso = () => {
    const [hh, mm] = String(time).split(":").map((x) => Number(x));
    const d = new Date(String(date));
    d.setHours(Number.isFinite(hh) ? hh : 23, Number.isFinite(mm) ? mm : 59, 0, 0);
    return d.toISOString();
  };

  const submit = (e) => {
    e.preventDefault();

    const t = String(title || "").trim();
    if (t.length < 2) {
      setError("Please provide an assignment title (at least 2 characters).");
      return;
    }

    if (!classId) {
      setError("Please select a class.");
      return;
    }

    const dueIso = buildDueIso();
    if (!Number.isFinite(new Date(dueIso).getTime())) {
      setError("Please choose a valid due date/time.");
      return;
    }

    const pts = Number(points);
    if (!Number.isFinite(pts) || pts <= 0) {
      setError("Points must be a positive number.");
      return;
    }

    onSubmit({
      title: t,
      classId,
      dueDate: dueIso,
      status,
      points: Math.round(pts),
    });
  };

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-label={isEdit ? "Edit assignment modal" : "Create assignment modal"}>
      <div className="modalCard">
        <div className="modalHeader">
          <div>
            <h3 style={{ margin: 0, fontSize: 14 }}>{isEdit ? "Edit assignment" : "Create assignment"}</h3>
            <p style={{ margin: "6px 0 0 0" }} className="muted">
              {isEdit ? "Update assignment details. Changes apply immediately." : "Add a new assignment to your dashboard."}
            </p>
          </div>
          <button className="btn" onClick={onCancel} aria-label="Close assignment editor modal">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="modalBody">
          <div className="grid2">
            <label className="modalField">
              <span className="muted">Title</span>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Binary Trees Worksheet"
                aria-label="Assignment title"
                autoFocus
              />
            </label>

            <label className="modalField">
              <span className="muted">Class</span>
              <select className="select" value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Assignment class">
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="modalField">
              <span className="muted">Due date</span>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Assignment due date" />
            </label>

            <label className="modalField">
              <span className="muted">Due time</span>
              <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Assignment due time" />
            </label>
          </div>

          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="modalField">
              <span className="muted">Status</span>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Assignment status">
                <option>Not Started</option>
                <option>In Progress</option>
                <option>Submitted</option>
              </select>
            </label>

            <label className="modalField">
              <span className="muted">Points</span>
              <input className="input" type="number" min="1" step="1" value={points} onChange={(e) => setPoints(e.target.value)} aria-label="Assignment points" />
            </label>
          </div>

          {error ? (
            <div className="emptyState" style={{ marginTop: 10, borderColor: "rgba(239,68,68,0.35)" }}>
              {error}
            </div>
          ) : null}

          <div className="modalActions" style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 10 }}>
              {onDelete ? (
                <button
                  type="button"
                  className="btn"
                  onClick={onDelete}
                  aria-label="Delete assignment"
                  style={{
                    borderColor: "rgba(239,68,68,0.35)",
                    background: "rgba(239,68,68,0.06)",
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn" onClick={onCancel} aria-label="Cancel assignment editor">
                Cancel
              </button>
              <button type="submit" className="btn btnPrimary" aria-label="Save assignment">
                {isEdit ? "Save changes" : "Create assignment"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function GradesPanel({ grades, classesById }) {
  const average = useMemo(() => {
    if (grades.length === 0) return 0;
    const percents = grades.map((g) => calcGradePercent(g.score, g.outOf));
    return Math.round(percents.reduce((a, b) => a + b, 0) / percents.length);
  }, [grades]);

  // PUBLIC_INTERFACE
  const handleExportCsv = () => {
    /** Export the currently shown (already filtered) grades to CSV. */
    const headers = [
      "Item",
      "Class Code",
      "Class Name",
      "Date (ISO)",
      "Date (Formatted)",
      "Score",
      "Out Of",
      "Percent",
    ];

    const rows = grades.map((g) => {
      const cls = classesById.get(g.classId);
      const pct = calcGradePercent(g.score, g.outOf);
      return [
        g.item,
        cls?.code ?? "",
        cls?.name ?? "",
        g.date,
        formatShortDate(g.date),
        g.score,
        g.outOf,
        pct,
      ];
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadCsv({
      filename: `grades-${stamp}.csv`,
      headers,
      rows,
    });
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="cardHeader">
          <div>
            <h2>Grades</h2>
            <p>Recent graded items</p>
          </div>

          <div className="rowActions">
            <span className="pill pillGreen">Avg {average}%</span>
            <button
              className="btn"
              onClick={handleExportCsv}
              aria-label="Export grades as CSV"
              title="Export the currently shown grades"
            >
              Export CSV
            </button>
          </div>
        </div>
        <div className="cardBody">
          {grades.length === 0 ? (
            <div className="emptyState">No grades match your filters.</div>
          ) : (
            <table className="table" aria-label="Grades table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Class</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Percent</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((g) => {
                  const cls = classesById.get(g.classId);
                  const pct = calcGradePercent(g.score, g.outOf);
                  return (
                    <tr key={g.id}>
                      <td>
                        <strong>{g.item}</strong>
                      </td>
                      <td>
                        <span className="pill">{cls?.code ?? "—"}</span>
                      </td>
                      <td>{formatShortDate(g.date)}</td>
                      <td>
                        {g.score} / {g.outOf}
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            pct >= 90
                              ? "pillGreen"
                              : pct >= 75
                              ? "pillBlue"
                              : pct >= 60
                              ? "pillAmber"
                              : "pillRed"
                          }`}
                        >
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarPanel({ events, classes, classesById, onCreateEvent }) {
  const todayKey = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.toISOString().slice(0, 10);
  }, []);

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const monthLabel = useMemo(
    () =>
      viewMonth.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [viewMonth]
  );

  const monthDays = useMemo(() => {
    // Build a 6-week grid starting on Sunday.
    const first = new Date(viewMonth);
    first.setDate(1);
    first.setHours(0, 0, 0, 0);

    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay()); // Sunday before/at first day

    return Array.from({ length: 42 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [viewMonth]);

  const eventsByDayKey = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const d = new Date(e.at);
      const key = d.toISOString().slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => new Date(a.at) - new Date(b.at));
      map.set(k, list);
    }
    return map;
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDayKey) return [];
    return eventsByDayKey.get(selectedDayKey) ?? [];
  }, [eventsByDayKey, selectedDayKey]);

  const openCreateForDay = (dayKey) => {
    setSelectedDayKey(dayKey);
    setCreateOpen(true);
  };

  const onPrevMonth = () => {
    setViewMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      d.setDate(1);
      return d;
    });
  };

  const onNextMonth = () => {
    setViewMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      d.setDate(1);
      return d;
    });
  };

  const onGoToday = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    setViewMonth(d);
    setSelectedDayKey(todayKey);
  };

  // PUBLIC_INTERFACE
  const submitNewEvent = (draft) => {
    /** Convert the event draft to the persisted data shape and add it to dashboard state. */
    const safeId =
      (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
      `e_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    onCreateEvent({
      id: safeId,
      type: draft.type,
      title: draft.title,
      at: draft.at,
      classId: draft.classId || null,
    });

    setCreateOpen(false);
  };

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const monthIndex = viewMonth.getMonth();
  const year = viewMonth.getFullYear();

  const upcomingInMonth = useMemo(() => {
    // Keep the list useful: show month events and upcoming beyond month too, but cap it.
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 1);
    return events
      .filter((e) => {
        const d = new Date(e.at);
        return d >= start && d < end;
      })
      .sort((a, b) => new Date(a.at) - new Date(b.at));
  }, [events, monthIndex, year]);

  return (
    <div className="grid">
      <div className="card">
        <div className="cardHeader">
          <div>
            <h2>Calendar</h2>
            <p>Month view (click a day to see events, double click to create)</p>
          </div>
          <div className="rowActions" style={{ alignItems: "center" }}>
            <button className="btn" onClick={onPrevMonth} aria-label="Previous month">
              ←
            </button>
            <span className="pill" aria-label="Current month">
              {monthLabel}
            </span>
            <button className="btn" onClick={onNextMonth} aria-label="Next month">
              →
            </button>
            <button className="btn btnPrimary" onClick={onGoToday} aria-label="Go to today">
              Today
            </button>
          </div>
        </div>

        <div className="cardBody">
          <div className="calendarMonthGrid" aria-label="Calendar month grid">
            {weekdayLabels.map((w) => (
              <div key={w} className="calendarMonthHeaderCell" aria-hidden="true">
                {w}
              </div>
            ))}

            {monthDays.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const inMonth = d.getMonth() === monthIndex;
              const dayEvents = eventsByDayKey.get(key) ?? [];
              const isToday = key === todayKey;
              const isSelected = selectedDayKey === key;

              return (
                <button
                  key={key}
                  type="button"
                  className={`calendarMonthCell ${inMonth ? "" : "calendarMonthCellMuted"} ${
                    isToday ? "calendarMonthCellToday" : ""
                  } ${isSelected ? "calendarMonthCellSelected" : ""}`}
                  onClick={() => setSelectedDayKey(key)}
                  onDoubleClick={() => openCreateForDay(key)}
                  aria-label={`${
                    inMonth ? "" : "Not in month, "
                  }${d.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}. ${dayEvents.length} events.`}
                >
                  <div className="calendarMonthCellTop">
                    <span className="calendarMonthDayNum">{d.getDate()}</span>
                    {dayEvents.length > 0 ? (
                      <span className="pill" style={{ padding: "4px 8px" }}>
                        {dayEvents.length}
                      </span>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>
                        —
                      </span>
                    )}
                  </div>

                  <div className="calendarMonthCellEvents" aria-hidden="true">
                    {dayEvents.slice(0, 2).map((e) => (
                      <div key={e.id} className="calendarMonthEventChip" title={e.title}>
                        <span className="calendarDot" aria-hidden="true" />
                        <span className="calendarMonthEventText">{e.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 2 ? (
                      <div className="calendarMonthMore muted">+{dayEvents.length - 2} more</div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="calendarBottomRow">
            <div className="card" style={{ background: "rgba(255,255,255,0.70)" }}>
              <div className="cardHeader">
                <div>
                  <h2>Day details</h2>
                  <p>
                    {selectedDayKey
                      ? new Date(selectedDayKey).toLocaleDateString(undefined, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Select a day"}
                  </p>
                </div>
                <div className="rowActions">
                  <button
                    className="btn btnPrimary"
                    onClick={() => openCreateForDay(selectedDayKey ?? todayKey)}
                    aria-label="Create event"
                  >
                    + New event
                  </button>
                </div>
              </div>

              <div className="cardBody">
                {!selectedDayKey ? (
                  <div className="emptyState">
                    Click any day in the grid to see events. Double-click a day to create a new event on that date.
                  </div>
                ) : selectedDayEvents.length === 0 ? (
                  <div className="emptyState">No events on this day. Create one to start planning.</div>
                ) : (
                  <div className="list" aria-label="Selected day events list">
                    {selectedDayEvents.map((e) => {
                      const cls = e.classId ? classesById.get(e.classId) : null;
                      return (
                        <div key={e.id} className="listItem">
                          <div>
                            <strong>{e.title}</strong>
                            <p>
                              {e.type} · {formatDateTime(e.at)}
                              {cls ? ` · ${cls.code}` : ""}
                            </p>
                          </div>
                          <span className="pill pillBlue">{e.type}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ background: "rgba(255,255,255,0.70)" }}>
              <div className="cardHeader">
                <div>
                  <h2>This month</h2>
                  <p>Events occurring in {monthLabel}</p>
                </div>
                <span className="pill">{upcomingInMonth.length} events</span>
              </div>
              <div className="cardBody">
                {upcomingInMonth.length === 0 ? (
                  <div className="emptyState">No events in this month (for current filters).</div>
                ) : (
                  <div className="list" aria-label="Month events list">
                    {upcomingInMonth.slice(0, 10).map((e) => {
                      const cls = e.classId ? classesById.get(e.classId) : null;
                      return (
                        <div
                          key={e.id}
                          className="pill"
                          title={formatDateTime(e.at)}
                          style={{ display: "inline-flex", width: "fit-content" }}
                        >
                          <span className="calendarDot" aria-hidden="true" />
                          {formatShortDate(e.at)} · {e.type}: {e.title}
                          {cls ? <span className="muted"> · {cls.code}</span> : null}
                        </div>
                      );
                    })}
                    {upcomingInMonth.length > 10 ? (
                      <div className="muted">+{upcomingInMonth.length - 10} more</div>
                    ) : null}
                  </div>
                )}

                <div className="muted" style={{ marginTop: 10 }}>
                  Note: Creating events updates the dashboard state. If “Persist” is On, events are saved to localStorage and will remain after refresh.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {createOpen ? (
        <CreateEventModal
          initialDayKey={selectedDayKey ?? todayKey}
          classes={classes}
          onCancel={() => setCreateOpen(false)}
          onSubmit={submitNewEvent}
        />
      ) : null}
    </div>
  );
}

function CreateEventModal({ initialDayKey, classes, onCancel, onSubmit }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Study Session");
  const [classId, setClassId] = useState("");
  const [time, setTime] = useState("09:00"); // HH:mm
  const [error, setError] = useState("");

  const initialDate = useMemo(() => {
    const d = new Date(initialDayKey);
    if (!Number.isFinite(d.getTime())) {
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      return t.toISOString().slice(0, 10);
    }
    return d.toISOString().slice(0, 10);
  }, [initialDayKey]);

  const [date, setDate] = useState(initialDate);

  useEffect(() => {
    // Reset error when user edits.
    if (error) setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, type, classId, time, date]);

  const createAtIso = () => {
    // Interpret the chosen date+time in the user's local timezone.
    const [hh, mm] = String(time).split(":").map((x) => Number(x));
    const d = new Date(date);
    d.setHours(Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0, 0, 0);
    return d.toISOString();
  };

  const submit = (e) => {
    e.preventDefault();

    const t = String(title || "").trim();
    if (t.length < 2) {
      setError("Please provide a short event title.");
      return;
    }

    const at = createAtIso();
    if (!Number.isFinite(new Date(at).getTime())) {
      setError("Please select a valid date/time.");
      return;
    }

    onSubmit({
      title: t,
      type,
      classId: classId || null,
      at,
    });
  };

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="Create event modal">
      <div className="modalCard">
        <div className="modalHeader">
          <div>
            <h3 style={{ margin: 0, fontSize: 14 }}>Create event</h3>
            <p style={{ margin: "6px 0 0 0" }} className="muted">
              Add an event to your calendar. Double-click any day to open this quickly.
            </p>
          </div>
          <button className="btn" onClick={onCancel} aria-label="Close create event modal">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="modalBody">
          <div className="grid2">
            <label className="modalField">
              <span className="muted">Title</span>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., CS 240 study block"
                aria-label="Event title"
                autoFocus
              />
            </label>

            <label className="modalField">
              <span className="muted">Type</span>
              <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Event type">
                <option>Class</option>
                <option>Office Hours</option>
                <option>Assignment Due</option>
                <option>Study Session</option>
                <option>Exam</option>
                <option>Personal</option>
              </select>
            </label>
          </div>

          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="modalField">
              <span className="muted">Date</span>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Event date" />
            </label>

            <label className="modalField">
              <span className="muted">Time</span>
              <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Event time" />
            </label>
          </div>

          <div style={{ marginTop: 10 }}>
            <label className="modalField">
              <span className="muted">Class (optional)</span>
              <select className="select" value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Event class association">
                <option value="">None</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <div className="emptyState" style={{ marginTop: 10, borderColor: "rgba(239,68,68,0.35)" }}>
              {error}
            </div>
          ) : null}

          <div className="modalActions">
            <button type="button" className="btn" onClick={onCancel} aria-label="Cancel create event">
              Cancel
            </button>
            <button type="submit" className="btn btnPrimary" aria-label="Save event">
              Save event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NotificationsPanel({
  notifications,
  preferences,
  categories,
  categoryCounts,
  onMarkRead,
  onUpdatePreferences,
}) {
  const unread = notifications.filter((n) => !n.read).length;

  const enabledCategoriesCount = Object.values(preferences?.categories ?? {}).filter(Boolean)
    .length;

  const quietHoursEnabled = Boolean(preferences?.quietHours?.enabled);
  const inQuietHours = useMemo(() => {
    if (!quietHoursEnabled) return false;
    return isNowInQuietHours(preferences.quietHours.start, preferences.quietHours.end);
  }, [quietHoursEnabled, preferences?.quietHours?.start, preferences?.quietHours?.end]);

  // PUBLIC_INTERFACE
  const setCategoryEnabled = (categoryKey, enabled) => {
    /** Enable/disable a single notification category. */
    onUpdatePreferences({
      categories: { [categoryKey]: enabled },
    });
  };

  // PUBLIC_INTERFACE
  const setAllCategories = (enabled) => {
    /** Enable/disable all categories at once. */
    const patch = {};
    for (const c of categories) patch[c.key] = enabled;
    onUpdatePreferences({ categories: patch });
  };

  // PUBLIC_INTERFACE
  const setChannelEnabled = (channelKey, enabled) => {
    /** Enable/disable a notification channel preference. */
    onUpdatePreferences({
      channels: { [channelKey]: enabled },
    });
  };

  return (
    <div className="grid">
      <div className="grid2">
        <div className="card">
          <div className="cardHeader">
            <div>
              <h2>Notification preferences</h2>
              <p>Choose what you want to be notified about</p>
            </div>
            <span className="pill pillBlue">{enabledCategoriesCount} categories on</span>
          </div>

          <div className="cardBody">
            <div className="grid" style={{ gap: 10 }}>
              <div className="split" style={{ alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 13 }}>Categories</strong>
                  <div className="muted">Disable categories to hide/suppress them in the list.</div>
                </div>

                <div className="rowActions" style={{ justifyContent: "flex-end" }}>
                  <button className="btn" onClick={() => setAllCategories(true)} aria-label="Enable all notification categories">
                    Enable all
                  </button>
                  <button className="btn" onClick={() => setAllCategories(false)} aria-label="Disable all notification categories">
                    Disable all
                  </button>
                </div>
              </div>

              <div className="list" aria-label="Notification categories list">
                {categories.map((c) => {
                  const enabled = Boolean(preferences?.categories?.[c.key] ?? true);
                  const counts = categoryCounts?.[c.key] ?? { total: 0, unread: 0 };

                  return (
                    <div key={c.key} className="listItem" style={{ alignItems: "center" }}>
                      <div style={{ minWidth: 0 }}>
                        <strong>
                          {c.label}{" "}
                          <span className="pill" style={{ marginLeft: 8 }}>
                            {counts.total} total
                          </span>
                          {counts.unread > 0 ? (
                            <span className="pill pillRed" style={{ marginLeft: 8 }}>
                              {counts.unread} unread
                            </span>
                          ) : null}
                        </strong>
                        <p>{c.desc}</p>
                      </div>

                      <div className="rowActions" style={{ alignItems: "center" }}>
                        <label className="pill" style={{ cursor: "pointer", userSelect: "none" }}>
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => setCategoryEnabled(c.key, e.target.checked)}
                            aria-label={`Toggle ${c.label} notifications`}
                            style={{ marginRight: 8 }}
                          />
                          {enabled ? "Enabled" : "Disabled"}
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 6 }} className="emptyState">
                <strong>Note:</strong> This dashboard is mock-only. Preferences affect what you see here and persist with “Persist: On”.
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="cardHeader">
            <div>
              <h2>Delivery</h2>
              <p>Channel preferences (mock)</p>
            </div>
            <span className={`pill ${inQuietHours ? "pillAmber" : "pillGreen"}`}>
              {quietHoursEnabled ? (inQuietHours ? "Quiet hours active" : "Quiet hours set") : "No quiet hours"}
            </span>
          </div>

          <div className="cardBody">
            <div className="list" aria-label="Notification delivery settings">
              <div className="listItem" style={{ alignItems: "center" }}>
                <div>
                  <strong>In-app</strong>
                  <p>Show notifications inside the dashboard.</p>
                </div>
                <label className="pill" style={{ cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences?.channels?.inApp ?? true)}
                    onChange={(e) => setChannelEnabled("inApp", e.target.checked)}
                    aria-label="Toggle in-app notifications"
                    style={{ marginRight: 8 }}
                  />
                  {preferences?.channels?.inApp ? "On" : "Off"}
                </label>
              </div>

              <div className="listItem" style={{ alignItems: "center" }}>
                <div>
                  <strong>Email</strong>
                  <p>Receive a copy by email (mock-only toggle).</p>
                </div>
                <label className="pill" style={{ cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences?.channels?.email ?? false)}
                    onChange={(e) => setChannelEnabled("email", e.target.checked)}
                    aria-label="Toggle email notifications"
                    style={{ marginRight: 8 }}
                  />
                  {preferences?.channels?.email ? "On" : "Off"}
                </label>
              </div>

              <div className="listItem" style={{ alignItems: "center" }}>
                <div>
                  <strong>SMS</strong>
                  <p>Text alerts (mock-only toggle).</p>
                </div>
                <label className="pill" style={{ cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences?.channels?.sms ?? false)}
                    onChange={(e) => setChannelEnabled("sms", e.target.checked)}
                    aria-label="Toggle SMS notifications"
                    style={{ marginRight: 8 }}
                  />
                  {preferences?.channels?.sms ? "On" : "Off"}
                </label>
              </div>
            </div>

            <div className="card" style={{ background: "rgba(255,255,255,0.70)", marginTop: 12 }}>
              <div className="cardHeader">
                <div>
                  <h2>Quiet hours</h2>
                  <p>Mute notification delivery in a time window (mock behavior)</p>
                </div>
              </div>
              <div className="cardBody">
                <div className="inputRow" aria-label="Quiet hours controls">
                  <label className="pill" style={{ cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(preferences?.quietHours?.enabled ?? false)}
                      onChange={(e) =>
                        onUpdatePreferences({
                          quietHours: { enabled: e.target.checked },
                        })
                      }
                      aria-label="Enable quiet hours"
                      style={{ marginRight: 8 }}
                    />
                    Enabled
                  </label>

                  <label className="muted" htmlFor="qhStart">
                    Start
                  </label>
                  <input
                    id="qhStart"
                    className="input"
                    type="time"
                    value={String(preferences?.quietHours?.start ?? "22:00")}
                    onChange={(e) =>
                      onUpdatePreferences({
                        quietHours: { start: e.target.value },
                      })
                    }
                    aria-label="Quiet hours start time"
                    disabled={!Boolean(preferences?.quietHours?.enabled)}
                  />

                  <label className="muted" htmlFor="qhEnd">
                    End
                  </label>
                  <input
                    id="qhEnd"
                    className="input"
                    type="time"
                    value={String(preferences?.quietHours?.end ?? "07:00")}
                    onChange={(e) =>
                      onUpdatePreferences({
                        quietHours: { end: e.target.value },
                      })
                    }
                    aria-label="Quiet hours end time"
                    disabled={!Boolean(preferences?.quietHours?.enabled)}
                  />
                </div>

                <div className="muted" style={{ marginTop: 10 }}>
                  When quiet hours are enabled, this panel indicates whether you're currently inside the quiet window. (This demo does not actually schedule pushes/emails.)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div>
            <h2>Notifications</h2>
            <p>Mark updates as read/unread</p>
          </div>
          <span className={`pill ${unread > 0 ? "pillRed" : "pillGreen"}`}>{unread} unread</span>
        </div>
        <div className="cardBody">
          {notifications.length === 0 ? (
            <div className="emptyState">
              No notifications match your filters or enabled categories.
              <div className="muted" style={{ marginTop: 8 }}>
                Tip: turn categories back on in preferences above.
              </div>
            </div>
          ) : (
            <div className="list" aria-label="Notifications list">
              {notifications.map((n) => (
                <div key={n.id} className="listItem">
                  <div style={{ minWidth: 0 }}>
                    <strong>
                      {n.title}{" "}
                      <span className="pill pillBlue" style={{ marginLeft: 8 }}>
                        {String(n._category ?? normalizeNotificationCategory(n.kind))}
                      </span>
                      {!n.read ? (
                        <span className="pill pillRed" style={{ marginLeft: 8 }}>
                          Unread
                        </span>
                      ) : (
                        <span className="pill" style={{ marginLeft: 8 }}>
                          Read
                        </span>
                      )}
                    </strong>
                    <p>
                      {n.body}
                      <span className="muted"> · {formatShortDate(n.time)}</span>
                    </p>
                  </div>
                  <div className="rowActions">
                    <button
                      className="btn btnPrimary"
                      onClick={() => onMarkRead(n.id, !n.read)}
                      aria-label={`Toggle read state for ${n.title}`}
                    >
                      Mark {n.read ? "unread" : "read"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="muted" style={{ marginTop: 10 }}>
            Note: Preferences and read/unread state persist when “Persist” is On.
          </div>
        </div>
      </div>
    </div>
  );
}

function isNowInQuietHours(startHHmm, endHHmm) {
  const parse = (hhmm) => {
    const [hh, mm] = String(hhmm ?? "").split(":").map((x) => Number(x));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return hh * 60 + mm;
  };

  const start = parse(startHHmm);
  const end = parse(endHHmm);
  if (start == null || end == null) return false;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Same-day window
  if (start === end) return true; // full-day mute
  if (start < end) return nowMinutes >= start && nowMinutes < end;

  // Overnight window (e.g., 22:00 -> 07:00)
  return nowMinutes >= start || nowMinutes < end;
}

function toDateInputValue(isoString) {
  const d = new Date(isoString);
  if (!Number.isFinite(d.getTime())) return new Date().toISOString().slice(0, 10);
  const local = new Date(d);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
}

function toTimeInputValue(isoString, fallback = "23:59") {
  const d = new Date(isoString);
  if (!Number.isFinite(d.getTime())) return fallback;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default App;
