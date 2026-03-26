import { render, screen, within } from "@testing-library/react";
import App from "./App";

test("renders student dashboard shell", () => {
  render(<App />);

  // Brand/title should exist.
  expect(
    screen.getByRole("heading", { name: /student dashboard/i })
  ).toBeInTheDocument();

  // Sidebar nav item should exist (avoid ambiguous "Profile" text elsewhere in the UI).
  const sidebarNav = screen.getByRole("navigation", { name: /sections/i });
  expect(
    within(sidebarNav).getByRole("button", { name: /^profile/i })
  ).toBeInTheDocument();
});
