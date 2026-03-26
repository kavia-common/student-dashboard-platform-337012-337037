import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { getDefaultDashboardData } from "./data/mockData";
import { loadFromStorage, saveToStorage } from "./utils/storage";
import {
  assignmentStatusPill,
  calcGradePercent,
  formatDateTime,
  formatShortDate,
  includesQuery,
} from "./utils/dashboard";

const STORAGE_KEY = "dashboard_state_v1";

const SECTIONS = [
  { key: "profile", label: "Profile", desc: "Overview and details", icon: "👤" },
  { key: "classes", label: "Classes", desc: "Schedule & instructors", icon: "📚" },
  { key: "assignments", label: "Assignments", desc: "Due dates & status", icon: "✅" },
  { key: "grades", label: "Grades", desc: "Scores & progress", icon: "📈" },
  { key: "calendar", label: "Calendar", desc: "Upcoming events", icon: "🗓️" },
  { key: "notifications", label: "Notifications", desc: "Updates & reminders", icon: "🔔" },
];

// PUBLIC_INTERFACE
function App() {
  /** Student dashboard app (mock data + optional localStorage persistence). */

  const [activeSection, setActiveSection] = useState("profile");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [persistEnabled, setPersistEnabled] = useState(
    loadFromStorage("persist_enabled", true)
  );

  const [data, setData] = useState(() => {
    const fallback = getDefaultDashboardData();
    if (!loadFromStorage("persist_enabled", true)) return fallback;
    return loadFromStorage(STORAGE_KEY, fallback);
  });

  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState("all");
  const [notificationFilter, setNotificationFilter] = useState("all"); // all|unread|read

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

  const filteredNotifications = useMemo(() => {
    return data.notifications
      .filter((n) =>
        notificationFilter === "all"
          ? true
          : notificationFilter === "unread"
          ? !n.read
          : n.read
      )
      .filter((n) => includesQuery(n.title, query) || includesQuery(n.body, query))
      .sort((a, b) => new Date(b.time) - new Date(a.time));
  }, [data.notifications, notificationFilter, query]);

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
  const resetToMockData = () => {
    /** Resets dashboard state to default mock data (and clears persisted state). */
    const fresh = getDefaultDashboardData();
    setData(fresh);
    saveToStorage(STORAGE_KEY, fresh);
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
    () => [{ id: "all", label: "All classes" }].concat(
      data.classes.map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` }))
    ),
    [data.classes]
  );

  return (
    <div className="appShell">
      <aside className={`sidebar ${sidebarOpen ? "sidebarOpen" : ""}`} aria-label="Sidebar navigation">
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
                <span className="navIcon" aria-hidden="true">{s.icon}</span>
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
              <span className="searchIcon" aria-hidden="true">⌕</span>
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
                      </>
                    ) : null}

                    <span className="muted" style={{ marginLeft: "auto" }}>
                      Tip: changes persist when “Persist” is On.
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {activeSection === "profile" ? (
              <ProfilePanel profile={data.profile} />
            ) : null}

            {activeSection === "classes" ? (
              <ClassesPanel classes={filteredClasses} />
            ) : null}

            {activeSection === "assignments" ? (
              <AssignmentsPanel
                assignments={filteredAssignments}
                classesById={classesById}
                onToggleStatus={toggleAssignmentStatus}
              />
            ) : null}

            {activeSection === "grades" ? (
              <GradesPanel grades={filteredGrades} classesById={classesById} />
            ) : null}

            {activeSection === "calendar" ? (
              <CalendarPanel events={filteredEvents} classesById={classesById} />
            ) : null}

            {activeSection === "notifications" ? (
              <NotificationsPanel
                notifications={filteredNotifications}
                onMarkRead={markNotificationRead}
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
                <p>{profile.program} · {profile.year}</p>
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

function AssignmentsPanel({ assignments, classesById, onToggleStatus }) {
  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <h2>Assignments</h2>
          <p>Track deadlines and progress</p>
        </div>
        <span className="pill">{assignments.length} shown</span>
      </div>
      <div className="cardBody">
        {assignments.length === 0 ? (
          <div className="emptyState">No assignments match your filters.</div>
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
                        <button
                          className="btn btnPrimary"
                          onClick={() => onToggleStatus(a.id)}
                          aria-label={`Toggle status for ${a.title}`}
                        >
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

  return (
    <div className="grid">
      <div className="card">
        <div className="cardHeader">
          <div>
            <h2>Grades</h2>
            <p>Recent graded items</p>
          </div>
          <span className="pill pillGreen">Avg {average}%</span>
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
                      <td><strong>{g.item}</strong></td>
                      <td><span className="pill">{cls?.code ?? "—"}</span></td>
                      <td>{formatShortDate(g.date)}</td>
                      <td>{g.score} / {g.outOf}</td>
                      <td>
                        <span className={`pill ${pct >= 90 ? "pillGreen" : pct >= 75 ? "pillBlue" : pct >= 60 ? "pillAmber" : "pillRed"}`}>
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

function CalendarPanel({ events, classesById }) {
  // Create a tiny "week view" grid (today + next 6 days).
  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

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

  return (
    <div className="grid">
      <div className="card">
        <div className="cardHeader">
          <div>
            <h2>Calendar</h2>
            <p>Week view (today + 6 days)</p>
          </div>
          <span className="pill">{events.length} matching events</span>
        </div>
        <div className="cardBody">
          <div className="calendarGrid" aria-label="Calendar week grid">
            {days.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const dayEvents = eventsByDayKey.get(key) ?? [];
              return (
                <div className="calendarCell" key={key}>
                  <div className="calendarCellHeader">
                    <span>
                      {d.toLocaleDateString(undefined, { weekday: "short" })}
                    </span>
                    <span>{d.getDate()}</span>
                  </div>

                  {dayEvents.length === 0 ? (
                    <div className="muted" style={{ marginTop: 8 }}>
                      No events
                    </div>
                  ) : (
                    <div className="list" style={{ marginTop: 8, gap: 8 }}>
                      {dayEvents.slice(0, 3).map((e) => {
                        const cls = e.classId ? classesById.get(e.classId) : null;
                        return (
                          <div key={e.id} className="pill" title={formatDateTime(e.at)}>
                            <span className="calendarDot" aria-hidden="true" />
                            {e.type}: {e.title}
                            {cls ? <span className="muted"> · {cls.code}</span> : null}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 ? (
                        <div className="muted">+{dayEvents.length - 3} more</div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div>
            <h2>Upcoming (list)</h2>
            <p>All matching events ordered by time</p>
          </div>
        </div>
        <div className="cardBody">
          {events.length === 0 ? (
            <div className="emptyState">No upcoming events match your filters.</div>
          ) : (
            <div className="list" aria-label="Upcoming events list">
              {events.map((e) => {
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
    </div>
  );
}

function NotificationsPanel({ notifications, onMarkRead }) {
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <h2>Notifications</h2>
          <p>Mark updates as read/unread</p>
        </div>
        <span className={`pill ${unread > 0 ? "pillRed" : "pillGreen"}`}>
          {unread} unread
        </span>
      </div>
      <div className="cardBody">
        {notifications.length === 0 ? (
          <div className="emptyState">No notifications match your filters.</div>
        ) : (
          <div className="list" aria-label="Notifications list">
            {notifications.map((n) => (
              <div key={n.id} className="listItem">
                <div>
                  <strong>
                    {n.title}{" "}
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
      </div>
    </div>
  );
}

export default App;
