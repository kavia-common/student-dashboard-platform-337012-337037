import { render, screen, within } from "@testing-library/react";
import App from "./App";

test("renders student dashboard shell", () => {
  render(<App />);

  // Brand/title should exist.
  // Note: the UI renders this as a <strong> inside an element with aria-label="App brand",
  // not as a semantic heading, so we assert on accessible text within that region.
  const brand = screen.getByLabelText(/app brand/i);
  expect(within(brand).getByText(/student dashboard/i)).toBeInTheDocument();

  // Sidebar nav item should exist (avoid ambiguous "Profile" text elsewhere in the UI).
  const sidebarNav = screen.getByRole("navigation", { name: /sections/i });
  expect(
    within(sidebarNav).getByRole("button", { name: /^profile/i })
  ).toBeInTheDocument();
});
