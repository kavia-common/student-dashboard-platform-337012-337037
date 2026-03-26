/**
 * Mock data for the student dashboard.
 * Dates are represented as ISO strings.
 */

function isoDatePlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

function isoDateAtStartPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

// PUBLIC_INTERFACE
export function getDefaultDashboardData() {
  /** Returns the initial dashboard dataset used by the app. */
  const profile = {
    id: "stu_1001",
    name: "Alex Johnson",
    program: "Computer Science",
    year: "Sophomore",
    email: "alex.johnson@university.edu",
    advisor: "Dr. Rivera",
    gpa: 3.68,
  };

  const classes = [
    { id: "c1", code: "CS 240", name: "Data Structures", instructor: "Prof. Kim", schedule: "Mon/Wed 10:00–11:15", location: "Room 204", term: "Spring 2026" },
    { id: "c2", code: "MATH 221", name: "Discrete Mathematics", instructor: "Dr. Patel", schedule: "Tue/Thu 9:30–10:45", location: "Hall B", term: "Spring 2026" },
    { id: "c3", code: "ENG 110", name: "Academic Writing", instructor: "Prof. Nguyen", schedule: "Mon 13:00–15:45", location: "Room 118", term: "Spring 2026" },
    { id: "c4", code: "HIST 205", name: "Modern World History", instructor: "Dr. Moreno", schedule: "Fri 11:00–12:15", location: "Room 307", term: "Spring 2026" },
  ];

  const assignments = [
    { id: "a1", classId: "c1", title: "Linked Lists Lab", dueDate: isoDatePlusDays(2), status: "In Progress", points: 20 },
    { id: "a2", classId: "c2", title: "Set Theory Problem Set", dueDate: isoDatePlusDays(4), status: "Not Started", points: 30 },
    { id: "a3", classId: "c3", title: "Draft: Research Outline", dueDate: isoDatePlusDays(1), status: "Submitted", points: 25 },
    { id: "a4", classId: "c1", title: "Binary Trees Quiz Prep", dueDate: isoDatePlusDays(6), status: "Not Started", points: 10 },
    { id: "a5", classId: "c4", title: "Primary Source Reflection", dueDate: isoDatePlusDays(8), status: "Not Started", points: 15 },
  ];

  const grades = [
    { id: "g1", classId: "c1", item: "Quiz 1", score: 18, outOf: 20, date: isoDatePlusDays(-10) },
    { id: "g2", classId: "c2", item: "Homework 1", score: 28, outOf: 30, date: isoDatePlusDays(-7) },
    { id: "g3", classId: "c3", item: "Essay Draft", score: 23, outOf: 25, date: isoDatePlusDays(-3) },
    { id: "g4", classId: "c4", item: "Short Quiz", score: 9, outOf: 10, date: isoDatePlusDays(-2) },
  ];

  const calendarEvents = [
    { id: "e1", type: "Class", title: "CS 240 - Lecture", at: isoDateAtStartPlusDays(0), classId: "c1" },
    { id: "e2", type: "Office Hours", title: "Discrete Math OH", at: isoDateAtStartPlusDays(1), classId: "c2" },
    { id: "e3", type: "Assignment Due", title: "Draft: Research Outline due", at: isoDatePlusDays(1), classId: "c3" },
    { id: "e4", type: "Study Session", title: "Data Structures group study", at: isoDateAtStartPlusDays(3), classId: "c1" },
  ];

  const notifications = [
    { id: "n1", title: "New grade posted", body: "Quiz 1 score is available for CS 240.", time: isoDatePlusDays(-1), read: false, kind: "Grades" },
    { id: "n2", title: "Assignment reminder", body: "Linked Lists Lab is due in 2 days.", time: isoDatePlusDays(0), read: false, kind: "Assignments" },
    { id: "n3", title: "Class update", body: "Room change for HIST 205 this Friday.", time: isoDatePlusDays(-2), read: true, kind: "Classes" },
  ];

  return {
    profile,
    classes,
    assignments,
    grades,
    calendarEvents,
    notifications,
  };
}
